"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { useToast } from "./Toast";

type Line = { lineId: string; title: string; eligible: boolean; reason: string | null; watchedPercent: number };
type Info = { eligibleUntil: string | null; selfServiceLeft: number; pendingRequest: { id: string } | null; lines: Line[] };

const why: Record<string, string> = {
  already_refunded: "Refunded",
  free_course: "Free course",
  not_paid: "Not paid",
  window_closed: "The 14-day refund period has ended",
  certificate_issued: "Certificate issued",
  watched_too_much: "More than 25% watched",
  disputed: "Payment disputed with your bank",
};

/** Learner refund request on the receipt: shows each course's eligibility under the published policy. */
export function RefundPanel({ orderId, onRefunded }: { orderId: string; onRefunded: () => void }) {
  const toast = useToast();
  const [info, setInfo] = useState<Info | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(() => {
    api(`/orders/${orderId}/refund`).then((r) => {
      const o = obj(r);
      setInfo({
        eligibleUntil: (o.eligibleUntil as string) ?? null,
        selfServiceLeft: Number(o.selfServiceLeft ?? 0),
        pendingRequest: o.pendingRequest ? { id: String(obj(o.pendingRequest).id) } : null,
        lines: (Array.isArray(o.lines) ? o.lines : []).map((l) => { const x = obj(l); return { lineId: String(x.lineId), title: String(x.title), eligible: !!x.eligible, reason: (x.reason as string) ?? null, watchedPercent: Number(x.watchedPercent ?? 0) }; }),
      });
    }).catch(() => setInfo(null));
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  if (!info) return null;
  const eligible = info.lines.filter((l) => l.eligible);
  const shown = info.lines.filter((l) => l.reason !== "already_refunded" && l.reason !== "free_course");
  if (!shown.length) return null;

  async function submit() {
    setBusy(true);
    try {
      const r = obj(await api(`/orders/${orderId}/refund`, { method: "POST", body: { lineIds: sel, reason: reason.trim() || undefined } }));
      toast("ok", r.status === "refunded" ? "Refund issued. It reaches your card in 5–10 business days." : "Request sent. An admin will review it.");
      setSel([]); setReason(""); setConfirming(false);
      load(); onRefunded();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <section className="mt-6 rounded-panel border border-line bg-surface p-6 print:hidden" aria-labelledby="refund-title" data-testid="refund-panel">
      <h2 id="refund-title" className="font-display text-xl font-bold">Refund</h2>
      <p className="mt-1 text-sm text-ink-2">
        You can get a refund within 14 days of purchase{info.eligibleUntil ? ` (until ${date(info.eligibleUntil)})` : ""}, while you’ve watched less than 25% of the course and before its certificate is issued.
      </p>
      {info.pendingRequest ? <p className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-sm">Your refund request is waiting for review.</p> : (
        <>
          <ul className="mt-4 divide-y divide-line rounded-tile border border-line text-sm">
            {shown.map((l) => (
              <li key={l.lineId} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" aria-label={`Refund ${l.title}`} disabled={!l.eligible} checked={sel.includes(l.lineId)}
                  onChange={(e) => setSel((s) => (e.target.checked ? [...s, l.lineId] : s.filter((x) => x !== l.lineId)))} />
                <span className="min-w-0 flex-1 font-bold">{l.title}</span>
                <span className={`text-right ${l.eligible ? "text-ink-2" : "text-muted"}`}>{l.eligible ? `${l.watchedPercent}% watched` : why[l.reason ?? ""] ?? "Not eligible"}</span>
              </li>
            ))}
          </ul>
          {eligible.length ? (
            <>
              <label className="label mt-4" htmlFor="refund-reason">What went wrong? (optional, helps the instructor)</label>
              <input id="refund-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              {info.selfServiceLeft < Math.max(1, sel.length) ? <p className="mt-2 text-xs text-muted">You’ve used this year’s instant refunds, so an admin will review this request.</p> : null}
              {confirming ? (
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2" role="alert">
                  <span className="mr-auto text-sm font-bold">Refund {sel.length} {sel.length === 1 ? "course" : "courses"}? You’ll lose access to {sel.length === 1 ? "it" : "them"}.</span>
                  <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={submit} data-testid="confirm-learner-refund">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Refund</button>
                </div>
              ) : (
                <div className="mt-4 flex justify-end"><button type="button" className="btn btn-outline" disabled={!sel.length} onClick={() => setConfirming(true)} data-testid="request-refund">Request a refund</button></div>
              )}
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
