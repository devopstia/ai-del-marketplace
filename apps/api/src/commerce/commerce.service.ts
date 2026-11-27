import { Injectable } from '@nestjs/common';
import { blockingEnrollmentWhere } from '../access/access';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { devPaymentsEnabled, env } from '../config/env';
import { cardInclude, cardPriceInput, toCard } from '../catalogue/course-card';
import { SalePricingService } from '../common/sale-pricing';
import { usd } from '../common/pricing';
import { MediaService } from '../media/media.service';
import { FulfilmentService } from './fulfilment.service';
import { splitLine } from './money';
import { TERMS_VERSION, termsAcceptance, type TermsInput } from './terms';
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
    private readonly pricing: SalePricingService,
  ) {}

  // ---------- cart ----------
  async cart(userId: string) {
    const rows = await this.prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: { course: { include: cardInclude } },
    });
    const prices = await this.pricing.prices(rows.map((r) => cardPriceInput(r.course)));
    const items = rows.map((r) => ({ ...toCard(r.course, (k) => this.media.imageUrl(k), prices.get(r.course.id)), available: r.course.status === 'published', addedAt: r.createdAt }));
    const payable = items.filter((i) => i.available);
    return { items, count: items.length, totalCents: payable.reduce((n, i) => n + i.priceCents, 0), currency: 'usd' };
  }

  async addToCart(userId: string, courseId: string) {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, status: 'published' } });
    if (!course) throw notFound('Course');
    if (course.instructorId === userId) throw badRequest('You cannot buy your own course', 'own_course');
    // One-year access: a course can be bought again (renewed) in its last 30 days or after it expired.
    const enr = await this.prisma.enrollment.findFirst({ where: { userId, courseId, ...blockingEnrollmentWhere() } });
    if (enr) throw conflict('You already have access to this course. You can renew it in the last 30 days before it ends.', 'already_enrolled');
    await this.prisma.cartItem.upsert({ where: { userId_courseId: { userId, courseId } }, create: { userId, courseId }, update: {} });
    return this.cart(userId);
  }

  /**
   * Guest cart (no session, no writes): card data for the given course ids, in the given order. Ids that are not
   * published (or do not exist) are returned in `unavailableIds` so the browser can drop them.
   */
  async previewCart(courseIds: string[]) {
    const ids = [...new Set(courseIds)];
    const rows = await this.prisma.course.findMany({ where: { id: { in: ids }, status: 'published' }, include: cardInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const prices = await this.pricing.prices(rows.map(cardPriceInput));
    const items = ids.filter((id) => byId.has(id)).map((id) => ({ ...toCard(byId.get(id)!, (k) => this.media.imageUrl(k), prices.get(id)), available: true }));
    return { items, count: items.length, totalCents: items.reduce((n, i) => n + i.priceCents, 0), currency: 'usd', unavailableIds: ids.filter((id) => !byId.has(id)) };
  }

  /**
   * After sign-in: move a guest cart into the user's cart. Skips (with a reason) courses that are unavailable,
   * the user's own, already owned, or already in the cart. Returns the cart plus `merge: { added, skipped }`.
   */
  async mergeCart(userId: string, courseIds: string[]) {
    const ids = [...new Set(courseIds)];
    const [courses, enrolled, inCart] = await Promise.all([
      this.prisma.course.findMany({ where: { id: { in: ids }, status: 'published' }, select: { id: true, instructorId: true } }),
      this.prisma.enrollment.findMany({ where: { userId, courseId: { in: ids }, ...blockingEnrollmentWhere() }, select: { courseId: true } }),
      this.prisma.cartItem.findMany({ where: { userId, courseId: { in: ids } }, select: { courseId: true } }),
    ]);
    const pub = new Map(courses.map((c) => [c.id, c]));
    const owned = new Set(enrolled.map((e) => e.courseId));
    const already = new Set(inCart.map((c) => c.courseId));
    const added: string[] = [];
    const skipped: { courseId: string; reason: 'unavailable' | 'own_course' | 'already_enrolled' | 'already_in_cart' }[] = [];
    for (const id of ids) {
      const c = pub.get(id);
      if (!c) skipped.push({ courseId: id, reason: 'unavailable' });
      else if (c.instructorId === userId) skipped.push({ courseId: id, reason: 'own_course' });
      else if (owned.has(id)) skipped.push({ courseId: id, reason: 'already_enrolled' });
      else if (already.has(id)) skipped.push({ courseId: id, reason: 'already_in_cart' });
      else added.push(id);
    }
    if (added.length) await this.prisma.cartItem.createMany({ data: added.map((courseId) => ({ userId, courseId })), skipDuplicates: true });
    return { ...(await this.cart(userId)), merge: { added, skipped } };
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
  async checkout(a: Actor, opts: { immediateAccessConsent?: boolean } & TermsInput = {}) {
    const userId = a.user.id;
    // Every order (free ones too) records the accepted version of the Terms of use and the Access and refunds policy.
    const terms = termsAcceptance(opts, a.ip);
    if (!terms) {
      throw opts.acceptTerms === true
        ? badRequest('Our terms were updated. Reload the page, read them and accept the current version.', 'terms_outdated', { currentVersion: TERMS_VERSION })
        : badRequest('Accept the Terms of use and the Access and refunds policy before continuing', 'terms_required', { currentVersion: TERMS_VERSION });
    }
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { course: { select: { id: true, title: true, priceCents: true, currency: true, status: true, instructorId: true } } },
    });
    const enrolled = new Set(
      (await this.prisma.enrollment.findMany({ where: { userId, courseId: { in: items.map((i) => i.courseId) }, ...blockingEnrollmentWhere() }, select: { courseId: true } })).map((e) => e.courseId),
    );
    const stale = items.filter((i) => i.course.status !== 'published' || enrolled.has(i.courseId) || i.course.instructorId === userId);
    if (stale.length) await this.prisma.cartItem.deleteMany({ where: { userId, courseId: { in: stale.map((s) => s.courseId) } } });
    const buy = items.filter((i) => !stale.includes(i));
    if (!buy.length) throw badRequest('Your cart is empty', 'cart_empty');

    // The price is fixed here, when the order is created: a sale that is running now applies, one that ended does not.
    const prices = await this.pricing.pricesForIds(buy.map((i) => i.courseId));
    const priceOf = (courseId: string, list: number) => prices.get(courseId) ?? { listPriceCents: list, priceCents: list, sale: null };
    const totalCents = buy.reduce((n, i) => n + priceOf(i.courseId, i.course.priceCents).priceCents, 0);
    const mode: 'free' | 'stripe' | 'test' = totalCents === 0 ? 'free' : this.stripe.configured ? 'stripe' : devPaymentsEnabled() ? 'test' : (null as never);
    if (!mode) throw unavailable('Payments are not configured', 'payments_unavailable');

    // Digital content: the buyer asks for immediate access and acknowledges the withdrawal-right rule (EU/UK law).
    if (totalCents > 0 && !opts.immediateAccessConsent) {
      throw badRequest('Confirm that you want immediate access to the course before paying', 'consent_required');
    }
    const defaultBps = await this.settings.commissionBps();
    const profiles = new Map(
      (await this.prisma.instructorProfile.findMany({
        where: { userId: { in: buy.map((b) => b.course.instructorId) } },
        select: { userId: true, isPlatform: true, commissionBps: true, payToPlatform: true },
      })).map((p) => [p.userId, p]),
    );
    const order = await this.prisma.order.create({
      data: {
        userId,
        totalCents,
        currency: 'usd',
        provider: mode,
        immediateAccessConsentAt: opts.immediateAccessConsent ? new Date() : null,
        ...terms,
        lines: {
          create: buy.map((i) => {
            const p = profiles.get(i.course.instructorId);
            // DEL's own courses: everything to the platform. Others: the instructor's agreed rate, else the default.
            const bps = p?.isPlatform ? 10000 : (p?.commissionBps ?? defaultBps);
            const payee = p?.isPlatform ? ('platform' as const) : p?.payToPlatform ? ('del_agreement' as const) : ('instructor' as const);
            // The split uses what the learner actually pays (the sale price when a sale applies).
            // Provisional before the Stripe fee is known (fee 0); settled on the real fee right after payment.
            const price = priceOf(i.courseId, i.course.priceCents);
            const s = splitLine(price.priceCents, 0, bps);
            const share = payee === 'platform' ? 0 : s.instructorShareCents;
            return {
              courseId: i.courseId,
              instructorId: i.course.instructorId,
              priceCents: price.priceCents,
              listPriceCents: i.course.priceCents,
              saleKind: price.sale?.kind ?? null,
              saleId: price.sale?.id ?? null,
              commissionBps: bps,
              netCents: s.netCents,
              instructorShareCents: share,
              payee,
              transferStatus: payee === 'instructor' && share > 0 ? ('pending' as const) : ('none' as const),
            };
          }),
        },
      },
      include: { lines: true },
    });
    await this.audit.log({ actorId: userId, action: 'order.created', targetType: 'order', targetId: order.id, ip: a.ip, meta: { totalCents, mode, lines: order.lines.length, discountCents: order.lines.reduce((n, l) => n + ((l.listPriceCents ?? l.priceCents) - l.priceCents), 0) } });

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
        // Payment methods (card, Link, wallets, bank, Klarna…) come from the Stripe Dashboard › Settings › Payment methods,
        // per mode. `payment_method_types` is retired for Checkout Sessions (Stripe 2026-09-30); a per-session card-only
        // setting was tried on staging and Stripe still showed Link, so it is managed in the Dashboard only.
        customer_email: user.email,
        client_reference_id: userId,
        // Stripe charges exactly the order lines (sale prices included).
        line_items: order.lines
          .filter((l) => l.priceCents > 0)
          .map((l) => {
            const title = buy.find((i) => i.courseId === l.courseId)!.course.title;
            const was = l.listPriceCents && l.listPriceCents > l.priceCents ? `Sale price (regular ${usd(l.listPriceCents)})` : undefined;
            return { quantity: 1, price_data: { currency: 'usd', unit_amount: l.priceCents, product_data: { name: title, ...(was ? { description: was } : {}), metadata: { courseId: l.courseId } } } };
          }),
        metadata: { orderId: order.id },
        payment_intent_data: { transfer_group: order.id, metadata: { orderId: order.id } },
        // Stripe "Managed Payments" (on by default on new accounts) doesn't support Connect, which pays instructors:
        // turn it off for every marketplace checkout so a Dashboard default can't break payments (owner 2026-11-27).
        ...({ managed_payments: { enabled: false } } as Record<string, unknown>),
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
    termsVersion: string | null; termsAcceptedAt: Date | null;
    lines:{ id: string; courseId: string; priceCents: number; listPriceCents: number | null; saleKind: string | null; refundedAt: Date | null; course: { slug: string; title: string } }[];
  }) {
    return {
      id: o.id,
      status: o.status,
      totalCents: o.totalCents,
      currency: o.currency,
      provider: o.provider,
      paidAt: o.paidAt,
      createdAt: o.createdAt,
      // The buyer's own receipt shows the accepted terms version and time (the IP stays for admins).
      terms: o.termsVersion ? { version: o.termsVersion, acceptedAt: o.termsAcceptedAt } : null,
      lines: o.lines.map((l) => ({ id: l.id, courseId: l.courseId, slug: l.course.slug, title: l.course.title, priceCents: l.priceCents, listPriceCents: l.listPriceCents ?? l.priceCents, saleKind: l.saleKind, refundedAt: l.refundedAt })),
    };
  }
}
