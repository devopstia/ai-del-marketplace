import fontkit from '@pdf-lib/fontkit';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LineCapStyle, PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import { money, receiptDate, type Receipt } from './receipt-model';

/**
 * The official receipt as a PDF (owner 2026-11-27, "Corporate Professional", docs/RECEIPTS.md). Vector text with the
 * site's fonts embedded (selectable, sharp at any zoom), laid out to match the web receipt
 * (apps/web/src/components/receipt/ReceiptDocument.tsx). Letter or A4; a long order continues on a second page with
 * the table header repeated; the totals and footer always end the last page.
 */
export type Paper = 'letter' | 'a4';
export const PAPER: Record<Paper, [number, number]> = { letter: [612, 792], a4: [595.28, 841.89] };
export const RECEIPT_PDF_VERSION = 'r1';

const INK = rgb(0x14 / 255, 0x18 / 255, 0x33 / 255);
const MUTED = rgb(0x5b / 255, 0x61 / 255, 0x78 / 255);
const LINE = rgb(0xdf / 255, 0xe2 / 255, 0xec / 255);
const ROW = rgb(0xe6 / 255, 0xe8 / 255, 0xf0 / 255);
const HEAD_BG = rgb(0xf4 / 255, 0xf5 / 255, 0xfa / 255);
const VIOLET = rgb(0x4f / 255, 0x3f / 255, 0xb0 / 255);
const CYAN = rgb(0x1e / 255, 0x9b / 255, 0xd7 / 255);
const OK_BG = rgb(0xe5 / 255, 0xf6 / 255, 0xec / 255);
const OK_FG = rgb(0x11 / 255, 0x68 / 255, 0x3a / 255);
const WARN_BG = rgb(1, 0xf3 / 255, 0xdf / 255);
const WARN_FG = rgb(0x8a / 255, 0x4b / 255, 0);

const LOOP_LEFT = 'M60,30 C48,14 34,8 22,10 C10,12 4,22 4,30 C4,38 10,48 22,50 C34,52 48,46 60,30';
const LOOP_RIGHT = 'M60,30 C72,46 86,52 98,50 C110,48 116,38 116,30 C116,22 110,12 98,10 C86,8 72,14 60,30';

function fontDir() {
  for (const d of [join(__dirname, '..', '..', 'assets', 'fonts'), join(process.cwd(), 'assets', 'fonts'), join(process.cwd(), 'apps', 'api', 'assets', 'fonts')]) {
    if (existsSync(join(d, 'AtkinsonHyperlegibleNext-400.ttf'))) return d;
  }
  throw new Error('Receipt fonts not found (apps/api/assets/fonts)');
}
let fontBytes: Record<string, Buffer> | null = null;
function bytes() {
  if (fontBytes) return fontBytes;
  const d = fontDir();
  fontBytes = {
    text: readFileSync(join(d, 'AtkinsonHyperlegibleNext-400.ttf')),
    textBold: readFileSync(join(d, 'AtkinsonHyperlegibleNext-600.ttf')),
    head: readFileSync(join(d, 'SchibstedGrotesk-700.ttf')),
    heavy: readFileSync(join(d, 'SchibstedGrotesk-800.ttf')),
    mono: readFileSync(join(d, 'JetBrainsMono-400.ttf')),
  };
  return fontBytes;
}

interface Fonts { text: PDFFont; textBold: PDFFont; head: PDFFont; heavy: PDFFont; mono: PDFFont }

/** Words into lines no wider than `w`; a single word longer than the line is broken by characters. */
export function wrap(text: string, font: PDFFont, size: number, w: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= w) { cur = next; continue; }
    if (cur) out.push(cur);
    if (font.widthOfTextAtSize(word, size) <= w) { cur = word; continue; }
    let part = '';
    for (const ch of word) {
      if (font.widthOfTextAtSize(part + ch, size) > w) { out.push(part); part = ch; } else part += ch;
    }
    cur = part;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

