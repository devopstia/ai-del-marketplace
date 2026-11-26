import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, forbidden } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { seal, unseal } from '../common/seal';
import { env, isProd, stepUpSkipped } from '../config/env';
import { credentialSource, publicClientId, REAL_PROVIDERS, type RealProvider, setSavedCredentials } from './oauth.providers';
import { SignInService } from './signin.service';

export const OAUTH_CONFIG_KEY = 'oauth_config';
type Saved = Partial<Record<RealProvider, { id: string; secret: string }>>;

/** Where a super admin creates the app, and the exact values the provider asks for. */
const GUIDE: Record<RealProvider, { label: string; console: string; steps: string }> = {
  google: { label: 'Google', console: 'https://console.cloud.google.com/apis/credentials', steps: 'Google Cloud › APIs & Services › Credentials › Create OAuth client ID › Web application. Add the redirect URI below. Consent screen: External, privacy policy https://ai-devopseasylearning.com/policies/privacy, then Publish.' },
  github: { label: 'GitHub', console: 'https://github.com/settings/applications/new', steps: 'GitHub › Settings › Developer settings › OAuth Apps › New OAuth App. Homepage = the site address, Authorization callback URL = the redirect URI below.' },
  facebook: { label: 'Facebook', console: 'https://developers.facebook.com/apps/', steps: 'Meta for Developers › Create app › Authenticate and request data with Facebook Login. Facebook Login › Settings › Valid OAuth Redirect URIs = the redirect URI below. Privacy policy and data deletion URL: https://ai-devopseasylearning.com/policies/privacy. Business verification, then switch the app to Live.' },
  linkedin: { label: 'LinkedIn', console: 'https://www.linkedin.com/developers/apps/new', steps: 'LinkedIn Developers › Create app › Products › add "Sign In with LinkedIn using OpenID Connect". Auth › Authorized redirect URLs = the redirect URI below. LinkedIn asks for a Company Page to verify the app.' },
};

const mask = (v: string) => (v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v ? `${v.slice(0, 2)}…` : '');
const SHAPE: Record<RealProvider, RegExp> = {
  google: /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
  github: /^[A-Za-z0-9.]{16,40}$/,
  facebook: /^[0-9]{8,20}$/,
  linkedin: /^[A-Za-z0-9]{8,40}$/,
};

/**
 * Super Admin › Sign-in methods (owner 2026-11-25): Google, GitHub, Facebook and LinkedIn keys entered on the site,
 * checked with the provider before they are saved, sealed at rest, never returned. A provider's button appears on the
 * sign-in page as soon as its keys are saved and disappears when they are removed (AGENTS.md rule 19). Keys in the
 * environment still work and are shown as "from the server settings".
 */
