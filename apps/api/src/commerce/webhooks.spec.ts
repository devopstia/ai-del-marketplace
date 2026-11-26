import Stripe from 'stripe';
import { resetEnvCache } from '../config/env';
import { AppError } from '../common/errors';
import { WebhooksController } from './commerce.controller';
import { StripeService } from './stripe.service';
import { WebhooksService } from './webhooks.service';

const SECRET = 'whsec_test_secret_for_unit_tests';

function signed(payload: object, secret = SECRET) {
  const body = JSON.stringify(payload);
  const header = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return { raw: Buffer.from(body), header };
}

describe('Stripe webhook endpoint (signature)', () => {
  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    resetEnvCache();
  });
  afterAll(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    resetEnvCache();
  });

  const build = () => {
    const hooks = { handle: jest.fn(async () => ({ received: true, duplicate: false })) };
    const ctrl = new WebhooksController(new StripeService(), hooks as any, {} as any, {} as any);
    return { ctrl, hooks };
  };
  const event = { id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } };

  it('accepts a correctly signed raw body', async () => {
    const { ctrl, hooks } = build();
    const { raw, header } = signed(event);
    await expect(ctrl.stripeHook({ rawBody: raw } as any, header)).resolves.toEqual({ received: true, duplicate: false });
    expect(hooks.handle).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt_1' }));
  });

  it('rejects a body signed with another secret', async () => {
    const { ctrl, hooks } = build();
    const { raw, header } = signed(event, 'whsec_attacker');
    await expect(ctrl.stripeHook({ rawBody: raw } as any, header)).rejects.toMatchObject({ code: 'invalid_signature' });
    expect(hooks.handle).not.toHaveBeenCalled();
  });

  it('rejects a tampered body', async () => {
    const { ctrl } = build();
    const { header } = signed(event);
    const tampered = Buffer.from(JSON.stringify({ ...event, id: 'evt_evil' }));
    await expect(ctrl.stripeHook({ rawBody: tampered } as any, header)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects a missing signature', async () => {
    const { ctrl } = build();
    await expect(ctrl.stripeHook({ rawBody: Buffer.from('{}') } as any, undefined)).rejects.toMatchObject({ code: 'invalid_signature' });
  });
});

describe('WebhooksService (event idempotency + routing)', () => {
  it('refund.updated goes to the refund settlement (applied only once Stripe confirms)', async () => {
    const { svc, refunds } = build();
    const refund = { id: 're_1', status: 'succeeded', metadata: { orderId: 'o1', lineIds: 'l1' } };
    await svc.handle({ id: 'evt_ru', type: 'refund.updated', data: { object: refund } });
    expect(refunds.onStripeRefund).toHaveBeenCalledWith(refund);
  });

  function build(seen: string[] = []) {
    const stored = new Set(seen);
    const prisma: any = {
      webhookEvent: {
        findUnique: jest.fn(async ({ where }: any) => (stored.has(where.id) ? { id: where.id } : null)),
        create: jest.fn(async ({ data }: any) => stored.add(data.id)),
      },
      order: {
        findUnique: jest.fn(async ({ where }: any) => (where.id === 'o1' || where.stripePaymentIntentId === 'pi_1' ? { id: 'o1', stripeCheckoutSessionId: 'cs_1', lines: [{ id: 'l1', priceCents: 500, refundedAt: null }] } : null)),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
    };
    prisma.order.findUniqueOrThrow = prisma.order.findUnique;
    const fulfilment = { fulfil: jest.fn() };
    const refunds = { applyRefund: jest.fn(), syncProcessing: jest.fn(), onStripeRefund: jest.fn() };
    const connect = { setPayoutsEnabled: jest.fn(), refreshAccount: jest.fn() };
    const stripe = { configured: true, client: { paymentIntents: { retrieve: jest.fn(async () => ({ latest_charge: 'ch_1' })) } } };
    const svc = new WebhooksService(prisma, stripe as any, fulfilment as any, refunds as any, connect as any, { log: jest.fn() } as any, { settleFromCharge: jest.fn() } as any);
    return { svc, prisma, fulfilment, refunds, connect };
  }
  const completed = {
    id: 'evt_c',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', metadata: { orderId: 'o1' } } },
  };

  it('fulfils a paid checkout session through the single fulfilment function', async () => {
    const { svc, fulfilment, prisma } = build();
    await svc.handle(completed);
    expect(fulfilment.fulfil).toHaveBeenCalledWith('o1', { via: 'stripe_webhook', paymentIntentId: 'pi_1', chargeId: 'ch_1' });
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({ data: { id: 'evt_c', type: 'checkout.session.completed' } });
  });

  it('skips an event id it has already processed', async () => {
    const { svc, fulfilment } = build(['evt_c']);
    await expect(svc.handle(completed)).resolves.toEqual({ received: true, duplicate: true });
    expect(fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it('processes the same delivery only once', async () => {
    const { svc, fulfilment } = build();
    await svc.handle(completed);
    await svc.handle(completed);
    expect(fulfilment.fulfil).toHaveBeenCalledTimes(1);
  });

  it('waits for async payment methods (unpaid session)', async () => {
    const { svc, fulfilment } = build();
    await svc.handle({ ...completed, id: 'evt_u', data: { object: { ...completed.data.object, payment_status: 'unpaid' } } });
    expect(fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it('ignores a session that does not match the order', async () => {
    const { svc, fulfilment } = build();
    await svc.handle({ ...completed, id: 'evt_x', data: { object: { ...completed.data.object, id: 'cs_other' } } });
    expect(fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it('full charge.refunded reverses everything via applyRefund', async () => {
    const { svc, refunds } = build();
    await svc.handle({ id: 'evt_r', type: 'charge.refunded', data: { object: { payment_intent: 'pi_1', amount: 500, amount_refunded: 500 } } });
    expect(refunds.syncProcessing).toHaveBeenCalledWith('o1');
    expect(refunds.applyRefund).toHaveBeenCalledWith('o1', ['l1']);
  });

  it('account.updated syncs payouts', async () => {
    const { svc, connect } = build();
    await svc.handle({ id: 'evt_a', type: 'account.updated', data: { object: { id: 'acct_1', payouts_enabled: true } } });
    expect(connect.setPayoutsEnabled).toHaveBeenCalledWith('acct_1', true);
  });
});
