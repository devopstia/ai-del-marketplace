import { Controller, Delete, Get, Headers, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { ActorCtx, type Actor, type AppRequest, Public, Roles, SkipCsrf, Cap } from '../common/auth-context';
import { AppError, badRequest, unavailable } from '../common/errors';
import { ZBody } from '../common/zod';
import { env } from '../config/env';
import { MuxVideoProvider } from '../media/mux-video.provider';
import { PrismaService } from '../common/prisma.service';
import { CommerceService } from './commerce.service';
import { ConnectService } from './connect.service';
import { FinanceService } from '../admin/finance.service';
import { RefundsService } from './refunds.service';
import { StripeService } from './stripe.service';
import { WebhooksService } from './webhooks.service';

const addSchema = z.object({ courseId: z.string().uuid() });
const checkoutSchema = z.object({
  immediateAccessConsent: z.boolean().optional(),
  // Terms of use + Access and refunds policy, accepted on the checkout page (src/commerce/terms.ts).
  acceptTerms: z.boolean().optional(),
  termsVersion: z.string().trim().max(32).optional(),
}).default({});
const reviewSchema = z.object({ note: z.string().trim().min(10, 'Tell us briefly what happened (10 characters or more)').max(2000) });
const refundRequestSchema = z.object({ lineIds: z.array(z.string().uuid()).max(50).optional(), reason: z.string().trim().max(500).optional() });
export const courseIdsSchema = z.object({ courseIds: z.array(z.string().uuid()).max(50) });

@Controller()
export class CommerceController {
  constructor(
    private readonly svc: CommerceService,
    private readonly connect: ConnectService,
    private readonly refunds: RefundsService,
    private readonly finance: FinanceService,
  ) {}

  @Get('cart')
  cart(@ActorCtx() a: Actor) {
    return this.svc.cart(a.user.id);
  }

  @Post('cart')
  add(@ZBody(addSchema) body: z.infer<typeof addSchema>, @ActorCtx() a: Actor) {
    return this.svc.addToCart(a.user.id, body.courseId);
  }

  /** Guest cart: no session, no writes; rate limited (60/min per IP). */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(200)
  @Post('cart/preview')
  preview(@ZBody(courseIdsSchema) body: z.infer<typeof courseIdsSchema>) {
    return this.svc.previewCart(body.courseIds);
  }

  /** Merge a guest cart into the signed-in user's cart. */
  @HttpCode(200)
  @Post('cart/merge')
  merge(@ZBody(courseIdsSchema) body: z.infer<typeof courseIdsSchema>, @ActorCtx() a: Actor) {
    return this.svc.mergeCart(a.user.id, body.courseIds);
  }

  @Delete('cart/:courseId')
  remove(@Param('courseId') courseId: string, @ActorCtx() a: Actor) {
    return this.svc.removeFromCart(a.user.id, courseId);
  }

  @Delete('cart')
  clear(@ActorCtx() a: Actor) {
    return this.svc.clearCart(a.user.id);
  }

  @HttpCode(200)
  @Post('checkout')
  checkout(@ZBody(checkoutSchema) b: z.infer<typeof checkoutSchema>, @ActorCtx() a: Actor) {
    return this.svc.checkout(a, b);
  }

  @Get('orders')
  orders(@ActorCtx() a: Actor) {
    return this.svc.orders(a.user.id);
  }

  @Get('orders/:id')
  order(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.svc.order(a.user.id, id);
  }

  /** Refund policy check for each course in the learner's order (eligibility, reason, % watched, deadline). */
  @Get('orders/:id/refund')
  refundEligibility(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.refunds.eligibility(a.user.id, id);
  }

  @Get('orders/:id/refund-requests')
  refundRequestsFor(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.refunds.requestsFor(a.user.id, id);
  }

  /** Ask a person to look at an automatic decline (wrong playback data, legal rights, billing error, exception). */
  @HttpCode(200)
  @Post('refund-requests/:id/review')
  requestReview(@Param('id') id: string, @ZBody(reviewSchema) b: z.infer<typeof reviewSchema>, @ActorCtx() a: Actor) {
    return this.refunds.requestReview({ id: a.user.id, ip: a.ip }, id, b.note);
  }

  /** Learner refund: decided at once by the policy (docs/ACCESS_AND_REFUNDS.md). */
  @HttpCode(200)
  @Cap('student.refunds.request')
  @Post('orders/:id/refund')
  requestRefund(@Param('id') id: string, @ZBody(refundRequestSchema) b: z.infer<typeof refundRequestSchema>, @ActorCtx() a: Actor) {
    return this.refunds.request({ id: a.user.id, ip: a.ip }, id, b.lineIds, b.reason);
  }

  /** Only when DEV_TEST_PAYMENTS=true and NODE_ENV!=production (otherwise 404). */
  @HttpCode(200)
  @Post('dev/test-payments/:orderId/complete')
  testPayment(@Param('orderId') orderId: string, @ActorCtx() a: Actor) {
    return this.svc.completeTestPayment(a, orderId);
  }

  @Roles('instructor')
  @HttpCode(200)
  @Post('instructor/stripe/onboarding-link')
  onboarding(@ActorCtx() a: Actor) {
    return this.connect.onboardingLink(a);
  }

  @Roles('instructor')
  @Get('instructor/stripe/status')
  status(@ActorCtx() a: Actor) {
    return this.connect.status(a.user.id);
  }

  /** The instructor's revenue share, how it is calculated, and the payout hold. */
  @Roles('instructor')
  @Get('instructor/terms')
  terms(@ActorCtx() a: Actor) {
    return this.finance.terms(a.user.id);
  }
}

/** Server-to-server webhooks: public, no CSRF, verified by signature over the raw body. */
@Public()
@SkipCsrf()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly stripe: StripeService,
    private readonly hooks: WebhooksService,
    private readonly mux: MuxVideoProvider,
    private readonly prisma: PrismaService,
  ) {}

  @HttpCode(200)
  @Post('stripe')
  async stripeHook(@Req() req: AppRequest, @Headers('stripe-signature') sig?: string) {
    if (!this.stripe.webhookSecret) throw unavailable('Stripe webhooks are not configured', 'stripe_not_configured');
    if (!req.rawBody || !sig) throw badRequest('Missing signature', 'invalid_signature');
    let event;
    try {
      event = this.stripe.constructEvent(req.rawBody, sig);
    } catch {
      throw new AppError(400, 'invalid_signature', 'Webhook signature verification failed');
    }
    return this.hooks.handle(event as any);
  }

  @HttpCode(200)
  @Post('mux')
  async muxHook(@Req() req: AppRequest) {
    if (!env().MUX_WEBHOOK_SECRET || !this.mux.configured) throw unavailable('Mux webhooks are not configured', 'mux_not_configured');
    let event: any;
    try {
      event = await this.mux.mux().webhooks.unwrap(req.rawBody!.toString('utf8'), req.headers as Record<string, string>, env().MUX_WEBHOOK_SECRET);
    } catch {
      throw new AppError(400, 'invalid_signature', 'Webhook signature verification failed');
    }
    const id = `mux:${event.id}`;
    if (await this.prisma.webhookEvent.findUnique({ where: { id } })) return { received: true, duplicate: true };
    if (event.type === 'video.asset.ready') {
      const d = event.data;
      await this.mux.markReady(d.id, d.upload_id, d.playback_ids?.find((p: any) => p.policy === 'signed')?.id ?? d.playback_ids?.[0]?.id, d.duration ?? 0);
    } else if (event.type === 'video.asset.errored') {
      await this.mux.markFailed(event.data.id, JSON.stringify(event.data.errors ?? {}));
    } else if (event.type === 'video.upload.asset_created') {
      await this.prisma.videoAsset.updateMany({ where: { muxUploadId: event.data.id }, data: { muxAssetId: event.data.asset_id, status: 'processing' } });
    }
    await this.prisma.webhookEvent.create({ data: { id, type: event.type } }).catch(() => undefined);
    return { received: true, duplicate: false };
  }
}
