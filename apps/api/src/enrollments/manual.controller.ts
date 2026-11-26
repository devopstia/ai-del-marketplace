import { Controller, Get, HttpCode, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, type AppRequest, CurrentUser, type AuthUser, Public, Roles, Cap } from '../common/auth-context';
import { CSRF_COOKIE } from '../common/cookies';
import { ZBody, ZQuery } from '../common/zod';
import { AuthService } from '../auth/auth.service';
import { ManualEnrollmentService } from './manual.service';

const date = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const item = z.object({ courseId: z.string().uuid(), expiresAt: date.optional() });
const payment = z.object({
  method: z.enum(['bank_transfer', 'mobile_money', 'cash', 'paypal', 'other']),
  reference: z.string().trim().min(2).max(120),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
  amount: z.string().trim().regex(/^\d+(\.\d+)?$/),
  usdRate: z.string().trim().regex(/^\d+(\.\d+)?$/).default('1'),
  feeUsdCents: z.number().int().min(0),
  notes: z.string().max(2000).optional(),
  allocations: z.array(z.object({ itemId: z.string().uuid().optional(), courseId: z.string().uuid().optional(), grossUsdCents: z.number().int().min(0) })).min(1).max(50),
  verify: z.boolean().optional(),
}).strict();
const createSchema = z.object({
  studentEmail: z.string().trim().email().max(200),
  studentName: z.string().trim().min(2).max(100),
  items: z.array(item).min(1).max(30),
  note: z.string().max(4000).optional(),
  complimentary: z.boolean().optional(),
  complimentaryReason: z.string().max(1000).optional(),
  payment: payment.optional(),
  activate: z.boolean().optional(),
}).strict();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date');
const listQuery = z.object({
  status: z.enum(['open', 'pending', 'needs_info', 'approved', 'rejected', 'cancelled']).optional(),
  instructorId: z.string().uuid().optional(), courseId: z.string().uuid().optional(), q: z.string().max(100).optional(),
  // Calendar days (the browser's date inputs): "created between from and to", both days included.
  from: day.optional(), to: day.optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const approveSchema = z.object({ complimentary: z.boolean().optional(), complimentaryReason: z.string().max(1000).optional(), expiries: z.record(z.string().uuid(), date).optional() }).strict();
const decideSchema = z.object({ decision: z.enum(['rejected', 'needs_info']), note: z.string().trim().min(3).max(4000) }).strict();
const resubmitSchema = z.object({ note: z.string().max(4000).optional(), expiries: z.record(z.string().uuid(), date).optional() }).strict();
const extendSchema = z.object({ expiresAt: date, reason: z.string().trim().min(3).max(500) }).strict();
const reasonSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
const payoutSchema = z.object({ status: z.enum(['payout_pending', 'payout_completed']), reference: z.string().max(200).optional() }).strict();
const acceptSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/), name: z.string().trim().min(2).max(100), password: z.string().min(1).max(200) }).strict();

/**
 * Manual enrollment (docs/MANUAL_ENROLLMENT.md). One API for both studios: what each person may do is decided in the
 * service from their roles (instructor: own courses, requests only; super admin: everything, no self-approval needed).
 */
@Controller()
export class ManualEnrollmentController {
  constructor(private readonly svc: ManualEnrollmentService, private readonly auth: AuthService) {}

  @Roles('instructor', 'super_admin') @Get('enrollments/manual/courses')
  courses(@CurrentUser() u: AuthUser, @ZQuery(z.object({ q: z.string().max(100).optional() })) q: { q?: string }) { return this.svc.courseOptions(u, q.q); }

  @Roles('instructor', 'super_admin') @Get('enrollments/manual/lookup')
  lookup(@CurrentUser() u: AuthUser, @ZQuery(z.object({ email: z.string().email() })) q: { email: string }) { return this.svc.lookup(u, q.email); }

  @Roles('instructor', 'admin') @Get('enrollments/manual')
  list(@CurrentUser() u: AuthUser, @ZQuery(listQuery) q: z.infer<typeof listQuery>) { return this.svc.list(u, q); }

  /** Options for the list filters: only the courses and instructors that appear in requests this person can see. */
  @Roles('instructor', 'admin') @Get('enrollments/manual/filters')
  filters(@CurrentUser() u: AuthUser) { return this.svc.filterOptions(u); }

  @Roles('instructor', 'super_admin') @Cap('instructor.enrollments.request') @Post('enrollments/manual')
  create(@ZBody(createSchema) b: z.infer<typeof createSchema>, @ActorCtx() a: Actor) { return this.svc.create(a, b); }

