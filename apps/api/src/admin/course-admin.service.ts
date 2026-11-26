import { Injectable, Optional } from '@nestjs/common';
import type { CourseLevel } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { CoversService } from '../covers/covers.service';
import { RevisionsService } from '../instructor/revisions.service';
import { PeopleService } from './people.service';
import { activeAccessWhere, daysUntilDeletion, deletionDate, DELETION_RETENTION_DAYS, lifecycle } from './course-lifecycle';

export interface CourseEdit {
  title?: string; subtitle?: string; description?: string; objectives?: string[]; requirements?: string[];
  categoryId?: string | null; level?: CourseLevel; language?: string; priceCents?: number; coverTemplateId?: string | null; reason?: string;
}
const EDITABLE = ['title', 'subtitle', 'description', 'objectives', 'requirements', 'categoryId', 'level', 'language', 'priceCents', 'coverTemplateId'] as const;

/**
 * Super Admin › Courses (owner 2026-11-26, docs/SUPER_ADMIN.md): any course, whoever teaches it. Edit, publish, feature,
 * archive and restore, and the 30-day soft deletion. The instructor stays the owner whatever DEL changes; every action is
 * audited under the real super admin.
 */
@Injectable()
export class CourseAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revisions: RevisionsService,
    private readonly people: PeopleService,
    @Optional() private readonly covers?: CoversService,
  ) {}

  private async find(id: string) {
    const c = await this.prisma.course.findUnique({ where: { id } });
    if (!c) throw notFound('Course');
    return c;
  }

  /** Lifecycle facts for the admin screens (also used by the course list). */
  async state(id: string) {
    const c = await this.find(id);
    const [paidActive, openAccess, latest] = await Promise.all([
      this.prisma.enrollment.count({ where: activeAccessWhere(id) }),
      this.prisma.enrollment.count({ where: { courseId: id, revokedAt: null, accessExpiresAt: null } }),
      this.prisma.enrollment.findFirst({ where: activeAccessWhere(id), orderBy: { accessExpiresAt: 'desc' }, select: { accessExpiresAt: true } }),
    ]);
    return {
      id: c.id, title: c.title, status: c.status, lifecycle: lifecycle(c), featured: !!c.featuredAt, featuredAt: c.featuredAt,
      archivedAt: c.archivedAt, archiveReason: c.archiveReason, deleteRequestedAt: c.deleteRequestedAt, deleteAfter: c.deleteAfter,
      daysLeft: daysUntilDeletion(c), purgedAt: c.purgedAt, statusBeforeArchive: c.statusBeforeArchive,
      learners: { paidAccessRunning: paidActive, accessWithoutEndDate: openAccess, lastPaidAccessEnds: latest?.accessExpiresAt ?? null },
      retentionDays: DELETION_RETENTION_DAYS,
    };
  }

  async edit(a: Actor, id: string, input: CourseEdit) {
    const c = await this.find(id);
    if (c.purgedAt) throw conflict('This course’s content was deleted; it can no longer be edited.', 'course_purged');
    const data: Record<string, unknown> = {};
    for (const k of EDITABLE) if (input[k] !== undefined) data[k] = input[k];
    if (typeof data.title === 'string' && !(data.title as string).trim()) throw badRequest('The title can’t be empty', 'title_required');
    if (data.categoryId && !(await this.prisma.category.findUnique({ where: { id: data.categoryId as string } }))) throw badRequest('Unknown category', 'invalid_category');
    if (data.coverTemplateId && !(await this.prisma.coverTemplate.findUnique({ where: { id: data.coverTemplateId as string } }))) throw badRequest('Unknown cover template', 'invalid_template');
    const changed = Object.keys(data).filter((k) => JSON.stringify((c as Record<string, unknown>)[k]) !== JSON.stringify(data[k]));
    if (!changed.length) return this.state(id);
    await this.prisma.course.update({ where: { id }, data: Object.fromEntries(changed.map((k) => [k, data[k]])) });
    if (changed.some((k) => k === 'title' || k === 'categoryId' || k === 'coverTemplateId')) await this.covers?.ensureCover(id).catch(() => null);
    await this.audit.log({
      actorId: a.user.id, action: 'course.admin_edited', targetType: 'course', targetId: id, ip: a.ip,
      meta: { fields: changed, before: Object.fromEntries(changed.map((k) => [k, (c as Record<string, unknown>)[k]])), after: Object.fromEntries(changed.map((k) => [k, data[k]])), reason: input.reason?.trim() || null, instructorId: c.instructorId },
    });
    return this.state(id);
  }

  /** Publish directly (super admin): any non-archived course that has at least one lesson. */
  async publish(a: Actor, id: string, note?: string) {
    const c = await this.find(id);
    if (c.archivedAt) throw conflict('Restore the course from the archive first.', 'course_archived');
    if (c.status === 'published') return this.state(id);
    const lessons = await this.prisma.lecture.count({ where: { section: { courseId: id } } });
    if (!lessons) throw conflict('A course needs at least one lesson before it can be published.', 'course_empty');
    await this.prisma.course.update({ where: { id }, data: { status: 'published', reviewNote: note?.trim() || null, ...(c.publishedAt ? {} : { publishedAt: new Date() }) } });
    await this.audit.log({ actorId: a.user.id, action: 'course.published_by_admin', targetType: 'course', targetId: id, ip: a.ip, meta: { from: c.status, note: note?.trim() || null } });
    return this.state(id);
  }

  async feature(a: Actor, id: string, on: boolean) {
    const c = await this.find(id);
    if (on && c.status !== 'published') throw conflict('Only a published course can be featured.', 'not_published');
    if (!!c.featuredAt === on) return this.state(id);
    await this.prisma.course.update({ where: { id }, data: { featuredAt: on ? new Date() : null } });
    await this.audit.log({ actorId: a.user.id, action: on ? 'course.featured' : 'course.unfeatured', targetType: 'course', targetId: id, ip: a.ip });
    return this.state(id);
  }

  /** Off the marketplace, kept for later. Enrolled learners keep their access until it ends. */
  async archive(a: Actor, id: string, reason: string) {
    if (!reason.trim()) throw badRequest('Add a reason (it is kept in the course history).', 'reason_required');
    const c = await this.find(id);
    if (c.archivedAt) return this.state(id);
    await this.revisions.closeOpen(id, 'The course was archived', a.user.id);
    await this.prisma.$transaction([
      this.prisma.course.update({ where: { id }, data: { archivedAt: new Date(), archiveReason: reason.trim(), archivedById: a.user.id, statusBeforeArchive: c.status, status: c.status === 'draft' ? 'draft' : 'unpublished', featuredAt: null } }),
      this.prisma.cartItem.deleteMany({ where: { courseId: id } }),
    ]);
    await this.audit.log({ actorId: a.user.id, action: 'course.archived', targetType: 'course', targetId: id, ip: a.ip, meta: { reason: reason.trim(), from: c.status, instructorId: c.instructorId } });
    return this.state(id);
  }

  /** Back to the status it had before (a published course is published again); cancels any scheduled deletion. */
  async restore(a: Actor, id: string) {
    const c = await this.find(id);
    if (c.purgedAt) throw conflict('This course’s content was already deleted and can’t be restored.', 'course_purged');
    if (!c.archivedAt && !c.deleteRequestedAt) return this.state(id);
    const back = c.statusBeforeArchive ?? 'unpublished';
    // Only a course that was live goes live again; a course that was in review goes back to the instructor's draft.
    const status = back === 'in_review' ? 'draft' : back;
    await this.prisma.course.update({ where: { id }, data: { archivedAt: null, archiveReason: null, archivedById: null, statusBeforeArchive: null, deleteRequestedAt: null, deleteAfter: null, status } });
    await this.audit.log({ actorId: a.user.id, action: 'course.restored', targetType: 'course', targetId: id, ip: a.ip, meta: { status, wasDeleting: !!c.deleteRequestedAt } });
    return this.state(id);
  }

  /**
   * Start the deletion: archive now, delete the content after 30 days (and after the last paid year of access ends).
   * Needs the authenticator code and the course title typed back.
   */
  async requestDeletion(a: Actor, id: string, input: { reason: string; confirmTitle: string; code?: string }) {
    const c = await this.find(id);
    if (c.purgedAt) return this.state(id);
    if (input.confirmTitle.trim() !== c.title.trim()) throw badRequest('Type the course title exactly to confirm.', 'confirm_mismatch');
    if (!input.reason.trim()) throw badRequest('Add a reason (it is kept in the course history).', 'reason_required');
    await this.people.stepUp(a, input.code);
    if (!c.archivedAt) await this.archive(a, id, input.reason);
    const now = new Date();
    await this.prisma.course.update({ where: { id }, data: { deleteRequestedAt: now, deleteAfter: deletionDate(now) } });
    await this.audit.log({ actorId: a.user.id, action: 'course.deletion_requested', targetType: 'course', targetId: id, ip: a.ip, meta: { reason: input.reason.trim(), deleteAfter: deletionDate(now).toISOString(), instructorId: c.instructorId } });
    return this.state(id);
  }

  /** Keep the course archived but stop the deletion. */
  async cancelDeletion(a: Actor, id: string) {
    const c = await this.find(id);
    if (c.purgedAt) throw conflict('This course’s content was already deleted.', 'course_purged');
    if (!c.deleteRequestedAt) return this.state(id);
    await this.prisma.course.update({ where: { id }, data: { deleteRequestedAt: null, deleteAfter: null } });
    await this.audit.log({ actorId: a.user.id, action: 'course.deletion_cancelled', targetType: 'course', targetId: id, ip: a.ip });
    return this.state(id);
  }
}
