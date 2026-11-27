/**
 * Admin / Super Admin dashboard: pure helpers (owner 2026-11-27, Option A "Enterprise Analytics", phase 3;
 * docs/DASHBOARD_DESIGN.md). Reporting only: amounts are the order-line snapshots taken at purchase.
 */
import type { SaleLine } from '../instructor/dashboard';

export interface MarketMoney {
  grossCents: number;
  feesCents: number;
  refundsCents: number;
  /** Instructor share of lines not refunded that go to an independent instructor (payee = instructor). */
  instructorEarningsCents: number;
  /** What DEL kept: gross − fees − refunds − instructor earnings. */
  platformNetCents: number;
  /** Part of platformNet from DEL-owned courses and DEL agreements (payee = platform | del_agreement). */
  delCoursesNetCents: number;
  /** Part of platformNet that is commission on independent instructors' sales (payee = instructor). */
  commissionCents: number;
  sales: number;
}

/**
 * Per line: gross = price; fee = Stripe's fee (kept by Stripe after a refund); a refunded line gives its price back and
 * earns nobody a share. For an independent instructor's line DEL keeps price − fee − share (the commission); for DEL's
 * own lines and DEL-agreement lines DEL keeps price − fee (the share, if any, is DEL's too).
 */
export function marketMoney(lines: SaleLine[]): MarketMoney {
  const m: MarketMoney = { grossCents: 0, feesCents: 0, refundsCents: 0, instructorEarningsCents: 0, platformNetCents: 0, delCoursesNetCents: 0, commissionCents: 0, sales: 0 };
  for (const l of lines) {
    m.sales++;
    m.grossCents += l.priceCents;
    m.feesCents += l.feeCents;
    const refund = l.refundedAt ? l.priceCents : 0;
    m.refundsCents += refund;
    const kept = l.priceCents - l.feeCents - refund;
    if (l.payee === 'instructor') {
      const share = l.refundedAt ? 0 : l.instructorShareCents;
      m.instructorEarningsCents += share;
      m.commissionCents += kept - share;
    } else {
      m.delCoursesNetCents += kept;
    }
  }
  m.platformNetCents = m.delCoursesNetCents + m.commissionCents;
  return m;
}

/** Revenue per key (course or instructor), largest gross first. */
export function rankBy<T extends SaleLine>(lines: T[], key: (l: T) => string, limit = 8): { key: string; grossCents: number; platformNetCents: number; sales: number }[] {
  const groups = new Map<string, T[]>();
  for (const l of lines) groups.set(key(l), [...(groups.get(key(l)) ?? []), l]);
  return [...groups]
    .map(([k, v]) => { const m = marketMoney(v); return { key: k, grossCents: m.grossCents, platformNetCents: m.platformNetCents, sales: m.sales }; })
    .sort((a, b) => b.grossCents - a.grossCents)
    .slice(0, limit);
}

/** Daily gross and DEL (platform) net over a period, every day present (same rule as the instructor chart). */
export function platformSeries(lines: SaleLine[], days: string[], dayOf: (d: Date) => string) {
  const out = new Map(days.map((d) => [d, { date: d, grossCents: 0, netCents: 0, sales: 0 }]));
  for (const l of lines) {
    const row = out.get(dayOf(l.paidAt));
    if (!row) continue;
    row.sales++;
    row.grossCents += l.priceCents;
    row.netCents += marketMoney([l]).platformNetCents;
  }
  return [...out.values()];
}
