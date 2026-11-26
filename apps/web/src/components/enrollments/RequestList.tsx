"use client";
import { Suspense, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Gift, Loader2, Mail, RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { qs } from "@/lib/qs";
import { obj } from "@/lib/normalize";
import { date, dateTime, moneyExact } from "@/lib/format";
import { StatusBadge } from "../StatusBadge";
import { Skeleton } from "../Empty";
import { Pager, useDebounced } from "../Pager";
import { useToast } from "../Toast";
import { ListFilters, type FilterOptions } from "../ListFilters";
import { useUrlFilters } from "@/lib/url-filters";

function fmtAmount(minor: number, currency: string) {
  try {
    const f = new Intl.NumberFormat("en", { style: "currency", currency });
    const d = f.resolvedOptions().maximumFractionDigits ?? 2;
    return f.format(minor / 10 ** d);
  } catch { return `${minor} ${currency}`; }
}

export interface Req {
  id: string; ref: string; status: string; createdAt: string;
  student: { email: string; name: string; hasAccount: boolean };
  requestedBy: { id: string; name: string | null; role: string };
  note: string; reviewNote: string | null; complimentary: boolean; complimentaryReason: string | null; decidedBy: string | null; decidedAt: string | null;
  invitation: { status: string; expiresAt: string | null; acceptedAt: string | null };
  items: { id: string; title: string; instructor: { name: string } | null; listPriceCents: number; expiresAt: string; activatedAt: string | null; revokedAt: string | null }[];
  payments: { id: string; method: string; reference: string; currency: string; amountMinor: number; usdRate: string; grossUsdCents: number; feeUsdCents: number; netUsdCents: number; status: string; recordedBy: string | null; verifiedBy: string | null; verifiedAt: string | null; allocations: { id: string; itemId: string; instructorCents: number; platformCents: number; netUsdCents: number; payoutStatus: string; payoutReference: string | null }[] }[];
  earnings: { id: string; itemId: string; netUsdCents: number; instructorCents: number; platformCents: number; payoutStatus: string }[];
  paymentStatus: string;
  history?: { action: string; at: string; actor: string | null }[];
}
const TABS = [["open", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"], ["", "All"]] as const;
const INVITE: Record<string, string> = { pending: "Invitation sent", accepted: "Invitation accepted", expired: "Invitation expired", revoked: "Invitation replaced or revoked", none: "No invitation yet", not_needed: "Existing account" };
const PAY: Record<string, string> = { payment_pending: "Payment pending", payment_verified: "Payment verified", complimentary: "Complimentary" };
const PAYOUT: Record<string, string> = { earnings_recorded: "Earnings recorded", payout_pending: "Payout pending", payout_completed: "Paid out" };
const ACTION: Record<string, string> = {
  "manual_enrollment.created": "Request created", "manual_enrollment.resubmitted": "More information sent", "manual_enrollment.approved": "Approved and activated",
  "manual_enrollment.rejected": "Rejected", "manual_enrollment.needs_info": "More information requested", "manual_enrollment.expiry_changed": "Access date changed",
  "manual_enrollment.access_revoked": "Access revoked", "external_payment.recorded": "Payment recorded", "external_payment.recorded_verified": "Payment recorded and verified",
  "external_payment.verified": "Payment verified", "external_payment.payout_pending": "Payout scheduled", "external_payment.payout_completed": "Payout completed",
  "invitation.sent": "Invitation emailed", "invitation.link_created": "Invitation link copied", "invitation.revoked": "Invitation revoked", "invitation.accepted": "Student created the account", "invitation.claimed": "Student added the courses to their account",
};

const FILTER_KEYS = ["status", "q", "instructor", "course", "from", "to", "page"] as const;

/** Requests with status tabs, search and filters (instructor for DEL, course, created between); all kept in the URL. */
export function RequestList(props: { mode: "instructor" | "super_admin" | "viewer"; refreshKey?: number }) {
  return <Suspense fallback={<Skeleton className="mt-5 h-60" />}><RequestListInner {...props} /></Suspense>;
}

function RequestListInner({ mode, refreshKey }: { mode: "instructor" | "super_admin" | "viewer"; refreshKey?: number }) {
  const [f, setF] = useUrlFilters(FILTER_KEYS);
  // No status in the URL = the "Waiting" tab; "all" = every status.
  const tab = (TABS.some(([k]) => k === f.status && k) ? f.status : f.status === "all" ? "" : "open") as (typeof TABS)[number][0];
  const page = Math.max(1, Number(f.page) || 1);
  const [q, setQ] = useState(f.q);
  const dq = useDebounced(q.trim());
  useEffect(() => {
    const v = dq.length > 1 ? dq : "";
    if (v !== f.q) setF({ q: v, page: null });
  }, [dq, f.q, setF]);
  const staff = mode !== "instructor";
  const opts = useApi("/enrollments/manual/filters", (r) => obj(r) as unknown as FilterOptions);
  const { data, error, reload } = useApi(`/enrollments/manual${qs({ status: tab || undefined, q: f.q || undefined, instructorId: staff ? f.instructor || undefined : undefined, courseId: f.course || undefined, from: f.from || undefined, to: f.to || undefined, page, pageSize: 20, k: refreshKey })}`, (r) => obj(r) as unknown as { items: Req[]; total: number; page: number; pageSize: number; counts: Record<string, number> });
  const [open, setOpen] = useState<string | null>(null);
  const waiting = (data?.counts.pending ?? 0) + (data?.counts.needs_info ?? 0);
  const filtered = !!(f.q || f.instructor || f.course || f.from || f.to);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <div role="tablist" className="flex gap-1 overflow-x-auto">
          {TABS.map(([k, l]) => (
            <button key={k || "all"} role="tab" type="button" aria-selected={tab === k} onClick={() => setF({ status: k === "open" ? null : k || "all", page: null })} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold ${tab === k ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {l}{k === "open" && waiting ? <span className="ml-1.5 rounded-full bg-amber px-1.5 text-xs text-[var(--on-amber)]">{waiting}</span> : null}
            </button>
          ))}
        </div>
        <input type="search" aria-label="Search requests" className="field mb-2 !w-64 max-w-full" placeholder="Student, email or ME-number" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ListFilters label="Filter requests" dates options={opts.data ? { courses: opts.data.courses, instructors: staff ? opts.data.instructors : undefined } : null}
        values={{ instructor: staff ? f.instructor : "", course: f.course, from: f.from, to: f.to }}
        onChange={(v) => setF({ instructor: v.instructor, course: v.course, from: v.from, to: v.to, page: null })} />
      {error ? <p className="mt-4 text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="mt-5 h-60" /> : null}
      {data ? (
        <>
          <ul className="mt-5 space-y-3">
            {data.items.map((r) => <RequestRow key={r.id} r={r} mode={mode} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} onChanged={reload} />)}
            {!data.items.length ? <li className="rounded-tile border border-line bg-surface px-4 py-10 text-center text-ink-2">{filtered ? "No requests match these filters." : tab === "open" ? "Nothing waiting." : "No requests here yet."}</li> : null}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(n) => setF({ page: n > 1 ? n : null })} noun="requests" />
        </>
      ) : null}
    </div>
  );
}

function RequestRow({ r, mode, open, onToggle, onChanged }: { r: Req; mode: "instructor" | "super_admin" | "viewer"; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [comp, setComp] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const isSuper = mode === "super_admin";
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast("ok", ok); onChanged(); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  };
  const canInvite = r.status === "approved" && !r.student.hasAccount && mode !== "viewer";
  async function copy() {
    setBusy("link");
    try {
      const res = obj(await api(`/enrollments/manual/${r.id}/invitation/link`, { method: "POST" }));
      const l = String(res.link);
      setLink(l);
      try { await navigator.clipboard.writeText(l); toast("ok", "New invitation link copied. Earlier links no longer work."); } catch { toast("ok", "New invitation link ready below."); }
      onChanged();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  const earn = (itemId: string) => r.earnings.find((e) => e.itemId === itemId);
  return (
    <li className="rounded-tile border border-line bg-surface" data-testid="enrollment-request">
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left">
        <span className="min-w-0">
          <span className="block truncate font-bold"><span className="text-muted">{r.ref}</span> · {r.student.name} <span className="font-normal text-muted">· {r.student.email}</span></span>
          <span className="block truncate text-sm text-ink-2">{r.items.map((i) => i.title).join(", ")}</span>
          <span className="mt-1 block text-xs text-muted">{isSuper || mode === "viewer" ? `By ${r.requestedBy.name ?? "—"}${r.requestedBy.role === "super_admin" ? " (direct)" : ""} · ` : ""}{date(r.createdAt)} · {PAY[r.paymentStatus]} · {INVITE[r.invitation.status]}</span>
        </span>
        <span className="flex items-center gap-2"><StatusBadge status={r.status === "needs_info" ? "needs_info" : r.status} /><ChevronDown className={`size-4 text-muted transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open ? (
        <div className="space-y-5 border-t border-line px-4 py-5">
          {r.reviewNote ? <p className="rounded-tile bg-amber-soft px-3 py-2 text-sm text-ink"><b>Note from DEL:</b> {r.reviewNote}</p> : null}
          {r.note ? <p className="whitespace-pre-line text-sm text-ink-2"><b className="text-ink">Request note:</b> {r.note}</p> : null}
          <div className="overflow-x-auto rounded-tile border border-line">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-surface-2/60 text-muted"><tr><th className="px-3 py-2 font-bold">Course</th><th className="px-3 py-2 font-bold">Instructor</th><th className="px-3 py-2 font-bold">Price</th><th className="px-3 py-2 font-bold">Access until</th><th className="px-3 py-2 font-bold">Earnings</th>{isSuper ? <th className="px-3 py-2"><span className="sr-only">Actions</span></th> : null}</tr></thead>
              <tbody className="divide-y divide-line">
                {r.items.map((i) => {
                  const e = earn(i.id);
                  return (
                    <tr key={i.id}>
                      <td className="px-3 py-2 font-bold">{i.title}{i.revokedAt ? <span className="ml-2 text-xs text-rose">revoked</span> : i.activatedAt ? <span className="ml-2 text-xs text-mint">active</span> : null}</td>
                      <td className="px-3 py-2 text-ink-2">{i.instructor?.name ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{moneyExact(i.listPriceCents)}</td>
                      <td className="px-3 py-2">{date(i.expiresAt)}</td>
                      <td className="px-3 py-2 text-xs">{e ? <>{moneyExact(e.instructorCents)} instructor · {moneyExact(e.platformCents)} DEL<span className="block text-muted">{PAYOUT[e.payoutStatus]}</span></> : r.complimentary ? "None (complimentary)" : "—"}</td>
                      {isSuper ? <td className="px-3 py-2 text-right"><ItemActions itemId={i.id} title={i.title} expiresAt={i.expiresAt} revoked={!!i.revokedAt} onChanged={onChanged} /></td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isSuper && r.payments.length ? (
            <div>
              <h3 className="font-display font-bold">Payments</h3>
              <ul className="mt-2 space-y-2">
                {r.payments.map((p) => (
                  <li key={p.id} className="rounded-tile border border-line px-3 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-bold">{p.method.replace("_", " ")} · {p.reference}</span>
                      <span className="tabular-nums">{fmtAmount(p.amountMinor, p.currency)}{p.currency !== "USD" ? ` at ${p.usdRate}` : ""} = {moneyExact(p.grossUsdCents)} · fees {moneyExact(p.feeUsdCents)} · net {moneyExact(p.netUsdCents)}</span>
                      <StatusBadge status={p.status === "verified" ? "approved" : "pending"} />
                      {p.status !== "verified" ? <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => act("v" + p.id, () => api(`/enrollments/payments/${p.id}/verify`, { method: "POST" }), "Payment verified.")}><ShieldCheck className="size-4" />Mark verified</button> : <span className="text-xs text-muted">verified by {p.verifiedBy} {dateTime(p.verifiedAt)}</span>}
                    </div>
                    {p.status === "verified" ? (
                      <ul className="mt-2 space-y-1">
                        {p.allocations.map((al) => (
                          <li key={al.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="min-w-0 flex-1 text-ink-2">{r.items.find((i) => i.id === al.itemId)?.title}: {moneyExact(al.instructorCents)} to the instructor · {PAYOUT[al.payoutStatus]}{al.payoutReference ? ` (${al.payoutReference})` : ""}</span>
                            {al.payoutStatus === "earnings_recorded" ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => act("p" + al.id, () => api(`/enrollments/allocations/${al.id}/payout`, { method: "POST", body: { status: "payout_pending" } }), "Payout scheduled.")}>Schedule payout</button> : null}
                            {al.payoutStatus !== "payout_completed" ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const ref = window.prompt("Payout reference (bank or transfer id)")?.trim(); if (ref) void act("c" + al.id, () => api(`/enrollments/allocations/${al.id}/payout`, { method: "POST", body: { status: "payout_completed", reference: ref } }), "Payout recorded as completed."); }}>Mark paid out</button> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isSuper && (r.status === "pending" || r.status === "needs_info") ? <ApproveBox r={r} onChanged={onChanged} comp={comp} setComp={setComp} /> : null}

          {canInvite || (isSuper && r.invitation.status === "pending") ? (
            <div className="flex flex-wrap items-center gap-2">
              {canInvite ? <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={copy} data-testid="copy-invite">{busy === "link" ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}Copy invitation link</button> : null}
              {canInvite ? <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => act("resend", () => api(`/enrollments/manual/${r.id}/invitation/resend`, { method: "POST" }), "Invitation emailed again with a new link.")}><Mail className="size-4" />Resend invitation</button> : null}
              {isSuper && r.invitation.status === "pending" ? <button type="button" className="btn btn-ghost btn-sm text-rose" disabled={!!busy} onClick={() => act("revoke", () => api(`/enrollments/manual/${r.id}/invitation/revoke`, { method: "POST" }), "Invitation revoked.")}>Revoke invitation</button> : null}
              {r.invitation.expiresAt && r.invitation.status === "pending" ? <span className="text-xs text-muted">Link valid until {dateTime(r.invitation.expiresAt)}. Each new link replaces the previous one.</span> : null}
            </div>
          ) : null}
          {link ? <p className="break-all rounded-tile bg-surface-2 px-3 py-2 text-xs" data-testid="invite-link">{link}</p> : null}

          {isSuper && (r.status === "pending" || r.status === "needs_info") ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
              <div className="min-w-0 flex-1"><label className="label" htmlFor={`n-${r.id}`}>Note for the instructor</label><input id={`n-${r.id}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required to ask for information or reject" /></div>
              <button type="button" className="btn btn-outline btn-sm !min-h-11" disabled={!!busy || note.trim().length < 3} onClick={() => act("ni", () => api(`/enrollments/manual/${r.id}/decision`, { method: "POST", body: { decision: "needs_info", note } }), "Question sent to the instructor.")}>Ask for information</button>
              <button type="button" className="btn btn-ghost btn-sm !min-h-11 text-rose" disabled={!!busy || note.trim().length < 3} onClick={() => act("rj", () => api(`/enrollments/manual/${r.id}/decision`, { method: "POST", body: { decision: "rejected", note } }), "Request rejected.")}>Reject</button>
            </div>
          ) : null}

          {mode === "instructor" && r.status === "needs_info" ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
              <div className="min-w-0 flex-1"><label className="label" htmlFor={`a-${r.id}`}>Your answer</label><input id={`a-${r.id}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment reference, date…" /></div>
              <button type="button" className="btn btn-primary btn-sm !min-h-11" disabled={!!busy || note.trim().length < 3} onClick={() => act("rs", () => api(`/enrollments/manual/${r.id}/resubmit`, { method: "POST", body: { note } }), "Sent back to DEL.")}><RotateCcw className="size-4" />Send to DEL</button>
            </div>
          ) : null}

          {r.history?.length ? (
            <details className="text-sm"><summary className="cursor-pointer font-bold">History</summary>
              <ol className="mt-2 divide-y divide-line">{r.history.map((h, i) => <li key={i} className="flex flex-wrap gap-x-3 py-1.5"><span className="w-40 shrink-0 text-muted">{dateTime(h.at)}</span><span>{ACTION[h.action] ?? h.action}{h.actor ? <span className="text-muted"> · {h.actor}</span> : null}</span></li>)}</ol>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ApproveBox({ r, onChanged, comp, setComp }: { r: Req; onChanged: () => void; comp: string; setComp: (s: string) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"payment" | "complimentary">("payment");
  const [p, setP] = useState({ method: "mobile_money", reference: "", currency: "USD", amount: "", usdRate: "1", fee: "0" });
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const verified = r.items.every((i) => r.payments.some((pp) => pp.status === "verified" && pp.allocations.some((a) => a.itemId === i.id)));
  async function go() {
    setBusy(true);
    try {
      if (mode === "payment" && !verified) {
        const usd = p.currency.toUpperCase() === "USD";
        await api(`/enrollments/manual/${r.id}/payments`, { method: "POST", body: { method: p.method, reference: p.reference.trim(), currency: p.currency.toUpperCase(), amount: p.amount.trim(), usdRate: usd ? "1" : p.usdRate.trim(), feeUsdCents: Math.round(Number(p.fee || 0) * 100), allocations: r.items.map((i) => ({ itemId: i.id, grossUsdCents: Math.round(Number(alloc[i.id] ?? 0) * 100) })), verify: true } });
      }
      await api(`/enrollments/manual/${r.id}/approve`, { method: "POST", body: mode === "complimentary" ? { complimentary: true, complimentaryReason: comp.trim() } : {} });
      toast("ok", r.student.hasAccount ? "Approved. The courses are in the student’s account." : "Approved. The invitation is on its way.");
      onChanged();
    } catch (e) { toast("error", errMsg(e)); onChanged(); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-tile border border-violet/40 bg-violet-soft/30 p-4" data-testid="approve-box">
      <h3 className="font-display font-bold">Verify and approve</h3>
      <div role="radiogroup" className="mt-2 flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={mode === "payment"} onClick={() => setMode("payment")} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${mode === "payment" ? "border-violet bg-violet-soft text-violet" : "border-line text-ink-2"}`}><Wallet className="size-4" />{verified ? "Payment verified" : "Payment received"}</button>
        <button type="button" role="radio" aria-checked={mode === "complimentary"} onClick={() => setMode("complimentary")} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${mode === "complimentary" ? "border-violet bg-violet-soft text-violet" : "border-line text-ink-2"}`}><Gift className="size-4" />Complimentary</button>
      </div>
      {mode === "complimentary" ? (
        <input aria-label="Why it is complimentary" className="field mt-3" value={comp} onChange={(e) => setComp(e.target.value)} placeholder="Why it is complimentary (kept in the record)" />
      ) : verified ? <p className="mt-2 text-sm text-ink-2">Every course is covered by a verified payment.</p> : (
        <div className="mt-3 grid gap-3 sm:grid-cols-6">
          <select aria-label="Method" className="field sm:col-span-2" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })}><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="paypal">PayPal</option><option value="other">Other</option></select>
          <input aria-label="Reference" className="field sm:col-span-4" placeholder="Transaction reference" value={p.reference} onChange={(e) => setP({ ...p, reference: e.target.value })} />
          <input aria-label="Currency" className="field uppercase sm:col-span-1" maxLength={3} value={p.currency} onChange={(e) => setP({ ...p, currency: e.target.value.toUpperCase() })} />
          <input aria-label="Amount" inputMode="decimal" className="field sm:col-span-2" placeholder="Amount" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} />
          <input aria-label="USD rate" inputMode="decimal" className="field sm:col-span-2" placeholder="USD per unit" disabled={p.currency.toUpperCase() === "USD"} value={p.currency.toUpperCase() === "USD" ? "1" : p.usdRate} onChange={(e) => setP({ ...p, usdRate: e.target.value })} />
          <input aria-label="Fees in USD" inputMode="decimal" className="field sm:col-span-1" placeholder="Fees" value={p.fee} onChange={(e) => setP({ ...p, fee: e.target.value })} />
          <div className="space-y-1.5 sm:col-span-6">
            {r.items.map((i) => <label key={i.id} className="flex items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate">{i.title} <span className="text-muted">(list {moneyExact(i.listPriceCents)})</span></span><input aria-label={`USD for ${i.title}`} inputMode="decimal" className="field !min-h-9 !w-28" value={alloc[i.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [i.id]: e.target.value })} placeholder="USD" /></label>)}
          </div>
        </div>
      )}
      <button type="button" className="btn btn-primary btn-sm mt-3" disabled={busy || (mode === "complimentary" && comp.trim().length < 5)} onClick={go} data-testid="approve-request">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Approve and activate</button>
    </div>
  );
}

function ItemActions({ itemId, title, expiresAt, revoked, onChanged }: { itemId: string; title: string; expiresAt: string; revoked: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (revoked) return null;
  return (
    <span className="inline-flex gap-1">
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
        const d = window.prompt(`New access date for ${title} (YYYY-MM-DD)`, expiresAt.slice(0, 10))?.trim();
        if (!d) return;
        const reason = window.prompt("Why does the date change?")?.trim();
        if (!reason) return;
        setBusy(true);
        try { await api(`/enrollments/items/${itemId}/expiry`, { method: "PUT", body: { expiresAt: d, reason } }); toast("ok", "Access date changed."); onChanged(); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
      }}>Change date</button>
      <button type="button" className="btn btn-ghost btn-sm text-rose" disabled={busy} onClick={async () => {
        const reason = window.prompt(`Revoke access to ${title}? Say why (progress is kept).`)?.trim();
        if (!reason) return;
        setBusy(true);
        try { await api(`/enrollments/items/${itemId}/revoke`, { method: "POST", body: { reason } }); toast("ok", "Access revoked."); onChanged(); } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
      }}>Revoke</button>
    </span>
  );
}
