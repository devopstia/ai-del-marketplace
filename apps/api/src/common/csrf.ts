import { CanActivate, ExecutionContext, Injectable, NestMiddleware } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppRequest, SKIP_CSRF } from './auth-context';
import { CSRF_COOKIE, CSRF_HEADER, csrfCookieOptions, SESSION_COOKIE } from './cookies';
import { agentBearer } from '../assist/assist-context';
import { forbidden } from './errors';
import { randomToken } from './util';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Make sure every client has a CSRF cookie; the token is also echoed by GET /auth/me and /auth/csrf. */
@Injectable()
export class CsrfCookieMiddleware implements NestMiddleware {
  use(req: AppRequest, res: Response, next: NextFunction) {
    let token = req.cookies?.[CSRF_COOKIE];
    if (!token || typeof token !== 'string' || token.length < 20) {
      token = randomToken(24);
      res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
      req.cookies = { ...(req.cookies ?? {}), [CSRF_COOKIE]: token, __csrfFresh: '1' };
    }
    next();
  }
}

export function csrfTokensMatch(cookie: unknown, header: unknown): boolean {
  if (typeof cookie !== 'string' || typeof header !== 'string' || cookie.length < 20) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Double-submit check on every state-changing request: header X-CSRF-Token must equal cookie `csrf`. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (SAFE.has(req.method)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF, [ctx.getHandler(), ctx.getClass()])) return true;
    // AI agent API: a Bearer token with no session cookie can't be forged cross-site (browsers never add that header).
    if (!req.cookies?.[SESSION_COOKIE] && agentBearer(req)) return true;
    // A cookie minted on this very request cannot have been echoed back, so it never counts.
    const cookie = req.cookies?.__csrfFresh ? undefined : req.cookies?.[CSRF_COOKIE];
    if (!csrfTokensMatch(cookie, req.headers[CSRF_HEADER])) {
      throw forbidden('Missing or invalid CSRF token (send header X-CSRF-Token = cookie csrf)', 'csrf_invalid');
    }
    return true;
  }
}
