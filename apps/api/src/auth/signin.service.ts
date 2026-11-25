import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import type { User } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import type { AppRequest } from '../common/auth-context';
import { hashSessionToken } from '../common/auth.guard';
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from '../common/cookies';
import { AppError } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { seal, sha256, unseal } from '../common/seal';
import { randomToken } from '../common/util';
import { env, isProd } from '../config/env';
import { newSecret, otpauthUrl, verifyCode } from './totp';

export const MFA_COOKIE = 'del_mfa';
export const TRUST_COOKIE = 'del_trust';
const VERIFY_TTL_MS = 5 * 60_000;
const ENROLL_TTL_MS = 20 * 60_000;
const TRUST_TTL_MS = 30 * 24 * 3600_000;
const MAX_CODE_TRIES = 5;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60_000;

export interface Ctx { ip: string | null; userAgent: string | null }
/** How the first step was passed. */
export type Method = 'password' | 'google' | 'github' | 'facebook' | 'linkedin' | 'test';
interface TicketData { method: Method; secret?: string; cartCourseIds?: string[]; next?: string }

const cookie = (path: string, maxAge: number): CookieOptions => ({ httpOnly: true, secure: isProd(), sameSite: 'lax', path, maxAge });
const mfaCookie = () => cookie('/api/auth', ENROLL_TTL_MS);
const trustCookie = () => cookie('/api/auth', TRUST_TTL_MS);

const unauthorizedCode = (code: string, message: string) => new AppError(401, code, message);

/**
 * Every sign-in (password, Google, GitHub, Facebook, LinkedIn) ends here (owner 2026-11-25): the first step only earns a
 * short ticket; a Google Authenticator code (or a recovery code) turns it into a session. People without an authenticator
 * set one up in the same flow. "Trust this device for 30 days" skips the code on that browser for that account.
 * Ported from the Insurance Knowledge Hub (auth-service mfa.py), adapted to cookie sessions.
 */
