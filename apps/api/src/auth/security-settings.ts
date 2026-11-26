import { z } from 'zod';
import type { Role } from '../generated/prisma/enums';

/**
 * Super Admin › Authentication & security (owner 2026-11-26, prompts.md; docs/AUTH.md §7). Stored in
 * platform_settings under AUTH_SETTINGS_KEY, cached by SecuritySettingsService and enforced by the API without a redeploy.
 * Admin and Super Admin always need Google Authenticator: email codes are never enough for them, whatever is saved.
 */
export const AUTH_SETTINGS_KEY = 'auth_security';

/** Roles that may use an email code as their second step (if the Super Admin allows it). */
export const EMAIL_OTP_ROLES = ['student', 'instructor'] as const;
export type EmailOtpRole = (typeof EMAIL_OTP_ROLES)[number];
/** Never allowed to sign in with an email code alone. */
export const PRIVILEGED_ROLES: Role[] = ['admin', 'super_admin'];

export const authSettingsSchema = z.object({
  emailOtp: z.object({
    enabled: z.boolean(),
    /** Which roles may choose "send a code to my email" (privileged roles can't be listed). */
    roles: z.array(z.enum(EMAIL_OTP_ROLES)).max(2),
    length: z.number().int().min(6).max(8),
    ttlMinutes: z.number().int().min(1).max(15),
    maxAttempts: z.number().int().min(3).max(10),
    resendSeconds: z.number().int().min(30).max(300),
  }).strict(),
  session: z.object({
    /** Sign out after this many minutes without activity (watching a video counts as activity). */
    inactivityMinutes: z.number().int().min(5).max(480),
    /** Warn this many minutes before (with a countdown and "Stay signed in"). */
    warningMinutes: z.number().int().min(1).max(10),
    /** Sign in again after this many hours, active or not. */
    lifetimeHours: z.number().int().min(1).max(720),
    /** One signed-in browser per account: a new sign-in (after its code) ends the older one. */
    singleSession: z.boolean(),
    /** When single-session is off: how many browsers may be signed in at once. */
    maxConcurrent: z.number().int().min(1).max(10),
    /** At the limit: end the oldest session (true) or refuse the new sign-in (false). */
    terminatePrevious: z.boolean(),
  }).strict(),
  alerts: z.object({
    /** Email the account owner when it signs in from a browser it has never used. */
    newDevice: z.boolean(),
    /** Email the account owner when it is locked after repeated wrong passwords or codes. */
    suspicious: z.boolean(),
  }).strict(),
}).strict().superRefine((v, ctx) => {
  if (v.session.warningMinutes >= v.session.inactivityMinutes) ctx.addIssue({ code: 'custom', path: ['session', 'warningMinutes'], message: 'The warning must come before the timeout' });
  if (v.session.inactivityMinutes > v.session.lifetimeHours * 60) ctx.addIssue({ code: 'custom', path: ['session', 'inactivityMinutes'], message: 'The inactivity timeout can’t be longer than the session lifetime' });
});
export type AuthSettings = z.infer<typeof authSettingsSchema>;

/** The owner's recommended defaults (prompts.md tables). */
export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  emailOtp: { enabled: true, roles: ['student', 'instructor'], length: 6, ttlMinutes: 5, maxAttempts: 5, resendSeconds: 60 },
  session: { inactivityMinutes: 30, warningMinutes: 2, lifetimeHours: 24, singleSession: true, maxConcurrent: 1, terminatePrevious: true },
  alerts: { newDevice: true, suspicious: true },
};

/**
 * Test stacks (AUTH_SESSION_LIMITS=off, never production): the same defaults without the single-session rule and with a
 * long idle timeout, so parallel browser tests can sign one demo account in several times. Saved settings still win.
 */
export const RELAXED_TEST_SETTINGS: AuthSettings = {
  ...DEFAULT_AUTH_SETTINGS,
  session: { inactivityMinutes: 480, warningMinutes: 2, lifetimeHours: 720, singleSession: false, maxConcurrent: 10, terminatePrevious: true },
};

/** Saved JSON → settings, falling back field by field to the defaults (an older saved shape never breaks sign-in). */
export function normalizeSettings(raw: unknown, base: AuthSettings = DEFAULT_AUTH_SETTINGS): AuthSettings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, Record<string, unknown>>;
  const merged = {
    emailOtp: { ...base.emailOtp, ...(o.emailOtp ?? {}) },
    session: { ...base.session, ...(o.session ?? {}) },
    alerts: { ...base.alerts, ...(o.alerts ?? {}) },
  };
  const r = authSettingsSchema.safeParse(merged);
  return r.success ? r.data : base;
}

/** The second steps this person may use. Privileged roles: authenticator only (the safeguard can't be configured away). */
export function allowedMethods(roles: readonly Role[], s: AuthSettings): { authenticator: true; email: boolean } {
  const privileged = roles.some((r) => PRIVILEGED_ROLES.includes(r));
  const email = !privileged && s.emailOtp.enabled && roles.every((r) => (s.emailOtp.roles as string[]).includes(r));
  return { authenticator: true, email };
}

/** How many other ordinary sessions may stay when a new one starts. */
export const concurrentLimit = (s: AuthSettings) => (s.session.singleSession ? 1 : s.session.maxConcurrent);

/** user@example.com → us•••@example.com */
export function maskEmail(email: string) {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(1, local.length - 2)))}@${domain}`;
}

/** "Chrome on Windows", "Safari on iPhone"… from a user agent; no third-party lookup. */
export function describeDevice(ua: string | null | undefined): { browser: string; os: string; type: 'phone' | 'tablet' | 'computer' | 'unknown'; label: string } {
  const u = ua ?? '';
  if (!u) return { browser: 'Unknown browser', os: 'unknown system', type: 'unknown', label: 'Unknown device' };
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\/|Opera/.test(u) ? 'Opera' : /SamsungBrowser/.test(u) ? 'Samsung Internet' : /Firefox\/|FxiOS/.test(u) ? 'Firefox' : /Chrome\/|CriOS/.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : /curl|node|undici|python|Go-http/i.test(u) ? 'Script' : 'Unknown browser';
  const os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X|Macintosh/.test(u) ? 'macOS' : /CrOS/.test(u) ? 'ChromeOS' : /Linux/.test(u) ? 'Linux' : 'unknown system';
  const type = /iPad|Tablet/.test(u) || (/Android/.test(u) && !/Mobile/.test(u)) ? 'tablet' : /iPhone|Mobile|Android/.test(u) ? 'phone' : browser === 'Unknown browser' || browser === 'Script' ? 'unknown' : 'computer';
  return { browser, os, type, label: `${browser} on ${os}` };
}
