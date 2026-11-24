import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';
import { FulfilmentService } from './fulfilment.service';
import { StripeService } from './stripe.service';

/**
 * Stripe Connect onboarding for instructors: a v2 Account with the `recipient` configuration (receives transfers;
 * platform is merchant of record and collects fees/losses), onboarded through a Stripe-hosted Account Link.
 */
@Injectable()
export class ConnectService {
  private readonly logger = new Logger('Connect');
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly audit: AuditService,
    private readonly fulfilment: FulfilmentService,
  ) {}

  private async profile(userId: string) {
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId }, include: { user: { select: { email: true, name: true } } } });
    if (!p || p.status !== 'approved') throw notFound('Approved instructor profile');
    if (p.isPlatform) throw badRequest('The platform account does not need payouts', 'platform_account');
    return p;
  }

  async onboardingLink(a: Actor) {
    const p = await this.profile(a.user.id);
    const stripe = this.stripe.client;
    let accountId = p.stripeAccountId;
    if (!accountId) {
      const account = await stripe.v2.core.accounts.create(
        {
          contact_email: p.user.email,
          display_name: p.user.name,
          dashboard: 'express',
          configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
          defaults: { responsibilities: { fees_collector: 'application', losses_collector: 'application' } },
          include: ['configuration.recipient', 'requirements'],
        },
        { idempotencyKey: `connect-account:${p.userId}` },
      );
      accountId = account.id;
      await this.prisma.instructorProfile.update({ where: { userId: p.userId }, data: { stripeAccountId: accountId } });
      await this.audit.log({ actorId: a.user.id, action: 'connect.account_created', targetType: 'instructor', targetId: p.userId, ip: a.ip, meta: { accountId } });
    }
    const web = env().WEB_URL;
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          collection_options: { fields: 'currently_due' },
          refresh_url: `${web}/instructor/payouts?refresh=1`,
          return_url: `${web}/instructor/payouts?return=1`,
        },
      },
    });
    return { url: link.url, expiresAt: link.expires_at };
  }

  async status(userId: string) {
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Instructor profile');
    if (p.isPlatform) return { connected: true, payoutsEnabled: true, isPlatform: true, stripeConfigured: this.stripe.configured };
    if (p.stripeAccountId && this.stripe.configured) {
      await this.refreshAccount(p.stripeAccountId).catch((e) => this.logger.warn(`status refresh failed: ${(e as Error).message}`));
    }
    const fresh = await this.prisma.instructorProfile.findUniqueOrThrow({ where: { userId } });
    const pending = await this.prisma.orderLine.aggregate({
      where: { instructorId: userId, transferStatus: 'pending', refundedAt: null },
      _sum: { instructorShareCents: true },
    });
    return {
      connected: !!fresh.stripeAccountId,
      payoutsEnabled: fresh.payoutsEnabled,
      isPlatform: false,
      stripeConfigured: this.stripe.configured,
      pendingPayoutCents: pending._sum.instructorShareCents ?? 0,
    };
  }

  /** Pull the account from Stripe and store whether it can receive transfers. Called by status + webhooks. */
  async refreshAccount(accountId: string) {
    const acct = await this.stripe.client.v2.core.accounts.retrieve(accountId, { include: ['configuration.recipient'] });
    const transfers = acct.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
    await this.setPayoutsEnabled(accountId, transfers?.status === 'active');
  }

  async setPayoutsEnabled(accountId: string, enabled: boolean) {
    const p = await this.prisma.instructorProfile.findUnique({ where: { stripeAccountId: accountId } });
    if (!p || p.payoutsEnabled === enabled) return;
    await this.prisma.instructorProfile.update({ where: { userId: p.userId }, data: { payoutsEnabled: enabled } });
    await this.audit.log({ action: 'connect.payouts_changed', targetType: 'instructor', targetId: p.userId, meta: { accountId, enabled } });
    if (enabled) await this.fulfilment.settlePendingForInstructor(p.userId);
  }
}