export async function renderReceiptPdf(r: Receipt, paper: Paper = 'letter'): Promise<{ pdf: Uint8Array; pages: number }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const b = bytes();
  const f: Fonts = {
    text: await doc.embedFont(b.text, { subset: true }),
    textBold: await doc.embedFont(b.textBold, { subset: true }),
    head: await doc.embedFont(b.head, { subset: true }),
    heavy: await doc.embedFont(b.heavy, { subset: true }),
    mono: await doc.embedFont(b.mono, { subset: true }),
  };
  doc.setTitle(`Receipt ${r.receiptNumber}`);
  doc.setAuthor(r.company.legalName);
  doc.setSubject(`Receipt for order ${r.orderRef}`);
  doc.setCreator('DevOps Easy Learning');
  doc.setProducer('DevOps Easy Learning receipts');
  doc.setCreationDate(new Date(r.paidAt ?? r.purchasedAt));

  const [W, H] = PAPER[paper];
  const M = 46; // side margin
  const CW = W - 2 * M;
  let page!: PDFPage;
  let y = 0; // distance from the top
  const T = (s: string, x: number, top: number, font: PDFFont, size: number, color = INK, align: 'left' | 'right' | 'center' = 'left') => {
    const w = font.widthOfTextAtSize(s, size);
    const xx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    page.drawText(s, { x: xx, y: H - top - size * 0.8, size, font, color });
    return w;
  };
  const rule = (top: number, thickness = 1, color = LINE, x1 = M, x2 = W - M) => page.drawLine({ start: { x: x1, y: H - top }, end: { x: x2, y: H - top }, thickness, color });
  const logo = (x: number, top: number, scale: number) => {
    for (const [d, c] of [[LOOP_LEFT, VIOLET], [LOOP_RIGHT, CYAN], ['M50,17 L60,30', VIOLET]] as const) {
      page.drawSvgPath(d, { x, y: H - top, scale, borderColor: c, borderWidth: 10, borderLineCap: LineCapStyle.Round });
    }
  };

  // Columns of the course table: Course | Qty | Unit price | Discount | Amount
  const col = { qty: M + CW - 250, unit: M + CW - 170, disc: M + CW - 85, amt: M + CW - 8 };
  const titleW = col.qty - 30 - (M + 8);
  const tableHead = () => {
    page.drawRectangle({ x: M, y: H - y - 22, width: CW, height: 22, color: HEAD_BG });
    for (const [label, x, align] of [['Course', M + 8, 'left'], ['Qty', col.qty, 'right'], ['Unit price', col.unit, 'right'], ['Discount', col.disc, 'right'], ['Amount', col.amt, 'right']] as const) T(label, x, y + 7, f.head, 8.5, MUTED, align);
    y += 22;
    rule(y, 1, INK);
  };
  const newPage = (first: boolean) => {
    page = doc.addPage([W, H]);
    y = 42;
    if (first) return;
    // Continuation pages: a slim header, then the table header again.
    logo(M, y, 0.28);
    T('DevOps Easy Learning', M + 40, y + 2, f.heavy, 10.5);
    T(`Receipt ${r.receiptNumber} (continued)`, W - M, y + 3, f.text, 9, MUTED, 'right');
    y += 34;
    tableHead();
  };

  newPage(true);
  // ---------- header ----------
  logo(M, y, 0.33);
  T(r.company.legalName, M + 46, y + 3, f.heavy, 13);
  T([r.company.supportEmail, r.company.website].filter(Boolean).join(' · '), M, y + 26, f.text, 8.5, MUTED);
  T('Receipt', W - M, y - 2, f.heavy, 22, INK, 'right');
  T(r.receiptNumber, W - M, y + 24, f.mono, 8.5, INK, 'right');
  const pillW = f.head.widthOfTextAtSize(r.statusLabel, 8.5) + 16;
  const ok = r.status === 'paid';
  page.drawRectangle({ x: W - M - pillW, y: H - (y + 38) - 16, width: pillW, height: 16, color: ok ? OK_BG : WARN_BG, borderWidth: 0 });
  T(r.statusLabel, W - M - pillW / 2, y + 42.5, f.head, 8.5, ok ? OK_FG : WARN_FG, 'center');
  y += 64;
  rule(y, 1.6, INK);
  y += 14;

  // ---------- facts ----------
  const facts: [string, string, PDFFont][] = [
    ['Purchase date', receiptDate(r.purchasedAt), f.textBold],
    ['Payment date', receiptDate(r.paidAt), f.textBold],
    ['Payment method', r.paymentMethod, f.textBold],
    ['Order reference', r.orderRef, f.mono],
  ];
  // The payment method gets the widest column so "Mastercard ending in 5454" stays on one line.
  const share = [0.2, 0.2, 0.36, 0.24];
  let fx = M;
  facts.forEach(([k, v, font], i) => {
    const fw = CW * share[i]!;
    T(k, fx, y, f.text, 8.5, MUTED);
    wrap(v, font, 9.5, fw - 10).forEach((ln, j) => T(ln, fx, y + 13 + j * 12, font, 9.5));
    fx += fw;
  });
  y += 42;
  rule(y);
  y += 14;

  // ---------- from / billed to ----------
  const half = CW / 2;
  T('From', M, y, f.head, 8.5, VIOLET);
  T('Billed to', M + half, y, f.head, 8.5, VIOLET);
  const from = [r.company.legalName, ...r.company.address, ...(r.company.taxId ? [`Tax ID ${r.company.taxId}`] : []), r.company.supportEmail, r.company.website].filter(Boolean);
  const to = [r.customer.name, r.customer.email];
  const fromLines = from.flatMap((s) => wrap(s, f.text, 9, half - 20));
  const toLines = to.flatMap((s, i) => wrap(s, i === 0 ? f.textBold : f.text, 9, half - 10).map((t) => [t, i] as const));
  fromLines.forEach((s, i) => T(s, M, y + 13 + i * 12, f.text, 9, MUTED));
  toLines.forEach(([s, k], i) => T(s, M + half, y + 13 + i * 12, k === 0 ? f.textBold : f.text, 9));
  y += 13 + Math.max(fromLines.length, toLines.length) * 12 + 14;

  // ---------- course table ----------
  tableHead();
  const totalsH = 34 + 18 * (2 + (r.discountCents ? 1 : 0) + (r.tax ? 1 : 0) + (r.refundedCents ? 1 : 0)) + 26 * r.refunds.length;
  const footerH = 64;
  const bottom = (last: boolean) => H - 40 - footerH - (last ? totalsH : 0);
  r.lines.forEach((l, i) => {
    const titleLines = wrap(l.title, f.text, 9.5, titleW);
    const extra = (l.discountLabel ? 1 : 0) + (l.refundedAt ? 1 : 0);
    const rowH = 10 + (titleLines.length + extra) * 12.5;
    const isLast = i === r.lines.length - 1;
    // Keep the totals with the last row: move on when this row (plus totals for the last one) doesn't fit.
    if (y + rowH > bottom(isLast) && y > 200) newPage(false);
    let ty = y + 8;
    titleLines.forEach((t) => { T(t, M + 8, ty, f.text, 9.5); ty += 12.5; });
    if (l.discountLabel) { T(l.discountLabel, M + 8, ty, f.text, 8, MUTED); ty += 12.5; }
    if (l.refundedAt) { T(`Refunded ${receiptDate(l.refundedAt)}`, M + 8, ty, f.text, 8, WARN_FG); ty += 12.5; }
    T(String(l.quantity), col.qty, y + 8, f.text, 9.5, INK, 'right');
    T(money(l.unitCents, r.currency), col.unit, y + 8, f.text, 9.5, INK, 'right');
    T(l.discountCents ? `−${money(l.discountCents, r.currency)}` : '—', col.disc, y + 8, f.text, 9.5, l.discountCents ? INK : MUTED, 'right');
    T(money(l.amountCents, r.currency), col.amt, y + 8, f.text, 9.5, INK, 'right');
    y += rowH;
    rule(y, 0.8, ROW);
  });

  // ---------- references (left) and totals (right) ----------
  y += 18;
  const tx0 = W - M - 220;
  T('Transaction reference', M, y, f.text, 8.5, MUTED);
  T(r.transactionRef ?? (r.paymentMethod === 'Free' ? 'None (free order)' : r.paymentMethod === 'Test payment' ? 'None (test payment)' : 'Recorded by DevOps Easy Learning'), M, y + 12, r.transactionRef ? f.mono : f.text, 8.5);
  T(`Currency ${r.currency}`, M, y + 30, f.text, 8.5, MUTED);
  if (r.paidAt) T(`Paid ${receiptDate(r.paidAt, true)}`, M, y + 42, f.text, 8.5, MUTED);
  const tRow = (label: string, value: string, font = f.text, size = 9.5, color = INK) => { T(label, tx0, y, font, size, color); T(value, W - M, y, font, size, color, 'right'); y += 18; };
  tRow('Subtotal', money(r.subtotalCents, r.currency));
  if (r.discountCents) tRow('Discounts', `−${money(r.discountCents, r.currency)}`);
  if (r.tax) tRow(r.tax.included ? 'Includes tax' : 'Tax', money(r.tax.cents, r.currency));
  y += 2;
  rule(y, 1.6, INK, tx0, W - M);
  y += 8;
  T('Total paid', tx0, y, f.heavy, 14);
  const tw = T(money(r.totalCents, r.currency), W - M - 26, y, f.heavy, 14, INK, 'right');
  void tw;
  T(r.currency, W - M, y + 4, f.head, 8, MUTED, 'right');
  y += 26;
  for (const rf of r.refunds) {
    tRow(`Refund · ${receiptDate(rf.at)}`, `−${money(rf.cents, r.currency)}`, f.text, 8.5, WARN_FG);
    y -= 6;
    T(rf.title.length > 44 ? `${rf.title.slice(0, 43)}…` : rf.title, tx0, y, f.text, 8, MUTED);
    y += 14;
  }
  if (r.refundedCents) tRow('Net paid', money(r.netCents, r.currency), f.textBold, 10);

  // ---------- footer (bottom of the last page) ----------
  const fy = H - 40 - 44;
  rule(fy);
  T('Thank you for choosing DevOps Easy Learning.', M, fy + 12, f.textBold, 9.5);
  T(`For help with this purchase, write to ${r.company.supportEmail}.`, M, fy + 26, f.text, 8.5, MUTED);
  const legal = wrap('Each course includes 12 months of access. The terms and refund policy accepted at checkout apply.', f.text, 8, 230);
  legal.forEach((s, i) => T(s, W - M, fy + 12 + i * 11, f.text, 8, MUTED, 'right'));

  const pages = doc.getPageCount();
  if (pages > 1) doc.getPages().forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages}`, { x: W / 2 - 22, y: 22, size: 7.5, font: f.text, color: MUTED }));
  return { pdf: await doc.save(), pages };
}
