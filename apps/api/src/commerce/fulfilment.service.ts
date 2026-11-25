import { Injectable, Logger } from '@nestjs/common';
import { grantYear } from '../access/access';
import { AuditService } from '../common/audit.service';
import { JobsService } from '../common/jobs';
import { refundDeadline, simulatedStripeFee, transferDueAt } from './money';
import { PayoutsService } from './payouts.service';
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
    private readonly payouts: PayoutsService,
  ) {}

  async fulfil(orderId: string, payment: PaymentInfo): Promise<FulfilResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const paidAt = new Date();
      const flipped = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['pending', 'failed'] } },
        data: {
          status: 'paid',
          paidAt,
          refundEligibleUntil: refundDeadline(paidAt),
          ...(payment.paymentIntentId ? { stripePaymentIntentId: payment.paymentIntentId } : {}),
          ...(payment.chargeId ? { stripeChargeId: payment.chargeId } : {}),
        },
      });
      if (flipped.count === 0) {
        return { orderId, alreadyFulfilled: true, enrolledCourseIds: [] as string[], userId: null as string | null };
      }
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
      // Instructor shares wait for the refund window to close before they are transferred.
      await tx.orderLine.updateMany({ where: { orderId, transferStatus: 'pending' }, data: { transferDueAt: transferDueAt(paidAt) } });
      const enrolled: string[] = [];
      const renewed: string[] = [];
      for (const line of order.lines) {
        // One year of access per paid line (renewals extend it); free courses have no expiry.
        const g = await grantYear(tx, { userId: order.userId, courseId: line.courseId, orderLineId: line.id, paidAt, free: line.priceCents === 0 });
        if (g.kind === 'none') continue; // unlimited access already (e.g. admin grant)
        if (g.newStudent) await tx.course.update({ where: { id: line.courseId }, data: { studentCount: { increment: 1 } } });
        enrolled.push(line.courseId);
        if (g.kind === 'renewal') renewed.push(line.courseId);
      }
      await tx.cartItem.deleteMany({ where: { userId: order.userId, courseId: { in: order.lines.map((l) => l.courseId) } } });
      await this.audit.log(
        {
          actorId: payment.actorId ?? null,
          action: 'order.paid',
          targetType: 'order',
          targetId: orderId,
          ip: payment.ip ?? null,
          meta: { via: payment.via, totalCents: order.totalCents, paymentIntentId: payment.paymentIntentId ?? null, enrolled, renewed },
        },
        tx,
      );
      return { orderId, alreadyFulfilled: false, enrolledCourseIds: enrolled, renewedCourseIds: renewed, userId: order.userId };
    });

    if (!result.alreadyFulfilled && result.userId) {
      // The receipt email is best effort: building it never blocks the order.
      try {
        const user = await this.prisma.user.findUnique({ where: { id: result.userId }, select: { email: true, name: true } });
        const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { totalCents: true, lines: { select: { courseId: true, priceCents: true, course: { select: { title: true } } } } } });
        const ens = await this.prisma.enrollment.findMany({ where: { userId: result.userId, courseId: { in: o?.lines.map((l) => l.courseId) ?? [] } }, select: { courseId: true, accessExpiresAt: true } });
        const lines = (o?.lines ?? []).map((l) => ({ title: l.course?.title ?? '', priceCents: l.priceCents, accessUntil: ens.find((e) => e.courseId === l.courseId)?.accessExpiresAt ?? null, renewal: result.renewedCourseIds?.includes(l.courseId) ?? false }));
        if (user) await this.jobs.sendEmail({ to: user.email, template: 'order-receipt', dedupeKey: `receipt:${orderId}`, data: { orderId, name: user.name, total: o?.totalCents ?? 0, lines } });
      } catch (e) {
        this.logger?.warn?.(`receipt email skipped: ${(e as Error).message}`);
      }
    }
    if (!result.alreadyFulfilled) await this.settleFee(orderId, payment.via);
    const { userId: _u, ...out } = result;
    return out;
  }

  /**
   * The split needs the real fee: free orders have none, dev test payments use a simulated Stripe fee, and Stripe
   * orders read it from the charge (it can lag a few seconds: a job retries, and `charge.updated` also settles it).
   */
  private async settleFee(orderId: string, via: PaymentInfo['via']) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.provider === 'free' || order.totalCents === 0) return void (await this.payouts.settleFee(orderId, 0, 'none'));
    if (order.provider === 'test') return void (await this.payouts.settleFee(orderId, simulatedStripeFee(order.totalCents), 'simulated'));
    const done = await this.payouts.fetchStripeFee(orderId).catch((e) => {
      this.logger.warn(`fee for ${orderId} not available yet (${via}): ${(e as Error).message}`);
      return false;
    });
    if (!done) await this.jobs.settleFee(orderId);
  }
}
