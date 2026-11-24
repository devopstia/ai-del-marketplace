import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { CourseStatus, OrderStatus, Role, UserStatus } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import { Actor, hasRole } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { slugify } from '../common/util';
import { RefundsService } from '../commerce/refunds.service';
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

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly refunds: RefundsService,
    private readonly media: MediaService,
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
  async reviewQueue() {
    const rows = await this.prisma.course.findMany({
      where: { status: 'in_review' },
      orderBy: { updatedAt: 'asc' },
      include: { instructor: { select: { id: true, name: true, email: true } }, category: { select: { name: true } }, _count: { select: { sections: true } } },
    });
    return { items: rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, priceCents: c.priceCents, instructor: c.instructor, category: c.category, submittedAt: c.updatedAt, sections: c._count.sections })) };
  }

  async courses(q: { status?: CourseStatus; q?: string; page: number; pageSize: number }) {
    const where: Prisma.CourseWhereInput = { status: q.status, ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        ...page(q.page, q.pageSize),
        include: { instructor: { select: { id: true, name: true } }, _count: { select: { enrollments: { where: { revokedAt: null } } } } },
      }),
    ]);
    return {
      items: rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, priceCents: c.priceCents, instructor: c.instructor, students: c._count.enrollments, reviewNote: c.reviewNote, updatedAt: c.updatedAt, publishedAt: c.publishedAt })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
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
    return { ...c, thumbnailUrl: this.media.imageUrl(c.thumbnailKey), history: audit };
  }

  async decide(a: Actor, courseId: string, decision: Decision, note?: string) {
    const t = TRANSITIONS[decision];
    if (t.noteRequired && !note?.trim()) throw badRequest('A note for the instructor is required', 'note_required');
    const c = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!c) throw notFound('Course');
    if (!t.from.includes(c.status)) throw conflict(`Cannot ${decision} a course that is ${c.status}`, 'invalid_status');
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
    return { items, total, page: q.page, pageSize: q.pageSize };
  }

  async updateUser(a: Actor, userId: string, input: { status?: UserStatus; roles?: Role[] }) {
    if (userId === a.user.id) throw forbidden('You cannot change your own status or roles', 'self_change');
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw notFound('User');
    const actorIsSuper = hasRole(a.user, 'super_admin');
    if (input.roles && !actorIsSuper) throw forbidden('Only a super admin can change roles', 'super_admin_required');
    if (!actorIsSuper && (target.roles.includes('admin') || target.roles.includes('super_admin'))) {
      throw forbidden('Only a super admin can change another admin', 'super_admin_required');
    }
    const roles = input.roles ? Array.from(new Set<Role>(['student', ...input.roles])) : undefined;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: input.status, roles },
      select: { id: true, email: true, name: true, roles: true, status: true },
    });
    if (input.status === 'suspended' || input.roles) {
      await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log({ actorId: a.user.id, action: 'user.updated', targetType: 'user', targetId: userId, ip: a.ip, meta: { before: { status: target.status, roles: target.roles }, after: { status: user.status, roles: user.roles } } });
    return user;
  }

  // ---------- instructors ----------
  async instructors(status?: 'pending' | 'approved' | 'rejected') {
    const rows = await this.prisma.instructorProfile.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, _count: { select: { courses: true } } } } },
    });
    return {
      items: rows.map((p) => ({
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        headline: p.headline,
        bio: p.bio,
        website: p.website,
        status: p.status,
        reviewNote: p.reviewNote,
        isPlatform: p.isPlatform,
        stripeConnected: !!p.stripeAccountId,
        payoutsEnabled: p.payoutsEnabled,
        courses: p.user._count.courses,
        appliedAt: p.createdAt,
      })),
    };
  }

  async decideInstructor(a: Actor, userId: string, approve: boolean, note?: string) {
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!p) throw notFound('Instructor application');
    if (!approve && !note?.trim()) throw badRequest('A note is required when rejecting', 'note_required');
    await this.prisma.$transaction(async (tx) => {
      await tx.instructorProfile.update({ where: { userId }, data: { status: approve ? 'approved' : 'rejected', reviewNote: note?.trim() || null } });
      const roles = approve ? Array.from(new Set<Role>([...p.user.roles, 'instructor'])) : p.user.roles.filter((r) => r !== 'instructor');
      await tx.user.update({ where: { id: userId }, data: { roles } });
    });
    await this.audit.log({ actorId: a.user.id, action: approve ? 'instructor.approved' : 'instructor.rejected', targetType: 'instructor', targetId: userId, ip: a.ip, meta: { note: note ?? null } });
    return { userId, status: approve ? 'approved' : 'rejected' };
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

  async putSettings(a: Actor, input: { commission_bps: number }) {
    const before = await this.settings.all();
    await this.settings.set('commission_bps', input.commission_bps);
    await this.audit.log({ actorId: a.user.id, action: 'settings.updated', targetType: 'settings', targetId: 'commission_bps', ip: a.ip, meta: { before: before.commission_bps, after: input.commission_bps } });
    return this.settings.all();
  }

  // ---------- orders ----------
  async orders(q: { status?: OrderStatus; page: number; pageSize: number }) {
    const where: Prisma.OrderWhereInput = { status: q.status };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...page(q.page, q.pageSize),
        include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { lines: true } } },
      }),
    ]);
    return {
      items: rows.map((o) => ({ id: o.id, status: o.status, totalCents: o.totalCents, currency: o.currency, provider: o.provider, user: o.user, lines: o._count.lines, paidAt: o.paidAt, createdAt: o.createdAt })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async order(id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } }, lines: { include: { course: { select: { title: true, slug: true } }, instructor: { select: { id: true, name: true } } } } },
    });
    if (!o) throw notFound('Order');
    return o;
  }

  refund(a: Actor, orderId: string, input: { lineIds?: string[]; reason?: string }) {
    return this.refunds.refund(orderId, input.lineIds, input.reason, { id: a.user.id, ip: a.ip });
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
  async auditLog(q: { action?: string; actorId?: string; targetType?: string; targetId?: string; page: number; pageSize: number }) {
    const where: Prisma.AuditLogWhereInput = {
      action: q.action ? { startsWith: q.action } : undefined,
      actorId: q.actorId,
      targetType: q.targetType,
      targetId: q.targetId,
    };
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, ...page(q.page, q.pageSize), include: { actor: { select: { id: true, name: true, email: true } } } }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  }
}
