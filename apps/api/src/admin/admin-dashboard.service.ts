import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type { AuthUser } from '../common/auth-context';
import { can } from '../common/permissions';
import { dailySeries, dayKey, resolveRange, type RangeKey, type SaleLine } from '../instructor/dashboard';
import { refundWhere } from './finance.service';
import { SystemService } from './system.service';
import { marketMoney, platformSeries, rankBy } from './admin-dashboard';

const PAID = ['paid', 'refunded', 'partially_refunded'] as const;
type AdminLine = SaleLine & { instructorId: string };

/**
 * Admin / Super Admin dashboard (owner 2026-11-27, Option A phase 3; docs/DASHBOARD_DESIGN.md). Read-only reporting
 * over the real records. Each block is returned only to admins holding its permission (super admins see all), so a
 * limited admin never receives figures their role can't open elsewhere. No emails or secrets; names only where the
 * corresponding admin page already shows them.
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService, private readonly system: SystemService) {}

  async overview(user: AuthUser, q: { range?: RangeKey; from?: Date; to?: Date }, now = new Date()) {
    const range = resolveRange(q.range ?? '30d', now, q.from, q.to);
    const { current: cur, previous: prev } = range;
    const superAdmin = user.roles.includes('super_admin');
    const allow = {
      finance: can(user, 'finance.view'),
      platform: can(user, 'users.view'),
      catalogue: can(user, 'courses.review'),
      audit: can(user, 'audit.view'),
    };
    const [finance, platform, catalogue, attention, health, audit] = await Promise.all([
      allow.finance ? this.finance(cur, prev) : null,
      allow.platform ? this.platform(cur, prev) : null,
      allow.catalogue ? this.catalogue() : null,
      this.attention(user, cur),
      superAdmin ? this.health() : null,
      allow.audit ? this.audit() : null,
    ]);
    return {
      range: { key: range.key, from: cur.from, to: cur.to, days: cur.days, previousFrom: prev.from, previousTo: prev.to },
      blocks: { finance: !!finance, platform: !!platform, catalogue: !!catalogue, health: !!health, audit: !!audit },
      finance, platform, catalogue, attention, health, audit,
    };
  }

  private async finance(cur: { from: Date; to: Date }, prev: { from: Date; to: Date }) {
    const [rows, payouts, failedNow, failedPrev, webhooks, stripeOrders] = await Promise.all([
      this.prisma.orderLine.findMany({
        where: { order: { status: { in: [...PAID] }, paidAt: { gte: prev.from, lt: cur.to } } },
        select: { courseId: true, instructorId: true, priceCents: true, feeCents: true, instructorShareCents: true, refundedAt: true, transferStatus: true, payee: true, order: { select: { paidAt: true } } },
      }),
      this.prisma.orderLine.groupBy({ by: ['transferStatus'], where: { payee: 'instructor', refundedAt: null, transferStatus: { in: ['pending', 'paid'] }, order: { status: { in: [...PAID] } } }, _sum: { instructorShareCents: true }, _count: { _all: true } }),
      this.prisma.order.count({ where: { status: 'failed', createdAt: { gte: cur.from, lt: cur.to } } }),
      this.prisma.order.count({ where: { status: 'failed', createdAt: { gte: prev.from, lt: prev.to } } }),
      this.prisma.webhookEvent.aggregate({ where: { processedAt: { gte: cur.from, lt: cur.to } }, _count: { _all: true }, _max: { processedAt: true } }),
      this.prisma.order.count({ where: { provider: 'stripe', status: { in: [...PAID] }, paidAt: { gte: cur.from, lt: cur.to } } }),
    ]);
    const lines: AdminLine[] = rows.filter((r) => r.order.paidAt).map((r) => ({ paidAt: r.order.paidAt!, courseId: r.courseId, instructorId: r.instructorId, priceCents: r.priceCents, feeCents: r.feeCents, instructorShareCents: r.instructorShareCents, refundedAt: r.refundedAt, transferStatus: r.transferStatus, payee: r.payee }));
    const inCur = lines.filter((l) => l.paidAt >= cur.from && l.paidAt < cur.to);
    const inPrev = lines.filter((l) => l.paidAt >= prev.from && l.paidAt < prev.to);
    const days = dailySeries([], { from: cur.from, to: cur.to, days: 0 }).map((d) => d.date);

    const topCourses = rankBy(inCur, (l) => l.courseId);
    const topInstructors = rankBy(inCur, (l) => l.instructorId);
    const [courses, instructors] = await Promise.all([
      this.prisma.course.findMany({ where: { id: { in: topCourses.map((c) => c.key) } }, select: { id: true, title: true } }),
      this.prisma.user.findMany({ where: { id: { in: topInstructors.map((i) => i.key) } }, select: { id: true, name: true, instructorProfile: { select: { isPlatform: true, official: true } } } }),
    ]);
    const courseTitle = new Map(courses.map((c) => [c.id, c.title]));
    const who = new Map(instructors.map((u) => [u.id, u]));
    const sum = (s: 'pending' | 'paid') => payouts.find((p) => p.transferStatus === s);
    return {
      current: { ...marketMoney(inCur), failedPayments: failedNow },
      previous: { ...marketMoney(inPrev), failedPayments: failedPrev },
      series: platformSeries(inCur, days, dayKey),
      payouts: {
        pendingCents: sum('pending')?._sum.instructorShareCents ?? 0, pendingCount: sum('pending')?._count._all ?? 0,
        paidCents: sum('paid')?._sum.instructorShareCents ?? 0, paidCount: sum('paid')?._count._all ?? 0,
      },
      byCourse: topCourses.map((c) => ({ ...c, id: c.key, title: courseTitle.get(c.key) ?? 'Deleted course' })),
      byInstructor: topInstructors.map((i) => {
        const u = who.get(i.key);
        return { ...i, id: i.key, name: u?.name ?? 'Unknown', kind: u?.instructorProfile?.isPlatform ? 'del' : u?.instructorProfile?.official ? 'official' : 'independent' };
      }),
      // Stripe orders paid in the range vs Stripe events received: sales with no events means a webhook problem.
      webhooks: { received: webhooks._count._all, lastAt: webhooks._max.processedAt, stripeOrders },
    };
  }

  private async platform(cur: { from: Date; to: Date }, prev: { from: Date; to: Date }) {
    const learning = (p: { from: Date; to: Date }) => this.prisma.lectureProgress.findMany({ where: { updatedAt: { gte: p.from, lt: p.to } }, distinct: ['userId'], select: { userId: true } });
    const [users, newNow, newPrev, activeNow, activePrev, profiles, enrolNow, enrolPrev, enrolTotal, certNow, certPrev, certTotal] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'deleted' } } }),
      this.prisma.user.count({ where: { createdAt: { gte: cur.from, lt: cur.to } } }),
      this.prisma.user.count({ where: { createdAt: { gte: prev.from, lt: prev.to } } }),
      learning(cur), learning(prev),
      this.prisma.instructorProfile.groupBy({ by: ['isPlatform', 'official'], where: { status: 'approved' }, _count: { _all: true } }),
      this.prisma.enrollment.count({ where: { createdAt: { gte: cur.from, lt: cur.to } } }),
      this.prisma.enrollment.count({ where: { createdAt: { gte: prev.from, lt: prev.to } } }),
      this.prisma.enrollment.count({ where: { revokedAt: null } }),
      this.prisma.certificate.count({ where: { issuedAt: { gte: cur.from, lt: cur.to } } }),
      this.prisma.certificate.count({ where: { issuedAt: { gte: prev.from, lt: prev.to } } }),
      this.prisma.certificate.count(),
    ]);
    const n = (f: (p: { isPlatform: boolean; official: boolean }) => boolean) => profiles.filter(f).reduce((a, p) => a + p._count._all, 0);
    return {
      users, newUsers: { current: newNow, previous: newPrev },
      activeStudents: { current: activeNow.length, previous: activePrev.length },
      instructors: { del: n((p) => p.isPlatform), official: n((p) => !p.isPlatform && p.official), independent: n((p) => !p.isPlatform && !p.official) },
      enrolments: { current: enrolNow, previous: enrolPrev, total: enrolTotal },
      completions: { current: certNow, previous: certPrev, total: certTotal },
    };
  }

  private async catalogue() {
    const [byStatus, revisions] = await Promise.all([
      this.prisma.course.groupBy({ by: ['status'], where: { archivedAt: null, purgedAt: null }, _count: { _all: true } }),
      this.prisma.courseRevision.count({ where: { status: 'in_review' } }),
    ]);
    const c = (s: string) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
    return { published: c('published'), drafts: c('draft') + c('changes_requested') + c('unpublished') + c('rejected'), pendingApproval: c('in_review') + revisions };
  }

  /** What is waiting on a person, each count only for admins allowed to act on it, with the page that handles it. */
  private async attention(user: AuthUser, cur: { from: Date; to: Date }) {
    const items: { key: string; label: string; count: number; href: string }[] = [];
    const add = async (perm: Parameters<typeof can>[1], key: string, label: string, href: string, count: () => Promise<number>) => {
      if (can(user, perm)) items.push({ key, label, href, count: await count() });
    };
    await Promise.all([
      add('courses.review', 'reviews', 'Courses waiting for approval', '/admin/review', async () => (await this.prisma.course.count({ where: { status: 'in_review' } })) + (await this.prisma.courseRevision.count({ where: { status: 'in_review' } }))),
      add('instructors.review', 'applications', 'Instructor applications', '/admin/instructors', () => this.prisma.instructorProfile.count({ where: { status: { in: ['pending', 'under_review'] }, isPlatform: false } })),
      add('finance.view', 'refunds', 'Refund requests needing a decision', '/admin/refunds', () => this.prisma.refundRequest.count({ where: refundWhere('needs_action') })),
      add('finance.view', 'disputes', 'Open payment disputes', '/admin/finance', () => this.prisma.dispute.count({ where: { status: 'open' } })),
      add('finance.view', 'failed', 'Failed payments in this period', '/admin/orders', () => this.prisma.order.count({ where: { status: 'failed', createdAt: { gte: cur.from, lt: cur.to } } })),
      add('support.manage', 'support', 'Support requests waiting for staff', '/admin/support', () => this.prisma.supportTicket.count({ where: { status: { in: ['new', 'open'] } } })),
      add('reviews.moderate', 'reports', 'Reported reviews', '/admin/course-reviews', () => this.prisma.reviewReport.count({ where: { status: 'open' } })),
    ]);
    const order = ['reviews', 'applications', 'refunds', 'disputes', 'failed', 'support', 'reports'];
    return items.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }

  /** Super admins only (the same checks as Super Admin › System health, slimmed for the overview). */
  private async health() {
    const h = await this.system.health();
    return {
      checkedAt: h.checkedAt,
      checks: h.checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail })),
      queues: h.queues.map((q) => { const c = q as unknown as { failed?: number; waiting?: number }; return { name: q.name, ok: q.ok, failed: c.failed ?? 0, waiting: c.waiting ?? 0 }; }),
      failedVideos: h.attention.failedVideos + h.attention.packagingFailed,
    };
  }

  private async audit() {
    // Administrative actions only: sign-ins and session events are left to the audit log page.
    const rows = await this.prisma.auditLog.findMany({ where: { NOT: { action: { startsWith: 'auth.' } } }, orderBy: { at: 'desc' }, take: 8, select: { id: true, action: true, targetType: true, at: true, status: true, actor: { select: { name: true } } } });
    return rows.map((r) => ({ id: r.id, action: r.action, targetType: r.targetType, at: r.at, status: r.status, actor: r.actor?.name ?? 'System' }));
  }
}
