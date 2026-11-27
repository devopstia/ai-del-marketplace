import { PDFDocument } from 'pdf-lib';
import { buildReceipt, money, paymentMethodLabel, type ReceiptOrder } from './receipt-model';
import { assignReceiptNumber, formatReceiptNumber, orderRef, orderRefToIdPrefix, RECEIPT_NUMBER_RE } from './receipt-number';
import { PAPER, renderReceiptPdf } from './receipt-pdf';

const company = { legalName: 'DevOps Easy Learning', address: [], supportEmail: 'support@devopseasylearning.com', website: 'ai-devopseasylearning.com', taxId: null };
const order = (over: Partial<ReceiptOrder> = {}): ReceiptOrder => ({
  id: '189f5252-2543-4634-a1ca-8d2d35556d0c', status: 'paid', totalCents: 499, currency: 'usd', provider: 'stripe',
  createdAt: new Date('2026-11-27T03:18:48Z'), paidAt: new Date('2026-11-27T03:20:59Z'), taxCents: 0, receiptNumber: 'DEL-RCP-2026-000001',
  stripePaymentIntentId: 'pi_3QbX9cL2wR8kTq1A', stripeChargeId: 'ch_1', paymentBrand: 'visa', paymentLast4: '4242', paymentWallet: null,
  user: { name: 'Amara Okafor', email: 'amara@example.com' },
  lines: [{ priceCents: 499, listPriceCents: 499, saleKind: null, refundedAt: null, course: { title: 'AI-Powered DevOps Automation with n8n' } }],
  ...over,
});

