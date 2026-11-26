import { allowedMethods, authSettingsSchema, concurrentLimit, DEFAULT_AUTH_SETTINGS, describeDevice, maskEmail, normalizeSettings, RELAXED_TEST_SETTINGS } from './security-settings';
import { diff } from './session-admin.service';
import { newEmailCode, otpHash } from './signin.service';

describe('authentication & security settings (docs/AUTH.md §7)', () => {
  it('defaults are the owner’s recommended values', () => {
    expect(DEFAULT_AUTH_SETTINGS.emailOtp).toMatchObject({ enabled: true, length: 6, ttlMinutes: 5, maxAttempts: 5, resendSeconds: 60 });
    expect(DEFAULT_AUTH_SETTINGS.session).toMatchObject({ inactivityMinutes: 30, warningMinutes: 2, lifetimeHours: 24, singleSession: true, maxConcurrent: 1, terminatePrevious: true });
    expect(DEFAULT_AUTH_SETTINGS.alerts).toEqual({ newDevice: true, suspicious: true });
    expect(authSettingsSchema.safeParse(DEFAULT_AUTH_SETTINGS).success).toBe(true);
    expect(authSettingsSchema.safeParse(RELAXED_TEST_SETTINGS).success).toBe(true);
  });

  it('email codes are never allowed for Admin or Super Admin, whatever is saved', () => {
    expect(allowedMethods(['student'], DEFAULT_AUTH_SETTINGS).email).toBe(true);
    expect(allowedMethods(['student', 'instructor'], DEFAULT_AUTH_SETTINGS).email).toBe(true);
    expect(allowedMethods(['student', 'admin'], DEFAULT_AUTH_SETTINGS).email).toBe(false);
    expect(allowedMethods(['student', 'super_admin'], DEFAULT_AUTH_SETTINGS).email).toBe(false);
    // The schema refuses privileged roles in the email list.
    const bad = { ...DEFAULT_AUTH_SETTINGS, emailOtp: { ...DEFAULT_AUTH_SETTINGS.emailOtp, roles: ['student', 'admin'] } };
    expect(authSettingsSchema.safeParse(bad).success).toBe(false);
  });

  it('per-role choice and the global switch', () => {
    const studentsOnly = { ...DEFAULT_AUTH_SETTINGS, emailOtp: { ...DEFAULT_AUTH_SETTINGS.emailOtp, roles: ['student' as const] } };
    expect(allowedMethods(['student'], studentsOnly).email).toBe(true);
    expect(allowedMethods(['student', 'instructor'], studentsOnly).email).toBe(false);
    const off = { ...DEFAULT_AUTH_SETTINGS, emailOtp: { ...DEFAULT_AUTH_SETTINGS.emailOtp, enabled: false } };
    expect(allowedMethods(['student'], off).email).toBe(false);
  });

  it('rejects inconsistent session timings', () => {
    const s = (session: Partial<typeof DEFAULT_AUTH_SETTINGS.session>) => authSettingsSchema.safeParse({ ...DEFAULT_AUTH_SETTINGS, session: { ...DEFAULT_AUTH_SETTINGS.session, ...session } }).success;
    expect(s({ warningMinutes: 30 })).toBe(false);
    expect(s({ inactivityMinutes: 120, lifetimeHours: 1 })).toBe(false);
    expect(s({ inactivityMinutes: 2 })).toBe(false);
    expect(s({ inactivityMinutes: 60, warningMinutes: 5, lifetimeHours: 12 })).toBe(true);
  });

  it('a stored older or broken shape falls back to defaults field by field', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_AUTH_SETTINGS);
    expect(normalizeSettings({ session: { inactivityMinutes: 45 } }).session.inactivityMinutes).toBe(45);
    expect(normalizeSettings({ session: { inactivityMinutes: 'x' } })).toEqual(DEFAULT_AUTH_SETTINGS);
  });

  it('single-session means one; otherwise the configured maximum', () => {
    expect(concurrentLimit(DEFAULT_AUTH_SETTINGS)).toBe(1);
    expect(concurrentLimit({ ...DEFAULT_AUTH_SETTINGS, session: { ...DEFAULT_AUTH_SETTINGS.session, singleSession: false, maxConcurrent: 3 } })).toBe(3);
  });

  it('describes devices without any lookup', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36').label).toBe('Chrome on Windows');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toMatchObject({ label: 'Safari on iPhone', type: 'phone' });
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36').type).toBe('tablet');
    expect(describeDevice(null).label).toBe('Unknown device');
  });

  it('masks the email on the code screen', () => {
    expect(maskEmail('amina.okafor@example.com')).toBe('am••••@example.com');
    expect(maskEmail('ab@x.io')).toBe('ab•@x.io');
  });

  it('email codes: right length, digits only, HMAC bound to the ticket', () => {
    for (const len of [6, 7, 8]) expect(newEmailCode(len)).toMatch(new RegExp(`^\\d{${len}}$`));
    expect(otpHash('t1', '123456')).toBe(otpHash('t1', '123456'));
    expect(otpHash('t1', '123456')).not.toBe(otpHash('t2', '123456'));
    expect(otpHash('t1', '123456')).not.toContain('123456');
  });

  it('settings changes are listed for the audit entry', () => {
    const next = { ...DEFAULT_AUTH_SETTINGS, session: { ...DEFAULT_AUTH_SETTINGS.session, inactivityMinutes: 45 } };
    expect(diff(DEFAULT_AUTH_SETTINGS, next)).toEqual(['session.inactivityMinutes: 30 → 45']);
  });
});
