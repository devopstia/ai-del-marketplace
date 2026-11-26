"use client";
import Link from "next/link";
import { use } from "react";
import { Download, RotateCcw } from "lucide-react";
import { obj, toCourseRefund } from "@/lib/normalize";
import { useApi } from "@/lib/useApi";
import { date, dateTime } from "@/lib/format";
import { pct } from "@/lib/refund-policy";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { LoopMeter } from "@/components/LoopMeter";

const n = (v: unknown) => Number(v ?? 0) || 0;
const hm = (sec: number) => { const h = Math.floor(sec / 3600); const m = Math.round((sec % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min`; };

/** A bar with its value; the marker shows a limit (the refund watch limit). */
function Bar({ value, limit, label }: { value: number; limit?: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-2.5 w-full rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
      <div className={`h-full rounded-full ${limit != null && value > limit ? "bg-amber" : "bg-violet"}`} style={{ width: `${v}%` }} />
      {limit != null ? <div className="absolute -top-1 h-4.5 w-0.5 bg-ink" style={{ left: `calc(${Math.min(100, limit)}% - 1px)` }} title={`Limit ${pct(limit)}`} /> : null}
    </div>
  );
}

/**
 * Student Studio › Learning progress › course report (owner 2026-11-26): every number from the API (unique seconds
 * of playback, completed lessons, downloads) and the refund position, without asking for a refund.
 */
export default function CourseReport({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, error } = useApi(`/me/courses/${slug}/report`, (r) => obj(r));
  if (error) return <p className="text-rose">{error}</p>;
  if (!data) return <Skeleton className="h-96" />;
  const course = obj(data.course);
  const lessons = obj(data.lessons);
  const video = obj(data.video);
  const downloads = obj(data.downloads);
  const items = Array.isArray(downloads.items) ? (downloads.items as Record<string, unknown>[]) : [];
  const refund = toCourseRefund(data.refund);
  const refundTone = refund?.state === "eligible" || refund?.state === "review" ? "text-mint" : refund?.state === "requested" ? "text-amber" : "text-ink-2";

  return (
    <div className="max-w-5xl">
      <PageHead title={String(course.title ?? "Course")} sub={`${String(obj(course.instructor).name ?? "")} · your progress and refund position`} actions={<Link href={`/learn/${slug}`} className="btn btn-primary btn-sm">Continue learning</Link>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="prog-h" data-testid="course-report">
          <h2 id="prog-h" className="font-display text-lg font-bold">Progress</h2>
          <div className="mt-4 flex items-center gap-4">
            <LoopMeter value={n(lessons.percent)} size="lg" />
            <p className="text-sm text-ink-2"><span className="font-bold text-ink tabular-nums">{n(lessons.completed)} of {n(lessons.total)}</span> lessons completed</p>
          </div>
          <div className="mt-5 space-y-1.5">
            <p className="flex justify-between text-sm"><span>Video watched</span><span className="tabular-nums font-bold">{pct(n(video.percent))}</span></p>
            <Bar value={n(video.percent)} label="Video watched" />
            <p className="text-xs text-muted">{hm(n(video.uniqueWatchedSec))} of {hm(n(video.totalSec))} of video, each second counted once (replays and skipped parts don’t add).</p>
          </div>
          <dl className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
            {data.purchasedAt ? <><dt className="text-ink-2">Bought</dt><dd className="tabular-nums">{dateTime(String(data.purchasedAt))}</dd></> : null}
            <dt className="text-ink-2">Enrolled</dt><dd className="tabular-nums">{date(String(data.enrolledAt))}</dd>
            {data.accessUntil ? <><dt className="text-ink-2">Access until</dt><dd className="tabular-nums">{date(String(data.accessUntil))}</dd></> : null}
            <dt className="text-ink-2">Total video</dt><dd className="tabular-nums">{hm(n(video.totalSec))}</dd>
            <dt className="text-ink-2">Time watched (unique)</dt><dd className="tabular-nums">{hm(n(video.uniqueWatchedSec))}</dd>
            <dt className="text-ink-2">Last studied</dt><dd className="tabular-nums">{data.lastAccessAt ? dateTime(String(data.lastAccessAt)) : "Not started"}</dd>
          </dl>
        </section>

        <section className="h-fit rounded-panel border border-line bg-surface p-5" aria-labelledby="refund-h" data-testid="refund-position">
          <h2 id="refund-h" className="flex items-center gap-2 font-display text-lg font-bold"><RotateCcw className="size-5 text-violet" aria-hidden="true" />Refund</h2>
          {!refund ? <p className="mt-2 text-sm text-ink-2">This course wasn’t bought (free or added for you), so there is nothing to refund.</p> : (
            <>
              <p className={`mt-2 font-bold ${refundTone}`} data-testid="refund-state">
                {refund.state === "refunded" ? "Refunded" : refund.state === "requested" ? "Refund request in progress" : refund.state === "eligible" ? "You can get a refund" : refund.state === "review" ? "Eligible: a member of our team approves refunds" : "Not eligible for a standard refund"}
              </p>
              {refund.state === "eligible" || refund.state === "review" ? (
                <p className="mt-1 text-sm text-ink-2"><span className="font-bold tabular-nums text-ink">{refund.daysLeft === 0 ? "Last day" : `${refund.daysLeft} day${refund.daysLeft === 1 ? "" : "s"} left`}</span> · until {refund.deadline ? dateTime(refund.deadline) : "—"}</p>
              ) : null}
              <div className="mt-4 space-y-1.5">
                <p className="flex justify-between text-sm"><span>Paid video watched (refund measure)</span><span className="tabular-nums font-bold">{pct(refund.watchedPercent)} <span className="font-normal text-muted">of {pct(refund.maxWatchedPercent)}</span></span></p>
                <Bar value={refund.watchedPercent} limit={refund.maxWatchedPercent} label="Paid video watched against the refund limit" />
                <p className="text-xs text-muted">Free preview lessons don’t count. {hm(n(video.paidWatchedSec))} of {hm(n(video.paidSec))} of paid video.</p>
              </div>
              <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-t border-line pt-4 text-sm">
                <dt className="text-ink-2">Refund period</dt><dd className="tabular-nums">{refund.windowDays} days</dd>
                <dt className="text-ink-2">Deadline</dt><dd className="tabular-nums">{refund.deadline ? dateTime(refund.deadline) : "—"}</dd>
                <dt className="text-ink-2">Policy version</dt><dd className="tabular-nums">{refund.policyVersion}</dd>
              </dl>
              {refund.state === "not_eligible" && refund.message ? <p className="mt-4 whitespace-pre-line rounded-tile border border-line bg-surface-2 p-3 text-sm text-ink-2" data-testid="refund-reason">{refund.message}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/student/purchases/${refund.orderId}`} className="btn btn-outline btn-sm">{refund.state === "eligible" || refund.state === "review" ? "Request a refund" : "Open the receipt"}</Link>
                <Link href="/policies/access-and-refunds" className="btn btn-ghost btn-sm">Refund policy</Link>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-panel border border-line bg-surface p-5" aria-labelledby="dl-h">
        <h2 id="dl-h" className="flex items-center gap-2 font-display text-lg font-bold"><Download className="size-5 text-violet" aria-hidden="true" />Study material downloads</h2>
        {items.length ? (
          <ul className="mt-3 divide-y divide-line text-sm" data-testid="download-history">
            {items.map((d, i) => <li key={i} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2"><span className="min-w-0 break-words">{String(d.title)}</span><span className="tabular-nums text-muted">{dateTime(String(d.at))}</span></li>)}
          </ul>
        ) : <p className="mt-2 text-sm text-ink-2">No files downloaded yet. Lesson files appear under each video in the player.</p>}
      </section>
    </div>
  );
}
