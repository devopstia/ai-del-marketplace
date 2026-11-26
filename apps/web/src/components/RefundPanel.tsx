"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { pct } from "@/lib/refund-policy";
import { useToast } from "./Toast";

type Line = { lineId: string; title: string; eligible: boolean; reason: string | null; reasons: string[]; outcome: string; watchedPercent: number; deadline: string | null; daysLeft: number | null; investigation: boolean };
type Policy = { version: number; windowDays: number; maxWatchedPercent: number; generousFrom: number | null; autoApprove: boolean };
type Info = { eligibleUntil: string | null; selfServiceLeft: number; pendingRequest: { id: string; paymentStatus: string } | null; policy: Policy | null; lines: Line[] };
type Req = { id: string; status: string; paymentStatus: string; decisionNote: string | null; message: string | null; createdAt: string; reviewRequestedAt: string | null; lineIds: string[] };

/** What the student sees for a request: the decision and, once approved, the payment state from the provider. */
function statusOf(q: Req): [string, string] {
  if (q.status === "auto_declined") return ["Not eligible under the policy", "text-amber"];
  if (q.status === "declined") return ["Declined after review", "text-rose"];
  if (q.status === "pending") return ["Waiting for our team", "text-amber"];
  if (q.paymentStatus === "succeeded") return ["Refunded", "text-mint"];
  if (q.paymentStatus === "failed") return ["Approved · payment delayed, we’re retrying", "text-amber"];
  return ["Approved · being processed", "text-ink-2"];
}

