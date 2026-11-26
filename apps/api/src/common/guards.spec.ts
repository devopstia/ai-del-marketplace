import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITY, IS_PUBLIC, PERMISSION, ROLES, SKIP_CSRF } from './auth-context';
import { AuthGuard, hashSessionToken } from './auth.guard';
import { CsrfGuard, csrfTokensMatch } from './csrf';
import { AppError } from './errors';
import { DEFAULT_AUTH_SETTINGS } from '../auth/security-settings';
import { REPLACED_MESSAGE } from './session-policy.service';

function ctx(req: any, meta: Record<string, unknown> = {}): { context: ExecutionContext; reflector: Reflector } {
  const handler = () => undefined;
  const reflector = { getAllAndOverride: (key: string) => meta[key] } as unknown as Reflector;
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
    getClass: () => Object,
  } as unknown as ExecutionContext;
  return { context, reflector };
}

const expectAppError = async (p: Promise<unknown> | (() => unknown), status: number, code?: string) => {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    expect((e as AppError).getStatus()).toBe(status);
    if (code) expect((e as AppError).code).toBe(code);
    return;
  }
  throw new Error('expected an error');
};

describe('CSRF double submit', () => {
  const token = 'a'.repeat(32);

  it('csrfTokensMatch compares exactly', () => {
    expect(csrfTokensMatch(token, token)).toBe(true);
    expect(csrfTokensMatch(token, token + 'x')).toBe(false);
    expect(csrfTokensMatch(token, undefined)).toBe(false);
    expect(csrfTokensMatch('short', 'short')).toBe(false);
  });

  it('lets safe methods through', () => {
    const { context, reflector } = ctx({ method: 'GET', cookies: {}, headers: {} });
    expect(new CsrfGuard(reflector).canActivate(context)).toBe(true);
  });

  it('rejects a POST without the header', async () => {
    const { context, reflector } = ctx({ method: 'POST', cookies: { csrf: token }, headers: {} });
    await expectAppError(() => new CsrfGuard(reflector).canActivate(context), 403, 'csrf_invalid');
  });

  it('rejects a POST whose header does not match the cookie', async () => {
    const { context, reflector } = ctx({ method: 'DELETE', cookies: { csrf: token }, headers: { 'x-csrf-token': 'b'.repeat(32) } });
    await expectAppError(() => new CsrfGuard(reflector).canActivate(context), 403, 'csrf_invalid');
  });

  it('rejects a cookie minted on this same request', async () => {
    const { context, reflector } = ctx({ method: 'POST', cookies: { csrf: token, __csrfFresh: '1' }, headers: { 'x-csrf-token': token } });
    await expectAppError(() => new CsrfGuard(reflector).canActivate(context), 403);
  });

  it('accepts a matching header', () => {
    const { context, reflector } = ctx({ method: 'PUT', cookies: { csrf: token }, headers: { 'x-csrf-token': token } });
    expect(new CsrfGuard(reflector).canActivate(context)).toBe(true);
  });

  it('skips webhook routes marked @SkipCsrf', () => {
    const { context, reflector } = ctx({ method: 'POST', cookies: {}, headers: {} }, { [SKIP_CSRF]: true });
    expect(new CsrfGuard(reflector).canActivate(context)).toBe(true);
  });
});

