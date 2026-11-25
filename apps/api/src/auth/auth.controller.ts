import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, type AppRequest, Public, Roles } from '../common/auth-context';
import { ACT_AS_COOKIE, ACT_AS_PLATFORM } from '../common/acting';
import { AuditService } from '../common/audit.service';
import { badRequest } from '../common/errors';
import { CSRF_COOKIE, SESSION_COOKIE, sessionCookieOptions } from '../common/cookies';
import { ZBody } from '../common/zod';
import { env } from '../config/env';
import { CommerceService } from '../commerce/commerce.service';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { PASSWORD_POLICY } from './password-policy';
import { SignInService } from './signin.service';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(1).max(200);
const next = z.string().max(300).optional();
const code = z.string().trim().max(20).optional();
/** Optional guest cart to merge right after sign-in (same rules as POST /cart/merge). */
const cartCourseIds = z.array(z.string().uuid()).max(50).optional();
// .strict(): a sign-up that tries to send roles, permissions or anything else is refused (every sign-up is a student).
const registerSchema = z.object({ email, password, name: z.string().trim().min(1).max(100), cartCourseIds, next }).strict();
const verifySchema = z.object({ token: z.string().min(20).max(200) });
const loginSchema = z.object({ email, password: z.string().min(1).max(200), cartCourseIds, next });
const profileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});
const passwordSchema = z.object({ currentPassword: z.string().max(200).optional(), newPassword: password, code });
const completeSchema = z.object({ code, recoveryCode: z.string().trim().max(40).optional(), trustDevice: z.boolean().optional() });
const codeSchema = z.object({ code });
const replaceSchema = z.object({ pending: z.string().min(10).max(2000), code: z.string().trim().max(20) });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().min(20).max(200), password });

const authLimit = { default: { limit: () => env().AUTH_RATE_LIMIT, ttl: 60_000 } };

const actAsSchema = z.object({ mode: z.enum(['del', 'self']) });

