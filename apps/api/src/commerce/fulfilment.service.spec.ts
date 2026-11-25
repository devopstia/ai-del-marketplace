import { FulfilmentService } from './fulfilment.service';

/** In-memory fake of the bits of Prisma fulfilment touches. */
function fakeDb() {
  const state = {
    order: { id: 'o1', userId: 'u1', status: 'pending', totalCents: 9998, currency: 'usd', stripeChargeId: null as string | null, paidAt: null as Date | null },
    lines: [
      { id: 'l1', orderId: 'o1', courseId: 'c1', instructorId: 'i-nadia', priceCents: 4999, instructorShareCents: 4249, transferStatus: 'pending', refundedAt: null },
      { id: 'l2', orderId: 'o1', courseId: 'c2', instructorId: 'i-del', priceCents: 4999, instructorShareCents: 0, transferStatus: 'none', refundedAt: null },
      { id: 'l3', orderId: 'o1', courseId: 'c3', instructorId: 'i-nostripe', priceCents: 0, instructorShareCents: 0, transferStatus: 'none', refundedAt: null },
    ],
    enrollments: [] as { userId: string; courseId: string; revokedAt: Date | null }[],
    studentCount: {} as Record<string, number>,
    cartDeleted: 0,
    audits: [] as string[],
    periods: [] as any[],
    profiles: {
      'i-nadia': { isPlatform: false, stripeAccountId: 'acct_nadia', payoutsEnabled: true },
      'i-del': { isPlatform: true, stripeAccountId: null, payoutsEnabled: false },
      'i-nostripe': { isPlatform: false, stripeAccountId: null, payoutsEnabled: false },
    } as Record<string, any>,
  };
  const tx: any = {
    order: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.id !== state.order.id || !where.status.in.includes(state.order.status)) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(async () => ({ ...state.order, lines: state.lines })),
      findUnique: jest.fn(async () => ({
        ...state.order,
        lines: state.lines
          .filter((l) => l.transferStatus === 'pending' && !l.refundedAt)
          .map((l) => ({ ...l, instructor: { instructorProfile: state.profiles[l.instructorId] } })),
      })),
    },
    enrollment: {
      findUnique: jest.fn(async ({ where }: any) => state.enrollments.find((e) => e.userId === where.userId_courseId.userId && e.courseId === where.userId_courseId.courseId) ?? null),
      findMany: jest.fn(async () => state.enrollments),
      create: jest.fn(async ({ data }: any) => state.enrollments.push({ accessExpiresAt: null, ...data, revokedAt: null })),
      update: jest.fn(),
    },
    accessPeriod: { create: jest.fn(async ({ data }: any) => (state.periods.push(data), data)) },
    course: { update: jest.fn(async ({ where }: any) => (state.studentCount[where.id] = (state.studentCount[where.id] ?? 0) + 1)) },
    cartItem: { deleteMany: jest.fn(async () => (state.cartDeleted++, { count: 1 })) },
    orderLine: {
      update: jest.fn(async ({ where, data }: any) => Object.assign(state.lines.find((l) => l.id === where.id)!, data)),
      updateMany: jest.fn(async (args: any) => ((state as any).dueUpdate = args, { count: 1 })),
    },
    user: { findUnique: jest.fn(async () => ({ email: 'u1@example.com' })) },
    auditLog: { create: jest.fn() },
  };
  const prisma: any = { ...tx, $transaction: jest.fn(async (fn: any) => fn(tx)) };
  return { state, prisma };
}

function build(stripeConfigured = true) {
  const { state, prisma } = fakeDb();
  const audit = { log: jest.fn(async (e: any) => state.audits.push(e.action)) };
  const transfers = { create: jest.fn(async (p: any) => ({ id: `tr_${p.metadata.orderLineId}` })) };
  const stripe: any = { configured: stripeConfigured, client: { transfers } };
  const jobs: any = { sendEmail: jest.fn(), settleFee: jest.fn() };
  const payouts: any = { settleFee: jest.fn(async () => true), fetchStripeFee: jest.fn(async () => true) };
  return { svc: new FulfilmentService(prisma, audit as any, stripe, jobs, payouts), state, transfers, jobs, payouts };
}