describe('AuthGuard (sessions + roles)', () => {
  const token = 't'.repeat(43);
  const future = new Date(Date.now() + 60_000);
  const user = { id: 'u1', email: 'a@b.c', name: 'A', roles: ['student'], status: 'active' };
  const live = (extra: Record<string, unknown> = {}) => ({ id: 'h', userId: 'u1', kind: 'user', createdAt: new Date(), lastActiveAt: new Date(), revokedAt: null, expiresAt: future, user, ...extra });
  const prismaWith = (session: unknown) => ({ session: { findUnique: jest.fn().mockResolvedValue(session) } }) as any;
  const policy = (settings = DEFAULT_AUTH_SETTINGS) => ({ settings: jest.fn().mockResolvedValue(settings), end: jest.fn().mockResolvedValue(1), touch: jest.fn() }) as any;
  const guard = (reflector: any, prisma: any, p = policy()) => new AuthGuard(reflector, prisma, p);

  it('401 on a protected route without a cookie', async () => {
    const { context, reflector } = ctx({ cookies: {} });
    await expectAppError(guard(reflector, prismaWith(null)).canActivate(context), 401);
  });

  it('public routes work signed out', async () => {
    const { context, reflector } = ctx({ cookies: {} }, { [IS_PUBLIC]: true });
    await expect(guard(reflector, prismaWith(null)).canActivate(context)).resolves.toBe(true);
  });

  it('looks the session up by the sha256 of the cookie and attaches the user', async () => {
    const prisma = prismaWith(live({ id: hashSessionToken(token) }));
    const req: any = { cookies: { sid: token } };
    const { context, reflector } = ctx(req);
    await expect(guard(reflector, prisma).canActivate(context)).resolves.toBe(true);
    expect(prisma.session.findUnique.mock.calls[0][0].where.id).toBe(hashSessionToken(token));
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.c', name: 'A', roles: ['student'] });
  });

  it.each([
    ['revoked', live({ revokedAt: new Date() })],
    ['expired', live({ expiresAt: new Date(Date.now() - 1000) })],
    ['suspended user', live({ user: { ...user, status: 'suspended' } })],
  ])('rejects a %s session', async (_label, session) => {
    const { context, reflector } = ctx({ cookies: { sid: token } });
    await expectAppError(guard(reflector, prismaWith(session)).canActivate(context), 401);
  });

  it('403 when the role is missing', async () => {
    const { context, reflector } = ctx({ cookies: { sid: token } }, { [ROLES]: ['admin'] });
    await expectAppError(guard(reflector, prismaWith(live())).canActivate(context), 403);
  });

  it('super_admin satisfies admin', async () => {
    const su = { ...user, roles: ['student', 'super_admin'] };
    const { context, reflector } = ctx({ cookies: { sid: token } }, { [ROLES]: ['admin'] });
    await expect(guard(reflector, prismaWith(live({ user: su }))).canActivate(context)).resolves.toBe(true);
  });

  // Session security (docs/AUTH.md §7)
  it('ends an idle session and says why (401 session_idle)', async () => {
    const p = policy();
    const req: any = { cookies: { sid: token } };
    const { context, reflector } = ctx(req);
    const idle = live({ lastActiveAt: new Date(Date.now() - 31 * 60_000) });
    await expectAppError(guard(reflector, prismaWith(idle), p).canActivate(context), 401, 'session_idle');
    expect(p.end).toHaveBeenCalledWith({ ids: ['h'], userId: 'u1' }, 'idle', expect.anything());
    expect(req.user).toBeUndefined();
  });

  it('ends a session older than the maximum lifetime', async () => {
    const p = policy();
    const { context, reflector } = ctx({ cookies: { sid: token } });
    await expectAppError(guard(reflector, prismaWith(live({ createdAt: new Date(Date.now() - 25 * 3600_000) })), p).canActivate(context), 401, 'session_lifetime');
    expect(p.end.mock.calls[0][1]).toBe('lifetime');
  });

  it('tells a browser whose session was replaced by a newer sign-in (exact message)', async () => {
    const { context, reflector } = ctx({ cookies: { sid: token } });
    const err = await guard(reflector, prismaWith(live({ revokedAt: new Date(), endedReason: 'replaced' }))).canActivate(context).catch((e) => e);
    expect(err.code).toBe('session_replaced');
    expect(err.message).toBe(REPLACED_MESSAGE);
  });

  it('support sessions are not subject to the ordinary idle/lifetime rule', async () => {
    const p = policy();
    const { context, reflector } = ctx({ cookies: { sid: token } });
    await expect(guard(reflector, prismaWith(live({ kind: 'support', createdAt: new Date(Date.now() - 48 * 3600_000), lastActiveAt: new Date(0) })), p).canActivate(context)).resolves.toBe(true);
    expect(p.end).not.toHaveBeenCalled();
  });

  it('video progress counts as activity', async () => {
    const p = policy();
    const { context, reflector } = ctx({ cookies: { sid: token }, method: 'PUT', path: '/api/lectures/abc/progress' });
    await guard(reflector, prismaWith(live()), p).canActivate(context);
    expect(p.touch).toHaveBeenCalledWith('h');
  });
});