@Injectable()
export class OAuthConfigService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  /** injectable for tests */
  fetcher: typeof fetch = fetch;

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly signIn: SignInService) {}

  async onModuleInit() {
    await this.reload();
    this.timer = setInterval(() => void this.reload(), 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async reload() {
    try {
      const row = await this.prisma.platformSetting.findUnique({ where: { key: OAUTH_CONFIG_KEY } });
      setSavedCredentials(row && typeof row.value === 'string' ? (JSON.parse(unseal('oauth-config', row.value).toString('utf8')) as Saved) : {});
    } catch { /* keep the last good keys; the next reload retries */ }
  }

  private async savedMap(): Promise<Saved> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: OAUTH_CONFIG_KEY } });
    return row && typeof row.value === 'string' ? (JSON.parse(unseal('oauth-config', row.value).toString('utf8')) as Saved) : {};
  }

  redirectUri(k: RealProvider) { return `${env().API_URL.replace(/\/$/, '')}/api/auth/oauth/${k}/callback`; }

  status() {
    return {
      site: env().WEB_URL.replace(/\/$/, ''),
      items: REAL_PROVIDERS.map((k) => {
        const source = credentialSource(k);
        return { key: k, label: GUIDE[k].label, enabled: !!source, source, clientId: source ? mask(publicClientId(k)) : '', redirectUri: this.redirectUri(k), console: GUIDE[k].console, steps: GUIDE[k].steps };
      }),
    };
  }

  async save(a: Actor, k: RealProvider, input: { clientId: string; clientSecret: string; code?: string }) {
    this.superOnly(a);
    await this.stepUp(a, input.code);
    const id = input.clientId.trim(); const secret = input.clientSecret.trim();
    if (!SHAPE[k].test(id)) throw badRequest(`That doesn't look like a ${GUIDE[k].label} client ID. Copy it again from the provider's console.`, 'clientId');
    if (secret.length < 8 || /\s/.test(secret)) throw badRequest('Paste the client secret exactly as the provider shows it', 'clientSecret');
    const problem = await this.probe(k, id, secret);
    if (problem) throw badRequest(problem, 'provider_rejected');
    const m = await this.savedMap();
    m[k] = { id, secret };
    await this.write(m);
    await this.audit.log({ actorId: a.user.id, action: 'auth.provider_keys_saved', targetType: 'settings', targetId: `${OAUTH_CONFIG_KEY}:${k}`, ip: a.ip, meta: { provider: k, clientId: mask(id) } });
    return this.status();
  }

  async remove(a: Actor, k: RealProvider, code?: string) {
    this.superOnly(a);
    await this.stepUp(a, code);
    const m = await this.savedMap();
    delete m[k];
    await this.write(m);
    await this.audit.log({ actorId: a.user.id, action: 'auth.provider_keys_removed', targetType: 'settings', targetId: `${OAUTH_CONFIG_KEY}:${k}`, ip: a.ip, meta: { provider: k } });
    return this.status();
  }

  private async write(m: Saved) {
    const value = seal('oauth-config', JSON.stringify(m));
    await this.prisma.platformSetting.upsert({ where: { key: OAUTH_CONFIG_KEY }, create: { key: OAUTH_CONFIG_KEY, value }, update: { value } });
    await this.reload();
  }

  /**
   * Asks the provider whether the client ID and secret belong together, without a user: a token request with a
   * deliberately invalid code is refused as "bad code" for good keys and as "invalid client" for wrong ones
   * (Facebook: an app-token request). Returns a message for the super admin, or null when the keys are accepted.
   */
  async probe(k: RealProvider, id: string, secret: string): Promise<string | null> {
    const f = this.fetcher; const t = AbortSignal.timeout(10_000);
    const redirect = this.redirectUri(k);
    const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(o), signal: t });
    let r: Response;
    try {
      if (k === 'facebook') r = await f(`https://graph.facebook.com/v23.0/oauth/access_token?${new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' })}`, { signal: t });
      else if (k === 'github') r = await f('https://github.com/login/oauth/access_token', form({ client_id: id, client_secret: secret, code: 'del-key-check', redirect_uri: redirect }));
      else if (k === 'google') r = await f('https://oauth2.googleapis.com/token', form({ grant_type: 'authorization_code', client_id: id, client_secret: secret, code: 'del-key-check', redirect_uri: redirect }));
      else r = await f('https://www.linkedin.com/oauth/v2/accessToken', form({ grant_type: 'authorization_code', client_id: id, client_secret: secret, code: 'del-key-check', redirect_uri: redirect }));
    } catch { return `${GUIDE[k].label} could not be reached to check the keys. Try again in a minute.`; }
    let body: Record<string, unknown> = {};
    try { body = (await r.json()) as Record<string, unknown>; } catch { /* non-JSON answer */ }
    const e = body.error;
    const err = typeof e === 'string' ? e : e && typeof e === 'object' ? String((e as { type?: unknown }).type ?? 'error') : '';
    const wrong = `${GUIDE[k].label} refused this client ID and secret. Copy both again from the provider's console.`;
    if (k === 'facebook') return r.ok && body.access_token ? null : wrong;
    if (k === 'github') {
      if (err === 'incorrect_client_credentials') return wrong;
      if (err === 'redirect_uri_mismatch') return `GitHub: set the app's Authorization callback URL to ${redirect}`;
      return err === 'bad_verification_code' ? null : r.status >= 500 ? `GitHub could not check the keys (${r.status}). Try again.` : null;
    }
    if (err === 'invalid_client' || err === 'unauthorized_client' || r.status === 401) return wrong;
    if (err === 'redirect_uri_mismatch') return `${GUIDE[k].label}: add ${redirect} as an authorised redirect URI`;
    if (r.status >= 500) return `${GUIDE[k].label} could not check the keys (${r.status}). Try again.`;
    return null; // invalid_grant / invalid_request about the fake code: the client was recognised
  }

  private superOnly(a: Actor) { if (!a.user.roles.includes('super_admin')) throw forbidden('Only a super admin can change sign-in methods', 'super_admin_required'); }
  private async stepUp(a: Actor, code?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { mfaEnabledAt: true } });
    if (stepUpSkipped(!!me?.mfaEnabledAt)) return;
    if (!code) throw badRequest('Enter the six-digit code from your Google Authenticator app to confirm this change.', 'step_up_required');
    await this.signIn.checkCode(a.user.id, code, a.ip);
  }
}
