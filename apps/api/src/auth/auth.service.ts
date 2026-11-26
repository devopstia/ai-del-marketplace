import { Injectable, Optional } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Response } from 'express';
import { AuditService } from '../common/audit.service';
import type { AppRequest } from '../common/auth-context';
import { AppError, conflict, notFound, unauthorized } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { sha256 } from '../common/seal';
import { randomToken } from '../common/util';
import { env } from '../config/env';
import { checkPassword, passwordMessage } from './password-policy';
import { ALL_ADMIN_PERMISSIONS } from '../common/permissions';
import { RoleConfigService } from '../common/role-config.service';
import { type Ctx, SignInService } from './signin.service';

export const ARGON2_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const RESET_TTL_MS = 60 * 60_000;

const publicUser = { id: true, email: true, name: true, avatarUrl: true, roles: true, status: true, createdAt: true, adminPermissions: true, signupMethod: true, emailVerifiedAt: true, mustChangePassword: true } as const;
const VERIFY_TTL_MS = 3 * 24 * 3600_000;

@Injectable()
export class AuthService {
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signIn: SignInService,
    private readonly jobs: JobsService,
    @Optional() private readonly roleConfig?: RoleConfigService,
  ) {}

  hashPassword(pw: string) {
    return argon2.hash(pw, ARGON2_OPTS);
  }

  /** The strength rules plus the breach check; throws a message listing every problem at once. */
  async assertStrong(pw: string, who: { email?: string; name?: string }) {
    const c = await checkPassword(pw, who);
    if (!c.ok) throw new AppError(400, c.breached ? 'password_breached' : 'weak_password', passwordMessage(c), { problems: c.problems });
  }

  /** Email and password sign-up: the account exists now, but the session comes only after Google Authenticator is set up. */
  async register(input: { email: string; password: string; name: string; cartCourseIds?: string[]; next?: string }, req: AppRequest, res: Response, ctx: Ctx) {
    const email = input.email.trim().toLowerCase();
    await this.assertStrong(input.password, { email, name: input.name });
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw conflict('An account with this email already exists. Log in instead, or reset your password.', 'email_taken');
    // Every public sign-up is a student (owner 2026-11-25): roles are never taken from the request.
    const user = await this.prisma.user.create({ data: { email, name: input.name.trim(), passwordHash: await this.hashPassword(input.password), passwordChangedAt: new Date(), roles: ['student'], signupMethod: 'email' } });
    await this.audit.log({ actorId: user.id, action: 'auth.register', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method: 'password' } });
    await this.sendVerification(user.id, ctx.ip);
    await this.notifyStaff('registration', { name: user.name, method: 'email' });
    return this.signIn.begin(user, 'password', req, res, ctx, { cartCourseIds: input.cartCourseIds, next: input.next });
  }

  /** First step with a password. Wrong passwords count toward the account lockout; a locked account refuses the right one too. */
  async login(input: { email: string; password: string; cartCourseIds?: string[]; next?: string }, req: AppRequest, res: Response, ctx: Ctx) {
    const email = input.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Verify against a dummy hash when there is no password, so timing doesn't reveal which emails are registered.
    this.dummyHash ??= this.hashPassword(randomToken(16));
    if (user) this.signIn.assertNotLocked(user);
    const ok = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), input.password).catch(() => false);
    if (!user || !user.passwordHash || !ok) {
      if (user) await this.signIn.recordFailure(user.id, ctx.ip, 'password');
      await this.audit.log({ actorId: user?.id ?? null, action: 'auth.login_failed', targetType: 'user', targetId: user?.id, ip: ctx.ip, meta: { email } });
      throw unauthorized('Email or password is incorrect', 'invalid_credentials');
    }
    if (argon2.needsRehash(user.passwordHash, ARGON2_OPTS)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.hashPassword(input.password) } });
    }
    return this.signIn.begin(user, 'password', req, res, ctx, { cartCourseIds: input.cartCourseIds, next: input.next });
  }

  async revokeSession(sessionId: string) {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...publicUser, instructorProfile: { select: { status: true, payoutsEnabled: true, isPlatform: true } } },
    });
    if (!user) throw notFound('User');
    const { instructorProfile, adminPermissions, ...rest } = user;
    const mfa = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaEnabledAt: true } });
    const allowed = (await this.roleConfig?.get())?.adminAllowed ?? ALL_ADMIN_PERMISSIONS;
    return { ...rest, adminPermissions: rest.roles.includes('super_admin') ? ALL_ADMIN_PERMISSIONS : rest.roles.includes('admin') ? adminPermissions.filter((p) => (allowed as string[]).includes(p)) : [], mfaEnabled: !!mfa?.mfaEnabledAt, instructor: instructorProfile };
  }

  // ---------- email verification ----------
  /** Sends a single-use link (3 days) proving the person owns the address. At most 3 per hour. */
  async sendVerification(userId: string, ip: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, emailVerifiedAt: true } });
    if (!user || user.emailVerifiedAt) return { ok: true, verified: !!user?.emailVerifiedAt };
    const recent = await this.prisma.emailVerification.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 3) throw new AppError(429, 'too_many_requests', 'We sent a link a moment ago. Check your inbox and spam folder, or try again in an hour.');
    const raw = randomToken(32);
    await this.prisma.emailVerification.create({ data: { id: sha256(raw), userId, email: user.email, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) } });
    await this.jobs.sendEmail({ to: user.email, template: 'verify-email', data: { name: user.name, link: `${env().WEB_URL}/verify-email?token=${raw}` } });
    await this.audit.log({ actorId: userId, action: 'auth.email_verification_sent', targetType: 'user', targetId: userId, ip });
    return { ok: true, verified: false };
  }

  /** Opening the link proves ownership of the address it was sent to (only if the account still uses that address). */
  async verifyEmail(raw: string, ip: string | null) {
    const v = await this.prisma.emailVerification.findUnique({ where: { id: sha256(raw) }, include: { user: { select: { id: true, email: true } } } });
    if (!v || v.usedAt || v.expiresAt < new Date() || v.user.email !== v.email) throw new AppError(400, 'verify_link_invalid', 'This link has expired or was already used. Sign in and ask for a new one.');
    const used = await this.prisma.emailVerification.updateMany({ where: { id: v.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!used.count) throw new AppError(400, 'verify_link_invalid', 'This link has expired or was already used. Sign in and ask for a new one.');
    await this.prisma.user.updateMany({ where: { id: v.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
    await this.audit.log({ actorId: v.userId, action: 'auth.email_verified', targetType: 'user', targetId: v.userId, ip });
    return { ok: true };
  }

  /** Optional staff notices (Super Admin › Settings): new registrations and instructor applications. */
  async notifyStaff(kind: 'registration' | 'application', data: Record<string, unknown>) {
    const key = kind === 'registration' ? 'notify_new_registrations' : 'notify_instructor_applications';
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    const on = setting ? setting.value === true || setting.value === 'true' : kind === 'application';
    if (!on) return;
    const staff = await this.prisma.user.findMany({ where: { roles: { has: 'super_admin' }, status: 'active' }, select: { email: true, name: true } });
    for (const s of staff) await this.jobs.sendEmail({ to: s.email, template: kind === 'registration' ? 'staff-new-registration' : 'staff-instructor-application', data: { staffName: s.name, ...data, link: `${env().WEB_URL}/admin/${kind === 'registration' ? 'users' : 'instructors'}` } });
  }

  /** DEL's own instructor account (the platform-owned profile), for the super admin's "DEL Studio" switch. */
  async platformInstructor() {
    const p = await this.prisma.instructorProfile.findFirst({ where: { isPlatform: true, status: 'approved' }, orderBy: { createdAt: 'asc' }, select: { user: { select: { id: true, name: true } } } });
    return p?.user ?? null;
  }

  async listSessions(userId: string, currentId?: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true, ip: true, userAgent: true },
    });
    return rows.map((r) => ({ ...r, current: r.id === currentId }));
  }

  async revokeOwnSession(userId: string, sessionId: string, ip: string | null) {
    const r = await this.prisma.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!r.count) throw notFound('Session');
    await this.audit.log({ actorId: userId, action: 'auth.session_revoked', targetType: 'session', targetId: sessionId, ip });
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string | null }) {
    return this.prisma.user.update({ where: { id: userId }, data, select: publicUser });
  }

  /** What Account › Security shows. */
  async security(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, passwordChangedAt: true, mfaEnabledAt: true } });
    const [codesLeft, devices] = await Promise.all([
      this.prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } }),
      this.prisma.trustedDevice.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    return { hasPassword: !!u.passwordHash, passwordChangedAt: u.passwordChangedAt, mfa: { enabledAt: u.mfaEnabledAt, recoveryCodesLeft: codesLeft }, trustedDevices: devices };
  }

  /**
   * Change the password (needs the current one) or set a first one on an account that signs in with Google and the like
   * (needs a code from the authenticator). Every other device is signed out and trusted devices are forgotten.
   */
  async setPassword(userId: string, input: { currentPassword?: string; newPassword: string; code?: string }, keepSessionId: string | undefined, ip: string | null) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash) {
      if (!input.currentPassword || !(await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false))) {
        throw unauthorized('Current password is incorrect', 'invalid_credentials');
      }
    } else {
      await this.signIn.checkCode(userId, input.code, ip);
    }
    await this.assertStrong(input.newPassword, { email: user.email, name: user.name });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(input.newPassword), passwordChangedAt: new Date(), mustChangePassword: false } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null, NOT: keepSessionId ? { id: keepSessionId } : undefined }, data: { revokedAt: new Date() } });
    await this.signIn.forgetDevices(userId);
    await this.audit.log({ actorId: userId, action: user.passwordHash ? 'auth.password_changed' : 'auth.password_set', targetType: 'user', targetId: userId, ip });
    await this.jobs.sendEmail({ to: user.email, template: 'security-password-changed', data: { name: user.name } });
  }

  /** Always the same answer, whether or not the address has an account (no account oracle). */
  async forgotPassword(emailRaw: string, ip: string | null) {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, name: true, status: true } });
    if (user && user.status === 'active') {
      const recent = await this.prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
      if (recent < 3) {
        const raw = randomToken(32);
        await this.prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
        await this.prisma.passwordReset.create({ data: { id: sha256(raw), userId: user.id, expiresAt: new Date(Date.now() + RESET_TTL_MS), ip } });
        await this.jobs.sendEmail({ to: email, template: 'password-reset', data: { name: user.name, link: `${env().WEB_URL}/reset-password?token=${raw}` } });
        await this.audit.log({ actorId: user.id, action: 'auth.password_reset_requested', targetType: 'user', targetId: user.id, ip });
      }
    }
    return { ok: true };
  }

  /** A reset ends every session and trusted device and clears the lockout; Google Authenticator is still asked at sign-in. */
  async resetPassword(raw: string, password: string, ip: string | null) {
    const r = await this.prisma.passwordReset.findUnique({ where: { id: sha256(raw) }, include: { user: true } });
    if (!r || r.usedAt || r.expiresAt < new Date() || r.user.status !== 'active') throw new AppError(400, 'reset_link_invalid', 'This link has expired or was already used. Ask for a new one.');
    await this.assertStrong(password, { email: r.user.email, name: r.user.name });
    const used = await this.prisma.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!used.count) throw new AppError(400, 'reset_link_invalid', 'This link has expired or was already used. Ask for a new one.');
    await this.prisma.user.update({ where: { id: r.userId }, data: { passwordHash: await this.hashPassword(password), passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null, mustChangePassword: false } });
    await this.prisma.session.updateMany({ where: { userId: r.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.signIn.forgetDevices(r.userId);
    await this.audit.log({ actorId: r.userId, action: 'auth.password_reset', targetType: 'user', targetId: r.userId, ip });
    await this.jobs.sendEmail({ to: r.user.email, template: 'security-password-changed', data: { name: r.user.name } });
    return { ok: true };
  }

  /** Super Admin: remove someone's authenticator (lost phone, no recovery code). Never their own account. */
  async resetMfa(actorId: string, targetId: string, ip: string | null) {
    if (actorId === targetId) throw new AppError(403, 'own_account', 'You can’t reset your own two-step sign-in. Use a recovery code, or ask another super admin.');
    const t = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, name: true } });
    if (!t) throw notFound('User');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: targetId }, data: { mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null } }),
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId: targetId } }),
      this.prisma.session.updateMany({ where: { userId: targetId, revokedAt: null }, data: { revokedAt: new Date() } }),
      this.prisma.authTicket.deleteMany({ where: { userId: targetId } }),
    ]);
    await this.signIn.forgetDevices(targetId);
    await this.audit.log({ actorId, action: 'auth.mfa_reset_by_admin', targetType: 'user', targetId, ip });
    await this.jobs.sendEmail({ to: t.email, template: 'security-mfa-reset', data: { name: t.name } });
    return { ok: true };
  }
}