describe('FulfilmentService.fulfil', () => {
  it('marks paid, enrols every course, clears the cart, audits', async () => {
    const { svc, state, jobs } = build(false);
    const r = await svc.fulfil('o1', { via: 'dev_test_payment', actorId: 'u1' });
    expect(r.alreadyFulfilled).toBe(false);
    expect(r.enrolledCourseIds).toEqual(['c1', 'c2', 'c3']);
    expect(state.order.status).toBe('paid');
    expect(state.enrollments).toHaveLength(3);
    expect(state.studentCount).toEqual({ c1: 1, c2: 1, c3: 1 });
    expect(state.cartDeleted).toBe(1);
    expect(state.audits).toContain('order.paid');
    expect(jobs.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('is idempotent: a second call (duplicate webhook / double click) changes nothing', async () => {
    const { svc, state, jobs } = build(false);
    await svc.fulfil('o1', { via: 'stripe_webhook' });
    const again = await svc.fulfil('o1', { via: 'stripe_webhook' });
    const third = await svc.fulfil('o1', { via: 'dev_test_payment' });
    expect(again).toEqual({ orderId: 'o1', alreadyFulfilled: true, enrolledCourseIds: [] });
    expect(third.alreadyFulfilled).toBe(true);
    expect(state.enrollments).toHaveLength(3);
    expect(state.studentCount).toEqual({ c1: 1, c2: 1, c3: 1 });
    expect(state.audits.filter((a) => a === 'order.paid')).toHaveLength(1);
    expect(jobs.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('does not enrol twice when the student already has the course', async () => {
    const { svc, state } = build(false);
    state.enrollments.push({ userId: 'u1', courseId: 'c2', revokedAt: null });
    const r = await svc.fulfil('o1', { via: 'stripe_webhook' });
    expect(r.enrolledCourseIds).toEqual(['c1', 'c3']);
    expect(state.enrollments).toHaveLength(3);
  });
});

describe('FulfilmentService: money after payment', () => {
  it('never transfers at payment time: shares wait for the refund-window hold', async () => {
    const { svc, state, transfers } = build(true);
    await svc.fulfil('o1', { via: 'stripe_webhook', paymentIntentId: 'pi_1', chargeId: 'ch_1' });
    expect(transfers.create).not.toHaveBeenCalled();
    expect(state.lines[0].transferStatus).toBe('pending');
    const held = (state as any).dueUpdate;
    expect(held.data.transferDueAt.getTime() - state.order.paidAt!.getTime()).toBe(16 * 24 * 3600 * 1000);
    expect((state.order as any).refundEligibleUntil.getTime() - state.order.paidAt!.getTime()).toBe(14 * 24 * 3600 * 1000);
  });

  it('dev test payments settle a simulated Stripe fee (2.9% + 30¢); Stripe orders read the real fee or retry', async () => {
    const t = build(false);
    (t.state.order as any).provider = 'test';
    await t.svc.fulfil('o1', { via: 'dev_test_payment' });
    expect(t.payouts.settleFee).toHaveBeenCalledWith('o1', Math.round(9998 * 0.029) + 30, 'simulated');

    const s = build(true);
    (s.state.order as any).provider = 'stripe';
    s.payouts.fetchStripeFee.mockResolvedValueOnce(false);
    await s.svc.fulfil('o1', { via: 'stripe_webhook', chargeId: 'ch_1' });
    expect(s.jobs.settleFee).toHaveBeenCalledWith('o1');
  });

  it('a duplicate fulfilment does not settle the fee twice', async () => {
    const { svc, payouts, state } = build(false);
    (state.order as any).provider = 'test';
    await svc.fulfil('o1', { via: 'dev_test_payment' });
    await svc.fulfil('o1', { via: 'dev_test_payment' });
    expect(payouts.settleFee).toHaveBeenCalledTimes(1);
  });
});
