import { averageProgress, dailySeries, money, ownershipOf, pct, resolveRange, type SaleLine } from './dashboard';

const now = new Date('2026-11-27T15:30:00Z');
const line = (day: string, price: number, fee: number, share: number, refunded = false, courseId = 'c1'): SaleLine => ({
  paidAt: new Date(`${day}T10:00:00Z`), courseId, priceCents: price, feeCents: fee, instructorShareCents: share, refundedAt: refunded ? new Date() : null, transferStatus: 'none', payee: 'platform',
});

describe('dashboard ranges', () => {
  it('30d ends today (inclusive) and the previous period is the 30 days before', () => {
    const r = resolveRange('30d', now);
    expect(r.current.to.toISOString()).toBe('2026-11-28T00:00:00.000Z');
    expect(r.current.from.toISOString()).toBe('2026-10-29T00:00:00.000Z');
    expect(r.current.days).toBe(30);
    expect(r.previous.to.toISOString()).toBe(r.current.from.toISOString());
    expect(r.previous.from.toISOString()).toBe('2026-09-29T00:00:00.000Z');
  });
  it('today, this month, this year', () => {
    expect(resolveRange('today', now).current.days).toBe(1);
    expect(resolveRange('month', now).current.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(resolveRange('year', now).current.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
  it('custom swaps reversed dates, includes the last day and caps the length', () => {
    const r = resolveRange('custom', now, new Date('2026-11-10'), new Date('2026-11-01'));
    expect(r.current.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(r.current.to.toISOString()).toBe('2026-11-11T00:00:00.000Z');
    expect(resolveRange('custom', now, new Date('2000-01-01'), new Date('2026-01-01')).current.days).toBe(731);
    expect(resolveRange('custom', now).current.days).toBe(30); // missing dates → 30 days
  });
});

describe('dashboard money', () => {
  it('a DEL-owned $4.99 sale: gross 4.99, Stripe fee 0.44, DEL net 4.55, instructor share 0', () => {
    const m = money([line('2026-11-27', 499, 44, 0)]);
    expect(m).toEqual({ grossCents: 499, feesCents: 44, refundsCents: 0, netCents: 455, instructorShareCents: 0, sales: 1 });
  });
  it('refunds reduce net by the price, keep the fee, and drop the instructor share', () => {
    const m = money([line('2026-11-20', 2000, 88, 1424), line('2026-11-21', 1000, 59, 753, true)]);
    expect(m.grossCents).toBe(3000);
    expect(m.refundsCents).toBe(1000);
    expect(m.feesCents).toBe(147);
    expect(m.netCents).toBe(3000 - 147 - 1000);
    expect(m.instructorShareCents).toBe(1424);
  });
  it('daily series has every day of the range, zeros included', () => {
    const r = resolveRange('7d', now);
    const s = dailySeries([line('2026-11-27', 499, 44, 0), line('2026-11-01', 999, 50, 0)], r.current);
    expect(s).toHaveLength(7);
    expect(s[6]).toEqual({ date: '2026-11-27', grossCents: 499, netCents: 455, sales: 1 });
    expect(s.slice(0, 6).every((d) => d.grossCents === 0)).toBe(true);
  });
});

describe('dashboard helpers', () => {
  it('ownership follows the profile', () => {
    expect(ownershipOf({ isPlatform: true })).toBe('platform');
    expect(ownershipOf({ payToPlatform: true })).toBe('del_agreement');
    expect(ownershipOf({})).toBe('revenue_share');
    expect(ownershipOf(null)).toBe('revenue_share');
  });
  it('progress and percentages', () => {
    expect(averageProgress([])).toBeNull();
    expect(averageProgress([{ completed: 5, total: 10 }, { completed: 10, total: 10 }, { completed: 0, total: 0 }])).toBe(75);
    expect(pct(1, 0)).toBeNull();
    expect(pct(1, 3)).toBe(33);
  });
});
