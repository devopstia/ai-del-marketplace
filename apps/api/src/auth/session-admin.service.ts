import { stepUpSkipped } from '../config/env';
import { Injectable } from '@nestjs/common';
import type { Actor } from '../common/auth-context';
import { AuditService } from '../common/audit.service';
import { AppError, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SessionPolicyService } from '../common/session-policy.service';
import { type AuthSettings, authSettingsSchema, describeDevice, EMAIL_OTP_ROLES, PRIVILEGED_ROLES } from './security-settings';
import { SignInService } from './signin.service';

/** Sign-in events shown as a person's login history (from the audit log). */
const LOGIN_EVENTS = ['auth.login', 'auth.login_failed', 'auth.mfa_failed', 'auth.new_device', 'auth.account_locked', 'auth.email_code_sent'];
/** Session ends shown as termination history. */
const END_EVENTS = ['auth.logout', 'auth.session_replaced', 'auth.session_idle_logout', 'auth.session_expired', 'auth.session_revoked', 'auth.session_revoked_by_admin'];

/**
 * Super Admin: Authentication & security settings and a person's sessions (owner 2026-11-26, prompts.md;
 * docs/AUTH.md §7). Every change needs an authenticator code (step-up) and is audited.
 */
@Injectable()
export class SessionAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: SessionPolicyService,
    private readonly signIn: SignInService,
  ) {}

  async getSettings() {
    return {
      settings: await this.policy.settings(),
      saved: await this.policy.saved(),
      defaults: this.policy.defaults(),
      // Fixed safeguards the page shows but can't change.
      fixed: { privilegedRoles: PRIVILEGED_ROLES, emailOtpRoles: EMAIL_OTP_ROLES, recoveryCodes: true },
    };
  }

  async saveSettings(a: Actor, input: { settings: unknown; code?: string }) {
    if (!stepUpSkipped(true)) await this.signIn.checkCode(a.user.id, input.code, a.ip);
    const parsed = authSettingsSchema.safeParse(input.settings);
    if (!parsed.success) throw new AppError(400, 'invalid_settings', parsed.error.issues.map((i) => i.message).join('; '), { issues: parsed.error.issues });
    const next: AuthSettings = parsed.data;
    // Safeguard: email codes are only for students and instructors (the schema allows nothing else; checked again here).
    if (next.emailOtp.roles.some((r) => (PRIVILEGED_ROLES as string[]).includes(r))) throw new AppError(400, 'invalid_settings', 'Email codes can never be enough for Admin or Super Admin accounts.');
    const before = await this.policy.settings();
    await this.policy.save(next);
    await this.audit.log({ actorId: a.user.id, action: 'auth.security_settings_changed', targetType: 'platform_setting', targetId: 'auth_security', ip: a.ip, meta: { changes: diff(before, next) } });
    return this.getSettings();
  }

  async resetSettings(a: Actor, code?: string) {
    if (!stepUpSkipped(true)) await this.signIn.checkCode(a.user.id, code, a.ip);
    const before = await this.policy.settings();
    await this.policy.reset();
    await this.audit.log({ actorId: a.user.id, action: 'auth.security_settings_reset', targetType: 'platform_setting', targetId: 'auth_security', ip: a.ip, meta: { changes: diff(before, await this.policy.settings()) } });
    return this.getSettings();
  }

  /** A person's sessions, login history and session ends (IP addresses are shown to super admins only). */
  async userSessions(a: Actor, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw notFound('User');
    const cfg = await this.policy.settings();
    const now = new Date();
    const [live, logins, ends] = await Promise.all([
      this.prisma.session.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.auditLog.findMany({ where: { targetType: 'user', targetId: userId, action: { in: LOGIN_EVENTS } }, orderBy: { at: 'desc' }, take: 30, select: { id: true, action: true, at: true, ip: true, meta: true } }),
      this.prisma.auditLog.findMany({ where: { targetType: 'session', action: { in: END_EVENTS }, meta: { path: ['userId'], equals: userId } }, orderBy: { at: 'desc' }, take: 30, select: { id: true, action: true, at: true, ip: true, meta: true, actorId: true } }),
    ]);
    await this.audit.log({ actorId: a.user.id, action: 'admin.user_sessions_viewed', targetType: 'user', targetId: userId, ip: a.ip });
    return {
      sessions: live.map((s) => {
        const d = describeDevice(s.userAgent);
        const last = s.lastActiveAt ?? s.createdAt;
        const lifetimeEnd = s.kind === 'user' ? Math.min(s.expiresAt.getTime(), s.createdAt.getTime() + cfg.session.lifetimeHours * 3600_000) : s.expiresAt.getTime();
        const idleEnd = s.kind === 'user' ? last.getTime() + cfg.session.inactivityMinutes * 60_000 : Infinity;
        return { id: s.id, kind: s.kind, createdAt: s.createdAt, lastActiveAt: last, expiresAt: new Date(Math.min(lifetimeEnd, idleEnd)), ip: s.ip, device: d.label, deviceType: d.type, browser: d.browser, os: d.os };
      }),
      logins: logins.map((l) => ({ id: l.id, action: l.action, at: l.at, ip: l.ip, device: str((l.meta as Record<string, unknown>)?.device), method: str((l.meta as Record<string, unknown>)?.method), mfa: str((l.meta as Record<string, unknown>)?.mfa) })),
      ends: ends.map((e) => ({ id: e.id, action: e.action, at: e.at, ip: e.ip, reason: str((e.meta as Record<string, unknown>)?.reason), byAdmin: e.actorId !== userId })),
    };
  }

  async endSession(a: Actor, userId: string, sessionId: string, reason?: string) {
    const n = await this.policy.end({ ids: [sessionId], userId }, 'admin', { actorId: a.user.id, ip: a.ip, extra: { note: reason ?? null } });
    if (!n) throw notFound('Session');
    return { ended: n };
  }

  async endAll(a: Actor, userId: string, reason?: string) {
    if (userId === a.user.id) throw new AppError(400, 'own_account', 'Use Account › Security to sign out your own other devices.');
    const n = await this.policy.end({ userId }, 'admin', { actorId: a.user.id, ip: a.ip, extra: { note: reason ?? null } });
    return { ended: n };
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : null);

/** "session.inactivityMinutes: 30 → 45" lines for the audit entry. */
export function diff(a: AuthSettings, b: AuthSettings): string[] {
  const out: string[] = [];
  for (const group of ['emailOtp', 'session', 'alerts'] as const) {
    const x = a[group] as Record<string, unknown>;
    const y = b[group] as Record<string, unknown>;
    for (const k of Object.keys(y)) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push(`${group}.${k}: ${JSON.stringify(x[k])} → ${JSON.stringify(y[k])}`);
  }
  return out;
}
