import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import type { User } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import { JobsService } from '../common/jobs';
import { SessionPolicyService } from '../common/session-policy.service';
import type { AppRequest } from '../common/auth-context';
import { hashSessionToken } from '../common/auth.guard';
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from '../common/cookies';
import { AppError } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { seal, sha256, unseal } from '../common/seal';
import { randomToken } from '../common/util';
import { env, isProd, signinCodeSkipped } from '../config/env';
import { allowedMethods, concurrentLimit, describeDevice, maskEmail } from './security-settings';
import { newSecret, otpauthUrl, verifyCode } from './totp';

export const MFA_COOKIE = 'del_mfa';
export const TRUST_COOKIE = 'del_trust';
/** Long-lived random browser id (httpOnly): a sign-in from a browser the account never used sends a security email. */
export const DEVICE_COOKIE = 'del_dev';
const DEVICE_TTL_MS = 400 * 24 * 3600_000;
/** At most this many email codes per sign-in attempt (then sign in again). */
const MAX_EMAIL_SENDS = 5;
const VERIFY_TTL_MS = 5 * 60_000;
const ENROLL_TTL_MS = 20 * 60_000;
const TRUST_TTL_MS = 30 * 24 * 3600_000;
const MAX_CODE_TRIES = 5;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MS = 15 * 60_000;

