"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, toOrder } from "@/lib/normalize";
import { dateTime, moneyExact } from "@/lib/format";
import type { Order } from "@/lib/types";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Empty";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

const map = (r: unknown) => list(r, "orders").map(toOrder);

export default function AdminOrders() {
  const toast = useToast();
  const { data, error, reload } = useApi("/admin/orders?pageSize=100", map);
  const [refund, setRefund] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead title="Orders" sub="Every checkout. Refunds go back to the learner’s card through Stripe, reverse instructor transfers and remove access." />
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <DataTable head={["Order", "Learner", "Courses", "Total", "Status", "Date", ""]} min={900} empty={!data.length ? <p className="px-4 py-10 text-center text-ink-2">No orders yet.</p> : null}>
          {data.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3 text-xs text-muted">{o.id.slice(0, 8)}</td>
              <td className="px-4 py-3">{o.user ? <><span className="block font-bold">{o.user.name}</span><span className="text-xs text-muted">{o.user.email}</span></> : "—"}</td>
              <td className="max-w-xs px-4 py-3">{o.lines.length ? o.lines.map((l) => l.title).join(", ") : `${o.lineCount ?? 0} ${o.lineCount === 1 ? "course" : "courses"}`}</td>
              <td className="px-4 py-3 tabular-nums">{moneyExact(o.totalCents, o.currency)}</td>
              <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{dateTime(o.paidAt ?? o.createdAt)}</td>
              <td className="px-4 py-3 text-right">{o.status === "paid" ? <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => setRefund(o)}>Refund</button> : null}</td>
            </tr>
          ))}
        </DataTable>
      ) : !error ? <Skeleton className="h-80" /> : null}
      <Modal open={!!refund} onClose={() => setRefund(null)} title="Refund order">
        {refund ? (
          <form className="space-y-4 p-5" onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/admin/orders/${refund.id}/refund`, { method: "POST", body: { reason: reason || undefined } });
              toast("ok", "Refund issued. Access has been removed and transfers reversed.");
              setRefund(null); setReason(""); reload();
            } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
          }}>
            <p className="text-ink-2">Refund <b className="text-ink">{moneyExact(refund.totalCents, refund.currency)}</b> to {refund.user?.name ?? "the learner"} for {refund.lineCount ?? refund.lines.length} {(refund.lineCount ?? refund.lines.length) === 1 ? "course" : "courses"}. This can’t be undone.</p>
            <div><label className="label" htmlFor="reason">Reason (kept in the audit log)</label><input id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Requested by learner within 30 days" /></div>
            <div className="flex justify-end gap-2"><button type="button" className="btn btn-ghost" onClick={() => setRefund(null)}>Cancel</button><button className="btn btn-danger" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Refund order</button></div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
