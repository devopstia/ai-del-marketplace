"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { toOrder } from "@/lib/normalize";
import { dateTime, moneyExact } from "@/lib/format";
import type { Order, Receipt } from "@/lib/types";
import { Skeleton } from "@/components/Empty";
import { OrderStatus } from "@/components/StatusBadge";
import { RefundPanel } from "@/components/RefundPanel";
import { ReceiptDocument } from "@/components/receipt/ReceiptDocument";
import { useToast } from "@/components/Toast";

/**
 * The buyer's receipt (owner 2026-11-27, "Corporate Professional"; docs/RECEIPTS.md). The document itself, then the
 * actions outside it: Download Receipt (PDF, Letter or A4, from the API: the same layout) and Print Receipt (only the
 * document prints). Orders that aren't paid have no receipt yet.
 */
export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const [r, setR] = useState<Receipt | null>(null);
  const [pending, setPending] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const [paper, setPaper] = useState<"letter" | "a4">("letter");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api(`/orders/${id}/receipt`)
      .then((x) => { if (live) { setR(x as Receipt); setPending(null); } })
      .catch(async (e) => {
        // No receipt (not paid yet): show the order's state instead.
        try { const o = toOrder(await api(`/orders/${id}`)); if (live) setPending(o); } catch { if (live) setErr(errMsg(e)); }
      });
    return () => { live = false; };
  }, [id, n]);

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/orders/${id}/receipt.pdf?paper=${paper}`, { credentials: "include" });
      if (!res.ok) throw new Error("The receipt couldn’t be downloaded. Try again.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${r?.receiptNumber ?? "receipt"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <div className="max-w-[880px]">
      {err ? <p className="mt-6 text-rose">{err}</p> : null}
      {!r && !pending && !err ? <Skeleton className="mt-6 h-96" /> : null}
      {pending ? (
        <section className="mt-4 rounded-panel border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-extrabold">Order not paid</h1><OrderStatus status={pending.status} /></div>
          <p className="mt-2 text-ink-2">A receipt is issued once the payment is confirmed. Started {dateTime(pending.createdAt)} · {moneyExact(pending.totalCents, pending.currency)}.</p>
          <ul className="mt-3 list-disc pl-5 text-ink-2">{pending.lines.map((l) => <li key={l.id}>{l.title}</li>)}</ul>
        </section>
      ) : null}
      {r ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden" data-testid="receipt-actions">
            <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Paper size">
              {(["letter", "a4"] as const).map((p) => (
                <button key={p} type="button" aria-pressed={paper === p} onClick={() => setPaper(p)} className={`px-3 py-2 text-sm font-bold ${paper === p ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface-2"}`}>{p === "letter" ? "US Letter" : "A4"}</button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void download()} disabled={busy} data-testid="download-receipt">{busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Download Receipt</button>
            <button type="button" className="btn btn-outline" onClick={() => window.print()}><Printer className="size-4" />Print Receipt</button>
          </div>
          <div className="mt-4"><ReceiptDocument r={r} /></div>
        </>
      ) : null}
      {r ? <RefundPanel orderId={r.orderId} onRefunded={() => setN((x) => x + 1)} /> : null}
      {r || pending ? <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden"><Link href={`/support/new?order=${id}&from=${encodeURIComponent(`/student/purchases/${id}`)}`} className="btn btn-ghost">Get help with this order</Link></div> : null}
    </div>
  );
}
