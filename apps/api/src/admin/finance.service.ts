import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import { Actor, hasRole } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { RefundsService } from '../commerce/refunds.service';
import { PayoutsService } from '../commerce/payouts.service';
import { StripeService } from '../commerce/stripe.service';
import { PAYOUT_HOLD_BUFFER_DAYS } from '../commerce/money';
import { RefundPolicyService } from '../commerce/refund-policy.service';
import { NotificationsService } from '../common/notifications.service';
import { JobsService } from '../common/jobs';
import { env } from '../config/env';

/** Refund dashboard filters (owner 2026-11-26). */
export const REFUND_FILTERS = ['all', 'needs_action', 'pending', 'investigation', 'auto_declined', 'auto_approved', 'approved', 'declined', 'refunded', 'processing', 'failed'] as const;
export type RefundFilter = (typeof REFUND_FILTERS)[number];
export function refundWhere(f: RefundFilter | undefined): Prisma.RefundRequestWhereInput {
  switch (f) {
    case 'needs_action': return { OR: [{ status: 'pending' }, { status: 'auto_declined', reviewRequestedAt: { not: null } }, { status: { in: ['approved', 'auto_approved'] }, paymentStatus: 'failed' }] };
    case 'pending': return { status: 'pending' };
    case 'investigation': return { investigation: true, status: 'pending' };
    case 'auto_declined': case 'auto_approved': case 'approved': case 'declined': return { status: f };
    case 'refunded': return { paymentStatus: 'succeeded' };
    case 'processing': return { paymentStatus: 'processing' };
    case 'failed': return { paymentStatus: 'failed' };
    default: return {};
  }
}

const requireSuper = (a: Actor) => {
  if (!hasRole(a.user, 'super_admin')) throw forbidden('Only a super admin can change commission or payout terms', 'super_admin_required');
};