@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly signIn: SignInService,
    private readonly oauth: OAuthService,
    private readonly commerce: CommerceService,
    private readonly audit: AuditService,
  ) {}

  private async mergeGuestCart(userId: string, ids?: string[]) {
    if (!ids?.length) return undefined;
    const cart = await this.commerce.mergeCart(userId, ids);
    return { count: cart.count, added: cart.merge.added, skipped: cart.merge.skipped };
  }

  private ctx(req: AppRequest) {
    return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
  }

  /** Signed in now (a trusted device) or a code is owed: { mfa: 'verify' | 'enroll' }. */
  private async afterFirstStep(r: { done: boolean; stage?: string; userId?: string; cartCourseIds?: string[] }, req: AppRequest) {
    if (!r.done) return { mfa: r.stage };
    const cart = await this.mergeGuestCart(r.userId!, r.cartCourseIds);
    return { user: await this.auth.me(r.userId!), csrf: req.cookies[CSRF_COOKIE], ...(cart ? { cart } : {}) };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @Post('auth/register')
  async register(@ZBody(registerSchema) body: z.infer<typeof registerSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    return this.afterFirstStep(await this.auth.register(body, req, res, this.ctx(req)), req);
  }

  /** Email ownership: resend the link (signed in), or open it (public). */
  @HttpCode(200)
  @Post('auth/verify-email/send')
  sendVerification(@Req() req: AppRequest) { return this.auth.sendVerification(req.user!.id, req.ip ?? null); }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/verify-email')
  verifyEmail(@ZBody(verifySchema) b: z.infer<typeof verifySchema>, @Req() req: AppRequest) { return this.auth.verifyEmail(b.token, req.ip ?? null); }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/login')
  async login(@ZBody(loginSchema) body: z.infer<typeof loginSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) await this.auth.revokeSession(req.sessionId); // no session fixation
    return this.afterFirstStep(await this.auth.login(body, req, res, this.ctx(req)), req);
  }

  // ---- The second step: Google Authenticator ----

  @Public()
  @Get('auth/mfa/pending')
  pending(@Req() req: AppRequest) { return this.signIn.pending(req); }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/mfa/enroll')
  enroll(@Req() req: AppRequest) { return this.signIn.enrollSecret(req); }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/mfa/complete')
  async complete(@ZBody(completeSchema) body: z.infer<typeof completeSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const r = await this.signIn.complete(req, res, this.ctx(req), body);
    const cart = await this.mergeGuestCart(r.userId, r.cartCourseIds);
    return { user: await this.auth.me(r.userId), csrf: req.cookies[CSRF_COOKIE], recoveryCodes: r.recoveryCodes, recoveryCodesLeft: r.recoveryCodesLeft, next: r.next, ...(cart ? { cart } : {}) };
  }

  @Public()
  @HttpCode(200)
  @Post('auth/mfa/cancel')
  async cancel(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) { await this.signIn.cancel(req, res); return { ok: true }; }

  // ---- Google, GitHub, Facebook, LinkedIn ----

  @Public()
  @Get('auth/providers')
  providers() { return { items: this.oauth.providers(), passwordPolicy: PASSWORD_POLICY }; }

  @Public()
  @Get('auth/password-policy')
  policy() { return PASSWORD_POLICY; }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @Get('auth/oauth/:provider/start')
  start(@Param('provider') p: string, @Query('mode') mode: string, @Query('next') nextPath: string, @Req() req: AppRequest, @Res() res: Response) {
    res.redirect(302, this.oauth.start(p, mode, nextPath, req, res));
  }

  /** Development-only page: its own strict policy (no inline script, posts only to itself; no https upgrade on local http). */
  @Public()
  @Get('auth/oauth/test/authorize')
  testAuthorize(@Query() q: Record<string, unknown>, @Res() res: Response) {
    const html = this.oauth.testPage(q);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    // form-action covers the whole redirect chain after submitting, which ends on the web app.
    res.setHeader('Content-Security-Policy', `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${new URL(env().WEB_URL).origin}; base-uri 'none'; frame-ancestors 'none'`);
    res.send(html);
  }

  @Public()
  @Get('auth/oauth/test/approve')
  testApprove(@Query() q: Record<string, unknown>, @Res() res: Response) { res.redirect(302, this.oauth.testApprove(q)); }

  @Public()
  @Get('auth/oauth/:provider/callback')
  async oauthCallback(@Param('provider') p: string, @Query() q: Record<string, unknown>, @Req() req: AppRequest, @Res() res: Response) {
    res.redirect(302, await this.oauth.callback(p, q, req, res, this.ctx(req)));
  }

  // ---- Forgotten password ----

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/password/forgot')
  forgot(@ZBody(forgotSchema) b: z.infer<typeof forgotSchema>, @Req() req: AppRequest) { return this.auth.forgotPassword(b.email, req.ip ?? null); }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/password/reset')
  reset(@ZBody(resetSchema) b: z.infer<typeof resetSchema>, @Req() req: AppRequest) { return this.auth.resetPassword(b.token, b.password, req.ip ?? null); }

  @Public()
  @HttpCode(200)
  @Post('auth/logout')
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) await this.auth.revokeSession(req.sessionId);
    const { maxAge: _m, ...opts } = sessionCookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
    res.clearCookie(ACT_AS_COOKIE, opts);
    return { ok: true };
  }

  /** Public: returns { user: null, csrf } when signed out, so the web app can bootstrap its CSRF token. */
  @Public()
  @Get('auth/me')
  async me(@Req() req: AppRequest) {
    const actingAs = req.user?.roles.includes('super_admin') && req.cookies?.[ACT_AS_COOKIE] === ACT_AS_PLATFORM ? await this.auth.platformInstructor() : null;
    return { user: req.user ? { ...(await this.auth.me(req.user.id)), actingAs } : null, csrf: req.cookies[CSRF_COOKIE] };
  }

  /** Super admin: switch the instructor studio between DEL's account ("del") and their own ("self"). Audited. */
  @Roles('super_admin')
  @HttpCode(200)
  @Post('auth/act-as')
  async actAs(@ZBody(actAsSchema) b: z.infer<typeof actAsSchema>, @ActorCtx() a: Actor, @Res({ passthrough: true }) res: Response) {
    if (b.mode === 'del') {
      const del = await this.auth.platformInstructor();
      if (!del) throw badRequest('No DEL instructor account exists', 'no_platform_instructor');
      res.cookie(ACT_AS_COOKIE, ACT_AS_PLATFORM, { ...sessionCookieOptions(), maxAge: 12 * 60 * 60 * 1000 });
      await this.audit.log({ actorId: a.user.id, action: 'auth.act_as_started', targetType: 'user', targetId: del.id, ip: a.ip });
      return { actingAs: del };
    }
    const { maxAge: _m, ...opts } = sessionCookieOptions();
    res.clearCookie(ACT_AS_COOKIE, opts);
    await this.audit.log({ actorId: a.user.id, action: 'auth.act_as_ended', targetType: 'user', targetId: a.user.id, ip: a.ip });
    return { actingAs: null };
  }

  @Public()
  @Get('auth/csrf')
  csrf(@Req() req: AppRequest) {
    return { csrf: req.cookies[CSRF_COOKIE] };
  }

  @Get('auth/sessions')
  sessions(@Req() req: AppRequest) {
    return this.auth.listSessions(req.user!.id, req.sessionId).then((items) => ({ items }));
  }

  @Delete('auth/sessions/:id')
  async revoke(@Param('id') id: string, @ActorCtx() a: Actor) {
    await this.auth.revokeOwnSession(a.user.id, id, a.ip);
    return { ok: true };
  }

  @Patch('me/profile')
  async profile(@ZBody(profileSchema) body: z.infer<typeof profileSchema>, @ActorCtx() a: Actor) {
    return { user: await this.auth.updateProfile(a.user.id, body) };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/password')
  async password(@ZBody(passwordSchema) body: z.infer<typeof passwordSchema>, @Req() req: AppRequest) {
    await this.auth.setPassword(req.user!.id, body, req.sessionId, req.ip ?? null);
    return { ok: true };
  }

  // ---- Account › Security ----

  @Get('auth/security')
  async security(@Req() req: AppRequest) {
    return { ...(await this.auth.security(req.user!.id)), identities: await this.oauth.identities(req.user!.id), providers: this.oauth.providers() };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/mfa/recovery-codes')
  async recoveryCodes(@ZBody(codeSchema) b: z.infer<typeof codeSchema>, @ActorCtx() a: Actor) {
    await this.signIn.checkCode(a.user.id, b.code, a.ip);
    return { recoveryCodes: await this.signIn.newRecoveryCodes(a.user.id, a.ip) };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/mfa/replace/start')
  async replaceStart(@ZBody(codeSchema) b: z.infer<typeof codeSchema>, @ActorCtx() a: Actor) {
    await this.signIn.checkCode(a.user.id, b.code, a.ip);
    return this.signIn.replaceStart(a.user);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/mfa/replace/confirm')
  async replaceConfirm(@ZBody(replaceSchema) b: z.infer<typeof replaceSchema>, @Req() req: AppRequest) {
    await this.signIn.replaceConfirm(req.user!.id, b.pending, b.code, req.sessionId, req.ip ?? null);
    return { ok: true };
  }

  @Delete('auth/trusted-devices')
  async forgetDevices(@ActorCtx() a: Actor) {
    const n = await this.signIn.forgetDevices(a.user.id);
    await this.audit.log({ actorId: a.user.id, action: 'auth.trusted_devices_forgotten', targetType: 'user', targetId: a.user.id, ip: a.ip, meta: { count: n } });
    return { forgotten: n };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/identities/:id/unlink')
  async unlink(@Param('id') id: string, @ZBody(codeSchema) b: z.infer<typeof codeSchema>, @ActorCtx() a: Actor) {
    await this.oauth.unlink(a.user.id, id, b.code, a.ip);
    return { ok: true };
  }

  @Roles('super_admin')
  @HttpCode(200)
  @Post('admin/users/:id/mfa/reset')
  resetMfa(@Param('id') id: string, @ActorCtx() a: Actor) { return this.auth.resetMfa(a.user.id, id, a.ip); }
}
