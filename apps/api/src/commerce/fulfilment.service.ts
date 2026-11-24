import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StripeService } from './stripe.service';

export interface PaymentInfo {
  /** where the confirmation came from (audit) */
  via: 'stripe_webhook' | 'dev_test_payment' | 'free_checkout' | 'reconcile';
  paymentIntentId?: string | null;
  chargeId?: string | null;
  actorId?: string | null;
  ip?: string | null;
}

export interface FulfilResult {
  orderId: string;
  alreadyFulfilled: boolean;
  enrolledCourseIds: string[];
}

/**
 * THE fulfilment function. Stripe webhooks, dev test payments and free checkouts all call `fulfil()`.
 * Idempotent: the order flips pending→paid with a conditional update inside a transaction, so a second call
 * (duplicate webhook, retry, double click) changes nothing. Transfers are issued afterwards, each with its own
 * Stripe idempotency key, and only for lines still `pending`, so they're safe to retry too.
 */
@Injectable()
export class FulfilmentService {
  private readonly logger = new Logger('Fulfilment');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
    private readonly jobs: JobsService,
  ) {}

  async fulfil(orderId: string, payment: PaymentInfo): Promise<FulfilResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const flipped = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['pending', 'failed'] } },
        data: {
          status: 'paid',
          paidAt: new Date(),
          ...(payment.paymentIntentId ? { stripePaymentIntentId: payment.paymentIntentId } : {}),
          ...(payment.chargeId ? { stripeChargeId: payment.chargeId } : {}),
        },
      });
      if (flipped.count === 0) {
        return { orderId, alreadyFulfilled: true, enrolledCourseIds: [] as string[], userId: null as string | null };
      }
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
      const enrolled: string[] = [];
      for (const line of order.lines) {
        const key = { userId_courseId: { userId: order.userId, courseId: line.courseId } };
        const existing = await tx.enrollment.findUnique({ where: key });
        const source = line.priceCents === 0 ? ('free' as const) : ('purchase' as const);
        if (!existing) {
          await tx.enrollment.create({ data: { userId: order.userId, courseId: line.courseId, orderLineId: line.id, source } });
        } else if (existing.revokedAt) {
          await tx.enrollment.update({ where: key, data: { revokedAt: null, orderLineId: line.id, source } });
        } else {
          continue; // already enrolled (e.g. admin grant): nothing to do
        }
        await tx.course.update({ where: { id: line.courseId }, data: { studentCount: { increment: 1 } } });
        enrolled.push(line.courseId);
      }
      await tx.cartItem.deleteMany({ where: { userId: order.userId, courseId: { in: order.lines.map((l) => l.courseId) } } });
      await this.audit.log(
        {
          actorId: payment.actorId ?? null,
          action: 'order.paid',
          targetType: 'order',
          targetId: orderId,
          ip: payment.ip ?? null,
          meta: { via: payment.via, totalCents: order.totalCents, paymentIntentId: payment.paymentIntentId ?? null, enrolled },
        },
        tx,
      );
      return { orderId, alreadyFulfilled: false, enrolledCourseIds: enrolled, userId: order.userId };
    });

    if (!result.alreadyFulfilled && result.userId) {
      const user = await this.prisma.user.findUnique({ where: { id: result.userId }, select: { email: true } });
      if (user) await this.jobs.sendEmail({ to: user.email, template: 'order-receipt', data: { orderId } });
    }
    await this.issueTransfers(orderId);
    const { userId: _u, ...out } = result;
    return out;
  }

  /**
   * Pay instructors their share: one Stripe transfer per order line whose instructor has a connected account with
   * payouts enabled and is not the platform itself. `source_transaction` ties the transfer to the charge (so it waits
   * for the funds) and the idempotency key makes retries safe. Lines that can't be paid yet stay `pending`.
   */
  async issueTransfers(orderId: string): Promise<number> {
    if (!this.stripe.configured) return 0;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: { where: { transferStatus: 'pending', refundedAt: null }, include: { instructor: { select: { instructorProfile: true } } } } },
    });
    if (!order || order.status !== 'paid' || !order.stripeChargeId) return 0;
    let sent = 0;
    for (const line of order.lines) {
      const p = line.instructor.instructorProfile;
      if (!p || p.isPlatform || !p.stripeAccountId || !p.payoutsEnabled || line.instructorShareCents <= 0) continue;
      try {
        const transfer = await this.stripe.client.transfers.create(
          {
            amount: line.instructorShareCents,
            currency: order.currency,
            destination: p.stripeAccountId,
            transfer_group: order.id,
            source_transaction: order.stripeChargeId,
            metadata: { orderId: order.id, orderLineId: line.id, courseId: line.courseId },
          },
          { idempotencyKey: `transfer:${line.id}` },
        );
        await this.prisma.orderLine.update({ where: { id: line.id }, data: { transferId: transfer.id, transferStatus: 'paid' } });
        await this.audit.log({
          action: 'payout.transfer_created',
          targetType: 'order_line',
          targetId: line.id,
          meta: { orderId: order.id, transferId: transfer.id, amount: line.instructorShareCents, destination: p.stripeAccountId },
        });
        sent++;
      } catch (e) {
        this.logger.error(`transfer for line ${line.id} failed: ${(e as Error).message}`);
        await this.audit.log({ action: 'payout.transfer_failed', targetType: 'order_line', targetId: line.id, meta: { error: (e as Error).message } });
      }
    }
    return sent;
  }

  /** After an instructor finishes onboarding, pay out everything that was waiting for them. */
  async settlePendingForInstructor(instructorId: string) {
    const orders = await this.prisma.orderLine.findMany({
      where: { instructorId, transferStatus: 'pending', refundedAt: null, order: { status: { in: ['paid', 'partially_refunded'] } } },
      select: { orderId: true },
      distinct: ['orderId'],
    });
    for (const o of orders) await this.issueTransfers(o.orderId);
  }
}
