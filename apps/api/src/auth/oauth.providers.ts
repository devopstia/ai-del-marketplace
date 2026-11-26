import { createHash, randomBytes } from 'node:crypto';
import { env, isProd } from '../config/env';

/** What every provider gives us after a successful sign-in. */
export interface OAuthProfile { subject: string; email: string | null; emailVerified: boolean; name: string | null; avatarUrl: string | null }

export interface ProviderDef {
  key: ProviderKey;
  label: string;
  authorizeUrl: string;
  scope: string;
  pkce: boolean;
  /** Code → profile. `fetcher` is injectable for tests. */
  exchange(code: string, redirectUri: string, verifier: string, fetcher: typeof fetch): Promise<OAuthProfile>;
}
export const PROVIDER_KEYS = ['google', 'github', 'facebook', 'linkedin', 'test'] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

export type RealProvider = Exclude<ProviderKey, 'test'>;
export const REAL_PROVIDERS: RealProvider[] = ['google', 'github', 'facebook', 'linkedin'];

/** Keys a super admin saved in Super Admin › Sign-in methods (sealed in platform_settings, loaded by OAuthConfigService). */
let saved: Partial<Record<RealProvider, { id: string; secret: string }>> = {};
export function setSavedCredentials(m: typeof saved) { saved = m; }
export function credentialSource(k: RealProvider): 'settings' | 'env' | null {
  if (saved[k]?.id && saved[k]?.secret) return 'settings';
  const e = envCreds(k); return e.id && e.secret ? 'env' : null;
}
const envCreds = (k: RealProvider) => {
  const e = env();
  const map = { google: [e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET], github: [e.GITHUB_CLIENT_ID, e.GITHUB_CLIENT_SECRET], facebook: [e.FACEBOOK_CLIENT_ID, e.FACEBOOK_CLIENT_SECRET], linkedin: [e.LINKEDIN_CLIENT_ID, e.LINKEDIN_CLIENT_SECRET] } as const;
  return { id: map[k][0], secret: map[k][1] };
};
const creds = (k: RealProvider) => (saved[k]?.id && saved[k]?.secret ? saved[k]! : envCreds(k));
export const publicClientId = (k: RealProvider) => creds(k).id;

async function json(r: Response, what: string) {
  if (!r.ok) throw new Error(`${what} failed (${r.status})`);
  return (await r.json()) as Record<string, unknown>;
}
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

async function formToken(url: string, body: Record<string, string>, fetcher: typeof fetch, accept = 'application/json') {
  const r = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: accept }, body: new URLSearchParams(body), signal: AbortSignal.timeout(10_000) });
  const t = await json(r, 'token exchange');
  const token = str(t.access_token);
  if (!token) throw new Error(`token exchange failed (${str(t.error) ?? 'no access token'})`);
  return token;
}
const bearer = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'del-marketplace' });

export const PROVIDERS: Record<ProviderKey, ProviderDef> = {
  google: {
    key: 'google', label: 'Google', pkce: true, scope: 'openid email profile',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    async exchange(code, redirectUri, verifier, fetcher) {
      const c = creds('google');
      const token = await formToken('https://oauth2.googleapis.com/token', { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: c.id, client_secret: c.secret, code_verifier: verifier }, fetcher);
      const u = await json(await fetcher('https://openidconnect.googleapis.com/v1/userinfo', { headers: bearer(token), signal: AbortSignal.timeout(10_000) }), 'profile');
      return { subject: String(u.sub), email: str(u.email)?.toLowerCase() ?? null, emailVerified: u.email_verified === true, name: str(u.name), avatarUrl: str(u.picture) };
    },
  },
  github: {
    key: 'github', label: 'GitHub', pkce: true, scope: 'read:user user:email',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    async exchange(code, redirectUri, verifier, fetcher) {
      const c = creds('github');
      const token = await formToken('https://github.com/login/oauth/access_token', { code, redirect_uri: redirectUri, client_id: c.id, client_secret: c.secret, code_verifier: verifier }, fetcher);
      const u = await json(await fetcher('https://api.github.com/user', { headers: bearer(token), signal: AbortSignal.timeout(10_000) }), 'profile');
      // The profile email may be hidden: the primary verified address comes from /user/emails.
      const emails = (await json(await fetcher('https://api.github.com/user/emails', { headers: bearer(token), signal: AbortSignal.timeout(10_000) }), 'emails')) as unknown as { email: string; primary: boolean; verified: boolean }[];
      const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified) : undefined;
      return { subject: String(u.id), email: primary?.email.toLowerCase() ?? null, emailVerified: !!primary, name: str(u.name) ?? str(u.login), avatarUrl: str(u.avatar_url) };
    },
  },
  facebook: {
    key: 'facebook', label: 'Facebook', pkce: true, scope: 'email,public_profile',
    authorizeUrl: 'https://www.facebook.com/v23.0/dialog/oauth',
    async exchange(code, redirectUri, verifier, fetcher) {
      const c = creds('facebook');
      const q = new URLSearchParams({ code, redirect_uri: redirectUri, client_id: c.id, client_secret: c.secret, code_verifier: verifier });
      const t = await json(await fetcher(`https://graph.facebook.com/v23.0/oauth/access_token?${q}`, { signal: AbortSignal.timeout(10_000) }), 'token exchange');
      const token = str(t.access_token);
      if (!token) throw new Error('token exchange failed');
      const u = await json(await fetcher(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(10_000) }), 'profile');
      const pic = (u.picture as { data?: { url?: string } } | undefined)?.data?.url ?? null;
      // Facebook only returns an email it has confirmed.
      return { subject: String(u.id), email: str(u.email)?.toLowerCase() ?? null, emailVerified: !!str(u.email), name: str(u.name), avatarUrl: pic };
    },
  },
  linkedin: {
    key: 'linkedin', label: 'LinkedIn', pkce: false, scope: 'openid profile email',
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    async exchange(code, redirectUri, _verifier, fetcher) {
      const c = creds('linkedin');
      const token = await formToken('https://www.linkedin.com/oauth/v2/accessToken', { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: c.id, client_secret: c.secret }, fetcher);
      const u = await json(await fetcher('https://api.linkedin.com/v2/userinfo', { headers: bearer(token), signal: AbortSignal.timeout(10_000) }), 'profile');
      return { subject: String(u.sub), email: str(u.email)?.toLowerCase() ?? null, emailVerified: u.email_verified === true, name: str(u.name), avatarUrl: str(u.picture) };
    },
  },
  /** Development only. The "code" is the identity typed on the test page, sealed by the API so it can't be forged. */
  test: {
    key: 'test', label: 'Test provider', pkce: false, scope: '',
    authorizeUrl: '/api/auth/oauth/test/authorize',
    async exchange() { throw new Error('handled by OAuthService'); },
  },
};

/** Providers whose keys are set (and the test provider when enabled outside production). */
export function enabledProviders(): ProviderKey[] {
  const e = env();
  const out: ProviderKey[] = [];
  for (const k of ['google', 'github', 'facebook', 'linkedin'] as const) { const c = creds(k); if (c.id && c.secret) out.push(k); }
  if (e.OAUTH_TEST_PROVIDER && !isProd()) out.push('test');
  return out;
}

export function clientId(k: ProviderKey) { return k === 'test' ? 'test' : creds(k).id; }

export function pkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}
