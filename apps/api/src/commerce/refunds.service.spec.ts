import { AdminService } from '../admin/admin.service';
import { RefundsService } from './refunds.service';

/** Two-line paid order (Nadia's course + a DEL course), test provider (no Stripe call). */
function fakeDb() {
  const state = {
    order: { id: 'o1', userId: 'buyer', status: 'paid', provider: 'test', stripePaymentIntentId: null },
    lines: [
      { id: 'a', orderId: 'o1', courseId: 'c-nadia', priceCents: 3999, instructorShareCents: 3199, transferStatus: 'pending', transferId: null, refundedAt: null as Date | null },
      { id: 'b', orderId: 'o1', courseId: 'c-del', priceCents: 2999, instructorShareCents: 0, transferStatus: 'none', transferId: null, refundedAt: null as Date | null },
    ],
    enrollments: [
      { userId: 'buyer', orderLineId: 'a', courseId: 'c-nadia', accessExpiresAt: null, revokedAt: null as Date | null },
      { userId: 'buyer', orderLineId: 'b', courseId: 'c-del', accessExpiresAt: null, revokedAt: null as Date | null },
    ],
    studentCount: { 'c-nadia': 5, 'c-del': 9 } as Record<string, number>,
  };
  const match = (l: any, w: any) =>
    (!w.id || (typeof w.id === 'string' ? l.id === w.id : w.id.in.includes(l.id))) &&
    (!w.orderId || l.orderId === w.orderId) &&
    (w.refundedAt !== null || !l.refundedAt) &&
    (!w.transferStatus || l.transferStatus === w.transferStatus);
  const db: any = {
    order: {
      findUnique: jest.fn(async () => ({ ...state.order, lines: state.lines })),
      update: jest.fn(async ({ data }: any) => Object.assign(state.order, data)),
      findUniqueOrThrow: jest.fn(async () => ({ ...state.order, lines: state.lines })),
    },
    orderLine: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = state.lines.filter((l) => match(l, where));
        rows.forEach((l) => Object.assign(l, data));
        return { count: rows.length };
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => ({ ...state.lines.find((l) => l.id === where.id), order: { userId: state.order.userId } })),
      findMany: jest.fn(async ({ where }: any) => state.lines.filter((l) => (where.orderId ? l.orderId === where.orderId : true) && (where.id?.in ? where.id.in.includes(l.id) : true) && (where.transferStatus ? l.transferStatus === where.transferStatus : true))),
    },
    enrollment: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = state.enrollments.filter((e) => e.orderLineId === where.orderLineId && !e.revokedAt);
        rows.forEach((e) => Object.assign(e, data));
        return { count: rows.length };
      }),
      findUnique: jest.fn(async ({ where }: any) => state.enrollments.find((e: any) => e.userId === where.userId_courseId.userId && e.courseId === where.userId_courseId.courseId) ?? null),
      update: jest.fn(async ({ where, data }: any) => Object.assign(state.enrollments.find((e: any) => e.userId === where.userId_courseId.userId && e.courseId === where.userId_courseId.courseId)!, data)),
    },
    // One-year access periods: none in these fixtures (enrolments made before periods), so a refund revokes the course.
    accessPeriod: { updateMany: jest.fn(async () => ({ count: 0 })), findMany: jest.fn(async () => []) },
    course: { update: jest.fn(async ({ where }: any) => (state.studentCount[where.id] -= 1)) },
    certificate: { deleteMany: jest.fn(async () => ({ count: 0 })) },
  };
  db.$transaction = jest.fn(async (fn: any) => fn(db));
  return { db, state };
}

describe('partial refunds', () => {
  function build() {
    const { db, state } = fakeDb();
    const audit = { log: jest.fn() };
    const payouts = { clawback: jest.fn() };
    const refunds = new RefundsService(db, audit as any, { client: {} } as any, payouts as any, {} as any);
    return { refunds, db, state, audit, payouts };
  }

  it('refunds only the chosen line: its enrolment is revoked, the other stays, order is partially refunded', async () => {
    const { refunds, state } = build();
    await refunds.refund('o1', ['a'], 'asked nicely', { id: 'admin', ip: null });
    expect(state.lines.find((l) => l.id === 'a')!.refundedAt).toBeInstanceOf(Date);
    expect(state.lines.find((l) => l.id === 'a')!.transferStatus).toBe('none'); // owed share cancelled
    expect(state.lines.find((l) => l.id === 'b')!.refundedAt).toBeNull();
    expect(state.enrollments.map((e) => !!e.revokedAt)).toEqual([true, false]);
    expect(state.studentCount).toEqual({ 'c-nadia': 4, 'c-del': 9 });
    expect(state.order.status).toBe('partially_refunded');
  });

  it('removes the certificate of a refunded course and asks payouts to recover any transferred share', async () => {
    const { refunds, db, payouts } = build();
    await refunds.refund('o1', ['a'], undefined, { id: 'admin', ip: null });
    expect(db.certificate.deleteMany).toHaveBeenCalledWith({ where: { userId: 'buyer', courseId: 'c-nadia' } });
    expect(payouts.clawback).toHaveBeenCalledWith('a', 'refund_clawback');
  });

  it('refunding the rest later completes the refund; a third attempt has nothing left', async () => {
    const { refunds, state } = build();
    await refunds.refund('o1', ['a'], undefined, { id: 'admin', ip: null });
    await refunds.refund('o1', undefined, undefined, { id: 'admin', ip: null });
    expect(state.order.status).toBe('refunded');
    expect(state.studentCount).toEqual({ 'c-nadia': 4, 'c-del': 8 });
    await expect(refunds.refund('o1', undefined, undefined, { id: 'admin', ip: null })).rejects.toMatchObject({ code: 'not_refundable' });
  });

  it('applying the same refund twice (webhook + admin) changes nothing the second time', async () => {
    const { refunds, state } = build();
    await refunds.applyRefund('o1', ['a']);
    await refunds.applyRefund('o1', ['a']);
    expect(state.studentCount['c-nadia']).toBe(4);
  });

  it('admin refund rejects line ids from another order', async () => {
    const prisma: any = { orderLine: { findMany: jest.fn(async () => [{ id: 'a' }]) } };
    const refunds = { refund: jest.fn() };
    const admin = new AdminService(prisma, {} as any, {} as any, refunds as any, {} as any, {} as any);
    const actor = { user: { id: 'admin', email: '', name: '', roles: ['admin' as const] }, ip: null };
    await expect(admin.refund(actor, 'o1', { lineIds: ['a', 'zzz'] })).rejects.toMatchObject({ code: 'invalid_line' });
    expect(refunds.refund).not.toHaveBeenCalled();
  });
});

