import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StripeService } from './stripe.service';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger('Refunds');
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
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
  async applyRefund(orderId: string, lineIds: string[], who: { actorId?: string | null; ip?: string | null } = {}) {
    const newlyRefunded: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const lineId of lineIds) {
        const r = await tx.orderLine.updateMany({ where: { id: lineId, orderId, refundedAt: null }, data: { refundedAt: new Date() } });
        if (!r.count) continue;
        newlyRefunded.push(lineId);
        const enr = await tx.enrollment.updateMany({ where: { orderLineId: lineId, revokedAt: null }, data: { revokedAt: new Date() } });
        if (enr.count) {
          const line = await tx.orderLine.findUniqueOrThrow({ where: { id: lineId } });
          await tx.course.update({ where: { id: line.courseId }, data: { studentCount: { decrement: 1 } } });
        }
        // Owed-but-unpaid shares are simply cancelled.
        await tx.orderLine.updateMany({ where: { id: lineId, transferStatus: 'pending' }, data: { transferStatus: 'none' } });
      }
      const all = await tx.orderLine.findMany({ where: { orderId }, select: { refundedAt: true } });
      const status = all.every((l) => l.refundedAt) ? 'refunded' : 'partially_refunded';
      await tx.order.update({ where: { id: orderId }, data: { status } });
    });

    // Transfers are reversed outside the DB transaction (network calls), each with its own idempotency key.
    const paidLines = await this.prisma.orderLine.findMany({ where: { id: { in: newlyRefunded }, transferStatus: 'paid', transferId: { not: null } } });
    for (const line of paidLines) {
      try {
        await this.stripe.client.transfers.createReversal(
          line.transferId!,
          { amount: line.instructorShareCents, metadata: { orderId, orderLineId: line.id } },
          { idempotencyKey: `reversal:${line.id}` },
        );
        await this.prisma.orderLine.update({ where: { id: line.id }, data: { transferStatus: 'reversed' } });
        await this.audit.log({ action: 'payout.transfer_reversed', targetType: 'order_line', targetId: line.id, meta: { transferId: line.transferId } });
      } catch (e) {
        this.logger.error(`reversal for line ${line.id} failed: ${(e as Error).message}`);
        await this.audit.log({ action: 'payout.reversal_failed', targetType: 'order_line', targetId: line.id, meta: { error: (e as Error).message } });
      }
    }
    if (newlyRefunded.length) {
      await this.audit.log({ actorId: who.actorId ?? null, action: 'order.refunded', targetType: 'order', targetId: orderId, ip: who.ip ?? null, meta: { lineIds: newlyRefunded } });
    }
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
  }
}
