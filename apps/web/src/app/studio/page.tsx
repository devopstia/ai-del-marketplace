"use client";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { toDashboard, type Dashboard, type DashCourse } from "@/lib/dashboard";
import { compact, date, moneyExact } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Stars } from "@/components/Stars";
import { useAuth } from "@/components/AuthProvider";
import { CourseCover } from "@/components/CourseCover";
import { KpiStrip, type Kpi } from "@/components/dashboard/KpiStrip";
import { Panel } from "@/components/dashboard/Panel";
import { RangePicker, rangeLabel } from "@/components/dashboard/RangePicker";
import { useRangeParam } from "@/components/dashboard/useRangeParam";
import { TimeChart } from "@/components/dashboard/TimeChart";
import { BarList } from "@/components/dashboard/BarList";
import { DataTable, type Column } from "@/components/dashboard/DataTable";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { EmptyNote, ErrorNote, PanelSkeleton } from "@/components/dashboard/States";

const pctText = (v: number | null) => (v === null ? "—" : `${v}%`);
const OWNERSHIP: Record<Dashboard["ownership"], string> = {
  platform: "DEL-owned courses · DevOps Easy Learning keeps the net revenue",
  del_agreement: "Your share is paid to DevOps Easy Learning under your agreement",
  revenue_share: "Revenue share · you earn your share of each sale",
};

