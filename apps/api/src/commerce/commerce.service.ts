import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { splitAmount } from '../common/util';
import { devPaymentsEnabled, env } from '../config/env';
import { cardInclude, toCard } from '../catalogue/course-card';
import { MediaService } from '../media/media.service';
import { FulfilmentService } from './fulfilment.service';
import { StripeService } from './stripe.service';

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly stripe: StripeService,
    private readonly fulfilment: FulfilmentService,
    private readonly media: MediaService,
  ) {}

  // ---------- cart ----------
  async cart(userId: string) {
    const rows = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { course: { include: cardInclude } },
    });
    const items = rows.map((r) => ({ ...toCard(r.course, (k) => this.media.imageUrl(k)), available: r.course.status === 'published', addedAt: r.createdAt }));
    const payable = items.filter((i) => i.available);
    return { items, count: items.length, totalCents: payable.reduce((n, i) => n + i.priceCents, 0), currency: 'usd' };
  }

  async addToCart(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, status: 'published' } });
    if (!course) throw notFound('Course');
    if (course.instructorId === userId) throw badRequest('You cannot buy your own course', 'own_course');
    const enr = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (enr && !enr.revokedAt) throw conflict('You are already enrolled in this course', 'already_enrolled');
    await this.prisma.cartItem.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId }, update: {} });
    return this.cart(userId);
  }

  async removeFromCart(userId: string, courseId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId, courseId } });
    return this.cart(userId);
  }

  async clearCart(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { userId } });
    return this.cart(userId);
  }

  // ---------- checkout ----------
  /**
   * Creates Order(pending) + OrderLines from the cart (commission from settings), then:
   *  - total 0 → fulfils right away;  - Stripe configured → Checkout Session;  - else dev test payment URL (non-prod only).
   */
  async checkout(a: Actor) {
    const userId = a.user.id;
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, priceCents: true, currency: true, status: true, instructorId: true } } },
    });
    const enrolled = new Set(
      (await this.prisma.enrollment.findMany({ where: { userId, revokedAt: null, courseId: { in: items.map((i) => i.courseId) } }, select: { courseId: true } })).map((e) => e.courseId),
    );
    const stale = items.filter((i) => i.course.status !== 'published' || enrolled.has(i.courseId) || i.course.instructorId === userId);
    if (stale.length) await this.prisma.cartItem.deleteMany({ where: { userId, courseId: { in: stale.map((s) => s.courseId) } } });
    const buy = items.filter((i) => !stale.includes(i));
    if (!buy.length) throw badRequest('Your cart is empty', 'cart_empty');

    const totalCents = buy.reduce((n, i) => n + i.course.priceCents, 0);
    const mode: 'free' | 'stripe' | 'test' = totalCents === 0 ? 'free' : this.stripe.configured ? 'stripe' : devPaymentsEnabled() ? 'test' : (null as never);
    if (!mode) throw unavailable('Payments are not configured', 'payments_unavailable');

    const commissionBps = await this.settings.commissionBps();
    const platform = new Set(
      (await this.prisma.instructorProfile.findMany({ where: { userId: { in: buy.map((b) => b.course.instructorId) }, isPlatform: true }, select: { userId: true } })).map((p) => p.userId),
    );
    const order = await this.prisma.order.create({
      data: {
        userId,
        totalCents,
        currency: 'usd',
        provider: mode,
        lines: {
          create: buy.map((i) => {
            const isPlatform = platform.has(i.course.instructorId);
            const bps = isPlatform ? 10000 : commissionBps; // the platform keeps 100% of its own courses
            const { instructorShareCents } = splitAmount(i.course.priceCents, bps);
            return {
              courseId: i.courseId,
              instructorId: i.course.instructorId,
              priceCents: i.course.priceCents,
              commissionBps: bps,
              instructorShareCents,
              transferStatus: isPlatform || instructorShareCents === 0 ? 'none' : 'pending',
            };
          }),
        },
      },
      include: { lines: true },
    });
    await this.audit.log({ actorId: userId, action: 'order.created', targetType: 'order', targetId: order.id, ip: a.ip, meta: { totalCents, mode, lines: order.lines.length } });

    const web = env().WEB_URL;
    if (mode === 'free') {
      await this.fulfilment.fulfil(order.id, { via: 'free_checkout', actorId: userId, ip: a.ip });
      return { orderId: order.id, mode, url: `${web}/checkout/success?order=${order.id}` };
    }
    if (mode === 'test') {
      return { orderId: order.id, mode, url: `${web}/checkout/test-payment?order=${order.id}` };
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
    const session = await this.stripe.client.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: user.email,
        client_reference_id: userId,
        line_items: buy
          .filter((i) => i.course.priceCents > 0)
          .map((i) => ({ quantity: 1, price_data: { currency: 'usd', unit_amount: i.course.priceCents, product_data: { name: i.course.title, metadata: { courseId: i.courseId } } } })),
        metadata: { orderId: order.id },
        payment_intent_data: { transfer_group: order.id, metadata: { orderId: order.id } },
        success_url: `${web}/checkout/success?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${web}/cart?canceled=1`,
      },
      { idempotencyKey: `checkout:${order.id}` },
    );
    await this.prisma.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });
    return { orderId: order.id, mode, url: session.url! };
  }

  /** DEV ONLY: simulates a successful payment, then runs the same fulfilment function as the Stripe webhook. */
  async completeTestPayment(a: Actor, orderId: string) {
    if (!devPaymentsEnabled()) throw notFound('Route');
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== a.user.id) throw notFound('Order');
    if (order.provider !== 'test') throw forbidden('This order is not a test-payment order', 'not_test_order');
    const r = await this.fulfilment.fulfil(orderId, { via: 'dev_test_payment', actorId: a.user.id, ip: a.ip });
    return { ...r, order: await this.order(a.user.id, orderId) };
  }

  // ---------- orders ----------
  async orders(userId: string) {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { lines: { include: { course: { select: { slug: true, title: true } } } } },
      take: 100,
    });
    return { items: rows.map((o) => this.orderView(o)) };
  }

  async order(userId: string, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, userId }, include: { lines: { include: { course: { select: { slug: true, title: true } } } } } });
    if (!o) throw notFound('Order');
    return this.orderView(o);
  }

  private orderView(o: {
    id: string; status: string; totalCents: number; currency: string; provider: string; paidAt: Date | null; createdAt: Date;
    lines: { id: string; courseId: string; priceCents: number; refundedAt: Date | null; course: { slug: string; title: string } }[];
  }) {
    return {
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      currency: o.currency,
      provider: o.provider,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      lines: o.lines.map((l) => ({ id: l.id, courseId: l.courseId, slug: l.course.slug, title: l.course.title, priceCents: l.priceCents, refundedAt: l.refundedAt })),
    };
  }
}
