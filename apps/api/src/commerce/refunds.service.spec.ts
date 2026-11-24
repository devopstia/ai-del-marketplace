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
      { orderLineId: 'a', courseId: 'c-nadia', revokedAt: null as Date | null },
      { orderLineId: 'b', courseId: 'c-del', revokedAt: null as Date | null },
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
      findUniqueOrThrow: jest.fn(async ({ where }: any) => state.lines.find((l) => l.id === where.id)),
      findMany: jest.fn(async ({ where }: any) => state.lines.filter((l) => (where.orderId ? l.orderId === where.orderId : true) && (where.id?.in ? where.id.in.includes(l.id) : true) && (where.transferStatus ? l.transferStatus === where.transferStatus : true))),
    },
    enrollment: {
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = state.enrollments.filter((e) => e.orderLineId === where.orderLineId && !e.revokedAt);
        rows.forEach((e) => Object.assign(e, data));
        return { count: rows.length };
      }),
    },
    course: { update: jest.fn(async ({ where }: any) => (state.studentCount[where.id] -= 1)) },
  };
  db.$transaction = jest.fn(async (fn: any) => fn(db));
  return { db, state };
}

describe('partial refunds', () => {
  function build() {
    const { db, state } = fakeDb();
    const audit = { log: jest.fn() };
    const refunds = new RefundsService(db, audit as any, { client: {} } as any);
    return { refunds, db, state, audit };
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