function DashboardInner() {
  const { me } = useAuth();
  const [range, setRange, qs] = useRangeParam();
  const d = useApi(`/instructor/dashboard?${qs}`, toDashboard);
  const data = d.data;
  const del = data ? data.ownership !== "revenue_share" : false;
  const m = data?.current, p = data?.previous;

  const kpis: Kpi[] = data && m && p ? [
    { label: "Gross sales", value: moneyExact(m.grossCents), current: m.grossCents, previous: p.grossCents, note: `${compact(m.sales)} ${m.sales === 1 ? "sale" : "sales"}` },
    del
      ? { label: "DEL net revenue", value: moneyExact(m.netCents), current: m.netCents, previous: p.netCents, note: "after fees and refunds" }
      : { label: "Your earnings", value: moneyExact(m.instructorShareCents), current: m.instructorShareCents, previous: p.instructorShareCents, note: "your share" },
    { label: "Stripe fees", value: moneyExact(m.feesCents), current: m.feesCents, previous: p.feesCents, inverse: true },
    { label: "Refunds", value: moneyExact(m.refundsCents), current: m.refundsCents, previous: p.refundsCents, inverse: true },
    { label: "New enrolments", value: compact(m.enrolments), current: m.enrolments, previous: p.enrolments },
    { label: "Active students", value: compact(m.activeStudents), current: m.activeStudents, previous: p.activeStudents, note: "learning in range" },
  ] : [];

  const columns: Column<DashCourse>[] = [
    { key: "title", label: "Course", sort: (c) => c.title.toLowerCase(), render: (c) => (
      <Link href={`/studio/courses/${c.id}`} className="flex min-w-[15rem] items-center gap-3 hover:text-violet">
        <span className="w-16 shrink-0"><CourseCover slug={c.slug || c.id} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" /></span>
        <span className="line-clamp-2 font-bold">{c.title || "Untitled course"}</span>
      </Link>
    ) },
    { key: "status", label: "Status", sort: (c) => c.status, render: (c) => <StatusBadge status={c.status} /> },
    { key: "students", label: "Students", num: true, sort: (c) => c.students, render: (c) => compact(c.students) },
    { key: "revenue", label: del ? "Gross sales" : "Your earnings", num: true, sort: (c) => (del ? c.grossCents : c.instructorShareCents), render: (c) => moneyExact(del ? c.grossCents : c.instructorShareCents) },
    { key: "rating", label: "Rating", num: true, sort: (c) => c.ratingAvg ?? -1, render: (c) => (c.ratingAvg !== null ? <span title={`${c.ratingCount} ratings`}>{c.ratingAvg.toFixed(1)} <span className="text-star">★</span></span> : "—") },
    { key: "completion", label: "Completion", num: true, sort: (c) => c.completionRate ?? -1, render: (c) => (c.completionRate !== null ? (
      <span className="inline-flex items-center gap-2"><span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-violet" style={{ width: `${c.completionRate}%` }} /></span>{c.completionRate}%</span>
    ) : "—") },
    { key: "updated", label: "Updated", sort: (c) => c.updatedAt, render: (c) => <span className="whitespace-nowrap">{date(c.updatedAt)}</span> },
    { key: "manage", label: "", render: (c) => <Link href={`/studio/courses/${c.id}`} className="link whitespace-nowrap text-sm">Manage</Link> },
  ];

  const hasSales = !!data?.series.some((s) => s.grossCents);
  const byCourse = (data?.courses ?? []).filter((c) => c.grossCents > 0).sort((a, b) => b.grossCents - a.grossCents);

  return (
    <>
      <PageHead
        title={data?.ownership === "platform" ? "DEL Studio overview" : `Hello, ${me?.name.split(" ")[0] ?? "instructor"}`}
        sub={data ? OWNERSHIP[data.ownership] : "Your courses at a glance."}
        actions={<Link href="/studio/courses?new=1" className="btn btn-primary"><Plus className="size-4" />New course</Link>}
      />
      <div className="-mt-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <RangePicker value={range} onChange={setRange} />
        {data ? <p className="text-sm text-muted">Compared with the previous {data.range.days === 1 ? "day" : `${data.range.days} days`}</p> : null}
      </div>

      {d.error && !data ? <ErrorNote message={d.error} onRetry={d.reload} /> : null}
      {data ? <KpiStrip items={kpis} /> : !d.error ? <PanelSkeleton className="h-24" /> : null}

      <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title={del ? "Gross sales and DEL net revenue" : "Gross sales and your earnings"} href="/studio/sales" linkLabel="All sales" id="rev-h">
          {data ? (
            <>
              <dl className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Published", compact(data.catalogue.published)], ["Drafts", compact(data.catalogue.drafts)], ["Average rating", data.catalogue.ratingAvg !== null ? data.catalogue.ratingAvg.toFixed(2) : "—"], ["Completion rate", pctText(data.catalogue.completionRate)]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-display text-lg font-extrabold tabular-nums">{v}</dd></div>
                ))}
              </dl>
              {!hasSales ? <div className="mb-2"><EmptyNote href="/studio/courses" action="Manage courses">No sales in this period ({rangeLabel(range).toLowerCase()}). Share a course page to bring in learners.</EmptyNote></div> : null}
              {data.series.length ? (
                <>
                  <p className="mb-1 flex gap-4 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-violet" />Gross</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-cyan" />{del ? "DEL net" : "Net after fees"}</span></p>
                  <TimeChart points={data.series.map((s) => ({ date: s.date, a: s.grossCents, b: s.netCents }))} labelA="Gross" labelB={del ? "DEL net" : "Net"} format={(v) => moneyExact(v)} ariaLabel={`Sales, ${rangeLabel(range)}`} />
                </>
              ) : null}
            </>
          ) : d.error ? null : <PanelSkeleton className="h-72" />}
        </Panel>

        <div className="grid min-w-0 gap-4">
          <Panel title="Revenue by course" href="/studio/sales" linkLabel="Sales" id="bycourse-h">
            {data ? (byCourse.length ? <BarList items={byCourse.slice(0, 6).map((c) => ({ key: c.id, label: c.title, value: c.grossCents, href: `/studio/courses/${c.id}` }))} format={(v) => moneyExact(v)} /> : <EmptyNote>No course sold in this period.</EmptyNote>) : d.error ? null : <PanelSkeleton className="h-28" />}
          </Panel>
          <Panel title="Recent activity" id="activity-h">
            {data ? (data.activity.length ? <ActivityFeed items={data.activity} /> : <EmptyNote>Purchases, enrolments, reviews and completions will appear here.</EmptyNote>) : d.error ? null : <PanelSkeleton className="h-40" />}
          </Panel>
        </div>
      </div>

      <div className="mt-4">
        <Panel title="Courses" href="/studio/courses" linkLabel="Manage courses" id="courses-h">
          {data ? (data.courses.length ? (
            <DataTable label="Your courses" rows={data.courses} columns={columns} rowKey={(c) => c.id} initialSort={{ key: "revenue", dir: -1 }} search={{ placeholder: "Search courses", text: (c) => c.title }} />
          ) : <EmptyNote href="/studio/courses?new=1" action="Create a course">You haven’t created a course yet.</EmptyNote>) : d.error ? null : <PanelSkeleton className="h-48" />}
        </Panel>
      </div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
        <Panel title="Students" href="/studio/students" linkLabel="Students" id="students-h">
          {data ? (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {[["Students", compact(data.students.total)], ["Active in range", compact(data.students.active)], ["Average progress", pctText(data.students.averageProgress)], ["Completion rate", pctText(data.students.completionRate)], ["Quiz average", data.students.quizAverage !== null ? `${data.students.quizAverage}%` : "—"], ["Certificates", `${compact(data.students.certificatesIssued)} in range`]].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-display text-lg font-extrabold tabular-nums">{v}</dd></div>
                ))}
              </dl>
              {data.payouts ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
                  <div><dt className="text-xs text-muted">Pending payouts</dt><dd className="font-bold tabular-nums">{moneyExact(data.payouts.pendingCents)}</dd></div>
                  <div><dt className="text-xs text-muted">Paid out</dt><dd className="font-bold tabular-nums">{moneyExact(data.payouts.paidCents)}</dd></div>
                </dl>
              ) : null}
              {!data.students.total ? <div className="mt-3"><EmptyNote>No learners yet. Progress, quizzes and certificates appear once people enrol.</EmptyNote></div> : null}
            </>
          ) : d.error ? null : <PanelSkeleton className="h-32" />}
        </Panel>
        <Panel title="Latest reviews" href="/studio/reviews" linkLabel="Reply to reviews" id="reviews-h">
          {data ? (data.reviews.length ? (
            <ul className="divide-y divide-line">
              {data.reviews.map((r) => (
                <li key={r.id} className="py-2.5 text-sm first:pt-0">
                  <div className="flex items-center justify-between gap-2"><span className="font-bold">{r.learner}</span><Stars value={r.rating} size={12} /></div>
                  <p className="truncate text-xs text-muted">{r.course.title}</p>
                  {r.body ? <p className="mt-0.5 line-clamp-2 text-ink-2">{r.body}</p> : null}
                  {!r.replied ? <Link href="/studio/reviews" className="link text-xs">Reply</Link> : <span className="text-xs text-muted">Replied</span>}
                </li>
              ))}
            </ul>
          ) : <EmptyNote>No reviews yet. They appear here as learners rate your courses.</EmptyNote>) : d.error ? null : <PanelSkeleton className="h-32" />}
        </Panel>
      </div>
    </>
  );
}

export default function StudioDashboard() {
  return <Suspense><DashboardInner /></Suspense>;
}