describe('refund payments are reported only once the provider confirms (owner 2026-11-26)', () => {
  function build(stripeStatus: 'succeeded' | 'pending' | 'failed' | 'throws') {
    const { db, state } = fakeDb();
    state.order.provider = 'stripe';
    (state.order as any).stripePaymentIntentId = 'pi_1';
    const requests: any[] = [{ id: 'rq1', orderId: 'o1', userId: 'buyer', lineIds: ['a'], status: 'auto_approved', paymentStatus: 'processing', stripeRefundId: null }];
    db.refundRequest = {
      findUniqueOrThrow: jest.fn(async ({ where }: any) => requests.find((r) => r.id === where.id)),
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async ({ where }: any) => requests.filter((r) => r.stripeRefundId === where.stripeRefundId && r.paymentStatus === where.paymentStatus)),
      update: jest.fn(async ({ where, data }: any) => Object.assign(requests.find((r) => r.id === where.id), data)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = requests.filter((r) => r.id === where.id && r.paymentStatus === where.paymentStatus);
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
    };
    const create = jest.fn(async () => {
      if (stripeStatus === 'throws') throw new Error('card_declined sk_test_123abc');
      return { id: 're_1', status: stripeStatus, failure_reason: stripeStatus === 'failed' ? 'expired_or_canceled_card' : null };
    });
    const audit = { log: jest.fn() };
    const refunds = new RefundsService(db, audit as any, { client: { refunds: { create } } } as any, { clawback: jest.fn() } as any, { current: jest.fn(async () => ({ messages: {} })) } as any);
    return { refunds, state, requests, create, audit };
  }

  it('succeeded at once: lines refunded, request succeeded', async () => {
    const { refunds, state, requests } = build('succeeded');
    expect(await refunds.pay('rq1', { id: 'buyer', ip: null }, 'self-service')).toBe('succeeded');
    expect(state.lines[0]!.refundedAt).toBeInstanceOf(Date);
    expect(requests[0]).toMatchObject({ paymentStatus: 'succeeded', stripeRefundId: 're_1' });
  });

  it('pending: nothing refunded locally until the webhook confirms; then applied once', async () => {
    const { refunds, state, requests } = build('pending');
    expect(await refunds.pay('rq1', { id: 'buyer', ip: null }, 'self-service')).toBe('processing');
    expect(state.lines[0]!.refundedAt).toBeNull();
    expect(requests[0].paymentStatus).toBe('processing');
    await refunds.onStripeRefund({ id: 're_1', status: 'succeeded', metadata: { orderId: 'o1', lineIds: 'a' } } as any);
    expect(state.lines[0]!.refundedAt).toBeInstanceOf(Date);
    expect(requests[0].paymentStatus).toBe('succeeded');
  });

  it('provider failure: nothing refunded, the request is marked failed with a safe error', async () => {
    const { refunds, state, requests, audit } = build('throws');
    expect(await refunds.pay('rq1', { id: 'buyer', ip: null }, 'self-service')).toBe('failed');
    expect(state.lines[0]!.refundedAt).toBeNull();
    expect(requests[0].paymentStatus).toBe('failed');
    expect(requests[0].paymentError).not.toContain('sk_test');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'refund.payment_failed' }));
  });

  it('a failed refund event marks the request failed', async () => {
    const { refunds, requests } = build('pending');
    await refunds.pay('rq1', { id: 'buyer', ip: null }, 'self-service');
    await refunds.onStripeRefund({ id: 're_1', status: 'failed', failure_reason: 'lost_or_stolen_card', metadata: { orderId: 'o1', lineIds: 'a' } } as any);
    expect(requests[0]).toMatchObject({ paymentStatus: 'failed', paymentError: 'lost_or_stolen_card' });
  });
});