/** Money administration: instructor terms, refund requests, disputes, payout overview and reconciliation checks. */
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly refunds: RefundsService,
    private readonly payouts: PayoutsService,
    private readonly stripe: StripeService,
    private readonly jobs: JobsService,
    private readonly policy: RefundPolicyService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- instructor terms (super admin) ----------
  async setInstructorTerms(a: Actor, userId: string, input: { commissionBps?: number | null; payToPlatform?: boolean; official?: boolean; note: string }) {
    requireSuper(a);
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Instructor');
    if (p.isPlatform) throw badRequest("DEL's own courses always go to the platform", 'platform_instructor');
    const data = {
      ...(input.commissionBps !== undefined ? { commissionBps: input.commissionBps } : {}),
      ...(input.payToPlatform !== undefined ? { payToPlatform: input.payToPlatform } : {}),
      // Official DEL Instructor: branding only (courses shown under DevOps Easy Learning); rate and payouts are unchanged.
      ...(input.official !== undefined && input.official !== p.official ? { official: input.official, officialSince: input.official ? new Date() : null } : {}),
      termsNote: input.note.trim(),
    };
    const updated = await this.prisma.instructorProfile.update({ where: { userId }, data });
    await this.audit.log({
      actorId: a.user.id,
      action: 'commission.terms_changed',
      targetType: 'instructor',
      targetId: userId,
      ip: a.ip,
      meta: { before: { commissionBps: p.commissionBps, payToPlatform: p.payToPlatform, official: p.official }, after: { commissionBps: updated.commissionBps, payToPlatform: updated.payToPlatform, official: updated.official }, note: data.termsNote, appliesTo: 'sales from now on' },
    });
    return this.terms(userId);
  }

  /** The terms that apply to an instructor's next sale (the same object the instructor sees in the studio). */
  async terms(userId: string) {
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Instructor');
    const defaultBps = await this.settings.commissionBps();
    const platformBps = p.isPlatform ? 10000 : (p.commissionBps ?? defaultBps);
    const policy = await this.policy.current();
    return {
      isPlatform: p.isPlatform,
      official: !p.isPlatform && p.official,
      officialSince: p.officialSince,
      platformBps,
      instructorSharePercent: (10000 - platformBps) / 100,
      source: p.isPlatform ? 'platform' : p.commissionBps != null ? 'agreement' : 'default',
      defaultInstructorSharePercent: (10000 - defaultBps) / 100,
      payToPlatform: p.payToPlatform,
      note: p.termsNote,
      formula: 'Your share = (price − Stripe processing fee) × your rate. Tax is never part of the split.',
      holdDays: policy.windowDays + PAYOUT_HOLD_BUFFER_DAYS,
      refundWindowDays: policy.windowDays,
    };
  }

  // ---------- refund requests ----------
  /**
   * Super Admin › Refunds (owner 2026-11-25, extended 2026-11-26): every request with the student, course, instructor,
   * amount, purchase and request dates, deadline, the measured share watched against the limit, lessons completed,
   * study material downloads, the automatic decision and its exact message, the payment state and references, and the
   * policy version. Filters follow the owner's list; `needs_action` = waiting for a person.
   */
  async refundRequests(filter: RefundFilter | undefined) {
    const where = refundWhere(filter);
    const rows = await this.prisma.refundRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
        order: { include: { lines: { include: { course: { select: { id: true, title: true, instructor: { select: { name: true } } } } } } } },
      },
    });
    const history = await this.prisma.auditLog.findMany({
      where: { targetType: 'order', targetId: { in: [...new Set(rows.map((r) => r.orderId))] }, OR: [{ action: { startsWith: 'refund.' } }, { action: { startsWith: 'order.refund' } }] },
      orderBy: { at: 'asc' },
      select: { action: true, at: true, targetId: true, meta: true, actor: { select: { name: true } } },
    });
    const downloads = await this.prisma.resourceDownload.findMany({
      where: { OR: rows.flatMap((r) => r.order.lines.filter((l) => r.lineIds.includes(l.id)).map((l) => ({ userId: r.userId, courseId: l.courseId }))) },
      orderBy: { at: 'desc' },
      take: 1000,
      select: { userId: true, courseId: true, title: true, at: true },
    });
    const counts: Record<string, number> = {};
    for (const f of REFUND_FILTERS) counts[f] = await this.prisma.refundRequest.count({ where: refundWhere(f) });
    const current = await this.policy.current();
    const DAY = 24 * 60 * 60 * 1000;
    return {
      counts,
      aiEnabled: !!env().ANTHROPIC_API_KEY,
      policy: { version: current.version, windowDays: current.windowDays, maxWatchedPercent: current.maxWatchedPercent, autoCheck: current.autoCheck, autoReject: current.autoReject, autoApprove: current.autoApprove, allowExceptions: current.allowExceptions },
      items: rows.map((r) => {
        const lines = r.order.lines.filter((l) => r.lineIds.includes(l.id));
        const courseIds = new Set(lines.map((l) => l.courseId));
        return {
          id: r.id,
          status: r.status,
          paymentStatus: r.paymentStatus,
          paymentError: r.paymentError,
          investigation: r.investigation,
          override: r.override,
          needsAction: r.status === 'pending' || (r.status === 'auto_declined' && !!r.reviewRequestedAt) || ((r.status === 'approved' || r.status === 'auto_approved') && r.paymentStatus === 'failed'),
          reason: r.reason,
          decisionNote: r.decisionNote,
          message: r.message,
          policyVersion: r.policyVersion,
          createdAt: r.createdAt,
          decidedAt: r.decidedAt,
          processedAt: r.processedAt,
          reviewRequestedAt: r.reviewRequestedAt,
          reviewNote: r.reviewNote,
          analysis: r.analysis,
          aiSummary: r.aiSummary,
          aiModel: r.aiModel,
          user: r.user,
          orderId: r.orderId,
          paidAt: r.order.paidAt,
          daysSincePurchase: r.order.paidAt ? Math.floor((r.createdAt.getTime() - r.order.paidAt.getTime()) / DAY) : null,
          amountCents: lines.reduce((n, l) => n + l.priceCents, 0),
          payment: { provider: r.order.provider, paymentIntentId: r.order.stripePaymentIntentId, chargeId: r.order.stripeChargeId, stripeRefundId: r.stripeRefundId },
          downloads: downloads.filter((d) => d.userId === r.userId && courseIds.has(d.courseId)).slice(0, 20).map((d) => ({ title: d.title, at: d.at })),
          lines: lines.map((l) => ({ id: l.id, title: l.course.title, instructor: l.course.instructor?.name ?? null, priceCents: l.priceCents, refundedAt: l.refundedAt, transferStatus: l.transferStatus, instructorShareCents: l.instructorShareCents })),
          history: history.filter((h) => h.targetId === r.orderId && (!h.meta || (h.meta as { requestId?: string }).requestId === r.id || !(h.meta as { requestId?: string }).requestId)).map((h) => ({ action: h.action, at: h.at, by: h.actor?.name ?? 'System' })),
        };
      }),
    };
  }

  /**
   * A person decides (owner 2026-11-26): requests waiting for a person (manual approval, yearly limit, missing tracking
   * data) — any admin with refunds.decide. Overriding an automatic decline — Super Admin only, only while the policy
   * allows exceptions, always with a documented reason. Declines need a note for the student. Approving pays through the
   * provider; the student is told "refunded" only once the provider confirms.
   */
  async decideRefundRequest(a: Actor, id: string, approve: boolean, note: string | undefined) {
    const r = await this.prisma.refundRequest.findUnique({ where: { id }, include: { user: { select: { email: true, name: true } } } });
    if (!r) throw notFound('Refund request');
    const override = r.status === 'auto_declined';
    if (r.status !== 'pending' && !override) throw conflict('This request was already decided', 'already_decided');
    if (override) {
      if (!a.user.roles.includes('super_admin')) throw forbidden('Only a Super Admin can overturn an automatic decision', 'super_admin_only');
      // Keeping an automatic decline is only a decision when the student asked for a review.
      if (!approve && !r.reviewRequestedAt) throw conflict('This request is already declined', 'already_decided');
      if (approve && !(await this.policy.current()).allowExceptions) throw forbidden('Exceptions are turned off in the refund policy settings', 'exceptions_disabled');
    }
    if (!note?.trim() && (!approve || override)) throw badRequest('Add a reason: it is kept in the audit log, and the student sees it', 'note_required');
    const moved = await this.prisma.refundRequest.updateMany({
      where: { id, status: r.status },
      data: { status: approve ? 'approved' : 'declined', decisionNote: note?.trim() || r.decisionNote, decidedById: a.user.id, decidedAt: new Date(), override: override && approve, ...(approve ? { paymentStatus: 'processing' } : {}) },
    });
    if (!moved.count) throw conflict('This request was already decided', 'already_decided');
    await this.audit.log({ actorId: a.user.id, action: approve ? (override ? 'refund.exception_approved' : 'order.refund_request_approved') : 'order.refund_request_declined', targetType: 'order', targetId: r.orderId, ip: a.ip, meta: { requestId: id, note: note ?? null, override, investigation: r.investigation } });
    if (approve) {
      const state = await this.refunds.pay(id, { id: a.user.id, ip: a.ip }, `${override ? 'Approved exception' : 'Approved request'}: ${note?.trim() || r.reason || 'no reason given'}`);
      return { id, status: 'approved', paymentStatus: state };
    }
    await this.jobs.sendEmail({ to: r.user.email, template: 'refund-declined-after-review', data: { name: r.user.name, requestId: id, note: note?.trim() || null } });
    await this.notifications.notify(r.userId, { kind: 'refund.declined', title: 'Refund request reviewed', body: `We reviewed your refund request and can’t refund it. ${note?.trim() ?? ''}`.trim(), link: `/student/purchases/${r.orderId}` });
    return { id, status: 'declined', paymentStatus: 'none' };
  }

  /** An approved refund the provider couldn't process: try again (Super Admin or refunds.decide). */
  async retryRefundPayment(a: Actor, id: string) {
    const r = await this.prisma.refundRequest.findUnique({ where: { id } });
    if (!r) throw notFound('Refund request');
    const moved = await this.prisma.refundRequest.updateMany({ where: { id, paymentStatus: 'failed', status: { in: ['approved', 'auto_approved'] } }, data: { paymentStatus: 'processing', paymentError: null } });
    if (!moved.count) throw conflict('Only an approved refund whose payment failed can be retried', 'not_retryable');
    await this.audit.log({ actorId: a.user.id, action: 'refund.payment_retried', targetType: 'order', targetId: r.orderId, ip: a.ip, meta: { requestId: id } });
    const state = await this.refunds.pay(id, { id: a.user.id, ip: a.ip }, 'Retry after a failed payment', true);
    return { id, paymentStatus: state };
  }

  // ---------- disputes ----------
  async disputes() {
    const rows = await this.prisma.dispute.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { order: { select: { id: true, user: { select: { name: true, email: true } } } } } });
    return { items: rows };
  }

  // ---------- overview + reconciliation ----------
  /**
   * Payout overview and internal reconciliation checks over paid orders. Every check must hold; a failed check means
   * the ledger and the orders disagree and needs a person to look. (Matching against Stripe's balance report needs
   * live keys and is added with them.)
   */
  async overview(now = new Date()) {
    const lines = await this.prisma.orderLine.findMany({
      where: { order: { status: { in: ['paid', 'partially_refunded', 'refunded'] } } },
      select: { id: true, orderId: true, priceCents: true, feeCents: true, netCents: true, instructorShareCents: true, payee: true, transferStatus: true, transferDueAt: true, refundedAt: true, disputeStatus: true, commissionBps: true },
    });
    const orders = await this.prisma.order.findMany({
      where: { status: { in: ['paid', 'partially_refunded', 'refunded'] } },
      select: { id: true, totalCents: true, stripeFeeCents: true, feeSource: true },
    });
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const live = lines.filter((l) => !l.refundedAt);
    const instructorLines = live.filter((l) => l.payee === 'instructor');
    const totals = {
      grossCents: sum(live.map((l) => l.priceCents)),
      feesCents: sum(live.map((l) => l.feeCents)),
      netCents: sum(live.map((l) => l.netCents)),
      instructorSharesCents: sum(instructorLines.map((l) => l.instructorShareCents)),
      delAgreementSharesCents: sum(live.filter((l) => l.payee === 'del_agreement').map((l) => l.instructorShareCents)),
      platformRevenueCents: sum(live.map((l) => l.netCents - (l.payee === 'instructor' ? l.instructorShareCents : 0))),
      refundedCents: sum(lines.filter((l) => l.refundedAt).map((l) => l.priceCents)),
      heldCents: sum(instructorLines.filter((l) => l.transferStatus === 'pending' && (!l.transferDueAt || l.transferDueAt > now)).map((l) => l.instructorShareCents)),
      dueCents: sum(instructorLines.filter((l) => l.transferStatus === 'pending' && l.transferDueAt && l.transferDueAt <= now).map((l) => l.instructorShareCents)),
      transferredCents: sum(instructorLines.filter((l) => l.transferStatus === 'paid').map((l) => l.instructorShareCents)),
      frozenByDisputeCents: sum(live.filter((l) => l.disputeStatus === 'open').map((l) => l.instructorShareCents)),
    };
    const owed = await this.prisma.ledgerEntry.groupBy({ by: ['instructorId'], _sum: { amountCents: true } });
    const owedCents = sum(owed.map((o) => Math.max(0, -(o._sum.amountCents ?? 0))));
    const byOrder = new Map<string, typeof lines>();
    for (const l of lines) byOrder.set(l.orderId, [...(byOrder.get(l.orderId) ?? []), l]);
    const problems: { orderId: string; check: string }[] = [];
    for (const o of orders) {
      const ls = byOrder.get(o.id) ?? [];
      if (sum(ls.map((l) => l.priceCents)) !== o.totalCents) problems.push({ orderId: o.id, check: 'line prices add up to the order total' });
      if (o.stripeFeeCents == null && o.totalCents > 0) problems.push({ orderId: o.id, check: 'Stripe fee recorded' });
      if (o.stripeFeeCents != null && sum(ls.map((l) => l.feeCents)) !== o.stripeFeeCents) problems.push({ orderId: o.id, check: 'line fees add up to the order fee' });
      for (const l of ls) {
        if (l.priceCents - l.feeCents !== l.netCents) problems.push({ orderId: o.id, check: `line ${l.id.slice(0, 8)}: net = price − fee` });
        if (l.instructorShareCents > l.netCents) problems.push({ orderId: o.id, check: `line ${l.id.slice(0, 8)}: share ≤ net` });
        if (l.payee !== 'instructor' && l.transferStatus === 'paid') problems.push({ orderId: o.id, check: `line ${l.id.slice(0, 8)}: no transfer for DEL lines` });
      }
    }
    return { stripeConfigured: this.stripe.configured, totals: { ...totals, owedByInstructorsCents: owedCents }, checks: { orders: orders.length, problems } };
  }

  /** Lines whose payout is due but cannot be sent yet (instructor not onboarded), for the admin "attention" list. */
  async waitingForOnboarding() {
    const rows = await this.prisma.orderLine.groupBy({
      by: ['instructorId'],
      where: { transferStatus: 'pending', payee: 'instructor', refundedAt: null, instructor: { instructorProfile: { payoutsEnabled: false } } },
      _sum: { instructorShareCents: true },
      _count: true,
    });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.instructorId) } }, select: { id: true, name: true, email: true } });
    return { items: rows.map((r) => ({ instructor: users.find((u) => u.id === r.instructorId), lines: r._count, amountCents: r._sum.instructorShareCents ?? 0 })) };
  }

  /** Manual trigger for the hourly payout release (super admin), e.g. right after Stripe keys are added. */
  async releaseNow(a: Actor) {
    requireSuper(a);
    const r = await this.payouts.releaseDue();
    await this.audit.log({ actorId: a.user.id, action: 'payout.release_run', targetType: 'platform', targetId: null, ip: a.ip, meta: r });
    return r;
  }
}
