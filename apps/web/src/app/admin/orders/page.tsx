"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj, paged, toOrder } from "@/lib/normalize";
import { qs } from "@/lib/qs";
import { date, dateTime, moneyExact } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Empty";
import { Modal } from "@/components/Modal";
import { Pager, useDebounced } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { StackTable } from "@/components/StackTable";

const map = (r: unknown) => paged(r, toOrder, "orders");
const STATUSES = ["", "paid", "partially_refunded", "refunded", "pending", "failed"] as const;

type DetailLine = {
  id: string; title: string; instructor: string; isPlatform: boolean; official: boolean; priceCents: number; commissionBps: number;
  commissionCents: number; instructorShareCents: number; transferStatus: string; refundedAt: string | null; refundable: boolean;
  feeCents: number; payee: string; transferDueAt: string | null; disputeStatus: string | null;
};
type Detail = {
  id: string; status: string; provider: string; currency: string; totalCents: number; refundedCents: number; paidAt: string | null;
  user: { name: string; email: string } | null; lines: DetailLine[];
  terms: { version: string; acceptedAt: string | null; ip: string | null } | null; history: { id: string; action: string; at: string; actor: string | null }[];
};
const toDetail = (x: unknown): Detail => {
  const o = obj(x);
  const n = (v: unknown) => Number(v ?? 0) || 0;
  return {
    id: String(o.id ?? ""), status: String(o.status ?? ""), provider: String(o.provider ?? ""), currency: String(o.currency ?? "usd"),
    totalCents: n(o.totalCents), refundedCents: n(o.refundedCents), paidAt: (o.paidAt as string) ?? null,
    user: o.user ? { name: String(obj(o.user).name ?? ""), email: String(obj(o.user).email ?? "") } : null,
    terms: obj(o.terms).version ? { version: String(obj(o.terms).version), acceptedAt: (obj(o.terms).acceptedAt as string) ?? null, ip: (obj(o.terms).ip as string) ?? null } : null,
    lines: (Array.isArray(o.lines) ? o.lines : []).map((l) => {
      const lo = obj(l);
      return {
        id: String(lo.id), title: String(obj(lo.course).title ?? "Course"), instructor: String(obj(lo.instructor).name ?? ""),
        isPlatform: !!obj(lo.instructor).isPlatform, official: !!obj(lo.instructor).official, priceCents: n(lo.priceCents), commissionBps: n(lo.commissionBps),
        commissionCents: n(lo.commissionCents), instructorShareCents: n(lo.instructorShareCents), transferStatus: String(lo.transferStatus ?? "none"),
        refundedAt: (lo.refundedAt as string) ?? null, refundable: !!lo.refundable,
        feeCents: n(lo.feeCents), payee: String(lo.payee ?? "instructor"), transferDueAt: (lo.transferDueAt as string) ?? null, disputeStatus: (lo.disputeStatus as string) ?? null,
      };
    }),
    history: (Array.isArray(o.history) ? o.history : []).map((h) => {
      const ho = obj(h);
      return { id: String(ho.id), action: String(ho.action), at: String(ho.at), actor: ho.actor ? String(obj(ho.actor).name ?? "") : null };
    }),
  };
};
const payoutText = (l: DetailLine) =>
  l.disputeStatus === "open" ? "Frozen: dispute"
  : l.payee === "platform" ? "DEL course, no transfer"
  : l.payee === "del_agreement" ? "Paid to DEL (agreement)"
  : l.transferStatus === "paid" ? "Transferred"
  : l.transferStatus === "reversed" ? "Taken back"
  : l.transferStatus === "pending" ? (l.transferDueAt && new Date(l.transferDueAt) > new Date() ? `Held until ${date(l.transferDueAt)}` : "Due")
  : "No transfer";

function OrderDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const toast = useToast();
  const { data, error, reload } = useApi(`/admin/orders/${id}`, toDetail);
  const [sel, setSel] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (error) return <p className="p-5 text-rose">{error}</p>;
  if (!data) return <div className="p-5"><Skeleton className="h-48" /></div>;
  const refundable = data.lines.filter((l) => l.refundable);
  const chosen = data.lines.filter((l) => sel.includes(l.id));
  const amount = chosen.reduce((a, l) => a + l.priceCents, 0);
  const all = chosen.length === refundable.length;
  async function refund() {
    setBusy(true);
    try {
      await api(`/admin/orders/${id}/refund`, { method: "POST", body: { lineIds: all ? undefined : sel, reason: reason.trim() || undefined } });
      toast("ok", `Refunded ${moneyExact(amount, data!.currency)}. Access removed for ${chosen.length === 1 ? "that course" : "those courses"}.`);
      setSel([]); setReason(""); setConfirming(false); reload(); onChanged();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <StatusBadge status={data.status} />
        <span className="text-ink-2">{data.user ? `${data.user.name} · ${data.user.email}` : "—"}</span>
        <span className="text-muted">Paid {dateTime(data.paidAt)} · {data.provider === "test" ? "development test payment" : data.provider}</span>
      </div>
      <StackTable className="overflow-x-auto rounded-tile border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-surface-2/60 text-muted"><tr><th className="px-3 py-2"><span className="sr-only">Select</span></th><th className="px-3 py-2">Course</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Stripe fee</th><th className="px-3 py-2 text-right">Platform</th><th className="px-3 py-2 text-right">Instructor</th><th className="px-3 py-2">Payout</th></tr></thead>
          <tbody className="divide-y divide-line">
            {data.lines.map((l) => (
              <tr key={l.id} className={l.refundedAt ? "text-muted" : ""}>
                <td className="px-3 py-2">{l.refundable ? <input type="checkbox" aria-label={`Refund ${l.title}`} checked={sel.includes(l.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id))} /> : null}</td>
                <td className="px-3 py-2"><span className="block font-bold text-ink">{l.title}</span><span className="text-xs text-muted">{l.instructor}{l.isPlatform ? " (platform)" : l.official ? " (Official DEL)" : " (independent)"}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyExact(l.priceCents, data.currency)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-2">{moneyExact(l.feeCents, data.currency)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyExact(l.commissionCents, data.currency)} <span className="text-xs text-muted">({l.commissionBps / 100}% of net)</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{moneyExact(l.instructorShareCents, data.currency)}</td>
                <td className="px-3 py-2 text-xs">{l.refundedAt ? <StatusBadge status="refunded" /> : payoutText(l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </StackTable>
      <p className="text-sm text-ink-2">Total {moneyExact(data.totalCents, data.currency)}{data.refundedCents ? `, refunded ${moneyExact(data.refundedCents, data.currency)}` : ""}.</p>
      <p className="text-sm text-ink-2" data-testid="order-terms">
        {data.terms
          ? <>Terms accepted: version <b className="text-ink">{data.terms.version}</b> on {dateTime(data.terms.acceptedAt)}{data.terms.ip ? <> from IP <span className="font-mono text-xs">{data.terms.ip}</span></> : null}.</>
          : "Terms acceptance: not recorded (order placed before acceptance was recorded)."}
      </p>
      {refundable.length ? (
        <div className="rounded-tile border border-line p-4">
          <h3 className="font-display font-bold">Refund</h3>
          <p className="mt-1 text-sm text-ink-2">Select the courses to refund. The money goes back to the learner’s card, instructor transfers for those courses are reversed, and access is removed.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSel(refundable.map((l) => l.id))}>Select all refundable</button>
            {sel.length ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel([])}>Clear</button> : null}
          </div>
          <label className="label mt-4" htmlFor="reason">Reason (kept in the audit log)</label>
          <input id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Requested by the learner" />
          {confirming ? (
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2" role="alert">
              <span className="mr-auto text-sm font-bold text-rose">Refund {moneyExact(amount, data.currency)} for {chosen.length} {chosen.length === 1 ? "course" : "courses"}? This can’t be undone.</span>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={refund} data-testid="confirm-refund">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Refund</button>
            </div>
          ) : (
            <div className="mt-4 flex justify-end"><button type="button" className="btn btn-danger" disabled={!sel.length} onClick={() => setConfirming(true)}>Refund {sel.length ? moneyExact(amount, data.currency) : "selected"}</button></div>
          )}
        </div>
      ) : null}
      {data.history.length ? (
        <div>
          <h3 className="font-display font-bold">History</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">{data.history.map((h) => <li key={h.id}><span className="text-muted">{dateTime(h.at)}</span> · {h.action.replace(/[._]/g, " ")}{h.actor ? ` by ${h.actor}` : ""}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminOrders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const { data, error, reload } = useApi(`/admin/orders${qs({ q: dq.length > 1 ? dq : undefined, status, page, pageSize: 25 })}`, map);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <PageHead title="Orders" sub="Every checkout. Open an order to see the split per course and to refund some or all of it." />
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="search" aria-label="Search orders" className="field !w-80 max-w-full" placeholder="Order id, learner or course" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select aria-label="Order status" className="field !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {STATUSES.map((s) => <option key={s} value={s}>{s ? s.replace("_", " ") : "All statuses"}</option>)}
        </select>
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <>
          <DataTable head={["Order", "Learner", "Courses", "Total", "Status", "Date", ""]} min={900} empty={!data.items.length ? <p className="px-4 py-10 text-center text-ink-2">No orders match.</p> : null}>
            {data.items.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 text-xs text-muted">{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3">{o.user ? <><span className="block font-bold">{o.user.name}</span><span className="text-xs text-muted">{o.user.email}</span></> : "—"}</td>
                <td className="max-w-xs px-4 py-3">{o.lines.length ? o.lines.map((l) => l.title).join(", ") : `${o.lineCount ?? 0} ${o.lineCount === 1 ? "course" : "courses"}`}</td>
                <td className="px-4 py-3 tabular-nums">{moneyExact(o.totalCents, o.currency)}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{dateTime(o.paidAt ?? o.createdAt)}</td>
                <td className="px-4 py-3 text-right"><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(o.id)} data-testid="order-details">Details</button></td>
              </tr>
            ))}
          </DataTable>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="orders" />
        </>
      ) : !error ? <Skeleton className="h-80" /> : null}
      <Modal open={!!open} onClose={() => setOpen(null)} title={`Order ${open?.slice(0, 8) ?? ""}`} wide>
        {open ? <OrderDetail key={open} id={open} onChanged={reload} /> : null}
      </Modal>
    </>
  );
}
