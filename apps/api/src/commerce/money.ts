/**
 * Marketplace money rules (owner decision 2026-11-24, docs/PAYMENTS_PROPOSAL.md). Pure functions, integer cents only.
 *
 *   base        = price paid for the course (after discount, excluding tax)
 *   fee         = the order's Stripe fee, allocated to lines in proportion to their base (largest remainder)
 *   net         = base - fee
 *   instructor  = round_half_up(net * (10000 - platformBps) / 10000)
 *   platform    = net - instructor
 */

/** Refunds: 14 days from purchase, under 25% of the course video watched, no certificate, 3 self-service refunds a year. */
export const REFUND_WINDOW_DAYS = 14;
export const REFUND_MAX_WATCHED = 0.25;
export const REFUND_AUTO_LIMIT_PER_YEAR = 3;
/** Instructor shares wait until the refund window has closed (+2 days buffer) before they are transferred. */
export const PAYOUT_HOLD_DAYS = REFUND_WINDOW_DAYS + 2;
const DAY = 24 * 60 * 60 * 1000;

export const refundDeadline = (paidAt: Date) => new Date(paidAt.getTime() + REFUND_WINDOW_DAYS * DAY);
export const transferDueAt = (paidAt: Date) => new Date(paidAt.getTime() + PAYOUT_HOLD_DAYS * DAY);

const assertCents = (n: number, what: string) => {
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what} must be a non-negative integer number of cents`);
};

/** Splits `fee` across `bases` in proportion, so the parts always add up to `fee` exactly (largest-remainder method). */
export function allocateFee(feeCents: number, bases: number[]): number[] {
  assertCents(feeCents, 'fee');
  bases.forEach((b) => assertCents(b, 'base'));
  const total = bases.reduce((a, b) => a + b, 0);
  if (!total || !feeCents) return bases.map(() => 0);
  if (feeCents > total) throw new Error('fee cannot exceed the amount paid');
  const exact = bases.map((b) => (feeCents * b) / total);
  const parts = exact.map(Math.floor);
  let left = feeCents - parts.reduce((a, b) => a + b, 0);
  // Hand the leftover cents to the largest fractional parts; ties go to the earlier line (stable, deterministic).
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (!left) break;
    parts[i]! += 1;
    left -= 1;
  }
  return parts;
}

export interface LineSplit {
  feeCents: number;
  netCents: number;
  instructorShareCents: number;
  platformCents: number;
}

/** `platformBps`: the platform's share of the net (2000 = 20%, the instructor keeps 80%). 10000 = all to the platform. */
export function splitLine(baseCents: number, feeCents: number, platformBps: number): LineSplit {
  assertCents(baseCents, 'base');
  assertCents(feeCents, 'fee');
  if (!Number.isInteger(platformBps) || platformBps < 0 || platformBps > 10000) throw new Error('platformBps must be 0..10000');
  if (feeCents > baseCents) throw new Error('fee cannot exceed the line amount');
  const netCents = baseCents - feeCents;
  // round half up on an exact integer numerator: no floating point drift
  const instructorShareCents = Math.floor((netCents * (10000 - platformBps) * 2 + 10000) / 20000);
  return { feeCents, netCents, instructorShareCents, platformCents: netCents - instructorShareCents };
}

/** Splits a whole order once its Stripe fee is known. */
export function splitOrder(feeCents: number, lines: { baseCents: number; platformBps: number }[]): LineSplit[] {
  const fees = allocateFee(feeCents, lines.map((l) => l.baseCents));
  return lines.map((l, i) => splitLine(l.baseCents, fees[i]!, l.platformBps));
}

/**
 * Development test payments have no real Stripe fee; we simulate Stripe's standard US card price (2.9% + 30¢)
 * so the whole split, hold and refund path is exercised locally. Never used for real Stripe orders.
 */
export function simulatedStripeFee(totalCents: number): number {
  assertCents(totalCents, 'total');
  return totalCents ? Math.min(totalCents, Math.round(totalCents * 0.029) + 30) : 0;
}
