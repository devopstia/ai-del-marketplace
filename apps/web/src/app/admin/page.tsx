"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { list, toAdminStats, toAudit, toOrder } from "@/lib/normalize";
import { compact, dateTime, moneyExact } from "@/lib/format";
import { dailySeries } from "@/lib/series";
import { PageHead, Kpis } from "@/components/shell/AppShell";
import { BarChart } from "@/components/BarChart";
import { Skeleton } from "@/components/Empty";

const mapOrders = (r: unknown) => list(r, "orders").map(toOrder);
const mapAudit = (r: unknown) => list(r, "entries", "logs").map(toAudit);

export default function AdminOverview() {
  const stats = useApi("/admin/stats", toAdminStats);
  const orders = useApi("/admin/orders?pageSize=100", mapOrders);
  const audit = useApi("/admin/audit", mapAudit);
  const s = stats.data;
  const paid = (orders.data ?? []).filter((o) => o.status === "paid" || o.status === "partially_refunded");
  const series = dailySeries(paid.map((o) => ({ at: o.paidAt ?? o.createdAt, cents: o.totalCents })));
  return (
    <>
      <PageHead title="Platform overview" sub="Revenue, catalogue health and everything waiting on an admin." />
      {s ? (
        <Kpis items={[
          { label: "Gross revenue", value: moneyExact(s.revenueCents), note: `${compact(s.orders)} paid ${s.orders === 1 ? "order" : "orders"}` },
          { label: "Learners", value: compact(s.users), note: `${compact(s.enrollments)} enrolments` },
          { label: "Published courses", value: compact(s.publishedCourses), note: s.refundedCents ? `${moneyExact(s.refundedCents)} refunded` : undefined },
          { label: "Instructors", value: compact(s.instructors) },
        ]} />
      ) : stats.error ? <p className="text-rose">{stats.error}</p> : <Skeleton className="h-28" />}

      {s ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link href="/admin/review" className={`flex items-center justify-between rounded-panel border p-5 ${s.pendingReviews ? "border-amber bg-amber-soft/60" : "border-line bg-surface"}`}>
            <span><span className="block font-display text-3xl font-extrabold tabular-nums">{s.pendingReviews}</span><span className="text-sm font-bold text-ink-2">{s.pendingReviews === 1 ? "course waiting for review" : "courses waiting for review"}</span></span>
            <ArrowUpRight className="size-5" />
          </Link>
          <Link href="/admin/instructors" className={`flex items-center justify-between rounded-panel border p-5 ${s.pendingInstructors ? "border-amber bg-amber-soft/60" : "border-line bg-surface"}`}>
            <span><span className="block font-display text-3xl font-extrabold tabular-nums">{s.pendingInstructors}</span><span className="text-sm font-bold text-ink-2">{s.pendingInstructors === 1 ? "instructor application" : "instructor applications"}</span></span>
            <ArrowUpRight className="size-5" />
          </Link>
        </div>
      ) : null}

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-panel border border-line bg-surface p-5 sm:p-6">
          <h2 className="mb-4 font-display text-lg font-bold">Revenue per day, last 30 days</h2>
          {orders.data ? (series.some((x) => x.value) ? <BarChart data={series} format={(v) => moneyExact(v)} label="Platform gross revenue per day, last 30 days" /> : <p className="py-14 text-center text-ink-2">No paid orders in the last 30 days.</p>) : <Skeleton className="h-52" />}
        </section>
        <section className="rounded-panel border border-line bg-surface p-5 sm:p-6">
          <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Recent admin activity</h2><Link href="/admin/audit" className="link text-sm">Audit log</Link></div>
          {audit.data ? (
            <ul className="divide-y divide-line text-sm">
              {audit.data.slice(0, 7).map((a) => (
                <li key={a.id} className="py-2.5"><p className="font-bold">{a.action.replace(/[._]/g, " ")}</p><p className="text-xs text-muted">{a.actor?.name ?? "System"}, {dateTime(a.at)}</p></li>
              ))}
              {!audit.data.length ? <li className="py-8 text-center text-ink-2">Nothing logged yet.</li> : null}
            </ul>
          ) : <Skeleton className="h-52" />}
        </section>
      </div>
    </>
  );
}