/** Learner refund request on the receipt: each course's position under the policy that applies to this purchase. */
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
      const p = o.policy ? obj(o.policy) : null;
      setInfo({
        eligibleUntil: (o.eligibleUntil as string) ?? null,
        selfServiceLeft: Number(o.selfServiceLeft ?? 0),
        pendingRequest: o.pendingRequest ? { id: String(obj(o.pendingRequest).id), paymentStatus: String(obj(o.pendingRequest).paymentStatus ?? "") } : null,
        policy: p ? { version: Number(p.version), windowDays: Number(p.windowDays), maxWatchedPercent: Number(p.maxWatchedPercent), generousFrom: p.generousFrom == null ? null : Number(p.generousFrom), autoApprove: p.autoApprove === true } : null,
        lines: (Array.isArray(o.lines) ? o.lines : []).map((l) => {
          const x = obj(l);
          return {
            lineId: String(x.lineId), title: String(x.title), eligible: !!x.eligible, reason: (x.reason as string) ?? null, reasons: Array.isArray(x.reasons) ? x.reasons.map(String) : [],
            outcome: String(x.outcome ?? ""), watchedPercent: Number(x.watchedPercent ?? 0), deadline: (x.windowEndsAt as string) ?? null, daysLeft: x.daysLeft == null ? null : Number(x.daysLeft), investigation: x.investigation === true,
          };
        }),
      });
    }).catch(() => setInfo(null));
    api(`/orders/${orderId}/refund-requests`).then((r) => setReqs((Array.isArray(obj(r).items) ? (obj(r).items as unknown[]) : []).map((x) => {
      const o = obj(x);
      return { id: String(o.id), status: String(o.status), paymentStatus: String(o.paymentStatus ?? "none"), decisionNote: (o.decisionNote as string) ?? null, message: (o.message as string) ?? null, createdAt: String(o.createdAt), reviewRequestedAt: (o.reviewRequestedAt as string) ?? null, lineIds: Array.isArray(o.lineIds) ? o.lineIds.map(String) : [] };
    }))).catch(() => setReqs([]));
  }, [orderId]);
  useEffect(() => { load(); }, [load]);

  if (!info) return null;
  const p = info.policy;
  const why = (r: string) => ({
    already_refunded: "Refunded", free_course: "Free course", not_paid: "Not paid", disputed: "Payment disputed with your bank", certificate_issued: "Certificate issued",
    window_closed: p ? `The ${p.windowDays}-day refund period has ended` : "The refund period has ended",
    watched_too_much: p ? `Over the ${pct(p.maxWatchedPercent)} limit` : "Over the watch limit",
  } as Record<string, string>)[r] ?? "Not eligible";
  const requestable = (l: Line) => l.outcome !== "none" && l.outcome !== "";
  const canAsk = info.lines.filter(requestable);
  const shown = info.lines.filter((l) => l.reason !== "already_refunded" && l.reason !== "free_course");
  if (!shown.length && !reqs.length) return null;
  const titleOf = (ids: string[]) => info.lines.filter((l) => ids.includes(l.lineId)).map((l) => l.title).join(", ");
  const selDeclined = info.lines.filter((l) => sel.includes(l.lineId) && l.outcome === "reject");
  const first = shown[0];

  async function submit() {
    setBusy(true);
    try {
      const r = obj(await api(`/orders/${orderId}/refund`, { method: "POST", body: { lineIds: sel, reason: reason.trim() || undefined } }));
      const msg: Record<string, [("ok" | "error"), string]> = {
        refunded: ["ok", "Refund complete. Our payment provider confirmed it; your bank shows it in 5–10 business days."],
        processing: ["ok", "Refund approved. Our payment provider is processing it; we’ll tell you when it’s complete."],
        payment_failed: ["error", "Refund approved, but the payment provider couldn’t process it yet. Our team is retrying."],
        declined: ["error", "This purchase doesn’t meet the refund policy. The reasons are below, and we emailed them to you."],
        pending_review: ["ok", "Request sent. A member of our team will review it and email you."],
        partial: ["ok", "Done: see each course’s result below."],
      };
      const [tone, text] = msg[String(r.status)] ?? ["ok", "Request recorded."];
      toast(tone, text);
      setSel([]); setReason(""); setConfirming(false);
      load(); onRefunded();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  return (
    <section className="mt-6 rounded-panel border border-line bg-surface p-6 print:hidden" aria-labelledby="refund-title" data-testid="refund-panel">
      <h2 id="refund-title" className="font-display text-xl font-bold">Refund</h2>
      <p className="mt-1 text-sm text-ink-2">
        {p ? <>For this purchase you can get a refund within <b className="text-ink">{p.windowDays} days</b>{info.eligibleUntil ? ` (until ${date(info.eligibleUntil)})` : ""} if you’ve watched <b className="text-ink">{pct(p.maxWatchedPercent)}</b> or less of the course’s paid video. </> : null}
        We count only the video you actually played, once. {p ? <span className="text-muted">Policy version {p.version}{p.generousFrom ? ` (with the more generous rules of version ${p.generousFrom})` : ""}. </span> : null}
        <a href="/policies/access-and-refunds" className="link">Access and refunds policy</a>
      </p>
      {first && first.outcome !== "none" && !reqs.length ? (
        <p className="mt-2 text-sm text-ink-2" data-testid="refund-days-left">
          {first.daysLeft != null ? <>{first.daysLeft === 0 ? "Last day to ask" : `${first.daysLeft} ${first.daysLeft === 1 ? "day" : "days"} left to ask`}{first.deadline ? ` (deadline ${new Date(first.deadline).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })})` : ""}.</> : "The refund period for this purchase has ended."}
        </p>
      ) : null}
      {reqs.length ? (
        <ul className="mt-4 grid gap-2" data-testid="refund-decisions">
          {reqs.map((q) => {
            const [label, tone] = statusOf(q);
            return (
              <li key={q.id} className="rounded-tile border border-line px-4 py-3 text-sm">
                <p className="flex flex-wrap justify-between gap-2"><span className="font-bold">{titleOf(q.lineIds) || "Refund request"}</span><span className={`font-bold ${tone}`} data-testid="refund-status">{label}</span></p>
                {q.message && (q.status === "auto_declined" || q.status === "pending") ? <p className="mt-2 whitespace-pre-line text-ink-2" data-testid="refund-message">{q.message}</p> : null}
                {q.decisionNote && q.status !== "auto_declined" ? <p className="mt-1 text-ink-2">{q.decisionNote}</p> : null}
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
      {info.pendingRequest ? <p className="mt-4 rounded-lg bg-amber-soft px-3 py-2 text-sm">{info.pendingRequest.paymentStatus === "processing" ? "Your refund is approved and being processed by our payment provider." : "Your refund request is waiting for review."}</p> : (
        <>
          <ul className="mt-4 divide-y divide-line rounded-tile border border-line text-sm">
            {shown.map((l) => (
              <li key={l.lineId} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" aria-label={`Refund ${l.title}`} disabled={!requestable(l)} checked={sel.includes(l.lineId)}
                  onChange={(e) => setSel((s) => (e.target.checked ? [...s, l.lineId] : s.filter((x) => x !== l.lineId)))} />
                <span className="min-w-0 flex-1 font-bold">{l.title}</span>
                <span className={`text-right ${l.eligible ? "text-ink-2" : "text-amber"}`}>
                  <span className="tabular-nums">{pct(l.watchedPercent)} watched</span>
                  {l.investigation ? " · a person will check" : l.eligible ? " · qualifies" : ` · ${l.reasons.length ? l.reasons.map(why).join(", ") : "Not eligible"}`}
                </span>
              </li>
            ))}
          </ul>
          {canAsk.length ? (
            <>
              <label className="label mt-4" htmlFor="refund-reason">What went wrong? (optional, helps the instructor)</label>
              <input id="refund-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              {selDeclined.length ? <p className="mt-2 text-xs text-amber">{selDeclined.map((l) => l.title).join(", ")} {selDeclined.length === 1 ? "doesn’t" : "don’t"} meet the policy, so the request will be declined automatically with the reasons. You can then ask a person to review it.</p> : null}
              {p?.autoApprove && info.selfServiceLeft < Math.max(1, sel.length - selDeclined.length) ? <p className="mt-2 text-xs text-muted">You’ve used this year’s instant refunds, so our team will review this request.</p> : null}
              {p && !p.autoApprove ? <p className="mt-2 text-xs text-muted">A member of our team approves eligible refunds.</p> : null}
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
