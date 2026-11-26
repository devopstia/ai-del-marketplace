import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { AppError, badRequest, conflict, forbidden, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { sha256 } from '../common/seal';
import { randomToken } from '../common/util';
import { env } from '../config/env';
import { AuthService } from '../auth/auth.service';
import { PeopleService } from './people.service';

const PRIVILEGED = ['admin', 'super_admin'];
/** A recovery link a super admin hands over in person: single use, short-lived. */
export const RECOVERY_LINK_TTL_MS = 30 * 60_000;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A random temporary password that meets the password rules (letters and numbers, 16 characters, no look-alikes). */
export function temporaryPassword(length = 16): string {
  for (;;) {
    let out = '';
    for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
    if (/[a-z]/i.test(out) && /\d/.test(out)) return out.replace(/(.{4})(?=.)/g, '$1-');
  }
}

/** sha256 of the address, so the audit log can prove which address was removed without keeping it. */
const fingerprint = (email: string) => sha256(email.trim().toLowerCase()).slice(0, 16);

/**
 * Super Admin › Users: helping people who can't get into their account, and account changes that used to need the
 * database (owner 2026-11-26, docs/SUPER_ADMIN.md). Passwords are never shown or emailed: a temporary password is shown
 * once to the super admin to hand over, and must be changed at the next sign-in.
 */
@Injectable()
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly auth: AuthService,
    private readonly people: PeopleService,
  ) {}

  private async target(a: Actor, userId: string, opts: { superOnly?: boolean } = {}) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw notFound('User');
    if (u.status === 'deleted') throw conflict('This account was deleted.', 'user_deleted');
    if (userId === a.user.id) throw forbidden('Use Account settings for your own account.', 'self_change');
    const isSuper = a.user.roles.includes('super_admin');
    if (opts.superOnly && !isSuper) throw forbidden('Only a super admin can do this', 'super_admin_required');
    if (!isSuper && u.roles.some((r) => PRIVILEGED.includes(r))) throw forbidden('Only a super admin can change another admin', 'super_admin_required');
    return u;
  }

  /** Name (users.manage for students and instructors, super admin for admins). */
  async updateProfile(a: Actor, userId: string, input: { name?: string }) {
    const u = await this.target(a, userId);
    const name = input.name?.trim();
    if (!name || name === u.name) return this.people.detail(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { name } });
    await this.audit.log({ actorId: a.user.id, action: 'user.updated', targetType: 'user', targetId: userId, ip: a.ip, meta: { fields: ['name'], before: { name: u.name }, after: { name } } });
    return this.people.detail(userId);
  }

  /**
   * Super admin + authenticator code. The new address must be confirmed by the person (link sent there); the old address
   * gets a notice. Sign-in with Google and the like is unaffected (matched by the provider's account id).
   */
  async changeEmail(a: Actor, userId: string, input: { email: string; code?: string; reason?: string }) {
    const u = await this.target(a, userId, { superOnly: true });
    const email = input.email.trim().toLowerCase();
    if (email === u.email) return this.people.detail(userId);
    await this.people.stepUp(a, input.code);
    if (await this.prisma.user.findUnique({ where: { email } })) throw conflict('Another account already uses this email address.', 'email_taken');
    await this.prisma.user.update({ where: { id: userId }, data: { email, emailVerifiedAt: null } });
    await this.prisma.emailVerification.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: 'user.email_changed', targetType: 'user', targetId: userId, ip: a.ip, meta: { before: u.email, after: email, reason: input.reason?.trim() || null } });
    await this.jobs.sendEmail({ to: u.email, template: 'security-email-changed', data: { name: u.name, newEmail: email } });
    await this.auth.sendVerification(userId, a.ip).catch(() => null);
    return this.people.detail(userId);
  }

  /** The usual reset email (single-use link, 1 hour), sent on the person's behalf. */
  async sendPasswordReset(a: Actor, userId: string) {
    const u = await this.target(a, userId);
    if (u.status !== 'active') throw conflict('Reactivate the account first: suspended accounts can’t reset their password.', 'not_active');
    const recent = await this.prisma.passwordReset.count({ where: { userId, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= 3) throw new AppError(429, 'too_many_requests', 'Three reset links were sent in the last hour. Ask them to check their spam folder, or create a recovery link.');
    const raw = randomToken(32);
    await this.prisma.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.passwordReset.create({ data: { id: sha256(raw), userId, expiresAt: new Date(Date.now() + 3600_000), ip: a.ip } });
    await this.jobs.sendEmail({ to: u.email, template: 'password-reset', data: { name: u.name, link: `${env().WEB_URL}/reset-password?token=${raw}` } });
    await this.audit.log({ actorId: a.user.id, action: 'user.password_reset_sent', targetType: 'user', targetId: userId, ip: a.ip });
    return { ok: true, sentTo: u.email };
  }

  async resendVerification(a: Actor, userId: string) {
    const u = await this.target(a, userId);
    if (u.emailVerifiedAt) return { ok: true, verified: true };
    const r = await this.auth.sendVerification(userId, a.ip);
    await this.audit.log({ actorId: a.user.id, action: 'user.verification_sent', targetType: 'user', targetId: userId, ip: a.ip });
    return { ...r, sentTo: u.email };
  }

  /**
   * When the person can't receive email: a single-use reset link (30 minutes) shown once to the super admin, who hands
   * it over after confirming who they are. Earlier unused links stop working.
   */
  async recoveryLink(a: Actor, userId: string, input: { code?: string; reason: string }) {
    const u = await this.target(a, userId, { superOnly: true });
    if (!input.reason.trim()) throw badRequest('Add how you confirmed who they are (kept in the account history).', 'reason_required');
    await this.people.stepUp(a, input.code);
    if (u.status !== 'active') throw conflict('Reactivate the account first.', 'not_active');
    const raw = randomToken(32);
    const expiresAt = new Date(Date.now() + RECOVERY_LINK_TTL_MS);
    await this.prisma.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.passwordReset.create({ data: { id: sha256(raw), userId, expiresAt, ip: a.ip } });
    await this.audit.log({ actorId: a.user.id, action: 'user.recovery_link_created', targetType: 'user', targetId: userId, ip: a.ip, meta: { reason: input.reason.trim(), expiresAt: expiresAt.toISOString() } });
    return { link: `${env().WEB_URL}/reset-password?token=${raw}`, expiresAt };
  }

  /**
   * A temporary password shown once (never emailed, never stored in clear). Every session ends, and the next sign-in
   * must choose a new password before anything else works. Two-step sign-in is still asked.
   */
  async temporaryPassword(a: Actor, userId: string, input: { code?: string; reason: string }) {
    const u = await this.target(a, userId, { superOnly: true });
    if (!input.reason.trim()) throw badRequest('Add how you confirmed who they are (kept in the account history).', 'reason_required');
    await this.people.stepUp(a, input.code);
    if (u.status !== 'active') throw conflict('Reactivate the account first.', 'not_active');
    const password = temporaryPassword();
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.auth.hashPassword(password), passwordChangedAt: new Date(), mustChangePassword: true, failedLogins: 0, lockedUntil: null } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.prisma.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: 'user.temporary_password_set', targetType: 'user', targetId: userId, ip: a.ip, meta: { reason: input.reason.trim() } });
    await this.jobs.sendEmail({ to: u.email, template: 'security-password-changed', data: { name: u.name } });
    return { password, mustChangePassword: true };
  }

  /** Sign the person out on every device (sessions end at once; trusted devices are forgotten). */
  async revokeSessions(a: Actor, userId: string) {
    await this.target(a, userId);
    const r = await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.prisma.trustedDevice.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: 'user.sessions_revoked', targetType: 'user', targetId: userId, ip: a.ip, meta: { sessions: r.count } });
    return { revoked: r.count };
  }

  /**
   * Delete an account (super admin, authenticator code, email typed back). Personal data is removed and the person can
   * never sign in again; orders, refunds, enrolments, certificates, reviews and the audit log stay (with "Deleted user").
   * Instructors must have no live course: archive or delete their courses first, so no learner loses a course silently.
   */
  async deleteUser(a: Actor, userId: string, input: { code?: string; confirmEmail: string; reason: string }) {
    const u = await this.target(a, userId, { superOnly: true });
    if (input.confirmEmail.trim().toLowerCase() !== u.email) throw badRequest('Type the account’s email address exactly to confirm.', 'confirm_mismatch');
    if (!input.reason.trim()) throw badRequest('Add a reason (kept in the audit log).', 'reason_required');
    if (u.roles.includes('super_admin')) await this.people.assertNotLastSuperAdmin(userId);
    const live = await this.prisma.course.count({ where: { instructorId: userId, archivedAt: null, purgedAt: null, status: { in: ['published', 'in_review'] } } });
    if (live) throw conflict(`This instructor has ${live} live or in-review course${live === 1 ? '' : 's'}. Archive or delete ${live === 1 ? 'it' : 'them'} first.`, 'has_live_courses');
    await this.people.stepUp(a, input.code);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
      this.prisma.trustedDevice.deleteMany({ where: { userId } }),
      this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } }),
      this.prisma.authTicket.deleteMany({ where: { userId } }),
      this.prisma.authIdentity.deleteMany({ where: { userId } }),
      this.prisma.passwordReset.deleteMany({ where: { userId } }),
      this.prisma.emailVerification.deleteMany({ where: { userId } }),
      this.prisma.cartItem.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted-${userId}@deleted.invalid`, name: 'Deleted user', avatarUrl: null, passwordHash: null, mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null,
          status: 'deleted', statusReason: input.reason.trim(), deletedAt: now, suspendedUntil: null, mustChangePassword: false, adminPermissions: [], roles: ['student'],
        },
      }),
    ]);
    await this.audit.log({ actorId: a.user.id, action: 'user.deleted', targetType: 'user', targetId: userId, ip: a.ip, meta: { reason: input.reason.trim(), emailFingerprint: fingerprint(u.email), roles: u.roles } });
    return { ok: true };
  }
}
