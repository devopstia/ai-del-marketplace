import { LoopMark } from "@/components/Logo";
import type { Receipt } from "@/lib/types";

/**
 * The official receipt, "Corporate Professional" (owner 2026-11-27; docs/RECEIPTS.md). A financial document: fixed
 * white paper and dark ink in both site themes, the same layout as the PDF (apps/api/src/receipts/receipt-pdf.ts).
 * Printing shows only this document (`.receipt-doc` print rules below). No buttons or links inside it.
 */
const money = (cents: number, currency: string) => {
  const v = (Math.abs(cents) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const s = currency === "USD" ? `$${v}` : `${v} ${currency}`;
  return cents < 0 ? `−${s}` : s;
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "");
const dayTime = (iso: string | null) => (iso ? `${day(iso)}, ${new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC` : "");

const CSS = `
.receipt-doc{--violet:#4f3fb0;--cyan:#1e9bd7;--r-ink:#141833;--r-muted:#5b6178;--r-line:#dfe2ec;--r-row:#e6e8f0;--r-head:#f4f5fa;--r-violet:#4f3fb0;color-scheme:light;background:#fff;color:var(--r-ink);font-size:13px;line-height:1.45;padding:clamp(20px,5vw,56px) clamp(16px,6vw,64px) clamp(20px,4vw,44px);border:1px solid var(--r-line);border-radius:6px;box-shadow:0 1px 2px rgba(20,24,51,.06),0 10px 30px rgba(20,24,51,.08)}
.receipt-doc .r-mono{font-family:ui-monospace,"JetBrains Mono",SFMono-Regular,Menlo,monospace;font-size:12px;white-space:nowrap}
.receipt-doc .r-k{color:var(--r-muted);font-size:12px}
.receipt-doc .r-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:18px;border-bottom:2px solid var(--r-ink)}
.receipt-doc .r-title{font-family:var(--font-display);font-weight:800;font-size:clamp(24px,4vw,30px);line-height:1;text-align:right}
.receipt-doc .r-pill{display:inline-block;font-family:var(--font-display);font-weight:700;font-size:12px;border-radius:99px;padding:3px 10px;white-space:nowrap}
.receipt-doc .r-pill.ok{background:#e5f6ec;color:#11683a}.receipt-doc .r-pill.warn{background:#fff3df;color:#8a4b00}
.receipt-doc .r-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px 22px;padding:16px 0;border-bottom:1px solid var(--r-line)}
.receipt-doc .r-facts .v{font-weight:600}
.receipt-doc .r-parties{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:18px 0}
.receipt-doc h3{font-family:var(--font-display);font-weight:700;font-size:12px;color:var(--r-violet);margin:0 0 5px}
.receipt-doc table{width:100%;border-collapse:collapse}
.receipt-doc th{font-family:var(--font-display);font-weight:700;font-size:12px;color:var(--r-muted);text-align:left;padding:8px 10px;background:var(--r-head);border-bottom:1px solid var(--r-ink)}
.receipt-doc td{padding:10px;border-bottom:1px solid var(--r-row);vertical-align:top}
.receipt-doc .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.receipt-doc .r-sum{display:grid;grid-template-columns:1fr minmax(0,300px);gap:28px;margin-top:20px}
.receipt-doc .r-tot td{border:0;padding:5px 0}
.receipt-doc .r-grand td{border-top:2px solid var(--r-ink);padding-top:10px;font-family:var(--font-display);font-weight:800;font-size:20px}
.receipt-doc .r-refund td{color:#8a4b00;font-size:12px}
.receipt-doc .r-foot{margin-top:28px;border-top:1px solid var(--r-line);padding-top:14px;display:flex;justify-content:space-between;gap:20px;font-size:12px;color:var(--r-muted)}
.receipt-doc .r-foot b{color:var(--r-ink);font-size:13px}
@media (max-width:640px){
  .receipt-doc .r-head{flex-direction:column}
  .receipt-doc .r-head>div:last-child{text-align:left}
  .receipt-doc .r-head .r-title{text-align:left}
  .receipt-doc .r-facts{grid-template-columns:1fr 1fr}
  .receipt-doc .r-parties,.receipt-doc .r-sum{grid-template-columns:1fr}
  .receipt-doc .r-hide{display:none}
  .receipt-doc .r-foot{flex-direction:column}
  .receipt-doc .r-foot div:last-child{text-align:left!important}
}
@media print{
  @page{margin:12mm}
  html,body{background:#fff!important}
  body *{visibility:hidden!important}
  .receipt-doc,.receipt-doc *{visibility:visible!important}
  .receipt-doc{position:absolute;left:0;top:0;width:100%;border:0;box-shadow:none;padding:0}
  .receipt-doc .r-facts{grid-template-columns:repeat(4,minmax(0,1fr))!important}
  .receipt-doc .r-parties{grid-template-columns:1fr 1fr!important}.receipt-doc .r-sum{grid-template-columns:1fr 300px!important}
  .receipt-doc .r-hide{display:table-cell!important}
  .receipt-doc thead{display:table-header-group}
  .receipt-doc tr{break-inside:avoid}
}`;

export function ReceiptDocument({ r }: { r: Receipt }) {
  const ok = r.status === "paid";
  const from = [r.company.legalName, ...r.company.address, ...(r.company.taxId ? [`Tax ID ${r.company.taxId}`] : []), r.company.supportEmail, r.company.website].filter(Boolean);
  return (
    <article className="receipt-doc" data-testid="receipt-document" aria-label={`Receipt ${r.receiptNumber}`}>
      <style>{CSS}</style>
      <header className="r-head">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5"><LoopMark className="h-6 w-12 shrink-0" /><span className="font-display text-[17px] font-extrabold">{r.company.legalName}</span></div>
          <p className="r-k mt-2">{r.company.supportEmail} · {r.company.website}</p>
        </div>
        <div className="shrink-0 text-right">
          <h1 className="r-title">Receipt</h1>
          <p className="r-mono mt-1.5" data-testid="receipt-number">{r.receiptNumber}</p>
          <p className="mt-2"><span className={`r-pill ${ok ? "ok" : "warn"}`}>{r.statusLabel}</span></p>
        </div>
      </header>

      <dl className="r-facts">
        <div><dt className="r-k">Purchase date</dt><dd className="v">{day(r.purchasedAt)}</dd></div>
        <div><dt className="r-k">Payment date</dt><dd className="v">{day(r.paidAt)}</dd></div>
        <div><dt className="r-k">Payment method</dt><dd className="v">{r.paymentMethod}</dd></div>
        <div><dt className="r-k">Order reference</dt><dd className="r-mono">{r.orderRef}</dd></div>
      </dl>

      <div className="r-parties">
        <div><h3>From</h3><p className="text-[13px]" style={{ color: "var(--r-muted)" }}>{from.map((l, i) => <span key={i} className="block">{l}</span>)}</p></div>
        <div className="min-w-0"><h3>Billed to</h3><p className="text-[13px]"><span className="block font-semibold">{r.customer.name}</span><span className="block [overflow-wrap:anywhere]">{r.customer.email}</span></p></div>
      </div>

      <table>
        <thead><tr><th>Course</th><th className="num r-hide">Qty</th><th className="num r-hide">Unit price</th><th className="num r-hide">Discount</th><th className="num">Amount</th></tr></thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={i}>
              <td>
                {l.title}
                {l.discountLabel ? <span className="block text-[11.5px]" style={{ color: "var(--r-muted)" }}>{l.discountLabel}: −{money(l.discountCents, r.currency)} off {money(l.unitCents, r.currency)}</span> : null}
                {l.refundedAt ? <span className="block text-[11.5px]" style={{ color: "#8a4b00" }}>Refunded {day(l.refundedAt)}</span> : null}
              </td>
              <td className="num r-hide">{l.quantity}</td>
              <td className="num r-hide">{money(l.unitCents, r.currency)}</td>
              <td className="num r-hide">{l.discountCents ? `−${money(l.discountCents, r.currency)}` : "—"}</td>
              <td className="num">{money(l.amountCents, r.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="r-sum">
        <div className="r-k">
          <span className="block">Transaction reference</span>
          <span className="r-mono block" style={{ color: "var(--r-ink)" }}>{r.transactionRef ?? (r.paymentMethod === "Free" ? "None (free order)" : r.paymentMethod === "Test payment" ? "None (test payment)" : "Recorded by DevOps Easy Learning")}</span>
          <span className="mt-3 block">Currency {r.currency}</span>
          {r.paidAt ? <span className="block">Paid {dayTime(r.paidAt)}</span> : null}
        </div>
        <table className="r-tot" data-testid="receipt-totals">
          <tbody>
            <tr><td>Subtotal</td><td className="num">{money(r.subtotalCents, r.currency)}</td></tr>
            {r.discountCents ? <tr><td>Discounts</td><td className="num">−{money(r.discountCents, r.currency)}</td></tr> : null}
            {r.tax ? <tr><td>{r.tax.included ? "Includes tax" : "Tax"}</td><td className="num">{money(r.tax.cents, r.currency)}</td></tr> : null}
            <tr className="r-grand"><td>Total paid</td><td className="num">{money(r.totalCents, r.currency)} <span className="text-xs font-semibold" style={{ color: "var(--r-muted)" }}>{r.currency}</span></td></tr>
            {r.refunds.map((x, i) => <tr key={i} className="r-refund"><td>Refund · {day(x.at)}<span className="block" style={{ color: "var(--r-muted)" }}>{x.title.length > 48 ? `${x.title.slice(0, 47)}…` : x.title}</span></td><td className="num">−{money(x.cents, r.currency)}</td></tr>)}
            {r.refundedCents ? <tr><td className="font-bold">Net paid</td><td className="num font-bold">{money(r.netCents, r.currency)}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <footer className="r-foot">
        <div><b>Thank you for choosing DevOps Easy Learning.</b><br />For help with this purchase, write to {r.company.supportEmail}.</div>
        <div className="max-w-[300px] text-right">Each course includes 12 months of access. The terms and refund policy accepted at checkout apply.</div>
      </footer>
    </article>
  );
}