describe('AuthGuard: role management and temporary passwords (owner 2026-11-26)', () => {
  const token = 't'.repeat(43);
  const future = new Date(Date.now() + 60_000);
  const prismaWith = (user: unknown) => ({ session: { findUnique: jest.fn().mockResolvedValue({ revokedAt: null, expiresAt: future, user }) } }) as any;
  const roleConfig = (cfg: Partial<{ adminAllowed: string[]; adminDefaults: string[]; disabled: string[] }>) => ({ get: async () => ({ adminAllowed: ['users.view', 'audit.view'], adminDefaults: [], disabled: [], ...cfg }) }) as any;
  const noPolicy = { touch: jest.fn(), settings: jest.fn(), end: jest.fn() } as any;
  const student = { id: 's1', email: 's@x.y', name: 'S', roles: ['student'], status: 'active', adminPermissions: [], mustChangePassword: false };

  it('a capability turned off is refused for students and allowed again when on', async () => {
    const { context, reflector } = ctx({ cookies: { sid: token }, path: '/api/courses/x/reviews' }, { [CAPABILITY]: 'student.reviews.write' });
    await expectAppError(new AuthGuard(reflector, prismaWith(student), noPolicy, roleConfig({ disabled: ['student.reviews.write'] })).canActivate(context), 403, 'capability_disabled');
    await expect(new AuthGuard(reflector, prismaWith(student), noPolicy, roleConfig({})).canActivate(context)).resolves.toBe(true);
  });

  it('super admins are never limited by capabilities', async () => {
    const su = { ...student, roles: ['student', 'super_admin'] };
    const { context, reflector } = ctx({ cookies: { sid: token }, path: '/api/x' }, { [CAPABILITY]: 'student.reviews.write' });
    await expect(new AuthGuard(reflector, prismaWith(su), noPolicy, roleConfig({ disabled: ['student.reviews.write'] })).canActivate(context)).resolves.toBe(true);
  });

  it('an admin permission withheld from the Admin role is refused even when granted to the person', async () => {
    const admin = { ...student, roles: ['student', 'admin'], adminPermissions: ['users.view', 'orders.view'] };
    const ok = ctx({ cookies: { sid: token }, path: '/api/admin/x' }, { [ROLES]: ['admin'], [PERMISSION]: 'users.view' });
    await expect(new AuthGuard(ok.reflector, prismaWith(admin), noPolicy, roleConfig({})).canActivate(ok.context)).resolves.toBe(true);
    const no = ctx({ cookies: { sid: token }, path: '/api/admin/x' }, { [ROLES]: ['admin'], [PERMISSION]: 'orders.view' });
    await expectAppError(new AuthGuard(no.reflector, prismaWith(admin), noPolicy, roleConfig({})).canActivate(no.context), 403, 'permission_required');
  });

  it('a temporary password allows only the password change until a new one is chosen', async () => {
    const temp = { ...student, mustChangePassword: true };
    const blocked = ctx({ cookies: { sid: token }, path: '/api/me/courses' });
    await expectAppError(new AuthGuard(blocked.reflector, prismaWith(temp), roleConfig({})).canActivate(blocked.context), 403, 'password_change_required');
    for (const path of ['/api/auth/password', '/api/auth/me', '/api/auth/logout']) {
      const ok = ctx({ cookies: { sid: token }, path });
      await expect(new AuthGuard(ok.reflector, prismaWith(temp), roleConfig({})).canActivate(ok.context)).resolves.toBe(true);
    }
  });
});
