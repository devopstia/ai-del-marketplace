import { WebhooksService } from './webhooks.service';

/**
 * The return-page safety net (owner 2026-11-28): the buyer's browser asks the API to check the order's own Stripe
 * Checkout Session. Webhook and confirm share one idempotent fulfilment: whichever comes first wins.
 */
describe('checkout confirm (webhook safety net)', () => {
  function build(opts: { paymentStatus?: string; amount?: number; metadataOrderId?: string; currency?: string } = {}) {
    const order = { id: 'o1', userId: 'u1', status: 'pending', provider: 'stripe', totalCents: 2999, currency: 'usd', stripeCheckoutSessionId: 'cs_1' };
    const session = {
      id: 'cs_1',
      payment_status: opts.paymentStatus ?? 'paid',
      amount_total: opts.amount ?? 2999,
      currency: opts.currency ?? 'usd',
      metadata: { orderId: opts.metadataOrderId ?? 'o1' },
      payment_intent: 'pi_1',
    };
    const fulfilCalls: string[] = [];
    // A fulfilment double with the real contract: pending → paid exactly once, later calls change nothing.
    const fulfilment = {
      fulfil: jest.fn(async (orderId: string, p: { via: string }) => {
        fulfilCalls.push(p.via);
        if (order.status === 'paid') return { orderId, alreadyFulfilled: true, enrolledCourseIds: [] };
        order.status = 'paid';
        return { orderId, alreadyFulfilled: false, enrolledCourseIds: ['c1'] };
      }),
    };
    const stored = new Set<string>();
    const prisma: any = {
      order: {
        findFirst: jest.fn(async ({ where }: any) => (where.id === order.id && where.userId === order.userId ? { ...order } : null)),
        findUnique: jest.fn(async ({ where }: any) => (where.id === order.id ? { ...order } : null)),
        findUniqueOrThrow: jest.fn(async () => ({ ...order })),
      },
      webhookEvent: {
        findUnique: jest.fn(async ({ where }: any) => (stored.has(where.id) ? { id: where.id } : null)),
        create: jest.fn(async ({ data }: any) => stored.add(data.id)),
      },
    };
    const stripe: any = {
      configured: true,
      client: {
        checkout: { sessions: { retrieve: jest.fn(async () => session) } },
        paymentIntents: { retrieve: jest.fn(async () => ({ latest_charge: 'ch_1' })) },
      },
    };
    const audit = { log: jest.fn(async () => undefined) };
    const svc = new WebhooksService(prisma, stripe, fulfilment as any, {} as any, {} as any, audit as any, {} as any);
    const webhook = () => svc.handle({ id: 'evt_1', type: 'checkout.session.completed', data: { object: session } });
    return { svc, order, fulfilment, fulfilCalls, stripe, audit, webhook };
  }

  it('confirm first: fulfils once; the later webhook is a no-op', async () => {
    const t = build();
    await expect(t.svc.confirmCheckout('u1', 'o1', 'cs_1')).resolves.toEqual({ orderId: 'o1', status: 'paid', confirmed: true });
    await t.webhook();
    expect(t.fulfilCalls).toEqual(['checkout_confirm', 'stripe_webhook']);
    expect(t.order.status).toBe('paid');
    // the second call found the order already paid: nothing enrolled twice
    expect(await t.fulfilment.fulfil.mock.results[1]!.value).toMatchObject({ alreadyFulfilled: true });
  });

  it('webhook first: confirm does not call Stripe or fulfil again', async () => {
    const t = build();
    await t.webhook();
    await expect(t.svc.confirmCheckout('u1', 'o1', 'cs_1')).resolves.toEqual({ orderId: 'o1', status: 'paid', confirmed: false });
    expect(t.fulfilCalls).toEqual(['stripe_webhook']);
    expect(t.stripe.client.checkout.sessions.retrieve).toHaveBeenCalledTimes(0);
  });

  it('unpaid session: the order stays pending', async () => {
    const t = build({ paymentStatus: 'unpaid' });
    await expect(t.svc.confirmCheckout('u1', 'o1', null)).resolves.toEqual({ orderId: 'o1', status: 'pending', confirmed: false });
    expect(t.fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it('a session id from the browser that is not the order’s is refused and audited', async () => {
    const t = build();
    await expect(t.svc.confirmCheckout('u1', 'o1', 'cs_other')).rejects.toMatchObject({ code: 'session_mismatch' });
    expect(t.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'order.confirm_refused' }));
    expect(t.fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it('an amount that differs from the order is refused and audited', async () => {
    const t = build({ amount: 100 });
    await expect(t.svc.confirmCheckout('u1', 'o1', 'cs_1')).rejects.toMatchObject({ code: 'amount_mismatch' });
    expect(t.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'order.confirm_refused', meta: expect.objectContaining({ reason: 'amount_mismatch' }) }));
    expect(t.fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it('a session that belongs to another order is refused', async () => {
    const t = build({ metadataOrderId: 'o2' });
    await expect(t.svc.confirmCheckout('u1', 'o1', null)).rejects.toMatchObject({ code: 'session_mismatch' });
    expect(t.fulfilment.fulfil).not.toHaveBeenCalled();
  });

  it('another user’s order is a 404', async () => {
    const t = build();
    await expect(t.svc.confirmCheckout('u2', 'o1', 'cs_1')).rejects.toMatchObject({ status: 404 });
    expect(t.stripe.client.checkout.sessions.retrieve).not.toHaveBeenCalled();
  });
});
