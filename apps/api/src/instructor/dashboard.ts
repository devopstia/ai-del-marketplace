/**
 * Instructor / DEL Studio dashboard: pure helpers (owner 2026-11-27, Option A "Enterprise Analytics"; docs/DASHBOARD_DESIGN.md).
 * Ranges are whole UTC days; the previous period is the same number of days immediately before.
 */
export type RangeKey = 'today' | '7d' | '30d' | '90d' | 'month' | 'year' | 'custom';
export const RANGE_KEYS: RangeKey[] = ['today', '7d', '30d', '90d', 'month', 'year', 'custom'];
export const MAX_RANGE_DAYS = 731;

export interface Period { from: Date; to: Date; days: number }
export interface Range { key: RangeKey; current: Period; previous: Period }

const DAY = 86_400_000;
const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
export const dayKey = (d: Date) => utcDay(d).toISOString().slice(0, 10);

/** from = start of the first day (inclusive), to = start of the day after the last day (exclusive). */
export function resolveRange(key: RangeKey = '30d', now = new Date(), customFrom?: Date, customTo?: Date): Range {
  const today = utcDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  let from: Date;
  let to = tomorrow;
  switch (key) {
    case 'today': from = today; break;
    case '7d': from = new Date(tomorrow.getTime() - 7 * DAY); break;
    case '90d': from = new Date(tomorrow.getTime() - 90 * DAY); break;
    case 'month': from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)); break;
    case 'year': from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1)); break;
    case 'custom': {
      if (!customFrom || !customTo) return resolveRange('30d', now);
      const a = utcDay(customFrom < customTo ? customFrom : customTo);
      const b = utcDay(customFrom < customTo ? customTo : customFrom);
      from = a;
      to = new Date(Math.min(b.getTime() + DAY, a.getTime() + MAX_RANGE_DAYS * DAY));
      break;
    }
    default: from = new Date(tomorrow.getTime() - 30 * DAY);
  }
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY));
  const prevTo = from;
  const prevFrom = new Date(from.getTime() - days * DAY);
  return { key, current: { from, to, days }, previous: { from: prevFrom, to: prevTo, days } };
}

/** One sold course line, as the dashboard needs it (all amounts in cents, from order_lines at purchase time). */
export interface SaleLine { paidAt: Date; courseId: string; priceCents: number; feeCents: number; instructorShareCents: number; refundedAt: Date | null; transferStatus: string; payee: string }

export interface Money { grossCents: number; feesCents: number; refundsCents: number; netCents: number; instructorShareCents: number; sales: number }

/**
 * Gross = every paid line (refunded later or not); refunds = the price of refunded lines; fees = Stripe's fee on every
 * line (Stripe keeps it after a refund); net = gross − fees − refunds (what the business kept). Instructor share counts
 * only lines that were not refunded (the same rule as /instructor/sales).
 */
export function money(lines: SaleLine[]): Money {
  const m: Money = { grossCents: 0, feesCents: 0, refundsCents: 0, netCents: 0, instructorShareCents: 0, sales: 0 };
  for (const l of lines) {
    m.sales++;
    m.grossCents += l.priceCents;
    m.feesCents += l.feeCents;
    if (l.refundedAt) m.refundsCents += l.priceCents;
    else m.instructorShareCents += l.instructorShareCents;
  }
  m.netCents = m.grossCents - m.feesCents - m.refundsCents;
  return m;
}

/** Daily gross and net over a period (every day present, zeros included) so the chart never invents or skips days. */
export function dailySeries(lines: SaleLine[], p: Period): { date: string; grossCents: number; netCents: number; sales: number }[] {
  const out = new Map<string, { date: string; grossCents: number; netCents: number; sales: number }>();
  for (let t = p.from.getTime(); t < p.to.getTime(); t += DAY) {
    const k = dayKey(new Date(t));
    out.set(k, { date: k, grossCents: 0, netCents: 0, sales: 0 });
  }
  for (const l of lines) {
    const row = out.get(dayKey(l.paidAt));
    if (!row) continue;
    row.sales++;
    row.grossCents += l.priceCents;
    row.netCents += l.priceCents - l.feeCents - (l.refundedAt ? l.priceCents : 0);
  }
  return [...out.values()];
}

export function byCourse(lines: SaleLine[]): Map<string, Money> {
  const groups = new Map<string, SaleLine[]>();
  for (const l of lines) groups.set(l.courseId, [...(groups.get(l.courseId) ?? []), l]);
  return new Map([...groups].map(([k, v]) => [k, money(v)]));
}

/** Who keeps the money on this account's courses. Reporting only: the split itself is snapshotted on each order line. */
export type Ownership = 'platform' | 'del_agreement' | 'revenue_share';
export function ownershipOf(p: { isPlatform?: boolean | null; payToPlatform?: boolean | null } | null | undefined): Ownership {
  if (p?.isPlatform) return 'platform';
  if (p?.payToPlatform) return 'del_agreement';
  return 'revenue_share';
}

/** Average of per-learner progress (completed lessons ÷ the course's lessons), 0..100; null when nobody is enrolled. */
export function averageProgress(perLearner: { completed: number; total: number }[]): number | null {
  const rows = perLearner.filter((r) => r.total > 0);
  if (!rows.length) return null;
  return Math.round((rows.reduce((a, r) => a + Math.min(1, r.completed / r.total), 0) / rows.length) * 100);
}

export const pct = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);
