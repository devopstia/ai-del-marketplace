"use client";
import { useState } from "react";
import { Bot, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { date, dateTime, moneyExact } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { Empty, Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { RefundPolicySettings } from "@/components/admin/RefundPolicySettings";
import { pct } from "@/lib/refund-policy";

type R = Record<string, unknown>;
const arr = (x: unknown) => (Array.isArray(x) ? (x as R[]) : []);
const n = (v: unknown) => Number(v ?? 0) || 0;
/** Filters from the owner's list (2026-11-26). */
const TABS: [string, string][] = [
  ["needs_action", "Needs action"], ["", "All"], ["pending", "Pending"], ["investigation", "Needs investigation"], ["auto_declined", "Automatically rejected"],
  ["auto_approved", "Automatically approved"], ["approved", "Manually approved"], ["declined", "Manually rejected"], ["refunded", "Refunded"], ["processing", "Processing"], ["failed", "Failed refunds"],
];
const STATUS: Record<string, [string, string]> = {
  pending: ["Waiting for a person", "bg-amber-soft text-amber"], auto_approved: ["Approved automatically", "bg-mint-soft text-mint"],
  approved: ["Approved manually", "bg-mint-soft text-mint"], auto_declined: ["Rejected automatically", "bg-surface-2 text-ink-2"], declined: ["Rejected manually", "bg-rose-soft text-rose"],
};
const PAYMENT: Record<string, [string, string]> = { succeeded: ["Refunded", "text-mint"], processing: ["Processing at the provider", "text-amber"], failed: ["Payment failed", "text-rose"] };
const hm = (sec: number) => { const h = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; };
const ACTION: Record<string, string> = {
  "refund.auto_approved": "Refunded automatically", "refund.auto_declined": "Declined by the policy", "refund.review_requested": "Student asked for a review",
  "refund.exception_approved": "Exception approved", "order.refund_request_created": "Waiting for a person", "order.refund_request_approved": "Approved", "order.refund_request_declined": "Declined",
  "order.refund_requested": "Refund sent to Stripe", "order.refunded": "Order refunded, access removed, instructor share recovered",
};

/** Super Admin refund dashboard (owner 2026-11-25): every request, its facts from playback records, AI summary, decision and history. */
export default function AdminRefunds() {
  const toast = useToast();
  const { me } = useAuth();
  const superAdmin = !!me?.roles.includes("super_admin");
  const [view, setView] = useState<"requests" | "policy">("requests");
  const [tab, setTab] = useState("needs_action");
  const { data, error, reload } = useApi(`/admin/refund-requests${tab ? `?status=${tab}` : ""}`, (r) => obj(r));
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const items = arr(data?.items);
  const counts = obj(data?.counts);

  const policy = obj(data?.policy);
  const REASON: Record<string, string> = {
    watched_too_much: "Over the watch limit", window_closed: "Refund period expired", certificate_issued: "Certificate issued", disputed: "Payment disputed",
    already_refunded: "Already refunded", free_course: "Free course", not_paid: "Not paid",
  };

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    try {
      const r = obj(await api(`/admin/refund-requests/${id}/${approve ? "approve" : "decline"}`, { method: "POST", body: { note: note[id]?.trim() || undefined } }));
      toast(r.paymentStatus === "failed" ? "error" : "ok", !approve ? "Rejected. The student is emailed your note."
        : r.paymentStatus === "succeeded" ? "Approved and refunded: the provider confirmed it. The student is emailed."
        : r.paymentStatus === "processing" ? "Approved. The provider is processing it; the student is told when it’s confirmed."
        : "Approved, but the provider couldn’t process the payment. Retry from this request.");
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  async function retry(id: string) {
    setBusy(id);
    try {
      const r = obj(await api(`/admin/refund-requests/${id}/retry-payment`, { method: "POST" }));
      toast(r.paymentStatus === "failed" ? "error" : "ok", r.paymentStatus === "succeeded" ? "Refunded: the provider confirmed it." : r.paymentStatus === "processing" ? "Sent again: the provider is processing it." : "The provider still couldn’t process it.");
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <div className="max-w-[1600px]">
      <PageHead title="Refunds" sub={policy.windowDays != null ? `Every request with the facts from purchase and playback records. Policy in force (version ${String(policy.version)}): within ${String(policy.windowDays)} days and ${pct(n(policy.maxWatchedPercent))} or less of the paid video watched; ${policy.autoCheck ? (policy.autoApprove ? "eligible requests are refunded at once" : "eligible requests wait for manual approval") : "every request is reviewed by a person"}. Only Super Admins approve exceptions.` : "Every refund request with the facts from purchase and playback records."} />
      <div role="tablist" aria-label="Refunds" className="mb-5 flex gap-1 border-b border-line">
        {([["requests", "Requests"], ["policy", "Policy settings"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} data-testid={`refunds-tab-${k}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold ${view === k ? "border-violet text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      {view === "policy" ? <RefundPolicySettings canEdit={superAdmin} /> : <>
      <div role="group" aria-label="Filter requests" className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k || "all"} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}
            className={`rounded-full border px-3 py-1 text-sm font-bold ${tab === k ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>
            {l}{counts[k || "all"] != null ? <span className="ml-1.5 tabular-nums">{n(counts[k || "all"])}</span> : null}
          </button>
        ))}
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-64" /> : null}
      {data && !items.length ? <Empty icon={RotateCcw} title={tab === "needs_action" ? "Nothing waiting" : "No requests here"} body={tab === "needs_action" ? "Requests waiting for a person, reviews students ask for and refunds whose payment failed appear here." : "Refund requests will be listed as students make them."} /> : null}
      {items.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-tile border border-line bg-surface" data-testid="refund-list">
          {items.map((r) => {
            const id = String(r.id);
            const user = obj(r.user);
            const a = obj(r.analysis);
            const facts = arr(a.lines);
            const lines = arr(r.lines);
            const [label, tone] = STATUS[String(r.status)] ?? [String(r.status), "bg-surface-2 text-ink-2"];
            const isOpen = open === id;
            const needs = r.needsAction === true;
            const exception = r.status === "auto_declined";
            const pay = PAYMENT[String(r.paymentStatus)];
            const payment = obj(r.payment);
            return (
              <li key={id} data-testid="refund-row">
                <button type="button" className="grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto]" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen}>
                  <span className="min-w-0"><span className="block truncate font-bold">{String(user.name)}</span><span className="block truncate text-sm text-muted">{String(user.email)}</span></span>
                  <span className="min-w-0 text-sm"><span className="block truncate">{lines.map((l) => String(l.title)).join(", ")}</span><span className="text-muted">{moneyExact(n(r.amountCents))} · {r.daysSincePurchase != null ? `${n(r.daysSincePurchase)} days after purchase` : "requested"} · {date(String(r.createdAt))}</span></span>
                  <span className="text-sm tabular-nums">{facts.map((f) => `${pct(n(f.watchedPercent))} of ${pct(n(f.thresholdPercent))}`).join(", ")}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{needs && exception ? "Review requested" : r.investigation && r.status === "pending" ? "Needs investigation" : label}</span>
                    {pay ? <span className={`text-xs font-bold ${pay[1]}`}>{pay[0]}</span> : null}
                    <ChevronDown className={`size-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {isOpen ? (
                  <div className="grid gap-5 border-t border-line bg-surface-2/40 px-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-muted">Refund analysis</h3>
                      {facts.map((f) => (
                        <dl key={String(f.lineId)} className="mt-2 grid grid-cols-[11rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-tile border border-line bg-surface p-3 text-sm" data-testid="refund-facts">
                          <dt className="text-muted">Course</dt><dd className="font-bold">{String(f.title)}{f.renewal ? " (renewal)" : ""}</dd>
                          <dt className="text-muted">Instructor</dt><dd>{String(f.instructor ?? lines.find((l) => l.id === f.lineId)?.instructor ?? "—")}</dd>
                          <dt className="text-muted">Purchased</dt><dd>{f.purchasedAt ? dateTime(String(f.purchasedAt)) : "—"} · {moneyExact(n(f.priceCents))}</dd>
                          <dt className="text-muted">Refund requested</dt><dd>{dateTime(String(a.requestedAt ?? r.createdAt))}{f.daysSincePurchase != null ? ` · ${n(f.daysSincePurchase)} days after purchase` : ""}</dd>
                          <dt className="text-muted">Refund deadline</dt><dd>{f.windowEndsAt ? dateTime(String(f.windowEndsAt)) : "—"} <span className="text-muted">({n(f.windowDays ?? a.windowDays)} days; {f.withinWindow ? "in time" : "passed"})</span></dd>
                          <dt className="text-muted">Paid course video</dt><dd>{hm(n(f.totalSec))} in {n(f.lessons)} lessons{f.paidVideoSecAtPurchase ? <span className="text-muted"> (at purchase {hm(n(f.paidVideoSecAtPurchase))})</span> : null}</dd>
                          <dt className="text-muted">Unique video watched</dt><dd>{hm(n(f.watchedSec))} · {n(f.lessonsStarted)} lessons started</dd>
                          <dt className="text-muted">Consumption</dt><dd className="font-bold tabular-nums">{pct(n(f.watchedPercent))} <span className="font-normal text-muted">(limit {pct(n(f.thresholdPercent))})</span></dd>
                          <dt className="text-muted">Lessons completed</dt><dd className="tabular-nums">{f.lessonsTotal != null ? `${n(f.lessonsCompleted)} of ${n(f.lessonsTotal)}` : "—"}</dd>
                          <dt className="text-muted">Study materials</dt><dd>{f.downloads != null ? `${n(f.downloads)} downloads since purchase` : "—"}</dd>
                          <dt className="text-muted">Tracking data</dt><dd className={f.tracking && f.tracking !== "ok" ? "font-bold text-amber" : ""}>{f.tracking === "missing" ? "Missing: a person decides" : f.tracking === "inconsistent" ? "Inconsistent: a person decides" : "Complete"}</dd>
                          <dt className="text-muted">Policy eligibility</dt><dd className={f.eligible ? "font-bold text-mint" : "font-bold text-amber"}>{f.eligible ? "Eligible" : f.investigation ? "Needs investigation" : `Not eligible: ${(Array.isArray(f.reasons) ? (f.reasons as string[]) : [String(f.reason)]).map((x) => REASON[x] ?? x).join(", ")}`}</dd>
                          <dt className="text-muted">Policy version</dt><dd>{String(f.policyVersion ?? r.policyVersion ?? "—")}{f.generousFrom ? ` (more generous rules of version ${String(f.generousFrom)} applied)` : ""}</dd>
                        </dl>
                      ))}
                      {r.message ? <div className="mt-3 rounded-tile border border-line bg-surface p-3 text-sm"><p className="font-bold">Automatic decision shown to the student</p><p className="mt-1 whitespace-pre-line text-ink-2" data-testid="refund-auto-message">{String(r.message)}</p></div> : null}
                      {arr(r.downloads).length ? (
                        <details className="mt-3 text-sm"><summary className="cursor-pointer font-bold">Download history ({arr(r.downloads).length})</summary>
                          <ul className="mt-1 space-y-0.5 text-ink-2">{arr(r.downloads).map((d, i) => <li key={i} className="flex justify-between gap-3"><span className="min-w-0 truncate">{String(d.title)}</span><span className="shrink-0 tabular-nums text-muted">{dateTime(String(d.at))}</span></li>)}</ul>
                        </details>
                      ) : null}
                      {r.reason ? <p className="mt-3 text-sm"><span className="text-muted">Student’s reason: </span>“{String(r.reason)}”</p> : null}
                      {r.reviewNote ? <p className="mt-2 rounded-lg bg-amber-soft px-3 py-2 text-sm text-amber"><span className="font-bold">Review asked:</span> {String(r.reviewNote)}</p> : null}
                      {r.aiSummary ? (
                        <div className="mt-3 rounded-tile border border-line bg-surface p-3 text-sm" data-testid="ai-summary">
                          <p className="flex items-center gap-1.5 font-bold"><Bot className="size-4 text-violet" />AI summary <span className="font-normal text-muted">({String(r.aiModel)}; explains the facts, never decides)</span></p>
                          <p className="mt-1 whitespace-pre-wrap text-ink-2">{String(r.aiSummary)}</p>
                        </div>
                      ) : data?.aiEnabled ? null : <p className="mt-3 text-xs text-muted">AI summaries appear here once ANTHROPIC_API_KEY is set.</p>}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-muted">Decision and processing</h3>
                      <p className="mt-2 text-sm"><span className="font-bold">{label}</span>{r.decidedAt ? ` · ${dateTime(String(r.decidedAt))}` : ""}{r.override ? " · exception" : ""}</p>
                      <dl className="mt-2 grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                        <dt className="text-muted">Payment</dt><dd className={pay?.[1] ?? ""}>{pay?.[0] ?? "Not sent"}{r.processedAt ? ` · ${dateTime(String(r.processedAt))}` : ""}</dd>
                        {r.paymentError ? <><dt className="text-muted">Provider error</dt><dd className="text-rose">{String(r.paymentError)}</dd></> : null}
                        <dt className="text-muted">Provider</dt><dd>{payment.provider === "test" ? "Test payment (no provider)" : String(payment.provider ?? "—")}</dd>
                        {payment.paymentIntentId ? <><dt className="text-muted">Payment reference</dt><dd className="break-all font-mono text-xs">{String(payment.paymentIntentId)}</dd></> : null}
                        {payment.stripeRefundId ? <><dt className="text-muted">Refund reference</dt><dd className="break-all font-mono text-xs">{String(payment.stripeRefundId)}</dd></> : null}
                      </dl>
                      {r.paymentStatus === "failed" ? <button type="button" className="btn btn-outline btn-sm mt-3" disabled={busy === id} onClick={() => void retry(id)} data-testid="retry-refund">{busy === id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Retry the payment</button> : null}
                      {r.decisionNote ? <p className="mt-1 text-sm text-ink-2">{String(r.decisionNote)}</p> : null}
                      <ul className="mt-2 text-sm text-ink-2">
                        {lines.map((l) => <li key={String(l.id)}>{String(l.title)}: {l.refundedAt ? `refunded ${date(String(l.refundedAt))}` : "not refunded"} · instructor share {moneyExact(n(l.instructorShareCents))} ({String(l.transferStatus) === "none" ? "cancelled or not owed" : String(l.transferStatus)})</li>)}
                      </ul>
                      <h3 className="mt-4 text-sm font-bold text-muted">History</h3>
                      <ol className="mt-1 space-y-1 text-sm" data-testid="refund-history">
                        {arr(r.history).map((h, i) => <li key={i} className="flex gap-2"><span className="w-36 shrink-0 tabular-nums text-muted">{dateTime(String(h.at))}</span><span>{ACTION[String(h.action)] ?? String(h.action)} <span className="text-muted">· {String(h.by)}</span></span></li>)}
                      </ol>
                      {needs && r.paymentStatus !== "failed" || (exception && superAdmin && policy.allowExceptions !== false && !needs) ? (
                        exception && !superAdmin ? <p className="mt-4 text-sm text-muted">Only a Super Admin can overturn an automatic decline.</p> : (
                          <div className="mt-4">
                            {exception && !needs ? <p className="mb-2 text-sm text-ink-2">Approve an exception only for a documented reason: a duplicate payment, a technical problem that blocked access, missing or defective content, wrong playback records, an unauthorised payment, an instructor issue or a legal right.</p> : null}
                            <label className="label" htmlFor={`note-${id}`}>{exception ? "Reason (required, kept in the audit log and sent to the student)" : "Note to the student (required to reject)"}</label>
                            <textarea id={`note-${id}`} className="field min-h-20" maxLength={1000} value={note[id] ?? ""} onChange={(e) => setNote((s) => ({ ...s, [id]: e.target.value }))} placeholder={exception ? "For example: duplicate payment confirmed in Stripe" : "Why"} />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" className="btn btn-danger btn-sm" disabled={busy === id || (exception && !(note[id] ?? "").trim())} onClick={() => void decide(id, true)} data-testid="approve-refund">{busy === id ? <Loader2 className="size-4 animate-spin" /> : null}{exception ? "Approve exception and refund" : "Approve refund"}</button>
                              {!exception || r.reviewRequestedAt ? <button type="button" className="btn btn-ghost btn-sm" disabled={busy === id || !(note[id] ?? "").trim()} onClick={() => void decide(id, false)}>{exception ? "Keep the decline" : "Reject"}</button> : null}
                            </div>
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      </>}
    </div>
  );
}
