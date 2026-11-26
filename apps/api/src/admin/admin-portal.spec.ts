import { ALL_ADMIN_PERMISSIONS, canWithConfig, DEFAULT_ROLE_CONFIG, hasCapability, parseRoleConfig } from '../common/permissions';
import { activeAccessWhere, daysUntilDeletion, deletionDate, DELETION_RETENTION_DAYS, lifecycle } from './course-lifecycle';
import { temporaryPassword } from './user-admin.service';

describe('Role Management config', () => {
  it('missing or broken settings fall back to the defaults', () => {
    expect(parseRoleConfig(undefined)).toEqual(DEFAULT_ROLE_CONFIG);
    expect(parseRoleConfig('nonsense')).toEqual(DEFAULT_ROLE_CONFIG);
  });

  it('drops unknown permissions and capabilities, and defaults outside the allowed set', () => {
    const cfg = parseRoleConfig({ adminAllowed: ['users.view', 'made.up'], adminDefaults: ['users.view', 'orders.view'], disabled: ['student.ai.ask', 'student.fly'] });
    expect(cfg).toEqual({ adminAllowed: ['users.view'], adminDefaults: ['users.view'], disabled: ['student.ai.ask'] });
  });

  it('an admin needs the permission granted AND allowed for the role; super admins always pass', () => {
    const admin = { roles: ['student', 'admin'] as never[], adminPermissions: ['orders.view'] };
    const cfg = { ...DEFAULT_ROLE_CONFIG, adminAllowed: ALL_ADMIN_PERMISSIONS.filter((p) => p !== 'orders.view') };
    expect(canWithConfig(admin, 'orders.view', DEFAULT_ROLE_CONFIG)).toBe(true);
    expect(canWithConfig(admin, 'orders.view', cfg)).toBe(false);
    expect(canWithConfig({ roles: ['super_admin'] as never[] }, 'orders.view', cfg)).toBe(true);
  });

  it('capabilities limit everyone except super admins', () => {
    const cfg = { ...DEFAULT_ROLE_CONFIG, disabled: ['instructor.sales.manage' as const] };
    expect(hasCapability({ roles: ['student', 'instructor'] as never[] }, 'instructor.sales.manage', cfg)).toBe(false);
    expect(hasCapability({ roles: ['student', 'instructor'] as never[] }, 'instructor.courses.create', cfg)).toBe(true);
    expect(hasCapability({ roles: ['super_admin'] as never[] }, 'instructor.sales.manage', cfg)).toBe(true);
  });
});

describe('course archive and soft deletion', () => {
  const none = { archivedAt: null, deleteRequestedAt: null, deleteAfter: null, purgedAt: null };
  const now = new Date('2026-11-26T12:00:00Z');

  it('lifecycle reads the strongest state', () => {
    expect(lifecycle(none)).toBe('active');
    expect(lifecycle({ ...none, archivedAt: now })).toBe('archived');
    expect(lifecycle({ ...none, archivedAt: now, deleteRequestedAt: now, deleteAfter: now })).toBe('deleting');
    expect(lifecycle({ ...none, archivedAt: now, deleteRequestedAt: now, purgedAt: now })).toBe('purged');
  });

  it('keeps a deleted course for at least 30 days and counts the days left', () => {
    expect(DELETION_RETENTION_DAYS).toBeGreaterThanOrEqual(30);
    const after = deletionDate(now);
    expect(after.getTime() - now.getTime()).toBe(30 * 86_400_000);
    expect(daysUntilDeletion({ deleteAfter: after }, now)).toBe(30);
    expect(daysUntilDeletion({ deleteAfter: after }, new Date(after.getTime() - 3600_000))).toBe(1);
    expect(daysUntilDeletion({ deleteAfter: after }, new Date(after.getTime() + 1))).toBe(0);
    expect(daysUntilDeletion({ deleteAfter: null })).toBeNull();
  });

  it('waits only for paid access that is still running', () => {
    expect(activeAccessWhere('c1', now)).toEqual({ courseId: 'c1', revokedAt: null, accessExpiresAt: { gt: now } });
  });
});

describe('temporary password', () => {
  it('has letters and numbers, 16 characters plus separators, and is different each time', () => {
    const a = temporaryPassword();
    const b = temporaryPassword();
    expect(a).not.toBe(b);
    const plain = a.replace(/-/g, '');
    expect(plain).toHaveLength(16);
    expect(plain).toMatch(/[a-z]/i);
    expect(plain).toMatch(/\d/);
    expect(plain).not.toMatch(/[01ilIoO]/);
  });
});