@Injectable()
export class SignInService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async createSession(userId: string, ctx: Ctx): Promise<string> {
    const token = randomToken(32);
    await this.prisma.session.create({
      data: { id: hashSessionToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS), ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null },
    });
    return token;
  }

  // ---- Lockout (password and code failures share one counter per account) ----

  assertNotLocked(user: Pick<User, 'lockedUntil'>) {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new AppError(423, 'account_locked', `Too many attempts. Try again in ${min} minute${min === 1 ? '' : 's'}, or reset your password.`);
    }
  }

  async recordFailure(userId: string, ip: string | null, what: string) {
    const u = await this.prisma.user.update({ where: { id: userId }, data: { failedLogins: { increment: 1 } }, select: { failedLogins: true } });
    if (u.failedLogins >= MAX_FAILED_LOGINS) {
      await this.prisma.user.update({ where: { id: userId }, data: { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } });
      await this.audit.log({ actorId: userId, action: 'auth.account_locked', targetType: 'user', targetId: userId, ip, meta: { after: what } });
    }
  }

  // ---- Trusted devices ----

  private trustTokens(req: AppRequest): string[] {
    const raw = req.cookies?.[TRUST_COOKIE];
    return typeof raw === 'string' ? raw.split('.').filter((t) => /^[A-Za-z0-9_-]{20,64}$/.test(t)).slice(-10) : [];
  }

  private async isTrusted(req: AppRequest, userId: string) {
    const ids = this.trustTokens(req).map(sha256);
    if (!ids.length) return false;
    const d = await this.prisma.trustedDevice.findFirst({ where: { id: { in: ids }, userId, revokedAt: null, expiresAt: { gt: new Date() } } });
    return !!d;
  }

  private async trust(req: AppRequest, res: Response, userId: string, ctx: Ctx) {
    const token = randomToken(24);
    await this.prisma.trustedDevice.create({ data: { id: sha256(token), userId, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null, expiresAt: new Date(Date.now() + TRUST_TTL_MS) } });
    res.cookie(TRUST_COOKIE, [...this.trustTokens(req), token].slice(-10).join('.'), trustCookie());
  }

  /** Ends every trusted device (password change or reset, MFA reset, "Forget trusted devices"). */
  async forgetDevices(userId: string) {
    const r = await this.prisma.trustedDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    return r.count;
  }

  // ---- The two steps ----

  /**
   * After the first step: a session right away on a trusted device of an enrolled account, otherwise a ticket for the code
   * (or for setting up an authenticator).
   */
  async begin(user: User, method: Method, req: AppRequest, res: Response, ctx: Ctx, extra: { cartCourseIds?: string[]; next?: string } = {}) {
    if (user.status !== 'active') throw new AppError(403, 'account_suspended', 'This account is suspended');
    this.assertNotLocked(user);
    if (user.mfaEnabledAt && (await this.isTrusted(req, user.id))) {
      const token = await this.createSession(user.id, ctx);
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
      await this.audit.log({ actorId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method, trustedDevice: true } });
      return { done: true as const, userId: user.id, cartCourseIds: extra.cartCourseIds };
    }
    const stage = user.mfaEnabledAt ? 'verify' : 'enroll';
    const raw = randomToken(32);
    await this.prisma.authTicket.deleteMany({ where: { userId: user.id, OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } });
    await this.prisma.authTicket.create({
      data: { id: sha256(raw), userId: user.id, stage, data: { method, cartCourseIds: extra.cartCourseIds, next: extra.next } satisfies TicketData as object, expiresAt: new Date(Date.now() + (stage === 'verify' ? VERIFY_TTL_MS : ENROLL_TTL_MS)) },
    });
    res.cookie(MFA_COOKIE, raw, mfaCookie());
    await this.audit.log({ actorId: user.id, action: 'auth.mfa_challenge', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method, stage } });
    return { done: false as const, stage };
  }

  private async ticket(req: AppRequest) {
    const raw = req.cookies?.[MFA_COOKIE];
    if (typeof raw !== 'string' || raw.length < 20) throw unauthorizedCode('no_pending_signin', 'Your sign-in expired. Please sign in again.');
    const t = await this.prisma.authTicket.findUnique({ where: { id: sha256(raw) }, include: { user: true } });
    if (!t || t.usedAt || t.expiresAt < new Date() || t.attempts >= MAX_CODE_TRIES) throw unauthorizedCode('no_pending_signin', 'Your sign-in expired. Please sign in again.');
    return { ...t, data: t.data as unknown as TicketData };
  }

  /** What the code page shows. */
  async pending(req: AppRequest) {
    const t = await this.ticket(req);
    const [local, domain] = t.user.email.split('@');
    return { stage: t.stage, method: t.data.method, name: t.user.name, email: `${local.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(1, local.length - 2)))}@${domain}`, next: t.data.next ?? null, expiresAt: t.expiresAt };
  }

  /** Enrolment: a new seed for this ticket (the same one if asked again), sealed until the first code proves the phone has it. */
  async enrollSecret(req: AppRequest) {
    const t = await this.ticket(req);
    if (t.stage !== 'enroll') throw new AppError(409, 'already_enrolled', 'This account already has an authenticator.');
    let secret = t.data.secret ? unseal('mfa-enroll', t.data.secret).toString('utf8') : null;
    if (!secret) {
      secret = newSecret();
      await this.prisma.authTicket.update({ where: { id: t.id }, data: { data: { ...t.data, secret: seal('mfa-enroll', secret) } as object } });
    }
    return { secret, otpauthUrl: otpauthUrl(env().MFA_ISSUER, t.user.email, secret) };
  }

  /** Second step: a code from the app (or a recovery code). Returns new recovery codes after enrolment. */
  async complete(req: AppRequest, res: Response, ctx: Ctx, input: { code?: string; recoveryCode?: string; trustDevice?: boolean }) {
    const t = await this.ticket(req);
    const user = t.user;
    this.assertNotLocked(user);
    let recoveryCodes: string[] | undefined;
    let ok = false;
    if (t.stage === 'enroll') {
      if (!t.data.secret) throw new AppError(409, 'enroll_not_started', 'Scan the QR code first.');
      const secret = unseal('mfa-enroll', t.data.secret).toString('utf8');
      const step = input.code ? verifyCode(secret, input.code, null) : null;
      if (step !== null) {
        ok = true;
        recoveryCodes = newRecoveryCodes();
        await this.prisma.$transaction([
          this.prisma.user.update({ where: { id: user.id }, data: { mfaSecret: seal('mfa', secret), mfaEnabledAt: new Date(), mfaLastStep: step } }),
          this.prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
          this.prisma.mfaRecoveryCode.createMany({ data: recoveryCodes.map((c) => ({ userId: user.id, codeHash: sha256(normRecovery(c)) })) }),
        ]);
        await this.audit.log({ actorId: user.id, action: 'auth.mfa_enabled', targetType: 'user', targetId: user.id, ip: ctx.ip });
      }
    } else if (input.recoveryCode) {
      const rc = await this.prisma.mfaRecoveryCode.findFirst({ where: { userId: user.id, usedAt: null, codeHash: sha256(normRecovery(input.recoveryCode)) } });
      if (rc) {
        const used = await this.prisma.mfaRecoveryCode.updateMany({ where: { id: rc.id, usedAt: null }, data: { usedAt: new Date() } });
        ok = used.count === 1;
        if (ok) await this.audit.log({ actorId: user.id, action: 'auth.mfa_recovery_code_used', targetType: 'user', targetId: user.id, ip: ctx.ip });
      }
    } else if (input.code && user.mfaSecret) {
      const step = verifyCode(unseal('mfa', user.mfaSecret).toString('utf8'), input.code, user.mfaLastStep);
      if (step !== null) {
        // Conditional update: two requests racing with the same code can't both win.
        const r = await this.prisma.user.updateMany({ where: { id: user.id, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] }, data: { mfaLastStep: step } });
        ok = r.count === 1;
      }
    }
    if (!ok) {
      await this.prisma.authTicket.update({ where: { id: t.id }, data: { attempts: { increment: 1 } } });
      await this.recordFailure(user.id, ctx.ip, 'mfa');
      await this.audit.log({ actorId: user.id, action: 'auth.mfa_failed', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method: t.data.method } });
      const left = MAX_CODE_TRIES - t.attempts - 1;
      if (left <= 0) { res.clearCookie(MFA_COOKIE, { path: '/api/auth' }); throw unauthorizedCode('no_pending_signin', 'Too many wrong codes. Please sign in again.'); }
      throw unauthorizedCode('invalid_code', input.recoveryCode ? 'That recovery code is not valid or was already used.' : 'That code is not right. Check the six digits in Google Authenticator and try again.');
    }
    await this.prisma.authTicket.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    const token = await this.createSession(user.id, ctx);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.clearCookie(MFA_COOKIE, { path: '/api/auth' });
    if (input.trustDevice) await this.trust(req, res, user.id, ctx);
    await this.audit.log({ actorId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method: t.data.method, mfa: t.stage === 'enroll' ? 'enrolled' : input.recoveryCode ? 'recovery_code' : 'code', trustDevice: !!input.trustDevice } });
    const left = await this.prisma.mfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
    return { userId: user.id, recoveryCodes, recoveryCodesLeft: left, cartCourseIds: t.data.cartCourseIds, next: t.data.next ?? null };
  }

  async cancel(req: AppRequest, res: Response) {
    const raw = req.cookies?.[MFA_COOKIE];
    if (typeof raw === 'string') await this.prisma.authTicket.updateMany({ where: { id: sha256(raw), usedAt: null }, data: { usedAt: new Date() } });
    res.clearCookie(MFA_COOKIE, { path: '/api/auth' });
  }

  /** For signed-in actions that need proof (new recovery codes, unlinking, setting a password without one). */
  async checkCode(userId: string, code: string | undefined, ip: string | null) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.assertNotLocked(user);
    const step = code && user.mfaSecret ? verifyCode(unseal('mfa', user.mfaSecret).toString('utf8'), code, user.mfaLastStep) : null;
    if (step === null) {
      await this.recordFailure(userId, ip, 'mfa');
      throw unauthorizedCode('invalid_code', 'That code is not right. Check the six digits in Google Authenticator and try again.');
    }
    await this.prisma.user.updateMany({ where: { id: userId, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] }, data: { mfaLastStep: step } });
  }

  async newRecoveryCodes(userId: string, ip: string | null) {
    const codes = newRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: sha256(normRecovery(c)) })) }),
    ]);
    await this.audit.log({ actorId: userId, action: 'auth.mfa_recovery_codes_renewed', targetType: 'user', targetId: userId, ip });
    return codes;
  }

  /** Replacing the authenticator (new phone): a sealed, user-bound pending seed, confirmed by a code from the new app. */
  replaceStart(user: Pick<User, 'id' | 'email'>) {
    const secret = newSecret();
    return { secret, otpauthUrl: otpauthUrl(env().MFA_ISSUER, user.email, secret), pending: seal(`mfa-replace:${user.id}`, JSON.stringify({ secret, exp: Date.now() + ENROLL_TTL_MS })) };
  }

  async replaceConfirm(userId: string, pending: string, code: string, keepSessionId: string | undefined, ip: string | null) {
    let secret: string;
    try {
      const p = JSON.parse(unseal(`mfa-replace:${userId}`, pending).toString('utf8')) as { secret: string; exp: number };
      if (p.exp < Date.now()) throw new Error('expired');
      secret = p.secret;
    } catch { throw new AppError(400, 'replace_expired', 'This setup expired. Start again.'); }
    const step = verifyCode(secret, code, null);
    if (step === null) throw unauthorizedCode('invalid_code', 'That code is not right. Use the code from the new entry in your app.');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: seal('mfa', secret), mfaEnabledAt: new Date(), mfaLastStep: step } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null, NOT: keepSessionId ? { id: keepSessionId } : undefined }, data: { revokedAt: new Date() } });
    await this.forgetDevices(userId);
    await this.audit.log({ actorId: userId, action: 'auth.mfa_replaced', targetType: 'user', targetId: userId, ip });
  }
}

/** Ten codes like `7KQ2-M9XA-4F`, about 50 bits each, shown once. */
function newRecoveryCodes(): string[] {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 10 }, () => {
    // 32 symbols divide 256 evenly, so every character is uniform: 10 × 5 bits = 50 bits.
    const s = Array.from(randomBytes(10), (b) => alphabet[b % 32]).join('');
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 10)}`;
  });
}
const normRecovery = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, '');
