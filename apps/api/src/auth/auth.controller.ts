import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, type AppRequest, Public } from '../common/auth-context';
import { CSRF_COOKIE, SESSION_COOKIE, sessionCookieOptions } from '../common/cookies';
import { ZBody } from '../common/zod';
import { env } from '../config/env';
import { AuthService } from './auth.service';

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(10, 'Password must be at least 10 characters').max(200);
const registerSchema = z.object({ email, password, name: z.string().trim().min(1).max(100) });
const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
const profileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: password });

const authLimit = { default: { limit: () => env().AUTH_RATE_LIMIT, ttl: 60_000 } };

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private ctx(req: AppRequest) {
    return { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @Post('auth/register')
  async register(@ZBody(registerSchema) body: z.infer<typeof registerSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.register(body, this.ctx(req));
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return { user: await this.auth.me(user.id), csrf: req.cookies[CSRF_COOKIE] };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle(authLimit)
  @HttpCode(200)
  @Post('auth/login')
  async login(@ZBody(loginSchema) body: z.infer<typeof loginSchema>, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) await this.auth.revokeSession(req.sessionId); // no session fixation
    const { user, token } = await this.auth.login(body, this.ctx(req));
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    return { user: await this.auth.me(user.id), csrf: req.cookies[CSRF_COOKIE] };
  }

  @Public()
  @HttpCode(200)
  @Post('auth/logout')
  async logout(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    if (req.sessionId) await this.auth.revokeSession(req.sessionId);
    const { maxAge: _m, ...opts } = sessionCookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
    return { ok: true };
  }

  /** Public: returns { user: null, csrf } when signed out, so the web app can bootstrap its CSRF token. */
  @Public()
  @Get('auth/me')
  async me(@Req() req: AppRequest) {
    return { user: req.user ? await this.auth.me(req.user.id) : null, csrf: req.cookies[CSRF_COOKIE] };
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
    await this.auth.changePassword(req.user!.id, body.currentPassword, body.newPassword, req.sessionId, req.ip ?? null);
    return { ok: true };
  }
}