export interface Ctx { ip: string | null; userAgent: string | null }
/** How the first step was passed. */
export type Method = 'password' | 'google' | 'github' | 'facebook' | 'linkedin' | 'test';
/** An email sign-in code (docs/AUTH.md §7): only its HMAC is stored; a new code replaces the previous one. */
interface EmailOtp { hash: string; expiresAt: number; sentAt: number; sends: number; attempts: number }
interface TicketData { method: Method; secret?: string; cartCourseIds?: string[]; next?: string; emailOtp?: EmailOtp }

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
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly policy: SessionPolicyService, private readonly jobs: JobsService) {}

  /**
   * Refuses a new ordinary sign-in when the account is at its session limit and the Super Admin chose "refuse" instead of
   * "end the older session". Called before the ticket is used up, so the person can sign out elsewhere and retry.
   */
  async assertCanStart(userId: string) {
    const s = await this.policy.settings();
    if (s.session.terminatePrevious) return;
    const live = await this.prisma.session.count({ where: { userId, kind: 'user', revokedAt: null, expiresAt: { gt: new Date() } } });
    if (live >= concurrentLimit(s)) throw new AppError(409, 'session_limit', 'This account is already signed in on another device or browser. Sign out there first, or contact support@devopseasylearning.com.');
  }

  /**
   * A new session (docs/AUTH.md §7). kind 'user' (an ordinary sign-in) follows the single-session / concurrent-session
   * rule: older ordinary sessions over the limit end as "replaced" (only now, after every verification step passed).
   * kind 'support' (a super admin support session, impersonation) never ends or counts against the person's sessions.
   */
  async createSession(userId: string, ctx: Ctx, opts: { req?: AppRequest; res?: Response; kind?: 'user' | 'support'; ttlMs?: number; method?: string } = {}): Promise<string> {
    const kind = opts.kind ?? 'user';
    const s = await this.policy.settings();
    const now = Date.now();
    let deviceId: string | null = null;
    if (opts.req && opts.res) {
      const raw = opts.req.cookies?.[DEVICE_COOKIE];
      const dev = typeof raw === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(raw) ? raw : randomToken(24);
      opts.res.cookie(DEVICE_COOKIE, dev, cookie('/', DEVICE_TTL_MS));
      deviceId = sha256(dev);
    }
    if (kind === 'user') {
      // Signing in again in the same browser replaces that browser's old session (no session fixation).
      if (opts.req?.sessionId && opts.req.sessionKind !== 'support') await this.policy.end({ ids: [opts.req.sessionId], userId }, 'user', { ip: ctx.ip });
      const live = await this.prisma.session.findMany({ where: { userId, kind: 'user', revokedAt: null, expiresAt: { gt: new Date(now) } }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      const over = live.length - (concurrentLimit(s) - 1);
      if (over > 0) await this.policy.end({ ids: live.slice(0, over).map((r) => r.id), userId }, 'replaced', { ip: ctx.ip, extra: { newDevice: describeDevice(ctx.userAgent).label } });
      if (deviceId && s.alerts.newDevice) await this.maybeNewDeviceEmail(userId, deviceId, ctx);
    }
    const token = randomToken(32);
    const ttl = kind === 'user' ? s.session.lifetimeHours * 3600_000 : Math.min(opts.ttlMs ?? 3600_000, SESSION_TTL_MS);
    await this.prisma.session.create({
      data: { id: hashSessionToken(token), userId, kind, deviceId, lastActiveAt: new Date(now), expiresAt: new Date(now + ttl), ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) ?? null },
    });
    return token;
  }

  /** First sign-in from this browser on an account that has signed in before: email the owner (no geo-IP lookup). */
  private async maybeNewDeviceEmail(userId: string, deviceId: string, ctx: Ctx) {
    const [before, seen] = await Promise.all([
      this.prisma.session.count({ where: { userId, kind: 'user' } }),
      this.prisma.session.count({ where: { userId, deviceId } }),
    ]);
    if (!before || seen) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user) return;
    const d = describeDevice(ctx.userAgent);
    await this.audit.log({ actorId: userId, action: 'auth.new_device', targetType: 'user', targetId: userId, ip: ctx.ip, meta: { device: d.label } });
    await this.jobs.sendEmail({ to: user.email, template: 'security-new-device', data: { name: user.name, device: d.label, ip: ctx.ip ?? '', at: new Date().toISOString() } });
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
      if ((await this.policy.settings()).alerts.suspicious) {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
        if (user) await this.jobs.sendEmail({ to: user.email, template: 'security-account-locked', data: { name: user.name, minutes: Math.round(LOCK_MS / 60_000), ip: ip ?? '', what } });
      }
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
    // A temporary suspension (Super Admin › Users) ends by itself at its end date: the first sign-in after it reactivates.
    if (user.status === 'suspended' && user.suspendedUntil && user.suspendedUntil <= new Date()) {
      await this.prisma.user.update({ where: { id: user.id }, data: { status: 'active', suspendedUntil: null, statusReason: null } });
      await this.audit.log({ actorId: null, action: 'user.reactivated', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { reason: 'Temporary suspension ended' } });
      user = { ...user, status: 'active', suspendedUntil: null };
    }
    if (user.status !== 'active') throw new AppError(403, 'account_suspended', user.status === 'suspended' && user.suspendedUntil ? `This account is suspended until ${user.suspendedUntil.toUTCString()}` : 'This account is suspended');
    this.assertNotLocked(user);
    // MFA_REQUIRED=false: local development and staging only; never honoured on production (signinCodeSkipped).
    const skip = signinCodeSkipped();
    if (skip || (user.mfaEnabledAt && (await this.isTrusted(req, user.id)))) {
      await this.assertCanStart(user.id);
      const token = await this.createSession(user.id, ctx, { req, res, method });
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
      await this.audit.log({ actorId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method, ...(skip ? { mfa: 'skipped (MFA_REQUIRED=false, local/staging only)' } : { trustedDevice: true }) } });
      return { done: true as const, userId: user.id, cartCourseIds: extra.cartCourseIds };
    }
    // Has an authenticator → 'verify'; without one → 'enroll'. A student or instructor allowed email codes may, on the
    // enroll screen, choose "send a code to my email" instead of setting one up (pending().methods.email).
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
    const s = await this.policy.settings();
    const allowed = allowedMethods(t.user.roles, s);
    const hasApp = !!t.user.mfaEnabledAt;
    const codesLeft = hasApp ? await this.prisma.mfaRecoveryCode.count({ where: { userId: t.user.id, usedAt: null } }) : 0;
    const otp = t.data.emailOtp;
    // Someone who signed in with an email code last time starts on the email code again.
    const last = !hasApp && allowed.email ? await this.prisma.auditLog.findFirst({ where: { action: 'auth.login', targetType: 'user', targetId: t.user.id }, orderBy: { at: 'desc' }, select: { meta: true } }) : null;
    const prefers = (last?.meta as Record<string, unknown> | undefined)?.mfa === 'email_code' ? 'email' : null;
    return {
      prefers,
      stage: t.stage, method: t.data.method, name: t.user.name, email: maskEmail(t.user.email), next: t.data.next ?? null, expiresAt: t.expiresAt,
      // The second steps this person may use here (Admin and Super Admin: authenticator only).
      methods: { authenticator: hasApp, email: allowed.email, recovery: codesLeft > 0 },
      emailCode: allowed.email ? { length: s.emailOtp.length, ttlMinutes: s.emailOtp.ttlMinutes, sent: !!otp && otp.expiresAt > Date.now(), resendAfter: otp ? new Date(otp.sentAt + s.emailOtp.resendSeconds * 1000) : null } : null,
    };
  }

  /**
   * "Send a code to my email" (owner 2026-11-26; docs/AUTH.md §7): students and instructors when the Super Admin allows
   * it, never Admin or Super Admin. A random N-digit code, only its HMAC stored, single use, expires, limited tries,
   * a resend cooldown, at most five per sign-in attempt; a new code replaces the previous one.
   */
  async sendEmailCode(req: AppRequest, ctx: Ctx) {
    const t = await this.ticket(req);
    const s = await this.policy.settings();
    if (!allowedMethods(t.user.roles, s).email) throw new AppError(403, 'email_code_not_allowed', 'Email codes are not available for this account. Use Google Authenticator or a recovery code.');
    const prev = t.data.emailOtp;
    const now = Date.now();
    if (prev && prev.sentAt + s.emailOtp.resendSeconds * 1000 > now) {
      const wait = Math.ceil((prev.sentAt + s.emailOtp.resendSeconds * 1000 - now) / 1000);
      throw new AppError(429, 'email_code_cooldown', `Please wait ${wait} seconds before asking for a new code.`, { retryAfterSeconds: wait });
    }
    if ((prev?.sends ?? 0) >= MAX_EMAIL_SENDS) throw new AppError(429, 'email_code_limit', 'Too many codes for this sign-in. Please sign in again.');
    const code = newEmailCode(s.emailOtp.length);
    const otp: EmailOtp = { hash: otpHash(t.id, code), expiresAt: now + s.emailOtp.ttlMinutes * 60_000, sentAt: now, sends: (prev?.sends ?? 0) + 1, attempts: 0 };
    const expiresAt = new Date(Math.max(t.expiresAt.getTime(), otp.expiresAt + 60_000));
    await this.prisma.authTicket.update({ where: { id: t.id }, data: { data: { ...t.data, emailOtp: otp } as object, expiresAt } });
    await this.jobs.sendEmail({ to: t.user.email, template: 'auth-email-code', data: { name: t.user.name, code, minutes: s.emailOtp.ttlMinutes, device: describeDevice(ctx.userAgent).label } });
    await this.audit.log({ actorId: t.user.id, action: 'auth.email_code_sent', targetType: 'user', targetId: t.user.id, ip: ctx.ip, meta: { sends: otp.sends } });
    return { sentTo: maskEmail(t.user.email), expiresAt: new Date(otp.expiresAt), resendAfter: new Date(now + s.emailOtp.resendSeconds * 1000) };
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
  async complete(req: AppRequest, res: Response, ctx: Ctx, input: { code?: string; recoveryCode?: string; emailCode?: string; trustDevice?: boolean }) {
    const t = await this.ticket(req);
    const user = t.user;
    this.assertNotLocked(user);
    let recoveryCodes: string[] | undefined;
    let ok = false;
    let used: 'code' | 'recovery_code' | 'email_code' | 'enrolled' = input.recoveryCode ? 'recovery_code' : 'code';
    if (input.emailCode) {
      used = 'email_code';
      const s = await this.policy.settings();
      const otp = t.data.emailOtp;
      if (!allowedMethods(user.roles, s).email) throw new AppError(403, 'email_code_not_allowed', 'Email codes are not available for this account. Use Google Authenticator or a recovery code.');
      if (!otp || otp.expiresAt <= Date.now() || otp.attempts >= s.emailOtp.maxAttempts) {
        throw new AppError(401, 'email_code_expired', 'This email code has expired or was tried too many times. Send a new code.');
      }
      const given = input.emailCode.replace(/\D/g, '');
      ok = given.length === s.emailOtp.length && safeEqual(otpHash(t.id, given), otp.hash);
      // Single use: a right code is removed; a wrong one counts toward the code's own limit.
      const { emailOtp: _drop, ...rest } = t.data;
      await this.prisma.authTicket.update({ where: { id: t.id }, data: { data: (ok ? rest : { ...t.data, emailOtp: { ...otp, attempts: otp.attempts + 1 } }) as object } });
      if (ok && !user.emailVerifiedAt) await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    } else if (t.stage === 'enroll') {
      used = 'enrolled';
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
      throw unauthorizedCode('invalid_code', input.emailCode ? 'That code is not right. Check the latest email from DevOps Easy Learning and try again.' : input.recoveryCode ? 'That recovery code is not valid or was already used.' : 'That code is not right. Check the six digits in Google Authenticator and try again.');
    }
    await this.assertCanStart(user.id);
    await this.prisma.authTicket.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    const token = await this.createSession(user.id, ctx, { req, res, method: t.data.method });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    res.clearCookie(MFA_COOKIE, { path: '/api/auth' });
    // "Trust this browser" skips the authenticator next time; an email-code sign-in isn't trusted (no authenticator).
    const trusted = !!input.trustDevice && used !== 'email_code';
    if (trusted) await this.trust(req, res, user.id, ctx);
    await this.audit.log({ actorId: user.id, action: 'auth.login', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method: t.data.method, mfa: used, trustDevice: trusted, device: describeDevice(ctx.userAgent).label } });
    const left = await this.prisma.mfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
    return { userId: user.id, recoveryCodes, recoveryCodesLeft: left, cartCourseIds: t.data.cartCourseIds, next: t.data.next ?? null };
  }

  async cancel(req: AppRequest, res: Response) {
    const raw = req.cookies?.[MFA_COOKIE];
    if (typeof raw === 'string') await this.prisma.authTicket.updateMany({ where: { id: sha256(raw), usedAt: null }, data: { usedAt: new Date() } });
    res.clearCookie(MFA_COOKIE, { path: '/api/auth' });
  }

  /**
   * Step-up by email for a student or instructor who signs in with email codes and has no authenticator (unlinking a
   * provider, setting a password…): the same code rules as sign-in, bound to the account instead of a sign-in ticket.
   */
  async sendStepUpCode(userId: string, ctx: Ctx) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaSecret) throw new AppError(409, 'use_authenticator', 'Use the code from Google Authenticator.');
    const s = await this.policy.settings();
    if (!allowedMethods(user.roles, s).email) throw new AppError(403, 'email_code_not_allowed', 'Email codes are not available for this account.');
    const now = Date.now();
    const prev = await this.prisma.authTicket.findFirst({ where: { userId, stage: 'stepup', usedAt: null }, orderBy: { createdAt: 'desc' } });
    const prevOtp = (prev?.data as unknown as TicketData | undefined)?.emailOtp;
    if (prevOtp && prevOtp.sentAt + s.emailOtp.resendSeconds * 1000 > now) {
      const wait = Math.ceil((prevOtp.sentAt + s.emailOtp.resendSeconds * 1000 - now) / 1000);
      throw new AppError(429, 'email_code_cooldown', `Please wait ${wait} seconds before asking for a new code.`, { retryAfterSeconds: wait });
    }
    await this.prisma.authTicket.deleteMany({ where: { userId, stage: 'stepup' } });
    const id = sha256(randomToken(24));
    const code = newEmailCode(s.emailOtp.length);
    const otp: EmailOtp = { hash: otpHash(id, code), expiresAt: now + s.emailOtp.ttlMinutes * 60_000, sentAt: now, sends: 1, attempts: 0 };
    await this.prisma.authTicket.create({ data: { id, userId, stage: 'stepup', data: { method: 'password', emailOtp: otp } satisfies TicketData as object, expiresAt: new Date(otp.expiresAt) } });
    await this.jobs.sendEmail({ to: user.email, template: 'auth-email-code', data: { name: user.name, code, minutes: s.emailOtp.ttlMinutes, purpose: 'confirm', device: describeDevice(ctx.userAgent).label } });
    await this.audit.log({ actorId: userId, action: 'auth.email_code_sent', targetType: 'user', targetId: userId, ip: ctx.ip, meta: { purpose: 'step-up' } });
    return { sentTo: maskEmail(user.email), expiresAt: new Date(otp.expiresAt), resendAfter: new Date(now + s.emailOtp.resendSeconds * 1000) };
  }

  private async checkStepUpEmail(userId: string, code: string | undefined): Promise<boolean> {
    const t = await this.prisma.authTicket.findFirst({ where: { userId, stage: 'stepup', usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    const otp = (t?.data as unknown as TicketData | undefined)?.emailOtp;
    const s = await this.policy.settings();
    if (!t || !otp || otp.attempts >= s.emailOtp.maxAttempts || !code) return false;
    const ok = safeEqual(otpHash(t.id, code.replace(/\D/g, '')), otp.hash);
    await this.prisma.authTicket.update({ where: { id: t.id }, data: ok ? { usedAt: new Date() } : { data: { ...(t.data as object), emailOtp: { ...otp, attempts: otp.attempts + 1 } } as object } });
    return ok;
  }

  /**
   * For signed-in actions that need proof (new recovery codes, unlinking, setting a password without one): a code from
   * the authenticator, or (an account without one that may use email codes) the code from sendStepUpCode.
   */
  async checkCode(userId: string, code: string | undefined, ip: string | null) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    this.assertNotLocked(user);
    if (!user.mfaSecret && allowedMethods(user.roles, await this.policy.settings()).email) {
      if (await this.checkStepUpEmail(userId, code)) return;
      await this.recordFailure(userId, ip, 'email-code');
      throw unauthorizedCode('invalid_code', 'That code is not right. Use the latest code we emailed you, or send a new one.');
    }
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
/** An N-digit code from the system's secure random source (uniform: randomInt has no modulo bias). */
export const newEmailCode = (length: number) => String(randomInt(0, 10 ** length)).padStart(length, '0');
/** HMAC of an email code bound to its ticket (or step-up), keyed with SESSION_SECRET: a database copy can't be tried offline. */
export const otpHash = (ticketId: string, code: string) => createHmac('sha256', env().SESSION_SECRET).update(`email-otp:${ticketId}:${code}`).digest('hex');
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
