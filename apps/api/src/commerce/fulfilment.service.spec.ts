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
      create: jest.fn(async ({ data }: any) => state.enrollments.push({ ...data, revokedAt: null })),
      update: jest.fn(),
    },
    course: { update: jest.fn(async ({ where }: any) => (state.studentCount[where.id] = (state.studentCount[where.id] ?? 0) + 1)) },
    cartItem: { deleteMany: jest.fn(async () => (state.cartDeleted++, { count: 1 })) },
    orderLine: { update: jest.fn(async ({ where, data }: any) => Object.assign(state.lines.find((l) => l.id === where.id)!, data)) },
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
  const jobs: any = { sendEmail: jest.fn() };
  return { svc: new FulfilmentService(prisma, audit as any, stripe, jobs), state, transfers, jobs };
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

describe('FulfilmentService.issueTransfers', () => {
  it('pays only third-party instructors with payouts enabled, with source_transaction + idempotency key', async () => {
    const { svc, state, transfers } = build(true);
    await svc.fulfil('o1', { via: 'stripe_webhook', paymentIntentId: 'pi_1', chargeId: 'ch_1' });
    expect(transfers.create).toHaveBeenCalledTimes(1);
    const [params, opts] = transfers.create.mock.calls[0] as any[];
    expect(params).toMatchObject({ amount: 4249, currency: 'usd', destination: 'acct_nadia', transfer_group: 'o1', source_transaction: 'ch_1' });
    expect(opts).toEqual({ idempotencyKey: 'transfer:l1' });
    expect(state.lines[0]).toMatchObject({ transferStatus: 'paid', transferId: 'tr_l1' });
    expect(state.lines[1].transferStatus).toBe('none'); // the platform's own course: no transfer
  });

  it('retrying transfers never pays a line twice', async () => {
    const { svc, transfers } = build(true);
    await svc.fulfil('o1', { via: 'stripe_webhook', chargeId: 'ch_1' });
    await svc.issueTransfers('o1');
    await svc.fulfil('o1', { via: 'stripe_webhook', chargeId: 'ch_1' });
    expect(transfers.create).toHaveBeenCalledTimes(1);
  });

  it('leaves lines pending when the instructor has not finished onboarding', async () => {
    const { svc, state, transfers } = build(true);
    state.profiles['i-nadia'].payoutsEnabled = false;
    await svc.fulfil('o1', { via: 'stripe_webhook', chargeId: 'ch_1' });
    expect(transfers.create).not.toHaveBeenCalled();
    expect(state.lines[0].transferStatus).toBe('pending');
  });

  it('does nothing without Stripe (dev test payments)', async () => {
    const { svc, transfers } = build(false);
    await svc.fulfil('o1', { via: 'dev_test_payment' });
    expect(transfers.create).not.toHaveBeenCalled();
  });
});
