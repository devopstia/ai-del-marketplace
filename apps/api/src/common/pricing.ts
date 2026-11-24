import { z } from 'zod';

/**
 * Course pricing rules (single source of truth; the web reads them from GET /platform/terms):
 * a course is free (0) or costs between $4.99 and $999.99. Money is integer cents, currency usd.
 */
export const PRICE_MIN_CENTS = 499;
export const PRICE_MAX_CENTS = 99999;
export const CURRENCY = 'usd';
/** Default platform commission for independent instructors (20%: instructors keep 80%). */
export const DEFAULT_COMMISSION_BPS = 2000;

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const PRICE_RULE_MESSAGE = `Price must be 0 (free) or between ${usd(PRICE_MIN_CENTS)} and ${usd(PRICE_MAX_CENTS)}`;

export function isValidPrice(cents: number): boolean {
  return Number.isInteger(cents) && (cents === 0 || (cents >= PRICE_MIN_CENTS && cents <= PRICE_MAX_CENTS));
}

/** Zod field for `priceCents`; its message is shown to instructors as-is. */
export const priceCentsSchema = z
  .number({ error: 'Price must be a number of cents (for example 2999 for $29.99)' })
  .refine(isValidPrice, { message: PRICE_RULE_MESSAGE });
