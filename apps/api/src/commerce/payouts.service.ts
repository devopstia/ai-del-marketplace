import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';
import { splitOrder } from './money';
import { StripeService } from './stripe.service';

type FeeSource = 'stripe' | 'simulated' | 'none';

/**
 * Money after payment: the real Stripe fee → the per-line split; instructor transfers after the refund-window hold;
 * recovering an instructor's share when a sale is refunded or a dispute is lost after their share was transferred.
 * Everything is idempotent (conditional updates + Stripe idempotency keys) so jobs and webhooks can retry freely.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger('Payouts');
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
  ) {}

  /** Stores the order's fee and splits every line on its net (fee allocated by price). Never touches a transferred line. */
  async settleFee(orderId: string, feeCents: number, source: FeeSource, balanceTxnId: string | null = null) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { id: 'asc' } } } });
      if (!order) return false;
      if (order.stripeFeeCents != null && order.feeSource === source) return false; // already settled
      if (order.lines.some((l) => l.transferStatus === 'paid' || l.transferStatus === 'reversed')) {
        this.logger.warn(`order ${orderId}: fee arrived after a transfer; split left as is`);
        return false;
      }
      const fee = Math.min(feeCents, order.lines.reduce((a, l) => a + l.priceCents, 0));
      const splits = splitOrder(fee, order.lines.map((l) => ({ baseCents: l.priceCents, platformBps: l.commissionBps })));
      for (const [i, line] of order.lines.entries()) {
        const s = splits[i]!;
        const share = line.payee === 'platform' ? 0 : s.instructorShareCents;
        await tx.orderLine.update({
          where: { id: line.id },
          data: {
            feeCents: s.feeCents,
            netCents: s.netCents,
            instructorShareCents: share,
            // a line whose share rounds to 0 has nothing to transfer
            ...(line.transferStatus === 'pending' && share === 0 ? { transferStatus: 'none' as const } : {}),
          },
        });
      }
      await tx.order.update({ where: { id: orderId }, data: { stripeFeeCents: fee, feeSource: source, balanceTxnId } });
      await this.audit.log({ action: 'order.fee_settled', targetType: 'order', targetId: orderId, meta: { feeCents: fee, source, balanceTxnId } }, tx);
      return true;
    });
  }

  /**
   * Reads the real fee from Stripe (the charge's balance transaction). Stripe creates it asynchronously, so it may not
   * exist yet right after payment: returns false and the caller (job / `charge.updated` webhook) tries again later.
   */
  async fetchStripeFee(orderId: string): Promise<boolean> {
    if (!this.stripe.configured) return false;
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.stripeChargeId || order.feeSource === 'stripe') return !!order && order.feeSource === 'stripe';
    const charge = await this.stripe.client.charges.retrieve(order.stripeChargeId, { expand: ['balance_transaction'] });
    return this.settleFromCharge(charge);
  }

  async settleFromCharge(charge: Stripe.Charge): Promise<boolean> {
    const bt = charge.balance_transaction;
    if (!bt || typeof bt === 'string') return false;
    const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    const order = piId ? await this.prisma.order.findUnique({ where: { stripePaymentIntentId: piId } }) : null;
    if (!order) return false;
    // Only Stripe's processing fee belongs in the split (not Stripe Tax fees or withheld tax).
    const stripeFee = bt.fee_details?.filter((f) => f.type === 'stripe_fee').reduce((a, f) => a + f.amount, 0) ?? bt.fee;
    if (bt.currency !== order.currency) this.logger.warn(`order ${order.id}: settlement currency ${bt.currency} ≠ ${order.currency}`);
    await this.settleFee(order.id, stripeFee, 'stripe', bt.id);
    return true;
  }

  /**
   * Transfers every instructor share whose hold has ended (refund window closed, no open dispute, fee known), to
   * instructors who finished Stripe onboarding. Money the instructor owes from earlier clawbacks is netted first.
   */
  async releaseDue(now = new Date(), instructorId?: string): Promise<{ transferred: number; netted: number }> {
    if (!this.stripe.configured) return { transferred: 0, netted: 0 };
    const lines = await this.prisma.orderLine.findMany({
      where: {
        transferStatus: 'pending',
        payee: 'instructor',
        refundedAt: null,
        OR: [{ disputeStatus: null }, { disputeStatus: 'won' }],
        transferDueAt: { lte: now },
        ...(instructorId ? { instructorId } : {}),
        order: { status: { in: ['paid', 'partially_refunded'] }, stripeChargeId: { not: null }, stripeFeeCents: { not: null } },
        instructor: { instructorProfile: { payoutsEnabled: true, stripeAccountId: { not: null }, isPlatform: false } },
      },
      include: { order: true, instructor: { select: { instructorProfile: true } } },
      orderBy: { transferDueAt: 'asc' },
    });
    let transferred = 0;
    let netted = 0;
    for (const line of lines) {
      const owed = await this.owedBy(line.instructorId);
      const deduct = Math.min(owed, line.instructorShareCents);
      const amount = line.instructorShareCents - deduct;
      try {
        let transferId: string | null = null;
        if (amount > 0) {
          const t = await this.stripe.client.transfers.create(
            {
              amount,
              currency: line.order.currency,
              destination: line.instructor.instructorProfile!.stripeAccountId!,
              transfer_group: line.orderId,
              source_transaction: line.order.stripeChargeId!,
              metadata: { orderId: line.orderId, orderLineId: line.id, courseId: line.courseId, nettedCents: String(deduct) },
            },
            { idempotencyKey: `transfer:${line.id}` },
          );
          transferId = t.id;
          transferred++;
        }
        await this.prisma.$transaction(async (tx) => {
          const r = await tx.orderLine.updateMany({ where: { id: line.id, transferStatus: 'pending' }, data: { transferStatus: 'paid', transferId } });
          if (!r.count) return;
          if (deduct > 0) {
            await tx.ledgerEntry.create({ data: { instructorId: line.instructorId, orderLineId: line.id, amountCents: deduct, kind: 'netted', note: 'Recovered from this sale before transfer' } });
            netted++;
          }
          await this.audit.log({ action: 'payout.transfer_created', targetType: 'order_line', targetId: line.id, meta: { orderId: line.orderId, transferId, amount, nettedCents: deduct } }, tx);
        });
      } catch (e) {
        this.logger.error(`transfer for line ${line.id} failed: ${(e as Error).message}`);
        await this.audit.log({ action: 'payout.transfer_failed', targetType: 'order_line', targetId: line.id, meta: { error: (e as Error).message } });
      }
    }
    return { transferred, netted };
  }

  /** What the instructor still owes the platform (sum of clawbacks minus recoveries), in cents ≥ 0. */
  async owedBy(instructorId: string): Promise<number> {
    const s = await this.prisma.ledgerEntry.aggregate({ where: { instructorId }, _sum: { amountCents: true } });
    return Math.max(0, -(s._sum.amountCents ?? 0));
  }

  /**
   * A refunded or lost-dispute sale whose share was already transferred: reverse the transfer in Stripe; if Stripe
   * refuses (the instructor's balance is too low), record the debt so it is netted from their next transfers.
   */
  async clawback(lineId: string, kind: 'refund_clawback' | 'dispute_clawback') {
    const line = await this.prisma.orderLine.findUnique({ where: { id: lineId } });
    if (!line || line.transferStatus !== 'paid') return;
    const netted = await this.nettedFor(line.id);
    const sent = line.instructorShareCents - netted;
    if (netted > 0) {
      // Part of this sale paid off an earlier debt; the sale is undone, so that debt is owed again.
      await this.prisma.ledgerEntry.create({ data: { instructorId: line.instructorId, orderLineId: line.id, amountCents: -netted, kind, note: 'Earlier recovery came from a sale that was undone' } });
    }
    if (sent <= 0 || !line.transferId) {
      await this.prisma.orderLine.update({ where: { id: line.id }, data: { transferStatus: 'reversed' } });
      return;
    }
    try {
      await this.stripe.client.transfers.createReversal(line.transferId, { amount: sent, metadata: { orderLineId: line.id, kind } }, { idempotencyKey: `reversal:${line.id}` });
      await this.prisma.orderLine.update({ where: { id: line.id }, data: { transferStatus: 'reversed' } });
      await this.audit.log({ action: 'payout.transfer_reversed', targetType: 'order_line', targetId: line.id, meta: { transferId: line.transferId, amount: sent, kind } });
    } catch (e) {
      await this.prisma.$transaction(async (tx) => {
        await tx.orderLine.update({ where: { id: line.id }, data: { transferStatus: 'reversed' } });
        await tx.ledgerEntry.create({ data: { instructorId: line.instructorId, orderLineId: line.id, amountCents: -sent, kind, note: `Stripe reversal failed: ${(e as Error).message}`.slice(0, 300) } });
        await this.audit.log({ action: 'payout.clawback_recorded', targetType: 'order_line', targetId: line.id, meta: { amount: sent, kind, error: (e as Error).message } }, tx);
      });
    }
  }

  private async nettedFor(lineId: string) {
    const s = await this.prisma.ledgerEntry.aggregate({ where: { orderLineId: lineId, kind: 'netted' }, _sum: { amountCents: true } });
    return s._sum.amountCents ?? 0;
  }
}
