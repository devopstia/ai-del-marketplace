import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { Actor, hasRole } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { RefundsService } from '../commerce/refunds.service';
import { PayoutsService } from '../commerce/payouts.service';
import { StripeService } from '../commerce/stripe.service';
import { PAYOUT_HOLD_DAYS, REFUND_WINDOW_DAYS } from '../commerce/money';

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
  ) {}

  // ---------- instructor terms (super admin) ----------
  async setInstructorTerms(a: Actor, userId: string, input: { commissionBps?: number | null; payToPlatform?: boolean; note: string }) {
    requireSuper(a);
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Instructor');
    if (p.isPlatform) throw badRequest("DEL's own courses always go to the platform", 'platform_instructor');
    const data = {
      ...(input.commissionBps !== undefined ? { commissionBps: input.commissionBps } : {}),
      ...(input.payToPlatform !== undefined ? { payToPlatform: input.payToPlatform } : {}),
      termsNote: input.note.trim(),
    };
    const updated = await this.prisma.instructorProfile.update({ where: { userId }, data });
    await this.audit.log({
      actorId: a.user.id,
      action: 'commission.terms_changed',
      targetType: 'instructor',
      targetId: userId,
      ip: a.ip,
      meta: { before: { commissionBps: p.commissionBps, payToPlatform: p.payToPlatform }, after: { commissionBps: updated.commissionBps, payToPlatform: updated.payToPlatform }, note: data.termsNote, appliesTo: 'sales from now on' },
    });
    return this.terms(userId);
  }

  /** The terms that apply to an instructor's next sale (the same object the instructor sees in the studio). */
  async terms(userId: string) {
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Instructor');
    const defaultBps = await this.settings.commissionBps();
    const platformBps = p.isPlatform ? 10000 : (p.commissionBps ?? defaultBps);
    return {
      isPlatform: p.isPlatform,
      platformBps,
      instructorSharePercent: (10000 - platformBps) / 100,
      source: p.isPlatform ? 'platform' : p.commissionBps != null ? 'agreement' : 'default',
      defaultInstructorSharePercent: (10000 - defaultBps) / 100,
      payToPlatform: p.payToPlatform,
      note: p.termsNote,
      formula: 'Your share = (price − Stripe processing fee) × your rate. Tax is never part of the split.',
      holdDays: PAYOUT_HOLD_DAYS,
      refundWindowDays: REFUND_WINDOW_DAYS,
    };
  }

  // ---------- refund requests ----------
  async refundRequests(status: 'pending' | 'approved' | 'declined' | undefined) {
    const rows = await this.prisma.refundRequest.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { user: { select: { id: true, name: true, email: true } }, order: { include: { lines: { include: { course: { select: { title: true } } } } } } },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.reason,
        decisionNote: r.decisionNote,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        user: r.user,
        orderId: r.orderId,
        paidAt: r.order.paidAt,
        lines: r.order.lines.filter((l) => r.lineIds.includes(l.id)).map((l) => ({ id: l.id, title: l.course.title, priceCents: l.priceCents, refundedAt: l.refundedAt })),
      })),
    };
  }

  async decideRefundRequest(a: Actor, id: string, approve: boolean, note: string | undefined) {
    const r = await this.prisma.refundRequest.findUnique({ where: { id } });
    if (!r) throw notFound('Refund request');
    if (r.status !== 'pending') throw conflict('This request was already decided', 'already_decided');
    if (!approve && !note?.trim()) throw badRequest('Add a note so the learner knows why', 'note_required');
    if (approve) await this.refunds.refund(r.orderId, r.lineIds, `Approved request: ${note?.trim() || r.reason || 'no reason given'}`, { id: a.user.id, ip: a.ip });
    await this.prisma.refundRequest.update({ where: { id }, data: { status: approve ? 'approved' : 'declined', decisionNote: note?.trim() || null, decidedById: a.user.id, decidedAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: approve ? 'order.refund_request_approved' : 'order.refund_request_declined', targetType: 'order', targetId: r.orderId, ip: a.ip, meta: { requestId: id, note: note ?? null } });
    return { id, status: approve ? 'approved' : 'declined' };
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
