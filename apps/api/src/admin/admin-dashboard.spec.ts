import { dayKey } from '../instructor/dashboard';
import { marketMoney, platformSeries, rankBy } from './admin-dashboard';

const at = new Date('2026-11-20T10:00:00Z');
const line = (o: Partial<{ priceCents: number; feeCents: number; instructorShareCents: number; refundedAt: Date | null; payee: string; courseId: string; instructorId: string; paidAt: Date }>) => ({
  paidAt: at, courseId: 'c1', instructorId: 'i1', priceCents: 1000, feeCents: 59, instructorShareCents: 753, refundedAt: null, transferStatus: 'pending', payee: 'instructor', ...o,
});

describe('admin dashboard money', () => {
  it('splits an independent sale into instructor earnings and DEL commission', () => {
    const m = marketMoney([line({})]);
    expect(m).toMatchObject({ grossCents: 1000, feesCents: 59, refundsCents: 0, instructorEarningsCents: 753, commissionCents: 188, delCoursesNetCents: 0, platformNetCents: 188, sales: 1 });
  });

  it('keeps everything after fees on a DEL-owned course ($4.99 sale, $0.44 fee → $4.55)', () => {
    const m = marketMoney([line({ priceCents: 499, feeCents: 44, instructorShareCents: 0, payee: 'platform' })]);
    expect(m).toMatchObject({ grossCents: 499, platformNetCents: 455, delCoursesNetCents: 455, instructorEarningsCents: 0, commissionCents: 0 });
  });

  it('counts a DEL-agreement share as DEL revenue, not instructor earnings', () => {
    const m = marketMoney([line({ payee: 'del_agreement' })]);
    expect(m.instructorEarningsCents).toBe(0);
    expect(m.platformNetCents).toBe(941);
  });

  it('a refunded line gives back its price, earns no share and still carries the Stripe fee', () => {
    const m = marketMoney([line({ refundedAt: new Date() })]);
    expect(m).toMatchObject({ grossCents: 1000, refundsCents: 1000, instructorEarningsCents: 0, platformNetCents: -59 });
    expect(m.grossCents - m.feesCents - m.refundsCents - m.instructorEarningsCents).toBe(m.platformNetCents);
  });

  it('ranks by gross and keeps every day in the series', () => {
    const lines = [line({ courseId: 'a', priceCents: 500 }), line({ courseId: 'b', priceCents: 2000 }), line({ courseId: 'a', priceCents: 500 })];
    expect(rankBy(lines, (l) => l.courseId).map((r) => [r.key, r.grossCents, r.sales])).toEqual([['b', 2000, 1], ['a', 1000, 2]]);
    const s = platformSeries(lines, ['2026-11-19', '2026-11-20', '2026-11-21'], dayKey);
    expect(s.map((d) => d.grossCents)).toEqual([0, 3000, 0]);
  });
});
