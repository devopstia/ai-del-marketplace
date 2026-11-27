"use client";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, XCircle } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { toAdminDashboard } from "@/lib/admin-dashboard";
import { compact, dateTime, moneyExact } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { KpiStrip, Change, type Kpi } from "@/components/dashboard/KpiStrip";
import { Panel } from "@/components/dashboard/Panel";
import { RangePicker, rangeLabel } from "@/components/dashboard/RangePicker";
import { useRangeParam } from "@/components/dashboard/useRangeParam";
import { TimeChart } from "@/components/dashboard/TimeChart";
import { BarList } from "@/components/dashboard/BarList";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { EmptyNote, ErrorNote, PanelSkeleton } from "@/components/dashboard/States";

const KIND: Record<string, string> = { del: "DEL", official: "Official DEL", independent: "Independent" };

/** A figure with its label, linking to the page that manages it (every number on the overview drills down). */
function Fig({ label, value, href, change }: { label: string; value: string; href?: string; change?: React.ReactNode }) {
  const body = (<><dt className="text-xs text-muted">{label}</dt><dd className="font-display text-lg font-extrabold tabular-nums">{value} {change}</dd></>);
  return href ? <Link href={href} className="block rounded-lg hover:text-violet">{body}</Link> : <div>{body}</div>;
}

