import { Injectable, Optional } from '@nestjs/common';
import { CoversService } from '../covers/covers.service';
import type { Prisma } from '../generated/prisma/client';
import type { CourseStatus, OrderStatus, Role, UserStatus } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import { Actor, hasRole } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { slugify } from '../common/util';
import { RefundsService } from '../commerce/refunds.service';
import { RevisionsService } from '../instructor/revisions.service';
import { recalcRating } from '../learning/learning.service';
import { MediaService } from '../media/media.service';

type Decision = 'approve' | 'request-changes' | 'reject' | 'unpublish';
const TRANSITIONS: Record<Decision, { from: CourseStatus[]; to: CourseStatus; noteRequired: boolean }> = {
  approve: { from: ['in_review'], to: 'published', noteRequired: false },
  'request-changes': { from: ['in_review'], to: 'changes_requested', noteRequired: true },
  reject: { from: ['in_review'], to: 'rejected', noteRequired: true },
  unpublish: { from: ['published'], to: 'unpublished', noteRequired: true },
};

const page = (p: number, size: number) => ({ skip: (p - 1) * size, take: size });
/** Every paginated admin list returns the same envelope. */
const paged = <T>(items: T[], total: number, q: { page: number; pageSize: number }) => ({ items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.ceil(total / q.pageSize) });

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly refunds: RefundsService,
    private readonly media: MediaService,
    private readonly revisions: RevisionsService,
    @Optional() private readonly covers?: CoversService,
  ) {}

  async stats() {
    const [users, instructors, pendingInstructors, published, inReview, paid, revenue, refunded, enrollments] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.instructorProfile.count({ where: { status: 'approved' } }),
      this.prisma.instructorProfile.count({ where: { status: 'pending' } }),
      this.prisma.course.count({ where: { status: 'published' } }),
      this.prisma.course.count({ where: { status: 'in_review' } }),
      this.prisma.order.count({ where: { status: { in: ['paid', 'partially_refunded'] } } }),
      this.prisma.orderLine.aggregate({ where: { refundedAt: null, order: { status: { in: ['paid', 'partially_refunded'] } } }, _sum: { priceCents: true, instructorShareCents: true } }),
      this.prisma.orderLine.aggregate({ where: { refundedAt: { not: null } }, _sum: { priceCents: true } }),
      this.prisma.enrollment.count({ where: { revokedAt: null } }),
    ]);
    const gross = revenue._sum.priceCents ?? 0;
    const share = revenue._sum.instructorShareCents ?? 0;
    return {
      users,
      instructors,
      pendingInstructors,
      publishedCourses: published,
      coursesInReview: inReview,
      paidOrders: paid,
      enrollments,
      grossRevenueCents: gross,
      instructorEarningsCents: share,
      platformRevenueCents: gross - share,
      refundedCents: refunded._sum.priceCents ?? 0,
    };
  }

  // ---------- courses ----------
  /**
   * New courses waiting for approval (`kind: 'course'`) and changes to published courses (`kind: 'revision'`,
   * with a plain-English `changes` list). Oldest first. `id` is always the course id (decisions use it).
   */
  async reviewQueue() {
    const include = { instructor: { select: { id: true, name: true, email: true } }, category: { select: { name: true } }, _count: { select: { sections: true } } } as const;
    const [courses, revs] = await Promise.all([
      this.prisma.course.findMany({ where: { status: 'in_review' }, orderBy: { updatedAt: 'asc' }, include }),
      this.prisma.courseRevision.findMany({ where: { status: 'in_review' }, orderBy: { submittedAt: 'asc' }, include: { course: { include } } }),
    ]);
    const items = [
      ...courses.map((c) => ({ kind: 'course' as const, id: c.id, slug: c.slug, title: c.title, priceCents: c.priceCents, instructor: c.instructor, category: c.category, submittedAt: c.updatedAt, sections: c._count.sections, revisionId: null, changes: [] as unknown[] })),
      ...(await Promise.all(
        revs.map(async (r) => {
          const c = r.course;
          const summary = await this.revisions.summary(r);
          return { kind: 'revision' as const, id: c.id, slug: c.slug, title: c.title, priceCents: c.priceCents, instructor: c.instructor, category: c.category, submittedAt: r.submittedAt ?? r.updatedAt, sections: c._count.sections, revisionId: r.id, changes: summary.changes as unknown[] };
        }),
      )),
    ].sort((a, b) => +new Date(a.submittedAt) - +new Date(b.submittedAt));
    return { items };
  }

  async courses(q: { status?: CourseStatus; q?: string; page: number; pageSize: number }) {
    const where: Prisma.CourseWhereInput = { status: q.status, ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...page(q.page, q.pageSize),
        include: {
          instructor: { select: { id: true, name: true } },
          _count: { select: { enrollments: { where: { revokedAt: null } } } },
          revisions: { where: { status: { in: ['draft', 'in_review', 'changes_requested'] } }, take: 1, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, submittedAt: true } },
        },
      }),
    ]);
    return paged(
      rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, priceCents: c.priceCents, instructor: c.instructor, students: c._count.enrollments, reviewNote: c.reviewNote, updatedAt: c.updatedAt, publishedAt: c.publishedAt, revision: c.revisions[0] ?? null })),
      total,
      q,
    );
  }

  async course(id: string) {
    const c = await this.prisma.course.findUnique({
      where: { id },
      include: {
        instructor: { select: { id: true, name: true, email: true } },
        category: true,
        sections: {
          orderBy: { position: 'asc' },
          include: {
            lectures: {
              orderBy: { position: 'asc' },
              include: { videoAsset: { select: { status: true, durationSec: true } }, resources: { select: { id: true, title: true, sizeBytes: true } }, quiz: { select: { questions: true } } },
            },
          },
        },
      },
    });
    if (!c) throw notFound('Course');
    const audit = await this.prisma.auditLog.findMany({ where: { targetType: 'course', targetId: id }, orderBy: { at: 'desc' }, take: 50 });
    // Changes to a published course: the summary plus the full proposed tree (videos are playable by admins via
    // POST /lectures/:id/playback only once live; draft videos are listed with their asset status).
    const rev = c.status === 'published' ? await this.revisions.open(id) : null;
    const revision = rev ? { ...(await this.revisions.summary(rev)), draft: rev.snapshot } : null;
    return { ...c, thumbnailUrl: this.media.imageUrl(c.coverKey), history: audit, revision };
  }

  async videoPlayback(a: Actor, assetId: string) {
    const asset = /^[0-9a-f-]{36}$/i.test(assetId) ? await this.prisma.videoAsset.findUnique({ where: { id: assetId } }) : null;
    if (!asset) throw notFound('Video');
    const out = await this.media.playback(asset, a.user.id);
    await this.audit.log({ actorId: a.user.id, action: 'video.admin_playback', targetType: 'video_asset', targetId: asset.id, ip: a.ip });
    return out;
  }

  async decide(a: Actor, courseId: string, decision: Decision, note?: string) {
    const t = TRANSITIONS[decision];
    if (t.noteRequired && !note?.trim()) throw badRequest('A note for the instructor is required', 'note_required');
    const c = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!c) throw notFound('Course');
    // A published course with changes in review: the decision applies to the revision; the live course stays.
    if (c.status === 'published' && decision !== 'unpublish') {
      const rev = await this.revisions.open(courseId);
      if (rev?.status === 'in_review') {
        const r =
          decision === 'approve'
            ? await this.revisions.approve(a, courseId, note)
            : await this.revisions.decide(a, courseId, decision === 'reject' ? 'rejected' : 'changes_requested', note!);
        // An approved revision may change the live title or topic: the cover follows.
        if (decision === 'approve') await this.covers?.ensureCover(courseId);
        const fresh = await this.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
        return { id: fresh.id, status: fresh.status, reviewNote: note?.trim() || null, publishedAt: fresh.publishedAt, revision: { id: r.revisionId, status: decision === 'approve' ? 'approved' : r.status } };
      }
    }
    if (!t.from.includes(c.status)) throw conflict(`Cannot ${decision} a course that is ${c.status}`, 'invalid_status');
    if (decision === 'unpublish') await this.revisions.closeOpen(courseId, 'The course was unpublished', a.user.id);
    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: t.to, reviewNote: note?.trim() || null, ...(t.to === 'published' && !c.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    await this.audit.log({ actorId: a.user.id, action: `course.${decision.replace('-', '_')}`, targetType: 'course', targetId: courseId, ip: a.ip, meta: { from: c.status, to: t.to, note: note ?? null } });
    return { id: updated.id, status: updated.status, reviewNote: updated.reviewNote, publishedAt: updated.publishedAt };
  }

  // ---------- users ----------
  async users(q: { q?: string; role?: Role; status?: UserStatus; page: number; pageSize: number }) {
    const where: Prisma.UserWhereInput = {
      status: q.status,
      ...(q.role ? { roles: { has: q.role } } : {}),
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...page(q.page, q.pageSize),
        select: { id: true, email: true, name: true, roles: true, status: true, createdAt: true, instructorProfile: { select: { status: true } }, _count: { select: { enrollments: true, orders: true } } },
      }),
    ]);
    return paged(items, total, q);
  }

  // ---------- instructors ----------
  async instructors(q: { status?: 'pending' | 'approved' | 'rejected'; q?: string; page: number; pageSize: number }) {
    const where: Prisma.InstructorProfileWhereInput = {
      status: q.status,
      ...(q.q ? { OR: [{ user: { name: { contains: q.q, mode: 'insensitive' } } }, { user: { email: { contains: q.q, mode: 'insensitive' } } }, { headline: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.instructorProfile.count({ where }),
      this.prisma.instructorProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...page(q.page, q.pageSize),
        include: { user: { select: { id: true, name: true, email: true, _count: { select: { courses: true } } } } },
      }),
    ]);
    return paged(
      rows.map((p) => ({
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        headline: p.headline,
        bio: p.bio,
        website: p.website,
        status: p.status,
        reviewNote: p.reviewNote,
        isPlatform: p.isPlatform,
        commissionBps: p.commissionBps,
        payToPlatform: p.payToPlatform,
        stripeConnected: !!p.stripeAccountId,
        payoutsEnabled: p.payoutsEnabled,
        courses: p.user._count.courses,
        appliedAt: p.createdAt,
      })),
      total,
      q,
    );
  }

  // ---------- categories ----------
  categories() {
    return this.prisma.category
      .findMany({ orderBy: [{ sort: 'asc' }, { name: 'asc' }], include: { _count: { select: { courses: true } } } })
      .then((rows) => ({ items: rows.map(({ _count, ...c }) => ({ ...c, courseCount: _count.courses })) }));
  }

  async createCategory(a: Actor, input: { name: string; slug?: string; icon?: string; sort?: number }) {
    const slug = input.slug ?? slugify(input.name);
    if (await this.prisma.category.findUnique({ where: { slug } })) throw conflict('A category with this slug exists', 'slug_taken');
    const c = await this.prisma.category.create({ data: { name: input.name, slug, icon: input.icon ?? '', sort: input.sort ?? 0 } });
    await this.audit.log({ actorId: a.user.id, action: 'category.created', targetType: 'category', targetId: c.id, ip: a.ip, meta: { slug } });
    return c;
  }

  async updateCategory(a: Actor, id: string, input: { name?: string; slug?: string; icon?: string; sort?: number }) {
    if (!(await this.prisma.category.findUnique({ where: { id } }))) throw notFound('Category');
    if (input.slug) {
      const other = await this.prisma.category.findUnique({ where: { slug: input.slug } });
      if (other && other.id !== id) throw conflict('A category with this slug exists', 'slug_taken');
    }
    const c = await this.prisma.category.update({ where: { id }, data: input });
    // Covers print the topic name: regenerate the topic's covers when it is renamed.
    if (input.name !== undefined) for (const x of await this.prisma.course.findMany({ where: { categoryId: id }, select: { id: true } })) await this.covers?.ensureCover(x.id);
    await this.audit.log({ actorId: a.user.id, action: 'category.updated', targetType: 'category', targetId: id, ip: a.ip, meta: input });
    return c;
  }

  async deleteCategory(a: Actor, id: string) {
    const c = await this.prisma.category.findUnique({ where: { id }, include: { _count: { select: { courses: true } } } });
    if (!c) throw notFound('Category');
    if (c._count.courses) throw conflict('Move the courses out of this category first', 'category_in_use');
    await this.prisma.category.delete({ where: { id } });
    await this.audit.log({ actorId: a.user.id, action: 'category.deleted', targetType: 'category', targetId: id, ip: a.ip, meta: { slug: c.slug } });
    return { ok: true };
  }

  // ---------- settings ----------
  getSettings() {
    return this.settings.all();
  }

  async putSettings(a: Actor, input: { commission_bps?: number; notify_new_registrations?: boolean; notify_instructor_applications?: boolean }) {
    if (!hasRole(a.user, 'super_admin')) throw forbidden('Only a super admin can change marketplace settings', 'super_admin_required');
    const before = await this.settings.all();
    for (const k of ['commission_bps', 'notify_new_registrations', 'notify_instructor_applications'] as const) {
      const v = input[k];
      if (v === undefined || v === before[k]) continue;
      await this.settings.set(k, v);
      await this.audit.log({ actorId: a.user.id, action: 'settings.updated', targetType: 'settings', targetId: k, ip: a.ip, meta: { before: before[k], after: v } });
    }
    return this.settings.all();
  }

  // ---------- orders ----------
  async orders(q: { status?: OrderStatus; q?: string; page: number; pageSize: number }) {
    const term = q.q?.trim();
    const isUuid = !!term && /^[0-9a-f-]{36}$/i.test(term);
    const where: Prisma.OrderWhereInput = {
      status: q.status,
      ...(term
        ? {
            OR: [
              ...(isUuid ? [{ id: term }] : []),
              { user: { email: { contains: term, mode: 'insensitive' as const } } },
              { user: { name: { contains: term, mode: 'insensitive' as const } } },
              { lines: { some: { course: { title: { contains: term, mode: 'insensitive' as const } } } } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...page(q.page, q.pageSize),
        include: {
          user: { select: { id: true, name: true, email: true } },
          lines: { select: { id: true, refundedAt: true, course: { select: { id: true, title: true, slug: true } } } },
        },
      }),
    ]);
    return paged(
      rows.map((o) => ({
        id: o.id,
        status: o.status,
        totalCents: o.totalCents,
        currency: o.currency,
        provider: o.provider,
        user: o.user,
        lines: o.lines.length,
        courses: o.lines.map((l) => ({ ...l.course, refunded: !!l.refundedAt })),
        paidAt: o.paidAt,
        createdAt: o.createdAt,
      })),
      total,
      q,
    );
  }

  /** Admin order detail: buyer, every line with its course, instructor, split and transfer state, and refund history. */
  async order(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        lines: {
          orderBy: { id: 'asc' },
          include: { course: { select: { id: true, title: true, slug: true } }, instructor: { select: { id: true, name: true, instructorProfile: { select: { isPlatform: true } } } } },
        },
      },
    });
    if (!o) throw notFound('Order');
    const history = await this.prisma.auditLog.findMany({ where: { targetType: 'order', targetId: id }, orderBy: { at: 'asc' }, select: { id: true, action: true, at: true, meta: true, actor: { select: { id: true, name: true } } } });
    const refundable = ['paid', 'partially_refunded'].includes(o.status);
    const lines = o.lines.map((l) => ({
      id: l.id,
      course: l.course,
      instructor: { id: l.instructor.id, name: l.instructor.name, isPlatform: !!l.instructor.instructorProfile?.isPlatform },
      priceCents: l.priceCents,
      commissionBps: l.commissionBps,
      feeCents: l.feeCents,
      netCents: l.netCents,
      // platform revenue for the line: the net minus whatever the instructor receives (DEL lines keep it all)
      commissionCents: l.netCents - (l.payee === 'instructor' ? l.instructorShareCents : 0),
      instructorShareCents: l.instructorShareCents,
      payee: l.payee,
      transferDueAt: l.transferDueAt,
      disputeStatus: l.disputeStatus,
      transferStatus: l.transferStatus,
      transferId: l.transferId,
      refundedAt: l.refundedAt,
      refundable: refundable && !l.refundedAt,
    }));
    const refundedCents = lines.filter((l) => l.refundedAt).reduce((n, l) => n + l.priceCents, 0);
    return {
      id: o.id,
      status: o.status,
      provider: o.provider,
      currency: o.currency,
      totalCents: o.totalCents,
      refundedCents,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      stripePaymentIntentId: o.stripePaymentIntentId,
      stripeFeeCents: o.stripeFeeCents,
      feeSource: o.feeSource,
      refundEligibleUntil: o.refundEligibleUntil,
      immediateAccessConsentAt: o.immediateAccessConsentAt,
      user: o.user,
      lines,
      history,
    };
  }

  /** Full refund (no lineIds) or partial refund of the given lines of this order; returns the order detail. */
  async refund(a: Actor, orderId: string, input: { lineIds?: string[]; reason?: string }) {
    if (input.lineIds?.length) {
      const own = await this.prisma.orderLine.findMany({ where: { orderId, id: { in: input.lineIds } }, select: { id: true } });
      if (own.length !== new Set(input.lineIds).size) {
        throw badRequest('Some order lines do not belong to this order', 'invalid_line', [{ field: 'lineIds', message: 'Choose lines of this order' }]);
      }
    }
    await this.refunds.refund(orderId, input.lineIds, input.reason, { id: a.user.id, ip: a.ip });
    return this.order(orderId);
  }

  // ---------- reviews moderation ----------
  async setReviewStatus(a: Actor, id: string, status: 'visible' | 'hidden') {
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw notFound('Review');
    await this.prisma.review.update({ where: { id }, data: { status } });
    await recalcRating(this.prisma, r.courseId);
    await this.audit.log({ actorId: a.user.id, action: `review.${status}`, targetType: 'review', targetId: id, ip: a.ip });
    return { id, status };
  }

  // ---------- audit ----------
  async auditLog(q: { action?: string; actorId?: string; targetType?: string; targetId?: string; q?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
    const term = q.q?.trim();
    const where: Prisma.AuditLogWhereInput = {
      action: q.action ? { startsWith: q.action } : undefined,
      actorId: q.actorId,
      targetType: q.targetType,
      targetId: q.targetId,
      at: q.from || q.to ? { gte: q.from, lte: q.to } : undefined,
      ...(term
        ? {
            OR: [
              { action: { contains: term, mode: 'insensitive' } },
              { targetId: { contains: term, mode: 'insensitive' } },
              { targetType: { contains: term, mode: 'insensitive' } },
              { actor: { email: { contains: term, mode: 'insensitive' } } },
              { actor: { name: { contains: term, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, ...page(q.page, q.pageSize), include: { actor: { select: { id: true, name: true, email: true } } } }),
    ]);
    return paged(items, total, q);
  }
}
