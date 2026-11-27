import { orderRef } from './receipt-number';

/**
 * The receipt as data (owner 2026-11-27, docs/RECEIPTS.md). One view model feeds the web page and the PDF, so they
 * always agree. Every amount comes from what was recorded at purchase (order lines, tax, refunds), never from today's
 * course price.
 */
export interface Company { legalName: string; address: string[]; supportEmail: string; website: string; taxId: string | null }

export interface ReceiptLine { title: string; quantity: number; unitCents: number; discountCents: number; amountCents: number; discountLabel: string | null; refundedAt: string | null }

export interface Receipt {
  orderId: string;
  receiptNumber: string;
  orderRef: string;
  status: 'paid' | 'partially_refunded' | 'refunded';
  statusLabel: string;
  purchasedAt: string;
  paidAt: string | null;
  paymentMethod: string;
  transactionRef: string | null;
  currency: string;
  customer: { name: string; email: string };
  company: Company;
  lines: ReceiptLine[];
  subtotalCents: number;
  discountCents: number;
  tax: { cents: number; included: boolean } | null;
  totalCents: number;
  refunds: { title: string; at: string; cents: number }[];
  refundedCents: number;
  netCents: number;
}

export interface ReceiptOrder {
  id: string; status: string; totalCents: number; currency: string; provider: string; createdAt: Date; paidAt: Date | null;
  taxCents: number; receiptNumber: string | null; stripePaymentIntentId: string | null; stripeChargeId: string | null;
  paymentBrand: string | null; paymentLast4: string | null; paymentWallet: string | null;
  user: { name: string; email: string };
  lines: { priceCents: number; listPriceCents: number | null; saleKind: string | null; refundedAt: Date | null; course: { title: string } }[];
}

export const RECEIPT_STATUSES = ['paid', 'partially_refunded', 'refunded'] as const;
const BRANDS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay', cartes_bancaires: 'Cartes Bancaires', link: 'Link' };
const WALLETS: Record<string, string> = { apple_pay: 'Apple Pay', google_pay: 'Google Pay', link: 'Link', samsung_pay: 'Samsung Pay' };

/** "Visa ending in 4242", "Apple Pay (Visa ending in 4242)", "Test payment"; never more than the last four digits. */
export function paymentMethodLabel(o: Pick<ReceiptOrder, 'provider' | 'paymentBrand' | 'paymentLast4' | 'paymentWallet' | 'totalCents'>): string {
  if (o.provider === 'free' || o.totalCents === 0) return 'Free';
  if (o.provider === 'test') return 'Test payment';
  const brand = o.paymentBrand ? BRANDS[o.paymentBrand] ?? o.paymentBrand.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null;
  const last4 = o.paymentLast4 && /^\d{4}$/.test(o.paymentLast4) ? o.paymentLast4 : null;
  const card = brand && last4 ? `${brand} ending in ${last4}` : brand ?? 'Card';
  const wallet = o.paymentWallet ? WALLETS[o.paymentWallet] ?? null : null;
  return wallet ? `${wallet} (${card})` : card;
}

const SALE: Record<string, string> = { course_sale: 'Course sale', promotion: 'Marketplace promotion' };

export function buildReceipt(o: ReceiptOrder, company: Company): Receipt {
  const lines: ReceiptLine[] = o.lines.map((l) => {
    const unit = Math.max(l.listPriceCents ?? l.priceCents, l.priceCents);
    return { title: l.course.title, quantity: 1, unitCents: unit, discountCents: unit - l.priceCents, amountCents: l.priceCents, discountLabel: unit > l.priceCents ? SALE[l.saleKind ?? ''] ?? 'Discount' : null, refundedAt: l.refundedAt?.toISOString() ?? null };
  });
  const subtotal = lines.reduce((n, l) => n + l.unitCents, 0);
  const discount = lines.reduce((n, l) => n + l.discountCents, 0);
  const tax = o.taxCents > 0 ? { cents: o.taxCents, included: subtotal - discount + o.taxCents !== o.totalCents } : null;
  const refunds = o.lines.filter((l) => l.refundedAt).map((l) => ({ title: l.course.title, at: l.refundedAt!.toISOString(), cents: l.priceCents }));
  const refunded = refunds.reduce((n, r) => n + r.cents, 0);
  const status = (RECEIPT_STATUSES as readonly string[]).includes(o.status) ? (o.status as Receipt['status']) : 'paid';
  return {
    orderId: o.id,
    receiptNumber: o.receiptNumber ?? orderRef(o.id),
    orderRef: orderRef(o.id),
    status,
    statusLabel: status === 'refunded' ? 'Refunded' : status === 'partially_refunded' ? 'Paid · partly refunded' : 'Paid',
    purchasedAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    paymentMethod: paymentMethodLabel(o),
    transactionRef: o.provider === 'stripe' ? o.stripePaymentIntentId ?? o.stripeChargeId : null,
    currency: o.currency.toUpperCase(),
    customer: { name: o.user.name, email: o.user.email },
    company,
    lines,
    subtotalCents: subtotal,
    discountCents: discount,
    tax,
    totalCents: o.totalCents,
    refunds,
    refundedCents: refunded,
    netCents: o.totalCents - refunded,
  };
}

export function money(cents: number, currency = 'USD') {
  const sym = currency === 'USD' ? '$' : '';
  const v = (Math.abs(cents) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${cents < 0 ? '−' : ''}${sym}${v}${sym ? '' : ` ${currency}`}`;
}

/** "Nov 27, 2026" and "Nov 27, 2026, 3:20 AM UTC": receipts use UTC so the PDF and the page agree. */
export function receiptDate(iso: string | null, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return withTime ? `${date}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC` : date;
}
