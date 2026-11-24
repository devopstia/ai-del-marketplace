"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { toSales } from "@/lib/normalize";
import { dateTime, moneyExact } from "@/lib/format";
import { dailySeries, daysAgoIso } from "@/lib/series";
import { PageHead, Kpis, DataTable } from "@/components/shell/AppShell";
import { BarChart } from "@/components/BarChart";
import { Skeleton } from "@/components/Empty";
import { TermsNote } from "@/components/studio/TermsNote";
import type { SaleRow } from "@/lib/types";
import { date } from "@/lib/format";

const ranges = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "12 months"]] as const;

/** Where this sale's money stands, in plain words. */
function payoutLabel(r: SaleRow): { status: string; text: string } {
  if (r.refundedAt) return { status: "refunded", text: "Refunded" };
  if (r.disputeStatus === "open") return { status: "pending", text: "On hold: card dispute" };
  if (r.payee === "platform") return { status: "draft", text: "DEL course" };
  if (r.payee === "del_agreement") return { status: "draft", text: "Paid to DEL (agreement)" };
  if (r.transferStatus === "paid") return { status: "paid", text: "Transferred" };
  if (r.transferStatus === "reversed") return { status: "refunded", text: "Taken back" };
  if (r.transferStatus === "pending" && r.transferDueAt && new Date(r.transferDueAt) > new Date()) return { status: "pending", text: `Held until ${date(r.transferDueAt)}` };
  if (r.transferStatus === "pending") return { status: "pending", text: "Due: waiting for Stripe setup" };
  return { status: "draft", text: "No payout" };
}

export default function SalesPage() {
  const [days, setDays] = useState<number>(30);
  const { data, error } = useApi(`/instructor/sales?from=${daysAgoIso(days)}&to=${daysAgoIso(-1)}`, toSales);
  // Refunded sales earn nothing, so they are left out of the chart (they stay in the list, marked Refunded).
  const series = dailySeries((data?.rows ?? []).filter((r) => !r.refundedAt).map((r) => ({ at: r.at, cents: r.instructorShareCents })), Math.min(days, 90));
  return (
    <>
      <PageHead title="Sales" sub="Every paid enrolment: what the learner paid, Stripe’s fee, your share and when it’s paid."
        actions={
          <div role="radiogroup" aria-label="Date range" className="flex rounded-lg border border-line bg-surface p-1">
            {ranges.map(([d, l]) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={`rounded-md px-3 py-1.5 text-sm font-bold ${days === d ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface-2"}`}>{l}</button>
            ))}
          </div>
        } />
      {error ? <p className="text-rose">{error}</p> : null}
      <TermsNote className="mb-6" />
      {data ? (
        <>
          <Kpis items={[
            { label: "Your earnings", value: moneyExact(data.instructorShareCents) },
            { label: "Learners paid", value: moneyExact(data.totalCents) },
            { label: "Stripe fees", value: moneyExact(data.feesCents) },
            { label: "Held in refund period", value: moneyExact(data.heldCents) },
          ]} />
          {days <= 90 ? (
            <section className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-bold">Earnings per day</h2>
              <BarChart data={series} format={(v) => moneyExact(v)} label={`Your earnings per day over the last ${days} days`} />
            </section>
          ) : null}
          <h2 className="mb-3 mt-10 font-display text-lg font-bold">Transactions</h2>
          <DataTable head={["Date", "Course", "Price", "Stripe fee", "Your share", "Payout"]} min={760}
            empty={!data.rows.length ? <p className="px-4 py-10 text-center text-ink-2">No sales in this period.</p> : null}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{dateTime(r.at)}</td>
                <td className="px-4 py-3 font-bold">{r.courseTitle}</td>
                <td className="px-4 py-3 tabular-nums">{moneyExact(r.priceCents)}</td>
                <td className="px-4 py-3 tabular-nums text-ink-2">{r.feeCents ? `−${moneyExact(r.feeCents)}` : "—"}</td>
                <td className="px-4 py-3 font-bold tabular-nums">{r.payee === "platform" || r.refundedAt ? "—" : moneyExact(r.instructorShareCents)}</td>
                <td className="px-4 py-3 text-sm">{payoutLabel(r).text}</td>
              </tr>
            ))}
          </DataTable>
        </>
      ) : !error ? <Skeleton className="h-96" /> : null}
    </>
  );
}
