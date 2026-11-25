import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import Stripe from 'stripe';
import { unavailable } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { seal, unseal } from '../common/seal';
import { env } from '../config/env';

export interface StripeKeys { secretKey: string; publishableKey: string; webhookSecret: string }
export const STRIPE_CONFIG_KEY = 'stripe_config';
export const STRIPE_LIVE_KEY = 'stripe_live_authorized';
export const modeOf = (secretKey: string): 'test' | 'live' | null => (/^(sk|rk)_test_/.test(secretKey) ? 'test' : /^(sk|rk)_live_/.test(secretKey) ? 'live' : null);

/**
 * Stripe client (owner 2026-11-25, docs/PAYMENTS.md). Keys come from Super Admin › Payments & Stripe (stored sealed
 * in platform_settings, never returned to a browser) or, when none are saved, from the environment (SSM in
 * production). **Live keys do nothing until a super admin separately authorises live payments**; until then the
 * marketplace behaves as "not configured" for live keys. API and worker refresh the configuration every minute.
 */
@Injectable()
export class StripeService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Stripe');
  private instance?: Stripe;
  private instanceKey = '';
  private keys: StripeKeys & { source: 'dashboard' | 'env' } = { secretKey: '', publishableKey: '', webhookSecret: '', source: 'env' };
  private liveAuthorized = false;
  private timer?: NodeJS.Timeout;

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.fromEnv();
  }

  private fromEnv() {
    const e = env();
    this.keys = { secretKey: e.STRIPE_SECRET_KEY, publishableKey: e.STRIPE_PUBLISHABLE_KEY ?? '', webhookSecret: e.STRIPE_WEBHOOK_SECRET, source: 'env' };
  }

  async onModuleInit() {
    await this.reload();
    this.timer = setInterval(() => void this.reload(), 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  /** Re-reads the saved configuration (after a change, and every minute). */
  async reload() {
    if (!this.prisma) return;
    try {
      const [cfg, live] = await Promise.all([
        this.prisma.platformSetting.findUnique({ where: { key: STRIPE_CONFIG_KEY } }),
        this.prisma.platformSetting.findUnique({ where: { key: STRIPE_LIVE_KEY } }),
      ]);
      this.liveAuthorized = live?.value === true;
      if (cfg && typeof cfg.value === 'string') {
        const k = JSON.parse(unseal('stripe-config', cfg.value).toString('utf8')) as StripeKeys;
        this.keys = { ...k, source: 'dashboard' };
      } else this.fromEnv();
    } catch (e) {
      this.log.warn(`could not load the saved Stripe configuration: ${(e as Error).message}`);
    }
  }

  static sealKeys(k: StripeKeys) { return seal('stripe-config', JSON.stringify(k)); }

  get mode(): 'test' | 'live' | null { return modeOf(this.keys.secretKey); }
  get source() { return this.keys.source; }
  /** Server-side only (status checks); never sent to a browser or a log. */
  get secretKeyForServer() { return this.keys.secretKey; }
  get publishableKey() { return this.keys.publishableKey; }
  get webhookSecret() { return this.keys.webhookSecret; }
  get isLiveAuthorized() { return this.liveAuthorized; }
  /** Keys saved but live payments not authorised yet. */
  get blockedLive(): boolean { return this.mode === 'live' && !this.liveAuthorized; }

  get configured(): boolean {
    return !!this.mode && !this.blockedLive;
  }

  get client(): Stripe {
    if (!this.configured) throw unavailable(this.blockedLive ? 'Live payments are not authorised yet' : 'Stripe is not configured', 'stripe_not_configured');
    if (!this.instance || this.instanceKey !== this.keys.secretKey) {
      this.instance = new Stripe(this.keys.secretKey, { maxNetworkRetries: 2, appInfo: { name: 'del-marketplace' } });
      this.instanceKey = this.keys.secretKey;
    }
    return this.instance;
  }

  /** A client for keys being tested before they are saved. */
  static probe(secretKey: string) { return new Stripe(secretKey, { maxNetworkRetries: 0, timeout: 15_000, appInfo: { name: 'del-marketplace' } }); }

  /** Verifies the Stripe-Signature header against the raw body. Throws on mismatch. */
  constructEvent(rawBody: Buffer, signature: string, secret = this.keys.webhookSecret): Stripe.Event {
    // Signature verification is pure HMAC; it does not need an API key.
    return Stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
