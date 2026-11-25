import { Injectable, Logger } from '@nestjs/common';
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
        const enr = await tx.enrollment.updateMany({ where: { orderLineId: lineId, revokedAt: null }, data: { revokedAt: new Date() } });
        if (enr.count) await tx.course.update({ where: { id: line.courseId }, data: { studentCount: { decrement: 1 } } });
        // A refunded course no longer counts as completed: its certificate stops verifying.
        await tx.certificate.deleteMany({ where: { userId: line.order.userId, courseId: line.courseId } });
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

  // ---------- learner self-service ----------

  /**
   * Refund policy per line: 14 days from purchase, under 25% of the course video watched, no certificate issued.
   * Self-service refunds are limited to 3 per 12 months; beyond that a request goes to an admin.
   */
  async eligibility(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: { lines: { include: { course: { select: { id: true, title: true } } } } } });
    if (!order) throw notFound('Order');
    const now = Date.now();
    const yearAgo = new Date(now - 365 * 24 * 3600 * 1000);
    const used = await this.prisma.orderLine.count({ where: { order: { userId }, refundedAt: { gte: yearAgo } } });
    const pending = await this.prisma.refundRequest.findFirst({ where: { orderId, userId, status: 'pending' } });
    const lines = [];
    for (const l of order.lines) {
      const watched = await this.watchedFraction(userId, l.courseId);
      const cert = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId: l.courseId } } });
      const reason =
        l.refundedAt ? 'already_refunded'
        : l.priceCents === 0 ? 'free_course'
        : order.status !== 'paid' && order.status !== 'partially_refunded' ? 'not_paid'
        : !order.refundEligibleUntil || order.refundEligibleUntil.getTime() < now ? 'window_closed'
        : cert ? 'certificate_issued'
        : watched >= REFUND_MAX_WATCHED ? 'watched_too_much'
        : l.disputeStatus === 'open' ? 'disputed'
        : null;
      lines.push({ lineId: l.id, courseId: l.courseId, title: l.course.title, eligible: !reason, reason, watchedPercent: Math.round(watched * 100) });
    }
    return {
      orderId,
      eligibleUntil: order.refundEligibleUntil,
      policy: { windowDays: REFUND_WINDOW_DAYS, maxWatchedPercent: REFUND_MAX_WATCHED * 100, selfServicePerYear: REFUND_AUTO_LIMIT_PER_YEAR },
      selfServiceLeft: Math.max(0, REFUND_AUTO_LIMIT_PER_YEAR - used),
      pendingRequest: pending ? { id: pending.id, createdAt: pending.createdAt } : null,
      lines,
    };
  }

  /** Learner refund: eligible lines are refunded at once; over the yearly limit, the request waits for an admin. */
  async request(actor: { id: string; ip: string | null }, orderId: string, lineIds: string[] | undefined, reason: string | undefined) {
    const e = await this.eligibility(actor.id, orderId);
    const wanted = e.lines.filter((l) => !lineIds?.length || lineIds.includes(l.lineId)).filter((l) => l.reason !== 'already_refunded');
    if (!wanted.length) throw badRequest('Nothing to refund in this order', 'nothing_to_refund');
    const blocked = wanted.find((l) => !l.eligible);
    if (blocked) throw badRequest(REASONS[blocked.reason!] ?? 'This purchase is not eligible for a refund', blocked.reason!);
    if (e.pendingRequest) throw conflict('A refund request for this order is already waiting for review', 'request_pending');
    const ids = wanted.map((l) => l.lineId);
    if (e.selfServiceLeft < ids.length) {
      const req = await this.prisma.refundRequest.create({ data: { orderId, userId: actor.id, lineIds: ids, reason: reason?.trim() || null } });
      await this.audit.log({ actorId: actor.id, action: 'order.refund_request_created', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { requestId: req.id, lineIds: ids } });
      return { status: 'pending_review' as const, requestId: req.id };
    }
    await this.audit.log({ actorId: actor.id, action: 'order.refund_self_service', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { lineIds: ids, reason: reason ?? null } });
    await this.refund(orderId, ids, reason ? `Learner: ${reason}` : 'Learner self-service refund', actor);
    return { status: 'refunded' as const };
  }

  /** Fraction of the course's video the learner has watched (completed lectures count in full). */
  private async watchedFraction(userId: string, courseId: string) {
    const lectures = await this.prisma.lecture.findMany({
      where: { section: { courseId }, type: 'video' },
      select: { durationSec: true, progress: { where: { userId }, select: { positionSec: true, completed: true } } },
    });
    const total = lectures.reduce((a, l) => a + l.durationSec, 0);
    if (!total) return 0;
    const seen = lectures.reduce((a, l) => {
      const p = l.progress[0];
      return a + (!p ? 0 : p.completed ? l.durationSec : Math.min(p.positionSec, l.durationSec));
    }, 0);
    return seen / total;
  }
}

export const REASONS: Record<string, string> = {
  already_refunded: 'This course was already refunded',
  free_course: 'Free courses have nothing to refund',
  not_paid: 'This order was not paid',
  window_closed: `Refunds are available for ${REFUND_WINDOW_DAYS} days after purchase`,
  certificate_issued: 'A certificate was issued for this course, so it can no longer be refunded',
  watched_too_much: `Refunds are available while less than ${REFUND_MAX_WATCHED * 100}% of the course has been watched`,
  disputed: 'This payment is being disputed with your bank',
};
