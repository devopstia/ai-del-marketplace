import { createHash } from 'node:crypto';
import { resetEnvCache } from '../config/env';
import { PROVIDERS } from './oauth.providers';
import { checkPassword } from './password-policy';
import { base32Decode, base32Encode, codeAt, verifyCode } from './totp';

beforeAll(() => {
  Object.assign(process.env, { SESSION_SECRET: 'x'.repeat(32), DATABASE_URL: 'postgres://x', GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gs', GITHUB_CLIENT_ID: 'hid', GITHUB_CLIENT_SECRET: 'hs', FACEBOOK_CLIENT_ID: 'fid', FACEBOOK_CLIENT_SECRET: 'fs', LINKEDIN_CLIENT_ID: 'lid', LINKEDIN_CLIENT_SECRET: 'ls' });
  resetEnvCache();
});

describe('TOTP (RFC 6238, as Google Authenticator)', () => {
  // RFC 6238 appendix B, SHA-1 seed "12345678901234567890": 94287082 at T=59 s, 07081804 at 1111111109 s (last 6 digits).
  const seed = base32Encode(Buffer.from('12345678901234567890'));
  it('matches the RFC test vectors', () => {
    expect(seed).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(codeAt(seed, Math.floor(59 / 30))).toBe('287082');
    expect(codeAt(seed, Math.floor(1111111109 / 30))).toBe('081804');
    expect(base32Decode(seed).toString()).toBe('12345678901234567890');
  });
  it('accepts one step either side, never a used step, never junk', () => {
    const now = 1111111109_000;
    const s = Math.floor(1111111109 / 30);
    expect(verifyCode(seed, '081804', null, now)).toBe(s);
    expect(verifyCode(seed, codeAt(seed, s - 1), null, now)).toBe(s - 1);
    expect(verifyCode(seed, codeAt(seed, s + 2), null, now)).toBeNull();
    expect(verifyCode(seed, '081804', s, now)).toBeNull(); // already used
    expect(verifyCode(seed, '08180', null, now)).toBeNull();
    expect(verifyCode(seed, 'abcdef', null, now)).toBeNull();
  });
});

describe('password policy', () => {
  const pwnedFor = (pw: string) => {
    const sha = createHash('sha1').update(pw).digest('hex').toUpperCase();
    const calls: string[] = [];
    const fetcher = (async (url: string) => { calls.push(url); return new Response(`0000000000000000000000000000000000A:3\r\n${sha.slice(5)}:12345\r\n`); }) as unknown as typeof fetch;
    return { fetcher, calls, prefix: sha.slice(0, 5) };
  };
  it('sends only 5 characters of the hash and blocks a breached password', async () => {
    const pw = 'correct horse battery 9';
    const f = pwnedFor(pw);
    const r = await checkPassword(pw, {}, f.fetcher);
    expect(f.calls).toEqual([`https://api.pwnedpasswords.com/range/${f.prefix}`]);
    expect(r).toMatchObject({ ok: false, breached: true });
  });
  it('fails open when the service is down', async () => {
    const down = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    expect(await checkPassword('Plenty-long-and-fine-42', {}, down)).toEqual({ ok: true, problems: [], breached: false });
  });
  it('lists every problem at once', async () => {
    const r = await checkPassword('sam', { email: 'sam@x.io' }, (async () => new Response('')) as unknown as typeof fetch);
    expect(r.problems).toEqual(['be at least 12 characters', 'mix letters and numbers']);
  });
});

describe('provider code exchange (responses as the providers document them)', () => {
  type Route = [RegExp, unknown];
  const fake = (routes: Route[]) => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      const hit = routes.find(([re]) => re.test(url));
      return hit ? new Response(JSON.stringify(hit[1]), { headers: { 'Content-Type': 'application/json' } }) : new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
    return { f, seen };
  };
  it('Google: OIDC userinfo, PKCE verifier sent', async () => {
    const { f, seen } = fake([[/oauth2\.googleapis\.com\/token/, { access_token: 't' }], [/openidconnect/, { sub: '1089', email: 'Ann@Gmail.com', email_verified: true, name: 'Ann', picture: 'https://p/a.png' }]]);
    expect(await PROVIDERS.google.exchange('c', 'https://api/cb', 'v', f)).toEqual({ subject: '1089', email: 'ann@gmail.com', emailVerified: true, name: 'Ann', avatarUrl: 'https://p/a.png' });
    expect(String(seen[0].init?.body)).toContain('code_verifier=v');
    expect(String(seen[0].init?.body)).toContain('client_secret=gs');
  });
  it('GitHub: the primary verified address from /user/emails', async () => {
    const { f } = fake([[/access_token/, { access_token: 't' }], [/api\.github\.com\/user\/emails/, [{ email: 'old@x.io', primary: false, verified: true }, { email: 'Dev@X.io', primary: true, verified: true }]], [/api\.github\.com\/user$/, { id: 42, login: 'dev', name: null, avatar_url: 'https://a/42' }]]);
    expect(await PROVIDERS.github.exchange('c', 'https://api/cb', 'v', f)).toEqual({ subject: '42', email: 'dev@x.io', emailVerified: true, name: 'dev', avatarUrl: 'https://a/42' });
  });
  it('Facebook: Graph /me with a confirmed email', async () => {
    const { f } = fake([[/oauth\/access_token/, { access_token: 't' }], [/graph\.facebook\.com\/me/, { id: '77', name: 'Fay', email: 'fay@x.io', picture: { data: { url: 'https://f/77' } } }]]);
    expect(await PROVIDERS.facebook.exchange('c', 'https://api/cb', 'v', f)).toEqual({ subject: '77', email: 'fay@x.io', emailVerified: true, name: 'Fay', avatarUrl: 'https://f/77' });
  });
  it('LinkedIn: OpenID Connect userinfo', async () => {
    const { f } = fake([[/accessToken/, { access_token: 't' }], [/api\.linkedin\.com\/v2\/userinfo/, { sub: 'li-9', email: 'lee@x.io', email_verified: true, name: 'Lee', picture: 'https://l/9' }]]);
    expect(await PROVIDERS.linkedin.exchange('c', 'https://api/cb', '', f)).toEqual({ subject: 'li-9', email: 'lee@x.io', emailVerified: true, name: 'Lee', avatarUrl: 'https://l/9' });
  });
  it('a failed token exchange is an error, never an account', async () => {
    const { f } = fake([[/oauth2\.googleapis\.com\/token/, { error: 'invalid_grant' }]]);
    await expect(PROVIDERS.google.exchange('c', 'https://api/cb', 'v', f)).rejects.toThrow('invalid_grant');
  });
});
