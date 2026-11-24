"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { toSales } from "@/lib/normalize";
import { dateTime, moneyExact } from "@/lib/format";
import { dailySeries, daysAgoIso } from "@/lib/series";
import { PageHead, Kpis, DataTable } from "@/components/shell/AppShell";
import { BarChart } from "@/components/BarChart";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Empty";

const ranges = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [365, "12 months"]] as const;

export default function SalesPage() {
  const [days, setDays] = useState<number>(30);
  const { data, error } = useApi(`/instructor/sales?from=${daysAgoIso(days)}&to=${daysAgoIso(-1)}`, toSales);
  const series = dailySeries((data?.rows ?? []).map((r) => ({ at: r.at, cents: r.instructorShareCents })), Math.min(days, 90));
  return (
    <>
      <PageHead title="Sales" sub="Every paid enrolment, your share after the platform commission, and its payout status."
        actions={
          <div role="radiogroup" aria-label="Date range" className="flex rounded-lg border border-line bg-surface p-1">
            {ranges.map(([d, l]) => (
              <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={`rounded-md px-3 py-1.5 text-sm font-bold ${days === d ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface-2"}`}>{l}</button>
            ))}
          </div>
        } />
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <>
          <Kpis items={[
            { label: "Your earnings", value: moneyExact(data.instructorShareCents) },
            { label: "Gross sales", value: moneyExact(data.totalCents) },
            { label: "Platform commission", value: moneyExact(Math.max(0, data.totalCents - data.instructorShareCents)) },
            { label: "Enrolments sold", value: String(data.count) },
          ]} />
          {days <= 90 ? (
            <section className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg font-bold">Earnings per day</h2>
              <BarChart data={series} format={(v) => moneyExact(v)} label={`Your earnings per day over the last ${days} days`} />
            </section>
          ) : null}
          <h2 className="mb-3 mt-10 font-display text-lg font-bold">Transactions</h2>
          <DataTable head={["Date", "Course", "Learner", "Price", "Your share", "Payout"]} min={760}
            empty={!data.rows.length ? <p className="px-4 py-10 text-center text-ink-2">No sales in this period.</p> : null}>
            {data.rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{dateTime(r.at)}</td>
                <td className="px-4 py-3 font-bold">{r.courseTitle}</td>
                <td className="px-4 py-3">{r.buyerName ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{moneyExact(r.priceCents)}</td>
                <td className="px-4 py-3 font-bold tabular-nums">{moneyExact(r.instructorShareCents)}</td>
                <td className="px-4 py-3"><StatusBadge status={r.transferStatus === "none" ? "draft" : r.transferStatus ?? "pending"} /></td>
              </tr>
            ))}
          </DataTable>
        </>
      ) : !error ? <Skeleton className="h-96" /> : null}
    </>
  );
}
