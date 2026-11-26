import { resetEnvCache } from '../config/env';
import { OAuthConfigService } from './oauth-config.service';
import { enabledProviders, setSavedCredentials } from './oauth.providers';

const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('Super Admin › Sign-in methods', () => {
  let svc: OAuthConfigService;
  beforeAll(() => {
    Object.assign(process.env, { DATABASE_URL: 'postgres://x', SESSION_SECRET: 'x'.repeat(40), API_URL: 'https://site.test', WEB_URL: 'https://site.test', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' });
    resetEnvCache();
    svc = new OAuthConfigService({} as never, {} as never, {} as never);
  });
  afterEach(() => setSavedCredentials({}));

  it('accepts keys the provider recognises (a fake code is refused as a bad code)', async () => {
    svc.fetcher = (async () => res(400, { error: 'invalid_grant' })) as typeof fetch;
    expect(await svc.probe('google', '1-a.apps.googleusercontent.com', 'GOCSPX-secret')).toBeNull();
    svc.fetcher = (async () => res(200, { error: 'bad_verification_code' })) as typeof fetch;
    expect(await svc.probe('github', 'Ov23liABCDEFGHIJ', 'secret123')).toBeNull();
    svc.fetcher = (async () => res(200, { access_token: '123|abc' })) as typeof fetch;
    expect(await svc.probe('facebook', '1234567890', 'secret123')).toBeNull();
    svc.fetcher = (async () => res(400, { error: 'invalid_request' })) as typeof fetch;
    expect(await svc.probe('linkedin', '86abcdefgh', 'secret123')).toBeNull();
  });

  it('refuses wrong keys and explains a wrong callback URL', async () => {
    svc.fetcher = (async () => res(401, { error: 'invalid_client' })) as typeof fetch;
    expect(await svc.probe('google', '1-a.apps.googleusercontent.com', 'bad')).toMatch(/refused/);
    expect(await svc.probe('linkedin', '86abcdefgh', 'bad')).toMatch(/refused/);
    svc.fetcher = (async () => res(200, { error: 'incorrect_client_credentials' })) as typeof fetch;
    expect(await svc.probe('github', 'Ov23liABCDEFGHIJ', 'bad')).toMatch(/refused/);
    svc.fetcher = (async () => res(200, { error: 'redirect_uri_mismatch' })) as typeof fetch;
    expect(await svc.probe('github', 'Ov23liABCDEFGHIJ', 'x')).toContain('https://site.test/api/auth/oauth/github/callback');
    svc.fetcher = (async () => res(400, { error: { type: 'OAuthException' } })) as typeof fetch;
    expect(await svc.probe('facebook', '1234567890', 'bad')).toMatch(/refused/);
    svc.fetcher = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect(await svc.probe('google', '1-a.apps.googleusercontent.com', 'x')).toMatch(/could not be reached/);
  });

  it('a provider button exists only while its keys are saved; secrets are never shown', () => {
    expect(enabledProviders()).not.toContain('google');
    setSavedCredentials({ google: { id: '123-abc.apps.googleusercontent.com', secret: 'GOCSPX-topsecret' } });
    expect(enabledProviders()).toContain('google');
    const g = svc.status().items.find((i) => i.key === 'google')!;
    expect(g).toMatchObject({ enabled: true, source: 'settings', redirectUri: 'https://site.test/api/auth/oauth/google/callback' });
    expect(JSON.stringify(svc.status())).not.toContain('topsecret');
  });
});
