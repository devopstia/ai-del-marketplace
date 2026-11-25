import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { AuditService } from '../common/audit.service';
import type { AppRequest } from '../common/auth-context';
import { AppError, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { seal, unseal } from '../common/seal';
import { randomToken } from '../common/util';
import { env, isProd } from '../config/env';
import { clientId, enabledProviders, type OAuthProfile, pkcePair, PROVIDERS, type ProviderKey } from './oauth.providers';
import { type Ctx, SignInService } from './signin.service';

export const OAUTH_COOKIE = 'del_oauth';
const STATE_TTL_MS = 10 * 60_000;
interface State { p: ProviderKey; state: string; verifier: string; mode: 'login' | 'link'; next: string; uid?: string; exp: number }

const safeNext = (n: unknown) => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && n.length < 300 ? n : '/my-learning');

/**
 * Sign in with Google, GitHub, Facebook or LinkedIn (owner 2026-11-25). Authorization code flow with a one-time `state`
 * and PKCE (where the provider supports it) held in a sealed, short-lived httpOnly cookie. Accounts are matched only by the
 * provider's own account id: an email that already belongs to a DEL account is never merged automatically; the owner of
 * that account signs in first and links the provider from Account › Security (docs/AUTH.md).
 */
@Injectable()
export class OAuthService {
  private readonly log = new Logger('OAuth');
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signIn: SignInService,
    private readonly jobs: JobsService,
  ) {}

  /** Same optional staff notice as email sign-ups (Super Admin › Settings › Notifications). */
  private async notifyRegistration(name: string, method: string) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key: 'notify_new_registrations' } });
    if (!(setting?.value === true || setting?.value === 'true')) return;
    const staff = await this.prisma.user.findMany({ where: { roles: { has: 'super_admin' }, status: 'active' }, select: { email: true, name: true } });
    for (const s of staff) await this.jobs.sendEmail({ to: s.email, template: 'staff-new-registration', data: { staffName: s.name, name, method, link: `${env().WEB_URL}/admin/users` } });
  }

  providers() {
    return enabledProviders().map((k) => ({ key: k, label: PROVIDERS[k].label }));
  }

  private redirectUri(p: ProviderKey) { return `${env().API_URL}/api/auth/oauth/${p}/callback`; }
  private web(path: string) { return `${env().WEB_URL}${path}`; }
  private provider(raw: string): ProviderKey {
    const p = raw as ProviderKey;
    if (!enabledProviders().includes(p)) throw notFound('Sign-in provider');
    return p;
  }

  /** Step 1: send the browser to the provider. `link` adds the provider to the signed-in account. */
  start(raw: string, mode: string, next: unknown, req: AppRequest, res: Response): string {
    const p = this.provider(raw);
    const m = mode === 'link' ? 'link' : 'login';
    if (m === 'link' && !req.user) return this.web(`/login?next=${encodeURIComponent('/account#security')}`);
    const { verifier, challenge } = pkcePair();
    const st: State = { p, state: randomToken(24), verifier, mode: m, next: safeNext(next), uid: m === 'link' ? req.user!.id : undefined, exp: Date.now() + STATE_TTL_MS };
    res.cookie(OAUTH_COOKIE, seal('oauth-state', JSON.stringify(st)), { httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/api/auth/oauth', maxAge: STATE_TTL_MS });
    const def = PROVIDERS[p];
    const q = new URLSearchParams({ client_id: clientId(p), redirect_uri: this.redirectUri(p), response_type: 'code', state: st.state });
    if (def.scope) q.set('scope', def.scope);
    if (def.pkce) { q.set('code_challenge', challenge); q.set('code_challenge_method', 'S256'); }
    if (p === 'google') q.set('prompt', 'select_account');
    const base = p === 'test' ? `${env().API_URL}${def.authorizeUrl}` : def.authorizeUrl;
    return `${base}?${q}`;
  }

  /** Step 2: the provider sends the browser back. Returns where to go next on the web app. */
  async callback(raw: string, query: Record<string, unknown>, req: AppRequest, res: Response, ctx: Ctx): Promise<string> {
    const p = raw as ProviderKey;
    const cookie = req.cookies?.[OAUTH_COOKIE];
    res.clearCookie(OAUTH_COOKIE, { path: '/api/auth/oauth' });
    let st: State;
    try { st = JSON.parse(unseal('oauth-state', String(cookie)).toString('utf8')) as State; } catch { return this.web('/login?error=oauth_expired'); }
    const fail = (code: string) => this.web(`${st.mode === 'link' ? '/account' : '/login'}?error=${code}&provider=${p}${st.mode === 'link' ? '#security' : ''}`);
    if (st.p !== p || st.exp < Date.now() || typeof query.state !== 'string' || query.state !== st.state) return this.web('/login?error=oauth_expired');
    if (query.error || typeof query.code !== 'string') return fail('oauth_cancelled');
    let profile: OAuthProfile;
    try {
      profile = p === 'test' ? this.testProfile(query.code) : await PROVIDERS[p].exchange(query.code, this.redirectUri(p), st.verifier, fetch);
    } catch (e) {
      this.log.warn(`${p} sign-in failed: ${(e as Error).message}`);
      return fail('oauth_failed');
    }

    const identity = await this.prisma.authIdentity.findUnique({ where: { provider_subject: { provider: p, subject: profile.subject } }, include: { user: true } });

    if (st.mode === 'link') {
      if (!req.user || req.user.id !== st.uid) return this.web('/login?error=oauth_expired');
      if (identity && identity.userId !== req.user.id) return fail('identity_in_use');
      if (!identity) {
        await this.prisma.authIdentity.create({ data: { userId: req.user.id, provider: p, subject: profile.subject, email: profile.email, name: profile.name } });
        await this.audit.log({ actorId: req.user.id, action: 'auth.identity_linked', targetType: 'user', targetId: req.user.id, ip: ctx.ip, meta: { provider: p } });
        await this.jobs.sendEmail({ to: req.user.email, template: 'security-identity-linked', data: { provider: PROVIDERS[p].label } });
      }
      return this.web(`/account?linked=${p}#security`);
    }

    let user = identity?.user ?? null;
    if (identity) {
      await this.prisma.authIdentity.update({ where: { id: identity.id }, data: { lastUsedAt: new Date(), email: profile.email ?? identity.email, name: profile.name ?? identity.name } });
    } else {
      if (!profile.email) return fail('oauth_no_email');
      if (!profile.emailVerified) return fail('oauth_email_unverified');
      const taken = await this.prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } });
      // Never merge by email: whoever controls this provider account must prove they own the DEL account first.
      if (taken) return fail('email_exists');
      user = await this.prisma.user.create({
        data: {
          email: profile.email, name: (profile.name ?? profile.email.split('@')[0]).slice(0, 100), passwordHash: null, roles: ['student'], signupMethod: p, emailVerifiedAt: new Date(),
          avatarUrl: profile.avatarUrl?.startsWith('https://') ? profile.avatarUrl.slice(0, 500) : null,
          identities: { create: { provider: p, subject: profile.subject, email: profile.email, name: profile.name, lastUsedAt: new Date() } },
        },
      });
      await this.audit.log({ actorId: user.id, action: 'auth.register', targetType: 'user', targetId: user.id, ip: ctx.ip, meta: { method: p } });
      await this.notifyRegistration(user.name, p);
      await this.jobs.sendEmail({ to: user.email, template: 'welcome', data: { name: user.name } });
    }
    try {
      const r = await this.signIn.begin(user!, p, req, res, ctx, { next: st.next });
      return r.done ? this.web(st.next) : this.web(`/login/verify?next=${encodeURIComponent(st.next)}`);
    } catch (e) {
      return fail(e instanceof AppError ? e.code : 'oauth_failed');
    }
  }

  // ---- Development test provider (OAUTH_TEST_PROVIDER, never in production) ----

  private testProfile(code: string): OAuthProfile {
    const x = JSON.parse(unseal('oauth-test', code).toString('utf8')) as { sub: string; email: string; name: string; exp: number };
    if (x.exp < Date.now()) throw new Error('test code expired');
    return { subject: x.sub, email: x.email.toLowerCase(), emailVerified: true, name: x.name, avatarUrl: null };
  }

  testApprove(query: Record<string, unknown>): string {
    if (!enabledProviders().includes('test')) throw notFound('Sign-in provider');
    const email = String(query.email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new AppError(400, 'bad_email', 'Enter an email address');
    const sub = String(query.sub ?? '').trim() || `test-${email}`;
    const code = seal('oauth-test', JSON.stringify({ sub: sub.slice(0, 100), email, name: String(query.name ?? '').trim().slice(0, 100) || email.split('@')[0], exp: Date.now() + 60_000 }));
    const q = new URLSearchParams({ code, state: String(query.state ?? '') });
    return `${this.redirectUri('test')}?${q}`;
  }

  testPage(query: Record<string, unknown>): string {
    if (!enabledProviders().includes('test')) throw notFound('Sign-in provider');
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test provider</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0f22;color:#e8eaf7;font:16px system-ui,sans-serif}
form{width:min(380px,calc(100% - 32px));background:#141834;border:1px solid #262c52;border-radius:16px;padding:24px}
h1{font-size:20px;margin:0 0 4px}p{color:#c9cce3;font-size:14px;margin:0 0 18px}label{display:block;font-size:14px;font-weight:700;margin:12px 0 4px}
input{box-sizing:border-box;width:100%;padding:10px 12px;border-radius:10px;border:1px solid #363d6b;background:#0c0f22;color:#e8eaf7;font-size:16px}
.row{display:flex;gap:8px;margin-top:20px}button,a{flex:1;text-align:center;padding:11px;border-radius:10px;font-weight:700;font-size:15px;border:1px solid #363d6b;color:#e8eaf7;background:transparent;text-decoration:none}
button{background:#9d8fff;color:#12103a;border-color:#9d8fff}</style></head><body>
<form method="get" action="/api/auth/oauth/test/approve"><h1>Test provider</h1><p>Development only. Pretend to be a Google, GitHub, Facebook or LinkedIn account.</p>
<input type="hidden" name="state" value="${esc(query.state)}">
<label for="email">Email</label><input id="email" name="email" type="email" required autofocus>
<label for="name">Name</label><input id="name" name="name">
<label for="sub">Account id (optional)</label><input id="sub" name="sub" placeholder="the same id signs in to the same account">
<div class="row"><a href="${esc(this.redirectUri('test'))}?error=access_denied&amp;state=${esc(query.state)}">Cancel</a><button type="submit" data-testid="test-provider-continue">Continue</button></div></form></body></html>`;
  }

  // ---- Linked accounts (Account › Security) ----

  async identities(userId: string) {
    return this.prisma.authIdentity.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true, provider: true, email: true, name: true, createdAt: true, lastUsedAt: true } });
  }

  async unlink(userId: string, id: string, code: string | undefined, ip: string | null) {
    const idn = await this.prisma.authIdentity.findFirst({ where: { id, userId } });
    if (!idn) throw notFound('Linked account');
    const [user, count] = await Promise.all([this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, email: true } }), this.prisma.authIdentity.count({ where: { userId } })]);
    if (!user.passwordHash && count <= 1) throw new AppError(409, 'last_sign_in_method', 'Set a password or link another account first, so you can still sign in.');
    await this.signIn.checkCode(userId, code, ip);
    await this.prisma.authIdentity.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'auth.identity_unlinked', targetType: 'user', targetId: userId, ip, meta: { provider: idn.provider } });
    await this.jobs.sendEmail({ to: user.email, template: 'security-identity-unlinked', data: { provider: PROVIDERS[idn.provider as ProviderKey]?.label ?? idn.provider } });
  }
}
