import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, ROLES, SKIP_CSRF } from './auth-context';
import { AuthGuard, hashSessionToken } from './auth.guard';
import { CsrfGuard, csrfTokensMatch } from './csrf';
import { AppError } from './errors';

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
  const prismaWith = (session: unknown) => ({ session: { findUnique: jest.fn().mockResolvedValue(session) } }) as any;

  it('401 on a protected route without a cookie', async () => {
    const { context, reflector } = ctx({ cookies: {} });
    await expectAppError(new AuthGuard(reflector, prismaWith(null)).canActivate(context), 401);
  });

  it('public routes work signed out', async () => {
    const { context, reflector } = ctx({ cookies: {} }, { [IS_PUBLIC]: true });
    await expect(new AuthGuard(reflector, prismaWith(null)).canActivate(context)).resolves.toBe(true);
  });

  it('looks the session up by the sha256 of the cookie and attaches the user', async () => {
    const prisma = prismaWith({ id: hashSessionToken(token), revokedAt: null, expiresAt: future, user });
    const req: any = { cookies: { sid: token } };
    const { context, reflector } = ctx(req);
    await expect(new AuthGuard(reflector, prisma).canActivate(context)).resolves.toBe(true);
    expect(prisma.session.findUnique.mock.calls[0][0].where.id).toBe(hashSessionToken(token));
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.c', name: 'A', roles: ['student'] });
  });

  it.each([
    ['revoked', { revokedAt: new Date(), expiresAt: future, user }],
    ['expired', { revokedAt: null, expiresAt: new Date(Date.now() - 1000), user }],
    ['suspended user', { revokedAt: null, expiresAt: future, user: { ...user, status: 'suspended' } }],
  ])('rejects a %s session', async (_label, session) => {
    const { context, reflector } = ctx({ cookies: { sid: token } });
    await expectAppError(new AuthGuard(reflector, prismaWith(session)).canActivate(context), 401);
  });

  it('403 when the role is missing', async () => {
    const { context, reflector } = ctx({ cookies: { sid: token } }, { [ROLES]: ['admin'] });
    await expectAppError(new AuthGuard(reflector, prismaWith({ revokedAt: null, expiresAt: future, user })).canActivate(context), 403);
  });

  it('super_admin satisfies admin', async () => {
    const su = { ...user, roles: ['student', 'super_admin'] };
    const { context, reflector } = ctx({ cookies: { sid: token } }, { [ROLES]: ['admin'] });
    await expect(new AuthGuard(reflector, prismaWith({ revokedAt: null, expiresAt: future, user: su })).canActivate(context)).resolves.toBe(true);
  });
});