  @Roles('instructor', 'admin') @Get('enrollments/manual/:id')
  detail(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.svc.detail(u, id); }

  @Roles('instructor') @Cap('instructor.enrollments.request') @HttpCode(200) @Post('enrollments/manual/:id/resubmit')
  resubmit(@Param('id') id: string, @ZBody(resubmitSchema) b: z.infer<typeof resubmitSchema>, @ActorCtx() a: Actor) { return this.svc.resubmit(a, id, b); }

  @Roles('super_admin') @HttpCode(200) @Post('enrollments/manual/:id/approve')
  approve(@Param('id') id: string, @ZBody(approveSchema) b: z.infer<typeof approveSchema>, @ActorCtx() a: Actor) { return this.svc.approve(a, id, b); }

  @Roles('super_admin') @HttpCode(200) @Post('enrollments/manual/:id/decision')
  decide(@Param('id') id: string, @ZBody(decideSchema) b: z.infer<typeof decideSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, b.decision, b.note); }

  @Roles('super_admin') @Post('enrollments/manual/:id/payments')
  pay(@Param('id') id: string, @ZBody(payment) b: z.infer<typeof payment>, @ActorCtx() a: Actor) { return this.svc.recordPayment(a, id, b); }

  @Roles('super_admin') @HttpCode(200) @Post('enrollments/payments/:paymentId/verify')
  verify(@Param('paymentId') id: string, @ActorCtx() a: Actor) { return this.svc.verifyPayment(a, id); }

  @Roles('super_admin') @HttpCode(200) @Post('enrollments/allocations/:id/payout')
  payout(@Param('id') id: string, @ZBody(payoutSchema) b: z.infer<typeof payoutSchema>, @ActorCtx() a: Actor) { return this.svc.setPayout(a, id, b.status, b.reference); }

  @Roles('super_admin') @Put('enrollments/items/:itemId/expiry')
  extend(@Param('itemId') id: string, @ZBody(extendSchema) b: z.infer<typeof extendSchema>, @ActorCtx() a: Actor) { return this.svc.extend(a, id, b.expiresAt, b.reason); }

  @Roles('super_admin') @HttpCode(200) @Post('enrollments/items/:itemId/revoke')
  revoke(@Param('itemId') id: string, @ZBody(reasonSchema) b: z.infer<typeof reasonSchema>, @ActorCtx() a: Actor) { return this.svc.revokeItem(a, id, b.reason); }

  @Roles('instructor', 'super_admin') @HttpCode(200) @Post('enrollments/manual/:id/invitation/link')
  link(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.copyLink(a, id); }

  @Roles('instructor', 'super_admin') @HttpCode(200) @Post('enrollments/manual/:id/invitation/resend')
  resend(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.resend(a, id); }

  @Roles('super_admin') @HttpCode(200) @Post('enrollments/manual/:id/invitation/revoke')
  revokeInvite(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.revokeInvitation(a, id); }

  @Roles('instructor', 'admin') @Get('enrollments/earnings')
  earnings(@CurrentUser() u: AuthUser, @ZQuery(z.object({ instructorId: z.string().uuid().optional() })) q: { instructorId?: string }) { return this.svc.earnings(u, q.instructorId); }

  // ---------- public: the invitation link ----------
  @Public() @UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 30, ttl: 60_000 } }) @Get('invitations/:token')
  info(@Param('token') t: string) { return this.svc.invitationInfo(t); }

  @Public() @UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 5, ttl: 600_000 } }) @HttpCode(200) @Post('invitations/:token/code')
  code(@Param('token') t: string) { return this.svc.sendCode(t); }

  @Public() @UseGuards(ThrottlerGuard) @Throttle({ default: { limit: 10, ttl: 600_000 } }) @HttpCode(200) @Post('invitations/:token/accept')
  async accept(@Param('token') t: string, @ZBody(acceptSchema) b: z.infer<typeof acceptSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const r = await this.svc.accept(t, b, req, res, req.ip ?? null, (req.headers['user-agent'] as string | undefined)?.slice(0, 300) ?? null);
    // Same answer as sign-up: a session only after Google Authenticator is set up (or MFA_REQUIRED=false locally).
    if (!r.done) return { mfa: r.stage };
    return { user: await this.auth.me(r.userId!), csrf: req.cookies[CSRF_COOKIE] };
  }

  @HttpCode(200) @Post('invitations/:token/claim')
  claim(@Param('token') t: string, @CurrentUser() u: AuthUser, @Req() req: AppRequest) { return this.svc.claim(u, t, req.ip ?? null); }
}
