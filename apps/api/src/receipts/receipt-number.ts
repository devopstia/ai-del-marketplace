import type { Tx } from '../common/prisma.service';

/**
 * Receipt and order references (owner 2026-11-27, docs/RECEIPTS.md). The internal uuid stays the key everywhere; the
 * customer sees a short receipt number (DEL-RCP-<year>-<6 digits>, one database sequence, assigned once at payment)
 * and a short order reference derived from the uuid.
 */
export const formatReceiptNumber = (year: number, n: number | bigint) => `DEL-RCP-${year}-${String(n).padStart(6, '0')}`;
export const RECEIPT_NUMBER_RE = /^DEL-RCP-\d{4}-\d{6,}$/;

// Crockford base32 (no I, L, O, U): easy to read aloud and to type.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ORD- + 8 characters = the first 40 bits of the order uuid. Deterministic, nothing stored. */
export function orderRef(id: string): string {
  const hex = id.replace(/-/g, '').slice(0, 10);
  let n = BigInt(`0x${hex}`);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out = B32[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return `ORD-${out}`;
}

/** The uuid prefix (10 hex characters) an order reference stands for, or null when it isn't one. */
export function orderRefToIdPrefix(ref: string): string | null {
  const m = ref.trim().toUpperCase().match(/^ORD-?([0-9A-HJKMNP-TV-Z]{8})$/);
  if (!m) return null;
  let n = 0n;
  for (const c of m[1]!) n = (n << 5n) | BigInt(B32.indexOf(c));
  const hex = n.toString(16).padStart(10, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8)}`;
}

/**
 * Gives a paid order its receipt number, once. Runs inside the fulfilment transaction right after the order flips to
 * paid, so a duplicate webhook (which doesn't flip it again) never reaches it; the `receiptNumber: null` guard makes
 * even a repeated call harmless.
 */
export async function assignReceiptNumber(tx: Tx, orderId: string, paidAt: Date): Promise<string | null> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('receipt_number_seq') AS n`;
  const number = formatReceiptNumber(paidAt.getUTCFullYear(), rows[0]!.n);
  const r = await tx.order.updateMany({ where: { id: orderId, receiptNumber: null }, data: { receiptNumber: number } });
  return r.count ? number : null;
}
