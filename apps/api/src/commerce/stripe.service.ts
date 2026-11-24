import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { unavailable } from '../common/errors';
import { env } from '../config/env';

/** Lazily-created Stripe client. Everything payment-related asks `configured` first. */
@Injectable()
export class StripeService {
  private instance?: Stripe;

  get configured(): boolean {
    return !!env().STRIPE_SECRET_KEY;
  }

  get client(): Stripe {
    if (!this.configured) throw unavailable('Stripe is not configured', 'stripe_not_configured');
    this.instance ??= new Stripe(env().STRIPE_SECRET_KEY, { maxNetworkRetries: 2, appInfo: { name: 'del-marketplace' } });
    return this.instance;
  }

  /** Verifies the Stripe-Signature header against the raw body. Throws on mismatch. */
  constructEvent(rawBody: Buffer, signature: string, secret = env().STRIPE_WEBHOOK_SECRET): Stripe.Event {
    // Signature verification is pure HMAC; it does not need an API key.
    return Stripe.webhooks.constructEvent(rawBody, signature, secret);
  }
}
