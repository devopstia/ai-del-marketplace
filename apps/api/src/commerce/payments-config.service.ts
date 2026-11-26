import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, forbidden } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { devPaymentsEnabled, env, isProd, stepUpSkipped } from '../config/env';
import { SignInService } from '../auth/signin.service';
import { modeOf, STRIPE_CONFIG_KEY, STRIPE_LIVE_KEY, StripeService } from './stripe.service';

const mask = (k: string) => (k ? `${k.slice(0, 8)}…${k.slice(-4)}` : '');
export const LIVE_CONFIRMATION = 'ENABLE LIVE PAYMENTS';

/**
 * Super Admin › Settings › Payments & Stripe (owner 2026-11-25). Status and health for super admins; key changes and
 * the live-mode switch need a fresh authenticator code, are audited without the secrets, and never return a key.
 */
@Injectable()
export class PaymentsConfigService {
  private account: { at: number; key: string; value: { id: string; name: string | null; country: string | null } | null; error: string | null } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly signIn: SignInService,
  ) {}

  /** What the public site shows: "test" puts a clear test-mode notice on cart and checkout. */
  publicMode() {
    if (this.stripe.configured) return { mode: this.stripe.mode, provider: 'stripe' as const };
    if (devPaymentsEnabled()) return { mode: 'simulated' as const, provider: 'local' as const };
    return { mode: 'off' as const, provider: null };
  }

  async status() {
    const s = this.stripe;
    let account = null as { id: string; name: string | null; country: string | null } | null;
    let accountError: string | null = null;
    if (s.mode) {
      // cache 5 minutes: the page shouldn't call Stripe on every view
      if (this.account && this.account.key === `${s.mode}:${s.source}` && Date.now() - this.account.at < 300_000) { account = this.account.value; accountError = this.account.error; }
      else {
        try {
          const a = await StripeService.probe(s.secretKeyForServer).accounts.retrieveCurrent();
          account = { id: a.id, name: a.business_profile?.name ?? a.settings?.dashboard?.display_name ?? null, country: a.country ?? null };
        } catch (e) { accountError = (e as Error).message.slice(0, 200); }
        this.account = { at: Date.now(), key: `${s.mode}:${s.source}`, value: account, error: accountError };
      }
    }
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [lastHook, hooks7d, failedOrders, pendingOld] = await Promise.all([
      this.prisma.webhookEvent.findFirst({ where: { id: { startsWith: 'evt_' } }, orderBy: { processedAt: 'desc' } }),
      this.prisma.webhookEvent.count({ where: { id: { startsWith: 'evt_' }, processedAt: { gte: since } } }),
      this.prisma.order.findMany({ where: { status: 'failed', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, createdAt: true, totalCents: true } }),
      this.prisma.order.count({ where: { status: 'pending', createdAt: { lt: new Date(Date.now() - 3600_000), gte: since } } }),
    ]);
    const web = env().WEB_URL.replace(/\/$/, '');
    return {
      configured: s.configured,
      mode: s.mode,
      liveAuthorized: s.isLiveAuthorized,
      blockedLive: s.blockedLive,
      source: s.source,
      publicMode: this.publicMode().mode,
      keys: { secretKey: mask(s.secretKeyForServer), publishableKey: mask(s.publishableKey), webhookSecret: s.webhookSecret ? 'set' : '' },
      account, accountError,
      webhook: { endpoint: `${env().API_URL.replace(/\/$/, '')}/api/webhooks/stripe`, lastEventAt: lastHook?.processedAt ?? null, lastEventType: lastHook?.type ?? null, events7d: hooks7d, secretSet: !!s.webhookSecret },
      problems: { failedOrders7d: failedOrders, pendingOver1h: pendingOld },
      commission: { platformPercent: (await this.settings.commissionBps()) / 100, instructorPercent: 100 - (await this.settings.commissionBps()) / 100 },
      checkoutReturnUrl: `${web}/checkout/success`,
      devTestPayments: devPaymentsEnabled(),
    };
  }

  /** Saves keys after checking them with Stripe. Live keys are stored but stay inactive until live mode is authorised. */
  async save(a: Actor, input: { secretKey: string; publishableKey: string; webhookSecret: string; code?: string }) {
    this.superOnly(a);
    await this.stepUp(a, input.code);
    const mode = modeOf(input.secretKey.trim());
    if (!mode) throw badRequest('The secret key must start with sk_test_ or sk_live_ (or a restricted rk_ key)', 'invalid_key');
    const pubMode = /^pk_test_/.test(input.publishableKey) ? 'test' : /^pk_live_/.test(input.publishableKey) ? 'live' : null;
    if (pubMode !== mode) throw badRequest('The publishable key must be from the same mode as the secret key', 'invalid_key');
    if (!/^whsec_/.test(input.webhookSecret.trim())) throw badRequest('The webhook signing secret starts with whsec_', 'invalid_key');
    try { await StripeService.probe(input.secretKey.trim()).balance.retrieve(); }
    catch (e) { throw badRequest(`Stripe refused the key: ${(e as Error).message.slice(0, 160)}`, 'stripe_rejected'); }
    const value = StripeService.sealKeys({ secretKey: input.secretKey.trim(), publishableKey: input.publishableKey.trim(), webhookSecret: input.webhookSecret.trim() });
    await this.prisma.platformSetting.upsert({ where: { key: STRIPE_CONFIG_KEY }, create: { key: STRIPE_CONFIG_KEY, value }, update: { value } });
    await this.stripe.reload();
    this.account = null;
    await this.audit.log({ actorId: a.user.id, action: 'payments.stripe_keys_saved', targetType: 'settings', targetId: STRIPE_CONFIG_KEY, ip: a.ip, meta: { mode, secretKey: mask(input.secretKey), liveAuthorized: this.stripe.isLiveAuthorized } });
    return this.status();
  }

  async clear(a: Actor, code?: string) {
    this.superOnly(a);
    await this.stepUp(a, code);
    await this.prisma.platformSetting.deleteMany({ where: { key: STRIPE_CONFIG_KEY } });
    await this.stripe.reload();
    this.account = null;
    await this.audit.log({ actorId: a.user.id, action: 'payments.stripe_keys_removed', targetType: 'settings', targetId: STRIPE_CONFIG_KEY, ip: a.ip });
    return this.status();
  }

  /** The separate, explicit switch for real payments (owner: never automatic). */
  async setLive(a: Actor, input: { enable: boolean; confirm?: string; code?: string }) {
    this.superOnly(a);
    await this.stepUp(a, input.code);
    if (input.enable && input.confirm !== LIVE_CONFIRMATION) throw badRequest(`Type ${LIVE_CONFIRMATION} to confirm`, 'confirmation_required');
    if (input.enable && this.stripe.mode !== 'live') throw badRequest('Save live keys first', 'no_live_keys');
    await this.prisma.platformSetting.upsert({ where: { key: STRIPE_LIVE_KEY }, create: { key: STRIPE_LIVE_KEY, value: input.enable }, update: { value: input.enable } });
    await this.stripe.reload();
    await this.audit.log({ actorId: a.user.id, action: input.enable ? 'payments.live_enabled' : 'payments.live_disabled', targetType: 'settings', targetId: STRIPE_LIVE_KEY, ip: a.ip });
    return this.status();
  }

  private superOnly(a: Actor) { if (!a.user.roles.includes('super_admin')) throw forbidden('Only a super admin can change payment settings', 'super_admin_required'); }
  private async stepUp(a: Actor, code?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { mfaEnabledAt: true } });
    if (stepUpSkipped(!!me?.mfaEnabledAt)) return;
    if (!code) throw badRequest('Enter the six-digit code from your Google Authenticator app to confirm this change.', 'step_up_required');
    await this.signIn.checkCode(a.user.id, code, a.ip);
  }
}
