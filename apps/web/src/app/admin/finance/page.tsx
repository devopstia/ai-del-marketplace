"use client";
import { useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { dateTime, moneyExact } from "@/lib/format";
import { PageHead, Kpis, DataTable } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";

type R = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0) || 0;
const rows = (r: unknown) => (Array.isArray(obj(r).items) ? (obj(r).items as R[]) : []);

function RefundRequests({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const { data, reload } = useApi("/admin/refund-requests?status=pending", rows);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  async function decide(id: string, approve: boolean) {
    setBusy(id);
    try {
      await api(`/admin/refund-requests/${id}/${approve ? "approve" : "decline"}`, { method: "POST", body: { note: note[id]?.trim() || undefined } });
      toast("ok", approve ? "Refund approved and issued." : "Request declined. The learner sees your note.");
      reload(); onChanged();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  return (
    <section className="mt-10" aria-labelledby="rr-h">
      <h2 id="rr-h" className="font-display text-lg font-bold">Refund requests</h2>
      <p className="mt-1 text-sm text-ink-2">Learners who used their 3 instant refunds this year. Approving refunds the card, removes access and recovers the instructor’s share.</p>
      {!data ? <Skeleton className="mt-3 h-24" /> : !data.length ? <p className="mt-3 rounded-tile border border-line bg-surface px-4 py-6 text-center text-sm text-ink-2">No requests waiting.</p> : (
        <ul className="mt-3 divide-y divide-line rounded-tile border border-line bg-surface">
          {data.map((r) => {
            const id = String(r.id);
            const user = obj(r.user);
            const lines = (Array.isArray(r.lines) ? r.lines : []) as R[];
            return (
              <li key={id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="min-w-0">
                  <p className="font-bold">{String(user.name)} <span className="font-normal text-muted">{String(user.email)}</span></p>
                  <p className="text-sm text-ink-2">{lines.map((l) => `${String(l.title)} (${moneyExact(n(l.priceCents))})`).join(", ")}, requested {dateTime(String(r.createdAt))}</p>
                  {r.reason ? <p className="mt-1 text-sm">“{String(r.reason)}”</p> : null}
                  <input aria-label="Note to the learner" className="field mt-2 max-w-md" placeholder="Note (required to decline)" value={note[id] ?? ""} onChange={(e) => setNote((s) => ({ ...s, [id]: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy === id || !(note[id] ?? "").trim()} onClick={() => decide(id, false)}>Decline</button>
                  <button type="button" className="btn btn-danger btn-sm" disabled={busy === id} onClick={() => decide(id, true)}>{busy === id ? <Loader2 className="size-4 animate-spin" /> : null}Approve refund</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function AdminFinance() {
  const toast = useToast();
  const { me } = useAuth();
  const superAdmin = !!me?.roles.includes("super_admin");
  const { data, error, reload } = useApi("/admin/finance", (r) => obj(r));
  const disputes = useApi("/admin/disputes", rows);
  const waiting = useApi("/admin/finance/waiting-for-onboarding", rows);
  const [releasing, setReleasing] = useState(false);
  const t = obj(data?.totals);
  const checks = obj(data?.checks);
  const problems = (Array.isArray(checks.problems) ? checks.problems : []) as R[];
  const stripeOn = data?.stripeConfigured === true;

  return (
    <>
      <PageHead title="Money" sub="Sales after Stripe fees, instructor shares and when they’re paid, refunds, disputes, and checks that the books add up." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-96" /> : null}
      {data ? (
        <>
          <Kpis items={[
            { label: "Learners paid", value: moneyExact(n(t.grossCents)), note: `Refunded ${moneyExact(n(t.refundedCents))}` },
            { label: "Stripe fees", value: moneyExact(n(t.feesCents)) },
            { label: "Platform revenue", value: moneyExact(n(t.platformRevenueCents)), note: "DEL courses + commission" },
            { label: "Instructor shares", value: moneyExact(n(t.instructorSharesCents)), note: n(t.delAgreementSharesCents) ? `+ ${moneyExact(n(t.delAgreementSharesCents))} paid to DEL by agreement` : undefined },
          ]} />
          <div className="mt-4">
            <Kpis items={[
              { label: "Held in refund period", value: moneyExact(n(t.heldCents)) },
              { label: "Due to instructors now", value: moneyExact(n(t.dueCents)) },
              { label: "Transferred", value: moneyExact(n(t.transferredCents)) },
              { label: "Owed by instructors", value: moneyExact(n(t.owedByInstructorsCents)), note: n(t.frozenByDisputeCents) ? `${moneyExact(n(t.frozenByDisputeCents))} frozen by disputes` : undefined },
            ]} />
          </div>

          <section className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-panel border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-bold">Reconciliation</h2>
              {problems.length ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-sm font-bold text-rose"><CircleAlert className="size-4" />{problems.length} {problems.length === 1 ? "check fails" : "checks fail"}</p>
                  <ul className="mt-2 space-y-1 text-sm">{problems.slice(0, 20).map((p, i) => <li key={i}><span className="text-muted">Order {String(p.orderId).slice(0, 8)}:</span> {String(p.check)}</li>)}</ul>
                </>
              ) : (
                <p className="mt-2 flex items-center gap-2 text-sm text-ink-2"><CheckCircle2 className="size-4 text-mint" />All {n(checks.orders)} paid orders add up: prices, fees, nets and shares match.</p>
              )}
            </div>
            <div className="rounded-panel border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-bold">Payouts</h2>
              {stripeOn ? (
                <>
                  <p className="mt-2 text-sm text-ink-2">Shares are transferred automatically every hour once their 16-day hold ends.</p>
                  {superAdmin ? (
                    <button type="button" className="btn btn-outline btn-sm mt-4" disabled={releasing} onClick={async () => {
                      setReleasing(true);
                      try { const r = obj(await api("/admin/finance/release-transfers", { method: "POST" })); toast("ok", `${n(r.transferred)} ${n(r.transferred) === 1 ? "transfer" : "transfers"} sent.`); reload(); }
                      catch (e) { toast("error", errMsg(e)); } finally { setReleasing(false); }
                    }}>{releasing ? <Loader2 className="size-4 animate-spin" /> : null}Send due payouts now</button>
                  ) : null}
                </>
              ) : <p className="mt-2 text-sm text-ink-2">Stripe isn’t connected yet, so no transfers can be sent. Shares are recorded and will be paid once Stripe keys are added.</p>}
              {waiting.data?.length ? (
                <div className="mt-4">
                  <p className="text-sm font-bold">Waiting for the instructor to finish Stripe setup</p>
                  <ul className="mt-1 space-y-1 text-sm text-ink-2">{waiting.data.map((w, i) => <li key={i}>{String(obj(w.instructor).name ?? "Instructor")}: {moneyExact(n(w.amountCents))} ({n(w.lines)} {n(w.lines) === 1 ? "sale" : "sales"})</li>)}</ul>
                </div>
              ) : null}
            </div>
          </section>

          <RefundRequests onChanged={reload} />

          <section className="mt-10" aria-labelledby="disp-h">
            <h2 id="disp-h" className="font-display text-lg font-bold">Disputes</h2>
            <p className="mt-1 text-sm text-ink-2">Card chargebacks. Respond in the Stripe Dashboard; the order’s payouts are frozen until the bank decides.</p>
            <div className="mt-3">
              <DataTable head={["Opened", "Order", "Learner", "Amount", "Reason", "Status"]} min={720} empty={disputes.data && !disputes.data.length ? <p className="px-4 py-8 text-center text-sm text-ink-2">No disputes.</p> : null}>
                {(disputes.data ?? []).map((d) => (
                  <tr key={String(d.id)}>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">{dateTime(String(d.createdAt))}</td>
                    <td className="px-4 py-3 text-xs text-muted">{String(obj(d.order).id ?? "—").slice(0, 8)}</td>
                    <td className="px-4 py-3">{String(obj(obj(d.order).user).email ?? "—")}</td>
                    <td className="px-4 py-3 tabular-nums">{moneyExact(n(d.amountCents))}</td>
                    <td className="px-4 py-3 text-ink-2">{String(d.reason ?? "—").replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 font-bold">{String(d.status)}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
