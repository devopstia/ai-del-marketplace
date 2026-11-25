"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { useToast } from "./Toast";

type Line = { lineId: string; title: string; eligible: boolean; reason: string | null; watchedPercent: number };
type Info = { eligibleUntil: string | null; selfServiceLeft: number; pendingRequest: { id: string } | null; lines: Line[] };
type Req = { id: string; status: string; decisionNote: string | null; createdAt: string; reviewRequestedAt: string | null; lineIds: string[] };
const STATUS: Record<string, [string, string]> = {
  auto_approved: ["Refunded automatically", "text-mint"], approved: ["Approved by our team", "text-mint"],
  auto_declined: ["Declined by the policy", "text-amber"], declined: ["Declined after review", "text-rose"], pending: ["Waiting for our team", "text-amber"],
};
/** Lines the student may still ask about (an automatic decline can then be reviewed by a person). */
const requestable = (l: Line) => l.eligible || l.reason === "watched_too_much" || l.reason === "window_closed" || l.reason === "certificate_issued";

const why: Record<string, string> = {
  already_refunded: "Refunded",
  free_course: "Free course",
  not_paid: "Not paid",
  window_closed: "The 14-day refund period has ended",
  certificate_issued: "Certificate issued",
  watched_too_much: "Over the 25% limit",
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
  const [reqs, setReqs] = useState<Req[]>([]);
  const [reviewFor, setReviewFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

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
    api(`/orders/${orderId}/refund-requests`).then((r) => setReqs((Array.isArray(obj(r).items) ? (obj(r).items as unknown[]) : []).map((x) => { const o = obj(x); return { id: String(o.id), status: String(o.status), decisionNote: (o.decisionNote as string) ?? null, createdAt: String(o.createdAt), reviewRequestedAt: (o.reviewRequestedAt as string) ?? null, lineIds: Array.isArray(o.lineIds) ? o.lineIds.map(String) : [] }; }))).catch(() => setReqs([]));
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  if (!info) return null;
  const canAsk = info.lines.filter(requestable);
  const shown = info.lines.filter((l) => l.reason !== "already_refunded" && l.reason !== "free_course");
  if (!shown.length && !reqs.length) return null;
  const titleOf = (ids: string[]) => info.lines.filter((l) => ids.includes(l.lineId)).map((l) => l.title).join(", ");
  const selIneligible = info.lines.filter((l) => sel.includes(l.lineId) && !l.eligible);

  async function submit() {
    setBusy(true);
    try {
      const r = obj(await api(`/orders/${orderId}/refund`, { method: "POST", body: { lineIds: sel, reason: reason.trim() || undefined } }));
      toast(r.status === "declined" ? "error" : "ok", r.status === "refunded" ? "Refund issued. It reaches your card in 5–10 business days."
        : r.status === "declined" ? "This purchase doesn’t meet the refund policy. We emailed you the details; you can ask for a review below."
        : r.status === "partial" ? "Done: see each course’s result below." : "Request sent. Our team will review it.");
      setSel([]); setReason(""); setConfirming(false);
      load(); onRefunded();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <section className="mt-6 rounded-panel border border-line bg-surface p-6 print:hidden" aria-labelledby="refund-title" data-testid="refund-panel">
      <h2 id="refund-title" className="font-display text-xl font-bold">Refund</h2>
      <p className="mt-1 text-sm text-ink-2">
        You can get a refund within 14 days of purchase{info.eligibleUntil ? ` (until ${date(info.eligibleUntil)})` : ""} if you’ve watched 25% or less of the course. We count only the video you actually played. <a href="/policies/access-and-refunds" className="link">Access and refunds policy</a>
      </p>
      {reqs.length ? (
        <ul className="mt-4 grid gap-2" data-testid="refund-decisions">
          {reqs.map((q) => {
            const [label, tone] = STATUS[q.status] ?? [q.status, "text-ink-2"];
            return (
              <li key={q.id} className="rounded-tile border border-line px-4 py-3 text-sm">
                <p className="flex flex-wrap justify-between gap-2"><span className="font-bold">{titleOf(q.lineIds) || "Refund request"}</span><span className={`font-bold ${tone}`}>{label}</span></p>
                {q.decisionNote ? <p className="mt-1 text-ink-2">{q.decisionNote}</p> : null}
                {q.status === "auto_declined" && q.reviewRequestedAt ? <p className="mt-1 text-amber">A person is reviewing this. We’ll email you.</p> : null}
                {q.status === "auto_declined" && !q.reviewRequestedAt ? (
                  reviewFor === q.id ? (
                    <form className="mt-2" onSubmit={async (e) => {
                      e.preventDefault(); setBusy(true);
                      try { await api(`/refund-requests/${q.id}/review`, { method: "POST", body: { note } }); toast("ok", "Thanks. A person will review it and email you."); setReviewFor(null); setNote(""); load(); }
                      catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
                    }}>
                      <label className="label" htmlFor={`review-${q.id}`}>What should we look at?</label>
                      <textarea id={`review-${q.id}`} className="field min-h-20" required minLength={10} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: the video kept replaying by itself, or I was charged twice." data-testid="review-note" />
                      <div className="mt-2 flex gap-2"><button className="btn btn-primary btn-sm" disabled={busy || note.trim().length < 10} data-testid="send-review">Send for review</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewFor(null)}>Cancel</button></div>
                    </form>
                  ) : <button type="button" className="link mt-1 text-sm" onClick={() => setReviewFor(q.id)} data-testid="ask-review">Ask a person to review this</button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {info.pendingRequest ? <p className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-sm">Your refund request is waiting for review.</p> : (
        <>
          <ul className="mt-4 divide-y divide-line rounded-tile border border-line text-sm">
            {shown.map((l) => (
              <li key={l.lineId} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" aria-label={`Refund ${l.title}`} disabled={!requestable(l)} checked={sel.includes(l.lineId)}
                  onChange={(e) => setSel((s) => (e.target.checked ? [...s, l.lineId] : s.filter((x) => x !== l.lineId)))} />
                <span className="min-w-0 flex-1 font-bold">{l.title}</span>
                <span className={`text-right ${l.eligible ? "text-ink-2" : "text-amber"}`}><span className="tabular-nums">{l.watchedPercent}% watched</span>{l.eligible ? " · qualifies" : ` · ${why[l.reason ?? ""] ?? "Not eligible"}`}</span>
              </li>
            ))}
          </ul>
          {canAsk.length ? (
            <>
              <label className="label mt-4" htmlFor="refund-reason">What went wrong? (optional, helps the instructor)</label>
              <input id="refund-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              {selIneligible.length ? <p className="mt-2 text-xs text-amber">{selIneligible.map((l) => l.title).join(", ")} {selIneligible.length === 1 ? "doesn’t" : "don’t"} meet the policy, so the request will be declined automatically. You can then ask a person to review it.</p> : null}
              {info.selfServiceLeft < Math.max(1, sel.length - selIneligible.length) ? <p className="mt-2 text-xs text-muted">You’ve used this year’s instant refunds, so our team will review this request.</p> : null}
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
