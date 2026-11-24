"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { list, toReview, toSales, toStudioCourse } from "@/lib/normalize";
import { compact, date, moneyExact } from "@/lib/format";
import { dailySeries, daysAgoIso } from "@/lib/series";
import { PageHead, Kpis } from "@/components/shell/AppShell";
import { BarChart } from "@/components/BarChart";
import { StatusBadge } from "@/components/StatusBadge";
import { Stars } from "@/components/Stars";
import { Skeleton } from "@/components/Empty";
import { useAuth } from "@/components/AuthProvider";
import { CourseCover } from "@/components/CourseCover";

const mapCourses = (r: unknown) => list(r, "courses").map(toStudioCourse);
const mapReviews = (r: unknown) => list(r, "reviews").map(toReview);

export default function StudioDashboard() {
  const { me } = useAuth();
  const from = daysAgoIso(30);
  const sales = useApi(`/instructor/sales?from=${from}`, toSales);
  const courses = useApi("/instructor/courses", mapCourses);
  const reviews = useApi("/instructor/reviews", mapReviews);
  const cs = courses.data ?? [];
  const students = cs.reduce((a, c) => a + (c.studentCount ?? 0), 0);
  const rated = cs.filter((c) => c.ratingCount);
  const ratingN = rated.reduce((a, c) => a + (c.ratingCount ?? 0), 0);
  const avg = ratingN ? rated.reduce((a, c) => a + (c.ratingAvg ?? 0) * (c.ratingCount ?? 0), 0) / ratingN : 0;
  const series = dailySeries((sales.data?.rows ?? []).filter((r) => !r.refundedAt).map((r) => ({ at: r.at, cents: r.instructorShareCents })));

  return (
    <>
      <PageHead title={`Hello, ${me?.name.split(" ")[0] ?? "instructor"}`} sub="Your last 30 days at a glance." actions={<Link href="/studio/courses?new=1" className="btn btn-primary"><Plus className="size-4" />New course</Link>} />
      {sales.data || courses.data ? (
        <Kpis items={[
          { label: "Your earnings, 30 days", value: moneyExact(sales.data?.instructorShareCents ?? 0), note: sales.data ? `${moneyExact(sales.data.totalCents)} gross sales` : undefined },
          { label: "New enrolments, 30 days", value: compact(sales.data?.count ?? 0) },
          { label: "Total students", value: compact(students), note: `${cs.filter((c) => c.status === "published").length} published courses` },
          { label: "Average rating", value: avg ? avg.toFixed(2) : "—", note: ratingN ? `${compact(ratingN)} ratings` : "No ratings yet" },
        ]} />
      ) : <Skeleton className="h-28" />}

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-panel border border-line bg-surface p-5 sm:p-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Daily earnings</h2>
            <Link href="/studio/sales" className="link text-sm">All sales</Link>
          </div>
          {sales.data ? (
            series.some((s) => s.value) ? <BarChart data={series} format={(v) => moneyExact(v)} label="Your earnings per day over the last 30 days" />
              : <p className="py-14 text-center text-ink-2">No sales in the last 30 days. Share your course page link to get your first learners.</p>
          ) : <Skeleton className="h-52" />}
        </section>
        <section className="rounded-panel border border-line bg-surface p-5 sm:p-6">
          <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Latest reviews</h2><Link href="/studio/reviews" className="link text-sm">Reply to reviews</Link></div>
          {reviews.data ? (
            reviews.data.length ? (
              <ul className="divide-y divide-line">
                {reviews.data.slice(0, 4).map((r) => (
                  <li key={r.id} className="py-3.5">
                    <div className="flex items-center justify-between gap-2"><span className="font-bold">{r.user.name}</span><Stars value={r.rating} size={12} /></div>
                    {r.course ? <p className="text-xs text-muted">{r.course.title}</p> : null}
                    <p className="mt-1 line-clamp-2 text-sm text-ink-2">{r.body}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="py-10 text-center text-ink-2">Reviews from your learners will show up here.</p>
          ) : <Skeleton className="h-52" />}
        </section>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Your courses</h2><Link href="/studio/courses" className="link text-sm">Manage courses</Link></div>
        {courses.data ? (
          cs.length ? (
            <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
              {cs.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/studio/courses/${c.id}`} className="grid grid-cols-[88px_1fr_auto] items-center gap-4 px-4 py-3.5 hover:bg-surface-2/60">
                    <CourseCover slug={c.slug || c.id} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" />
                    <span className="min-w-0"><span className="block truncate font-bold">{c.title || "Untitled course"}</span><span className="text-xs text-muted">Updated {date(c.updatedAt)}</span></span>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-panel border border-dashed border-line-strong p-10 text-center text-ink-2">You haven’t created a course yet. <Link href="/studio/courses?new=1" className="link">Create your first course</Link></p>
        ) : <Skeleton className="h-40" />}
      </section>
    </>
  );
}
