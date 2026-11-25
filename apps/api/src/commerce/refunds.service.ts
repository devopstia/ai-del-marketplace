import { Injectable, Logger, Optional } from '@nestjs/common';
import { revokeYear } from '../access/access';
import { courseConsumption } from '../access/consumption';
import { JobsService } from '../common/jobs';
import { refundAiEnabled, summarizeRefund } from './refund-ai';
import { AuditService } from '../common/audit.service';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { REFUND_AUTO_LIMIT_PER_YEAR, REFUND_MAX_WATCHED, REFUND_WINDOW_DAYS } from './money';
import { PayoutsService } from './payouts.service';
import { StripeService } from './stripe.service';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger('Refunds');
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
    private readonly payouts: PayoutsService,
    @Optional() private readonly jobs?: JobsService,
  ) {}

  /** Admin refund of the whole order or selected lines: refunds the charge, then applies the refund locally. */
  async refund(orderId: string, lineIds: string[] | undefined, reason: string | undefined, actor: { id: string; ip: string | null }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!order) throw notFound('Order');
    if (!['paid', 'partially_refunded'].includes(order.status)) throw badRequest('Only paid orders can be refunded', 'not_refundable');
    const lines = order.lines.filter((l) => !l.refundedAt && (!lineIds?.length || lineIds.includes(l.id)));
    if (!lines.length) throw badRequest('Nothing left to refund', 'already_refunded');
    const amount = lines.reduce((n, l) => n + l.priceCents, 0);

    let stripeRefundId: string | null = null;
    if (order.provider === 'stripe' && amount > 0) {
      if (!order.stripePaymentIntentId) throw badRequest('Order has no payment to refund', 'no_payment');
      const ids = lines.map((l) => l.id).sort().join(',');
      const refund = await this.stripe.client.refunds.create(
        { payment_intent: order.stripePaymentIntentId, amount, metadata: { orderId, lineIds: ids } },
        { idempotencyKey: `refund:${orderId}:${ids}` },
      );
      stripeRefundId = refund.id;
    }
    await this.audit.log({
      actorId: actor.id,
      action: 'order.refund_requested',
      targetType: 'order',
      targetId: orderId,
      ip: actor.ip,
      meta: { amount, lineIds: lines.map((l) => l.id), reason: reason ?? null, stripeRefundId },
    });
    return this.applyRefund(orderId, lines.map((l) => l.id), { actorId: actor.id, ip: actor.ip });
  }

  /**
   * Idempotent local side of a refund (admin action or `charge.refunded` webhook): mark lines refunded, revoke the
   * enrolments they granted, reverse instructor transfers, update order status.
   */
  async applyRefund(orderId: string, lineIds: string[], who: { actorId?: string | null; ip?: string | null } = {}, kind: 'refund_clawback' | 'dispute_clawback' = 'refund_clawback') {
    const newlyRefunded: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const lineId of lineIds) {
        const r = await tx.orderLine.updateMany({ where: { id: lineId, orderId, refundedAt: null }, data: { refundedAt: new Date() } });
        if (!r.count) continue;
        newlyRefunded.push(lineId);
        const line = await tx.orderLine.findUniqueOrThrow({ where: { id: lineId }, include: { order: { select: { userId: true } } } });
        // Only this line's year goes back; a refunded renewal leaves the earlier year in force.
        const lost = await revokeYear(tx, lineId, line.order.userId, line.courseId);
        if (lost) {
          await tx.course.update({ where: { id: line.courseId }, data: { studentCount: { decrement: 1 } } });
          // A refunded course no longer counts as completed: its certificate stops verifying.
          await tx.certificate.deleteMany({ where: { userId: line.order.userId, courseId: line.courseId } });
        }
        // Owed-but-unpaid shares are simply cancelled.
        await tx.orderLine.updateMany({ where: { id: lineId, transferStatus: 'pending' }, data: { transferStatus: 'none' } });
      }
      const all = await tx.orderLine.findMany({ where: { orderId }, select: { refundedAt: true } });
      const status = all.every((l) => l.refundedAt) ? 'refunded' : 'partially_refunded';
      await tx.order.update({ where: { id: orderId }, data: { status } });
    });

    // Shares already transferred to the instructor are recovered (Stripe reversal, else netted later). Network calls
    // stay outside the DB transaction.
    for (const lineId of newlyRefunded) await this.payouts.clawback(lineId, kind);
    if (newlyRefunded.length) {
      await this.audit.log({ actorId: who.actorId ?? null, action: 'order.refunded', targetType: 'order', targetId: orderId, ip: who.ip ?? null, meta: { lineIds: newlyRefunded } });
    }
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
  }

  // ---------- learner self-service (owner 2026-11-25: 14 days, at most 25% watched, decided automatically) ----------

  /** The facts for one line, from purchase records and playback ranges only (docs/ACCESS_AND_REFUNDS.md). */
  private async lineFacts(userId: string, order: { id: string; status: string; paidAt: Date | null; refundEligibleUntil: Date | null }, l: { id: string; courseId: string; priceCents: number; refundedAt: Date | null; disputeStatus: string | null; course: { title: string } }, now = new Date()) {
    const c = await courseConsumption(this.prisma, userId, l.courseId);
    const cert = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId: l.courseId } } });
    const renewal = (await this.prisma.accessPeriod.count({ where: { userId, courseId: l.courseId, orderLineId: { not: l.id } } })) > 0;
    const withinWindow = !!order.refundEligibleUntil && order.refundEligibleUntil.getTime() >= now.getTime();
    const reason =
      l.refundedAt ? 'already_refunded'
      : l.priceCents === 0 ? 'free_course'
      : order.status !== 'paid' && order.status !== 'partially_refunded' ? 'not_paid'
      : l.disputeStatus === 'open' ? 'disputed'
      : !withinWindow ? 'window_closed'
      : c.percent > REFUND_MAX_WATCHED * 100 ? 'watched_too_much'
      : cert ? 'certificate_issued'
      : null;
    return {
      lineId: l.id, courseId: l.courseId, title: l.course.title, priceCents: l.priceCents,
      purchasedAt: order.paidAt, windowEndsAt: order.refundEligibleUntil, withinWindow, renewal,
      totalSec: c.totalSec, watchedSec: c.watchedSec, watchedPercent: c.percent, lessons: c.lessons, lessonsStarted: c.lessonsStarted,
      thresholdPercent: REFUND_MAX_WATCHED * 100, eligible: !reason, reason,
    };
  }

  async eligibility(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: { lines: { include: { course: { select: { id: true, title: true } } } } } });
    if (!order) throw notFound('Order');
    const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const used = await this.prisma.orderLine.count({ where: { order: { userId }, refundedAt: { gte: yearAgo } } });
    const pending = await this.prisma.refundRequest.findFirst({ where: { orderId, userId, status: 'pending' } });
    const lines = [];
    for (const l of order.lines) lines.push(await this.lineFacts(userId, order, l));
    return {
      orderId,
      eligibleUntil: order.refundEligibleUntil,
      policy: { windowDays: REFUND_WINDOW_DAYS, maxWatchedPercent: REFUND_MAX_WATCHED * 100, selfServicePerYear: REFUND_AUTO_LIMIT_PER_YEAR },
      selfServiceLeft: Math.max(0, REFUND_AUTO_LIMIT_PER_YEAR - used),
      pendingRequest: pending ? { id: pending.id, createdAt: pending.createdAt } : null,
      lines,
    };
  }

  /**
   * A learner's refund request is always recorded and decided at once by the policy:
   * - every chosen course qualifies → refunded now (instructor share cancelled or clawed back), up to 3 a year;
   *   beyond that it waits for a Super Admin;
   * - a course that doesn't qualify → declined with the facts and an email; the learner can ask for a human review
   *   (wrong playback data, legal rights, billing errors, exceptions). Nothing legally required is refused for good.
   */
  async request(actor: { id: string; ip: string | null }, orderId: string, lineIds: string[] | undefined, reason: string | undefined) {
    const e = await this.eligibility(actor.id, orderId);
    const wanted = e.lines.filter((l) => !lineIds?.length || lineIds.includes(l.lineId)).filter((l) => l.reason !== 'already_refunded' && l.reason !== 'free_course' && l.reason !== 'not_paid');
    if (!wanted.length) throw badRequest('Nothing to refund in this order', 'nothing_to_refund');
    if (e.pendingRequest) throw conflict('A refund request for this order is already waiting for review', 'request_pending');
    const requestedAt = new Date();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true, name: true } });
    const facts = (ls: typeof wanted) => ({ orderId, requestedAt, windowDays: REFUND_WINDOW_DAYS, thresholdPercent: REFUND_MAX_WATCHED * 100, selfServiceLeft: e.selfServiceLeft, lines: ls }) as unknown as object;
    const results: { requestId: string; status: string; lineIds: string[] }[] = [];

    const ok = wanted.filter((l) => l.eligible);
    const no = wanted.filter((l) => !l.eligible);
    if (no.length) {
      const note = no.map((l) => `${l.title}: ${REASONS[l.reason!] ?? 'not eligible'}`).join(' ');
      const req = await this.prisma.refundRequest.create({ data: { orderId, userId: actor.id, lineIds: no.map((l) => l.lineId), reason: reason?.trim() || null, status: 'auto_declined', analysis: facts(no), decisionNote: note, decidedAt: requestedAt } });
      await this.audit.log({ actorId: actor.id, action: 'refund.auto_declined', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { requestId: req.id, lines: no.map((l) => ({ lineId: l.lineId, reason: l.reason, watchedPercent: l.watchedPercent })) } });
      const top = no[0];
      await this.jobs?.sendEmail({ to: user.email, template: 'refund-declined', data: { name: user.name, course: top.title, watchedPercent: top.watchedPercent, thresholdPercent: top.thresholdPercent, windowDays: REFUND_WINDOW_DAYS, reason: top.reason, requestId: req.id, orderId } });
      void this.addAiSummary(req.id);
      results.push({ requestId: req.id, status: 'declined', lineIds: req.lineIds });
    }
    if (ok.length) {
      const ids = ok.map((l) => l.lineId);
      if (e.selfServiceLeft < ids.length) {
        const req = await this.prisma.refundRequest.create({ data: { orderId, userId: actor.id, lineIds: ids, reason: reason?.trim() || null, analysis: facts(ok) } });
        await this.audit.log({ actorId: actor.id, action: 'order.refund_request_created', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { requestId: req.id, lineIds: ids, why: 'over the yearly self-service limit' } });
        await this.jobs?.sendEmail({ to: user.email, template: 'refund-received', data: { name: user.name, courses: ok.map((l) => l.title), requestId: req.id } });
        void this.addAiSummary(req.id);
        results.push({ requestId: req.id, status: 'pending_review', lineIds: ids });
      } else {
        await this.refund(orderId, ids, reason ? `Learner: ${reason}` : 'Learner self-service refund', actor);
        const req = await this.prisma.refundRequest.create({ data: { orderId, userId: actor.id, lineIds: ids, reason: reason?.trim() || null, status: 'auto_approved', analysis: facts(ok), decidedAt: requestedAt, processedAt: new Date() } });
        await this.audit.log({ actorId: actor.id, action: 'refund.auto_approved', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { requestId: req.id, lineIds: ids } });
        await this.jobs?.sendEmail({ to: user.email, template: 'refund-approved', data: { name: user.name, courses: ok.map((l) => l.title), amountCents: ok.reduce((n, l) => n + l.priceCents, 0), requestId: req.id } });
        void this.addAiSummary(req.id);
        results.push({ requestId: req.id, status: 'refunded', lineIds: ids });
      }
    }
    // Backwards compatible summary for the receipt page.
    const status = results.every((r) => r.status === 'refunded') ? 'refunded' : results.every((r) => r.status === 'declined') ? 'declined' : results.some((r) => r.status === 'pending_review') && results.length === 1 ? 'pending_review' : 'partial';
    return { status, requests: results, requestId: results[0]?.requestId };
  }

  /** The learner asks a person to look at an automatic decline (wrong data, legal rights, an exception). */
  async requestReview(actor: { id: string; ip: string | null }, requestId: string, note: string) {
    const r = await this.prisma.refundRequest.findFirst({ where: { id: requestId, userId: actor.id } });
    if (!r) throw notFound('Refund request');
    if (r.status !== 'auto_declined') throw conflict('Only an automatic decline can be sent for review', 'not_reviewable');
    if (r.reviewRequestedAt) throw conflict('A review was already requested', 'review_requested');
    await this.prisma.refundRequest.update({ where: { id: r.id }, data: { reviewRequestedAt: new Date(), reviewNote: note.trim().slice(0, 2000) } });
    await this.audit.log({ actorId: actor.id, action: 'refund.review_requested', targetType: 'order', targetId: r.orderId, ip: actor.ip, meta: { requestId: r.id } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true, name: true } });
    await this.jobs?.sendEmail({ to: user.email, template: 'refund-review-received', data: { name: user.name, requestId: r.id } });
    return { ok: true };
  }

  /** The learner's refund requests for an order (receipt page). */
  async requestsFor(userId: string, orderId: string) {
    const rows = await this.prisma.refundRequest.findMany({ where: { orderId, userId }, orderBy: { createdAt: 'desc' } });
    return { items: rows.map((r) => ({ id: r.id, status: r.status, lineIds: r.lineIds, decisionNote: r.decisionNote, createdAt: r.createdAt, decidedAt: r.decidedAt, reviewRequestedAt: r.reviewRequestedAt, analysis: r.analysis })) };
  }

  /** Optional AI explanation for the admin; failure or no key changes nothing. */
  async addAiSummary(requestId: string) {
    if (!refundAiEnabled()) return;
    const r = await this.prisma.refundRequest.findUnique({ where: { id: requestId } });
    if (!r?.analysis) return;
    const refundsThisYear = await this.prisma.orderLine.count({ where: { order: { userId: r.userId }, refundedAt: { gte: new Date(Date.now() - 365 * 86400_000) } } });
    const s = await summarizeRefund({ status: r.status, ...(r.analysis as object), refundsThisYear });
    if (s) await this.prisma.refundRequest.update({ where: { id: requestId }, data: { aiSummary: s.text, aiModel: s.model } });
  }
}

export const REASONS: Record<string, string> = {
  already_refunded: 'This course was already refunded',
  free_course: 'Free courses have nothing to refund',
  not_paid: 'This order was not paid',
  window_closed: `Refunds are available for ${REFUND_WINDOW_DAYS} days after purchase`,
  certificate_issued: 'A certificate was issued for this course, so it can no longer be refunded',
  watched_too_much: `More than ${REFUND_MAX_WATCHED * 100}% of the course has been watched (refunds are for up to ${REFUND_MAX_WATCHED * 100}%)`,
  disputed: 'This payment is being disputed with your bank',
};