function Overview() {
  const [range, setRange, qs] = useRangeParam();
  const d = useApi(`/admin/dashboard?${qs}`, toAdminDashboard);
  const data = d.data;
  const f = data?.finance;
  const m = f?.current, p = f?.previous;

  const kpis: Kpi[] = data ? [
    ...(m && p ? [
      { label: "Marketplace gross", value: moneyExact(m.grossCents), current: m.grossCents, previous: p.grossCents, note: `${compact(m.sales)} ${m.sales === 1 ? "sale" : "sales"}` },
      { label: "DEL net revenue", value: moneyExact(m.platformNetCents), current: m.platformNetCents, previous: p.platformNetCents, note: "after fees, refunds and instructor shares" },
      { label: "Instructor earnings", value: moneyExact(m.instructorEarningsCents), current: m.instructorEarningsCents, previous: p.instructorEarningsCents },
      { label: "Stripe fees", value: moneyExact(m.feesCents), current: m.feesCents, previous: p.feesCents, inverse: true },
      { label: "Refunds", value: moneyExact(m.refundsCents), current: m.refundsCents, previous: p.refundsCents, inverse: true },
    ] as Kpi[] : []),
    ...(data.platform ? [{ label: "New users", value: compact(data.platform.newUsers.current), current: data.platform.newUsers.current, previous: data.platform.newUsers.previous, note: `${compact(data.platform.users)} in total` }] as Kpi[] : []),
  ] : [];
  const waiting = (data?.attention ?? []).filter((a) => a.count > 0);
  const hasSales = !!f?.series.some((s) => s.grossCents);
  const healthBad = data?.health ? data.health.checks.filter((c) => !c.ok).length + data.health.queues.filter((q) => !q.ok || q.failed).length + (data.health.failedVideos ? 1 : 0) : 0;

  return (
    <>
      <PageHead title="Platform overview" sub="Money, learners, catalogue and everything waiting on an admin." />
      <div className="-mt-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <RangePicker value={range} onChange={setRange} />
        {data ? <p className="text-sm text-muted">Compared with the previous {data.range.days === 1 ? "day" : `${data.range.days} days`}</p> : null}
      </div>

      {d.error && !data ? <ErrorNote message={d.error} onRetry={d.reload} /> : null}
      {data ? (kpis.length ? <KpiStrip items={kpis} /> : null) : !d.error ? <PanelSkeleton className="h-24" /> : null}

      {/* Needs attention first when something is waiting: it is the admin's to-do list. */}
      <div className={`mt-4 grid items-stretch gap-4 ${data && !data.finance ? "" : "xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"}`}>
        {data?.finance || (!data && !d.error) ? (
          <Panel title="Marketplace gross and DEL net revenue" href="/admin/finance" linkLabel="Money" id="rev-h">
            {f ? (
              <>
                <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Fig label="DEL courses net" value={moneyExact(f.current.delCoursesNetCents)} href="/admin/finance" />
                  <Fig label="Commission" value={moneyExact(f.current.commissionCents)} href="/admin/finance" />
                  <Fig label="Pending payouts" value={moneyExact(f.payouts.pendingCents)} href="/admin/finance" />
                  <Fig label="Paid out to date" value={moneyExact(f.payouts.paidCents)} href="/admin/finance" />
                </dl>
                {!hasSales ? <div className="mb-2"><EmptyNote href="/admin/orders" action="Orders">No sales in this period ({rangeLabel(range).toLowerCase()}).</EmptyNote></div> : null}
                <p className="mb-1 flex gap-4 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-violet" />Gross</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-cyan" />DEL net</span></p>
                <TimeChart points={f.series.map((s) => ({ date: s.date, a: s.grossCents, b: s.netCents }))} labelA="Gross" labelB="DEL net" format={(v) => moneyExact(v)} ariaLabel={`Marketplace sales, ${rangeLabel(range)}`} />
              </>
            ) : <PanelSkeleton className="h-72" />}
          </Panel>
        ) : null}

        <div className="grid min-w-0 content-start gap-4">
          <Panel title="Needs attention" id="attention-h">
            {data ? (data.attention.length ? (
              <ul className="divide-y divide-line" data-testid="admin-attention">
                {data.attention.map((a) => (
                  <li key={a.key}>
                    <Link href={a.href} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-violet">
                      <span className="min-w-0">{a.label}</span>
                      <span className={`inline-flex shrink-0 items-center gap-1 font-display font-extrabold tabular-nums ${a.count ? "text-violet" : "text-muted"}`}>{a.count}<ArrowUpRight className="size-3.5" aria-hidden="true" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyNote>Your role has no queues to watch.</EmptyNote>) : d.error ? null : <PanelSkeleton className="h-40" />}
            {data && data.attention.length && !waiting.length ? <p className="mt-2 text-xs text-muted">Nothing is waiting. All clear.</p> : null}
          </Panel>
          {f ? (
            <Panel title="Revenue by course" href="/admin/orders" linkLabel="Orders" id="bycourse-h">
              {f.byCourse.length ? <BarList items={f.byCourse.slice(0, 6).map((c) => ({ key: c.id, label: c.label, value: c.grossCents, href: `/admin/courses/${c.id}` }))} format={(v) => moneyExact(v)} /> : <EmptyNote>No course sold in this period.</EmptyNote>}
            </Panel>
          ) : null}
        </div>
      </div>

      {f ? (
        <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
          <Panel title="Revenue by instructor" href="/admin/instructors" linkLabel="Instructors" id="byinstructor-h">
            {f.byInstructor.length ? (
              <BarList items={f.byInstructor.slice(0, 6).map((i) => ({ key: i.id, label: `${i.label} · ${KIND[i.kind ?? ""] ?? "Independent"}`, value: i.grossCents, href: `/admin/users?q=${encodeURIComponent(i.label)}` }))} format={(v) => moneyExact(v)} />
            ) : <EmptyNote>No instructor sales in this period.</EmptyNote>}
          </Panel>
          <Panel title="Payments" href="/admin/orders" linkLabel="Orders" id="payments-h">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Fig label="Paid sales" value={compact(f.current.sales)} href="/admin/orders" change={<Change current={f.current.sales} previous={f.previous.sales} />} />
              <Fig label="Failed payments" value={compact(f.current.failedPayments)} href="/admin/orders" />
              <Fig label="Sales awaiting payout" value={`${compact(f.payouts.pendingCount)} ${f.payouts.pendingCount === 1 ? "sale" : "sales"}`} href="/admin/finance" />
              <Fig label="Stripe events received" value={compact(f.webhooks.received)} />
              <Fig label="Last Stripe event" value={f.webhooks.lastAt ? dateTime(f.webhooks.lastAt) : "—"} />
              <Fig label="Sales paid out" value={`${compact(f.payouts.paidCount)} ${f.payouts.paidCount === 1 ? "sale" : "sales"}`} href="/admin/finance" />
            </dl>
            {f.webhooks.stripeOrders > 0 && !f.webhooks.received ? <div className="mt-3"><EmptyNote href="/admin/payments" action="Payments & Stripe">Stripe sales but no Stripe events received in this period: check the webhook.</EmptyNote></div> : null}
          </Panel>
        </div>
      ) : null}

      {data?.platform || data?.catalogue ? (
        <div className="mt-4">
          <Panel title={data.platform ? "Platform" : "Catalogue"} href={data.platform ? "/admin/users" : "/admin/courses"} linkLabel={data.platform ? "People" : "Courses"} id="platform-h">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              {data.platform ? (
                <>
                  <Fig label="Registered users" value={compact(data.platform.users)} href="/admin/users" />
                  <Fig label="Active students" value={compact(data.platform.activeStudents.current)} href="/admin/users" change={<Change current={data.platform.activeStudents.current} previous={data.platform.activeStudents.previous} />} />
                  <Fig label="Enrolments" value={compact(data.platform.enrolments.current)} href="/admin/enrollments" change={<Change current={data.platform.enrolments.current} previous={data.platform.enrolments.previous} />} />
                  <Fig label="Completions" value={compact(data.platform.completions.current)} href="/admin/certificates" change={<Change current={data.platform.completions.current} previous={data.platform.completions.previous} />} />
                  <Fig label="Certificates issued" value={compact(data.platform.completions.total)} href="/admin/certificates" />
                  <Fig label="Active enrolments" value={compact(data.platform.enrolments.total)} href="/admin/enrollments" />
                  <Fig label="Official DEL instructors" value={compact(data.platform.instructors.official)} href="/admin/instructors" />
                  <Fig label="Independent instructors" value={compact(data.platform.instructors.independent)} href="/admin/instructors" />
                </>
              ) : null}
              {data.catalogue ? (
                <>
                  <Fig label="Published courses" value={compact(data.catalogue.published)} href="/admin/courses" />
                  <Fig label="Drafts" value={compact(data.catalogue.drafts)} href="/admin/courses" />
                  <Fig label="Waiting for approval" value={compact(data.catalogue.pendingApproval)} href="/admin/review" />
                </>
              ) : null}
            </dl>
          </Panel>
        </div>
      ) : null}

      {data?.health || data?.audit ? (
        <div className={`mt-4 grid items-stretch gap-4 ${data.health && data.audit ? "lg:grid-cols-2" : ""}`}>
          {data.health ? (
            <Panel title="Service health" href="/admin/system" linkLabel="System health" id="health-h">
              <p className={`mb-2 text-sm font-bold ${healthBad ? "text-rose" : "text-mint"}`} data-testid="admin-health">{healthBad ? `${healthBad} ${healthBad === 1 ? "problem" : "problems"} need a look` : "All services are running"}</p>
              <ul className="grid gap-x-6 sm:grid-cols-2">
                {[...data.health.checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail })), ...data.health.queues.map((q) => ({ name: q.name, ok: q.ok && !q.failed, detail: q.failed ? `${q.failed} failed jobs` : `${q.waiting} waiting` }))].map((c) => (
                  <li key={c.name} className="flex items-start gap-2 border-b border-line py-2 text-sm">
                    {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" aria-label="OK" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-rose" aria-label="Problem" />}
                    <span className="min-w-0"><span className="font-bold">{c.name}</span><span className="block text-xs text-muted">{c.detail}</span></span>
                  </li>
                ))}
              </ul>
              {data.health.failedVideos ? <div className="mt-3"><EmptyNote href="/admin/system" action="Open">{data.health.failedVideos} video{data.health.failedVideos === 1 ? "" : "s"} failed processing.</EmptyNote></div> : null}
            </Panel>
          ) : null}
          {data.audit ? (
            <Panel title="Recent admin activity" href="/admin/audit" linkLabel="Audit log" id="audit-h">
              {data.audit.length ? (
                <ActivityFeed items={data.audit.map((a) => ({ kind: a.status === "ok" ? "admin" : "alert", at: a.at, text: a.action.replace(/[._]/g, " "), detail: `${a.actor}${a.status !== "ok" ? ` · ${a.status}` : ""}` }))} />
              ) : <EmptyNote>Nothing logged yet.</EmptyNote>}
            </Panel>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export default function AdminOverview() {
  return <Suspense><Overview /></Suspense>;
}