describe('receipt numbers and references', () => {
  it('formats DEL-RCP-<year>-<6 digits>', () => {
    expect(formatReceiptNumber(2026, 1)).toBe('DEL-RCP-2026-000001');
    expect(formatReceiptNumber(2027, 1234567n)).toBe('DEL-RCP-2027-1234567');
    expect(RECEIPT_NUMBER_RE.test('DEL-RCP-2026-000123')).toBe(true);
  });
  it('order reference: ORD- + 8 characters, deterministic and reversible to the uuid prefix', () => {
    const id = '189f5252-2543-4634-a1ca-8d2d35556d0c';
    const ref = orderRef(id);
    expect(ref).toMatch(/^ORD-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(orderRef(id)).toBe(ref);
    expect(orderRefToIdPrefix(ref)).toBe('189f5252-25');
    expect(orderRefToIdPrefix(ref.toLowerCase())).toBe('189f5252-25');
    expect(orderRefToIdPrefix('DEL-RCP-2026-000001')).toBeNull();
  });
  it('assigns a number only while the order has none', async () => {
    let n = 0;
    const store: { receiptNumber: string | null } = { receiptNumber: null };
    const tx: any = {
      $queryRaw: jest.fn(async () => [{ n: BigInt(++n) }]),
      order: { updateMany: jest.fn(async ({ data }: any) => (store.receiptNumber ? { count: 0 } : (Object.assign(store, data), { count: 1 }))) },
    };
    expect(await assignReceiptNumber(tx, 'o1', new Date('2026-12-31T23:59:00Z'))).toBe('DEL-RCP-2026-000001');
    expect(await assignReceiptNumber(tx, 'o1', new Date('2026-12-31T23:59:00Z'))).toBeNull();
    expect(store.receiptNumber).toBe('DEL-RCP-2026-000001');
  });
});

describe('receipt totals come from the order as recorded', () => {
  it('one course', () => {
    const r = buildReceipt(order(), company);
    expect(r).toMatchObject({ subtotalCents: 499, discountCents: 0, tax: null, totalCents: 499, refundedCents: 0, netCents: 499, statusLabel: 'Paid', paymentMethod: 'Visa ending in 4242', currency: 'USD' });
  });
  it('several courses with a sale and tax added on top', () => {
    const r = buildReceipt(order({
      totalCents: 6998 + 1400, taxCents: 1400,
      lines: [
        { priceCents: 1500, listPriceCents: 1500, saleKind: null, refundedAt: null, course: { title: 'A' } },
        { priceCents: 3499, listPriceCents: 4999, saleKind: 'promotion', refundedAt: null, course: { title: 'B' } },
        { priceCents: 1999, listPriceCents: null, saleKind: null, refundedAt: null, course: { title: 'C' } },
      ],
    }), company);
    expect(r.subtotalCents).toBe(8498);
    expect(r.discountCents).toBe(1500);
    expect(r.lines[1]).toMatchObject({ unitCents: 4999, discountCents: 1500, amountCents: 3499, discountLabel: 'Marketplace promotion' });
    expect(r.tax).toEqual({ cents: 1400, included: false });
    expect(r.totalCents).toBe(8398);
  });
  it('tax included in the prices', () => {
    expect(buildReceipt(order({ taxCents: 83 }), company).tax).toEqual({ cents: 83, included: true });
  });
  it('partial and full refunds', () => {
    const lines = [
      { priceCents: 1500, listPriceCents: 1500, saleKind: null, refundedAt: null, course: { title: 'A' } },
      { priceCents: 1999, listPriceCents: 1999, saleKind: null, refundedAt: new Date('2026-12-09T10:00:00Z'), course: { title: 'C' } },
    ];
    const part = buildReceipt(order({ status: 'partially_refunded', totalCents: 3499, lines }), company);
    expect(part).toMatchObject({ statusLabel: 'Paid · partly refunded', refundedCents: 1999, netCents: 1500 });
    expect(part.refunds).toEqual([{ title: 'C', at: '2026-12-09T10:00:00.000Z', cents: 1999 }]);
    const full = buildReceipt(order({ status: 'refunded', lines: [{ ...order().lines[0]!, refundedAt: new Date('2026-12-01T00:00:00Z') }] }), company);
    expect(full).toMatchObject({ statusLabel: 'Refunded', netCents: 0 });
  });
  it('payment method shows at most the last four digits', () => {
    expect(paymentMethodLabel({ provider: 'stripe', paymentBrand: 'mastercard', paymentLast4: '5454', paymentWallet: 'apple_pay', totalCents: 1 })).toBe('Apple Pay (Mastercard ending in 5454)');
    expect(paymentMethodLabel({ provider: 'stripe', paymentBrand: 'visa', paymentLast4: '4242424242424242', paymentWallet: null, totalCents: 1 })).toBe('Visa');
    expect(paymentMethodLabel({ provider: 'test', paymentBrand: null, paymentLast4: null, paymentWallet: null, totalCents: 1 })).toBe('Test payment');
    expect(paymentMethodLabel({ provider: 'free', paymentBrand: null, paymentLast4: null, paymentWallet: null, totalCents: 0 })).toBe('Free');
  });
  it('money', () => {
    expect(money(123456)).toBe('$1,234.56');
    expect(money(-500)).toBe('−$5.00');
  });
});

describe('receipt PDF', () => {
  jest.setTimeout(30_000);
  it.each(['letter', 'a4'] as const)('one page at the exact %s size for a normal order', async (paper) => {
    const { pdf, pages } = await renderReceiptPdf(buildReceipt(order(), company), paper);
    expect(pages).toBe(1);
    const doc = await PDFDocument.load(pdf);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual(PAPER[paper].map(Math.round));
    expect(doc.getTitle()).toBe('Receipt DEL-RCP-2026-000001');
  });
  it('long names, emails and titles still fit one page', async () => {
    const r = buildReceipt(order({
      user: { name: 'Maximiliana Alexandra Fitzgerald-Okonkwo', email: 'm.fitzgerald-okonkwo@northwind-cloud-consulting.example' },
      lines: [{ priceCents: 3499, listPriceCents: 4999, saleKind: 'course_sale', refundedAt: null, course: { title: 'AI for DevOps: from the vocabulary of AI to agents in production on AWS and Azure, with Terraform and GitHub Actions' } }],
      totalCents: 3499,
    }), { ...company, address: ['221B Sample Street', 'London EC1A 1BB', 'United Kingdom'], taxId: 'GB123456789' });
    expect((await renderReceiptPdf(r, 'letter')).pages).toBe(1);
  });
  it('a large order continues on a second page', async () => {
    const lines = Array.from({ length: 26 }, (_, i) => ({ priceCents: 1999, listPriceCents: 1999, saleKind: null, refundedAt: null, course: { title: `Course number ${i + 1}: a fairly long title that wraps onto a second line in the table` } }));
    const { pages } = await renderReceiptPdf(buildReceipt(order({ lines, totalCents: 1999 * 26 }), company), 'a4');
    expect(pages).toBe(2);
  });
});
