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

type R = Record<string, unknown>;
const arr = (x: unknown) => (Array.isArray(x) ? (x as R[]) : []);
const n = (v: unknown) => Number(v ?? 0) || 0;
const TABS: [string, string][] = [["needs_action", "Needs action"], ["", "All"], ["auto_approved", "Refunded automatically"], ["approved", "Approved"], ["auto_declined", "Declined by policy"], ["declined", "Declined after review"]];
const STATUS: Record<string, [string, string]> = {
  pending: ["Waiting: over yearly limit", "bg-amber-soft text-amber"], auto_approved: ["Refunded automatically", "bg-mint-soft text-mint"],
  approved: ["Approved", "bg-mint-soft text-mint"], auto_declined: ["Declined by policy", "bg-surface-2 text-ink-2"], declined: ["Declined after review", "bg-rose-soft text-rose"],
};
const REASON: Record<string, string> = { watched_too_much: "Watched more than 25%", window_closed: "Outside the 14-day window", certificate_issued: "Certificate issued", disputed: "Payment disputed" };
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
  const [tab, setTab] = useState("needs_action");
  const { data, error, reload } = useApi(`/admin/refund-requests${tab ? `?status=${tab}` : ""}`, (r) => obj(r));
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const items = arr(data?.items);
  const counts = obj(data?.counts);

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    try {
      await api(`/admin/refund-requests/${id}/${approve ? "approve" : "decline"}`, { method: "POST", body: { note: note[id]?.trim() || undefined } });
      toast("ok", approve ? "Refund approved and issued. The student is emailed." : "Declined. The student is emailed your note.");
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <div className="max-w-[1600px]">
      <PageHead title="Refunds" sub="Every refund request with the facts from purchase and playback records. Policy: within 14 days and 25% or less watched; eligible requests are refunded automatically (3 a year per student). Only Super Admins can overturn an automatic decline." />
      <div role="group" aria-label="Filter requests" className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([k, l]) => (
          <button key={k || "all"} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}
            className={`rounded-full border px-3 py-1 text-sm font-bold ${tab === k ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>
            {l}{k && counts[k] != null ? <span className="ml-1.5 tabular-nums">{n(counts[k])}</span> : null}
          </button>
        ))}
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-64" /> : null}
      {data && !items.length ? <Empty icon={RotateCcw} title={tab === "needs_action" ? "Nothing waiting" : "No requests here"} body={tab === "needs_action" ? "Requests over a student’s yearly limit, and reviews students ask for, appear here." : "Refund requests will be listed as students make them."} /> : null}
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
            return (
              <li key={id} data-testid="refund-row">
                <button type="button" className="grid w-full gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto]" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen}>
                  <span className="min-w-0"><span className="block truncate font-bold">{String(user.name)}</span><span className="block truncate text-sm text-muted">{String(user.email)}</span></span>
                  <span className="min-w-0 text-sm"><span className="block truncate">{lines.map((l) => String(l.title)).join(", ")}</span><span className="text-muted">{moneyExact(lines.reduce((s, l) => s + n(l.priceCents), 0))} · requested {date(String(r.createdAt))}</span></span>
                  <span className="text-sm tabular-nums">{facts.map((f) => `${n(f.watchedPercent)}%`).join(", ")} watched</span>
                  <span className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tone}`}>{needs && exception ? "Review requested" : label}</span><ChevronDown className={`size-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} /></span>
                </button>
                {isOpen ? (
                  <div className="grid gap-5 border-t border-line bg-surface-2/40 px-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-muted">Refund analysis</h3>
                      {facts.map((f) => (
                        <dl key={String(f.lineId)} className="mt-2 grid grid-cols-[11rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-tile border border-line bg-surface p-3 text-sm" data-testid="refund-facts">
                          <dt className="text-muted">Course</dt><dd className="font-bold">{String(f.title)}{f.renewal ? " (renewal)" : ""}</dd>
                          <dt className="text-muted">Purchased</dt><dd>{f.purchasedAt ? dateTime(String(f.purchasedAt)) : "—"} · {moneyExact(n(f.priceCents))}</dd>
                          <dt className="text-muted">Refund requested</dt><dd>{dateTime(String(a.requestedAt ?? r.createdAt))}</dd>
                          <dt className="text-muted">14-day window</dt><dd>{f.withinWindow ? "Within" : "Ended"}{f.windowEndsAt ? ` (until ${date(String(f.windowEndsAt))})` : ""}</dd>
                          <dt className="text-muted">Course video</dt><dd>{hm(n(f.totalSec))} in {n(f.lessons)} lessons</dd>
                          <dt className="text-muted">Unique video watched</dt><dd>{hm(n(f.watchedSec))} · {n(f.lessonsStarted)} lessons started</dd>
                          <dt className="text-muted">Consumption</dt><dd className="font-bold tabular-nums">{n(f.watchedPercent)}% <span className="font-normal text-muted">(limit {n(f.thresholdPercent)}%)</span></dd>
                          <dt className="text-muted">Policy eligibility</dt><dd className={f.eligible ? "font-bold text-mint" : "font-bold text-amber"}>{f.eligible ? "Eligible" : `Not eligible: ${REASON[String(f.reason)] ?? String(f.reason)}`}</dd>
                        </dl>
                      ))}
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
                      <p className="mt-2 text-sm"><span className="font-bold">{label}</span>{r.decidedAt ? ` · ${dateTime(String(r.decidedAt))}` : ""}</p>
                      {r.decisionNote ? <p className="mt-1 text-sm text-ink-2">{String(r.decisionNote)}</p> : null}
                      <ul className="mt-2 text-sm text-ink-2">
                        {lines.map((l) => <li key={String(l.id)}>{String(l.title)}: {l.refundedAt ? `refunded ${date(String(l.refundedAt))}` : "not refunded"} · instructor share {moneyExact(n(l.instructorShareCents))} ({String(l.transferStatus) === "none" ? "cancelled or not owed" : String(l.transferStatus)})</li>)}
                      </ul>
                      <h3 className="mt-4 text-sm font-bold text-muted">History</h3>
                      <ol className="mt-1 space-y-1 text-sm" data-testid="refund-history">
                        {arr(r.history).map((h, i) => <li key={i} className="flex gap-2"><span className="w-36 shrink-0 tabular-nums text-muted">{dateTime(String(h.at))}</span><span>{ACTION[String(h.action)] ?? String(h.action)} <span className="text-muted">· {String(h.by)}</span></span></li>)}
                      </ol>
                      {needs ? (
                        exception && !superAdmin ? <p className="mt-4 text-sm text-muted">Only a Super Admin can overturn an automatic decline.</p> : (
                          <div className="mt-4">
                            <label className="label" htmlFor={`note-${id}`}>Note to the student {exception ? "(required)" : "(required to decline)"}</label>
                            <textarea id={`note-${id}`} className="field min-h-20" maxLength={1000} value={note[id] ?? ""} onChange={(e) => setNote((s) => ({ ...s, [id]: e.target.value }))} placeholder={exception ? "Why the exception is approved or the decline stands" : "Why"} />
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button type="button" className="btn btn-danger btn-sm" disabled={busy === id || (exception && !(note[id] ?? "").trim())} onClick={() => void decide(id, true)} data-testid="approve-refund">{busy === id ? <Loader2 className="size-4 animate-spin" /> : null}{exception ? "Approve exception and refund" : "Approve refund"}</button>
                              <button type="button" className="btn btn-ghost btn-sm" disabled={busy === id || !(note[id] ?? "").trim()} onClick={() => void decide(id, false)}>{exception ? "Keep the decline" : "Decline"}</button>
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
    </div>
  );
}
