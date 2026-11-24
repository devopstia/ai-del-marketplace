import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../common/prisma.service';
import { ConnectService } from './connect.service';
import { FulfilmentService } from './fulfilment.service';
import { PayoutsService } from './payouts.service';
import { RefundsService } from './refunds.service';
import { StripeService } from './stripe.service';

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === 'P2002';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('StripeWebhook');
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly fulfilment: FulfilmentService,
    private readonly refunds: RefundsService,
    private readonly connect: ConnectService,
    private readonly audit: AuditService,
    private readonly payouts: PayoutsService,
  ) {}

  /** Process a verified event once. Handlers are idempotent too, so a race between two deliveries is harmless. */
  async handle(event: { id: string; type: string; data?: { object?: unknown }; related_object?: { id?: string } }) {
    if (await this.prisma.webhookEvent.findUnique({ where: { id: event.id } })) return { received: true, duplicate: true };
    await this.dispatch(event);
    try {
      await this.prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
    return { received: true, duplicate: false };
  }

  private async dispatch(event: { id: string; type: string; data?: { object?: unknown }; related_object?: { id?: string } }) {
    const obj = event.data?.object as any;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const s = obj as Stripe.Checkout.Session;
        if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return; // async method: wait
        const orderId = await this.orderForSession(s);
        if (!orderId) return;
        const piId = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null);
        let chargeId: string | null = null;
        if (piId && this.stripe.configured) {
          const pi = await this.stripe.client.paymentIntents.retrieve(piId);
          chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : (pi.latest_charge?.id ?? null);
        }
        await this.fulfilment.fulfil(orderId, { via: 'stripe_webhook', paymentIntentId: piId, chargeId });
        return;
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const orderId = await this.orderForSession(obj as Stripe.Checkout.Session);
        if (!orderId) return;
        const r = await this.prisma.order.updateMany({ where: { id: orderId, status: 'pending' }, data: { status: 'failed' } });
        if (r.count) await this.audit.log({ action: 'order.failed', targetType: 'order', targetId: orderId, meta: { event: event.type } });
        return;
      }
      case 'charge.refunded': {
        const charge = obj as Stripe.Charge;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (!piId) return;
        const order = await this.prisma.order.findUnique({ where: { stripePaymentIntentId: piId }, include: { lines: true } });
        if (!order) return;
        const open = order.lines.filter((l) => !l.refundedAt);
        const refundedLocally = order.lines.filter((l) => l.refundedAt).reduce((n, l) => n + l.priceCents, 0);
        if (charge.amount_refunded >= charge.amount) {
          await this.refunds.applyRefund(order.id, open.map((l) => l.id));
        } else if (charge.amount_refunded > refundedLocally) {
          // Partial refund made outside the admin screen: we can't know which course it was for. Flag it for an admin.
          await this.prisma.order.update({ where: { id: order.id }, data: { status: 'partially_refunded' } });
          await this.audit.log({
            action: 'order.partial_refund_unmatched',
            targetType: 'order',
            targetId: order.id,
            meta: { amountRefunded: charge.amount_refunded, refundedLocally },
          });
        }
        return;
      }
      case 'charge.updated': {
        // The charge's balance transaction (with the exact Stripe fee) appears here once Stripe has created it.
        const charge = obj as Stripe.Charge;
        if (charge.balance_transaction && this.stripe.configured) {
          const full = typeof charge.balance_transaction === 'string' ? await this.stripe.client.charges.retrieve(charge.id, { expand: ['balance_transaction'] }) : charge;
          await this.payouts.settleFromCharge(full);
        }
        return;
      }
      case 'charge.dispute.created': {
        // Chargeback: freeze the order's payouts until it is decided. Stripe debits the amount + fee from DEL.
        const d = obj as Stripe.Dispute;
        const piId = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id;
        const order = piId ? await this.prisma.order.findUnique({ where: { stripePaymentIntentId: piId } }) : null;
        await this.prisma.dispute.upsert({
          where: { id: d.id },
          create: { id: d.id, orderId: order?.id ?? null, amountCents: d.amount, currency: d.currency, reason: d.reason, status: 'open' },
          update: {},
        });
        if (order) await this.prisma.orderLine.updateMany({ where: { orderId: order.id, refundedAt: null }, data: { disputeStatus: 'open' } });
        await this.audit.log({ action: 'order.disputed', targetType: 'order', targetId: order?.id ?? null, meta: { disputeId: d.id, amount: d.amount, reason: d.reason } });
        return;
      }
      case 'charge.dispute.closed': {
        const d = obj as Stripe.Dispute;
        const won = d.status === 'won' || d.status === 'warning_closed';
        const row = await this.prisma.dispute.findUnique({ where: { id: d.id } });
        if (!row || row.status !== 'open') return;
        await this.prisma.dispute.update({ where: { id: d.id }, data: { status: won ? 'won' : 'lost', closedAt: new Date() } });
        if (row.orderId) {
          const lines = await this.prisma.orderLine.findMany({ where: { orderId: row.orderId, disputeStatus: 'open' } });
          await this.prisma.orderLine.updateMany({ where: { id: { in: lines.map((l) => l.id) } }, data: { disputeStatus: won ? 'won' : 'lost' } });
          // Lost: the money went back to the cardholder, so access ends and the instructor's share is recovered.
          if (!won && lines.length) await this.refunds.applyRefund(row.orderId, lines.map((l) => l.id), {}, 'dispute_clawback');
        }
        await this.audit.log({ action: won ? 'order.dispute_won' : 'order.dispute_lost', targetType: 'order', targetId: row.orderId, meta: { disputeId: d.id, status: d.status } });
        return;
      }
      case 'account.updated': {
        const acct = obj as Stripe.Account;
        await this.connect.setPayoutsEnabled(acct.id, !!acct.payouts_enabled);
        return;
      }
      default:
        // Accounts v2 thin events (e.g. v2.core.account[configuration.recipient].capability_status_updated)
        if (event.type.startsWith('v2.core.account') && event.related_object?.id && this.stripe.configured) {
          await this.connect.refreshAccount(event.related_object.id);
          return;
        }
        this.logger.debug(`ignored event ${event.type}`);
    }
  }

  private async orderForSession(s: Stripe.Checkout.Session): Promise<string | null> {
    const orderId = s.metadata?.orderId;
    if (!orderId) return null;
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, stripeCheckoutSessionId: true } });
    // The session must be the one we created for this order.
    if (!order || (order.stripeCheckoutSessionId && order.stripeCheckoutSessionId !== s.id)) {
      this.logger.warn(`session ${s.id} does not match order ${orderId}`);
      return null;
    }
    return order.id;
  }
}
