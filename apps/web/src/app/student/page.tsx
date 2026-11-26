"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Award, BookOpen, CalendarClock, MessageSquareText, PlayCircle } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj, toLearningItem } from "@/lib/normalize";
import { date } from "@/lib/format";
import type { LearningItem } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { CourseCover } from "@/components/CourseCover";
import { LoopMeter } from "@/components/LoopMeter";
import { Empty, Skeleton } from "@/components/Empty";
import { Kpis, PageHead } from "@/components/shell/AppShell";
import { resumeHref, useNow } from "@/components/student/MyCourses";
import { ProgramNote } from "@/components/promo/FullProgram";

const DAY = 86_400_000;

/** Student Studio dashboard: real numbers from the API, the course to continue, and what needs attention. */
export default function StudentDashboard() {
  const { me } = useAuth();
  const now = useNow();
  const [items, setItems] = useState<LearningItem[] | null>(null);
  const [expired, setExpired] = useState<LearningItem[]>([]);
  const [toReview, setToReview] = useState<{ slug: string; title: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api("/me/learning").then((r) => {
      setItems(list(r, "courses", "enrollments").map(toLearningItem));
      setExpired(Array.isArray(obj(r).expired) ? (obj(r).expired as unknown[]).map(toLearningItem) : []);
    }).catch((e) => setErr(errMsg(e)));
    api("/me/reviews").then((r) => setToReview((obj(r).toReview as { slug: string; title: string }[]) ?? [])).catch(() => {});
  }, []);

  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "")), [items]);
  const current = sorted.find((i) => i.progressPct > 0 && i.progressPct < 100) ?? sorted.find((i) => i.progressPct < 100);
  const done = sorted.filter((i) => i.progressPct >= 100);
  const inProgress = sorted.filter((i) => i.progressPct > 0 && i.progressPct < 100);
  const overall = sorted.length ? Math.round(sorted.reduce((n, i) => n + i.progressPct, 0) / sorted.length) : 0;
  const expiring = sorted.filter((i) => i.access?.expiresAt && new Date(i.access.expiresAt).getTime() - now <= 30 * DAY);
  const certReady = done.filter((i) => !i.certificateCode);
  const attention = [
    ...expiring.map((i) => ({ key: `exp-${i.course.slug}`, icon: CalendarClock, tone: "text-amber", text: <>Access to <b>{i.course.title}</b> ends {date(i.access!.expiresAt)}.</>, href: `/courses/${i.course.slug}`, cta: "Renew" })),
    ...(expired.length ? [{ key: "expired", icon: CalendarClock, tone: "text-muted", text: <>{expired.length} course{expired.length === 1 ? "" : "s"} expired. Your progress is saved.</>, href: "/student/courses", cta: "See" }] : []),
    ...certReady.map((i) => ({ key: `cert-${i.course.slug}`, icon: Award, tone: "text-mint", text: <>You finished <b>{i.course.title}</b>. Your certificate is ready.</>, href: "/student/courses", cta: "Get it" })),
    ...toReview.slice(0, 3).map((c) => ({ key: `rev-${c.slug}`, icon: MessageSquareText, tone: "text-violet", text: <>How was <b>{c.title}</b>? Your rating helps other learners.</>, href: `/learn/${c.slug}?tab=review`, cta: "Rate" })),
  ];

  return (
    <div className="max-w-[1600px]">
      <PageHead title={me ? `Welcome, ${me.name.split(" ")[0]}` : "Dashboard"} sub="Your learning at a glance." />
      {err ? <p className="text-rose">{err}</p> : null}
      {!items && !err ? <div className="grid gap-6"><Skeleton className="h-28" /><Skeleton className="h-64" /></div> : null}
      {items ? (
        <>
          <Kpis items={[
            { label: "Enrolled courses", value: String(items.length), note: expired.length ? `${expired.length} expired` : undefined },
            { label: "In progress", value: String(inProgress.length) },
            { label: "Completed", value: String(done.length) },
            { label: "Overall progress", value: `${overall}%`, note: "Average across your courses" },
          ]} />

          {!items.length ? (
            <div className="mt-8"><Empty icon={BookOpen} title="Start your first course" body="Courses you enrol in appear here with your progress. Every course has free previews, so try before you buy." href="/courses" cta="Browse courses" /></div>
          ) : null}

          {current ? (
            <section aria-labelledby="continue-h" className="mt-8 overflow-hidden rounded-panel bg-stage text-white" data-qa-on-media>
              <div className="grid items-center gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,360px)_1fr] md:gap-10">
                <Link href={resumeHref(current)} className="group relative block" aria-label={`Resume ${current.course.title}`}>
                  <CourseCover slug={current.course.slug} title={current.course.title} category={current.course.category?.name} thumbnailUrl={current.course.thumbnailUrl} />
                  <span className="absolute inset-0 grid place-items-center rounded-tile bg-black/30 opacity-90 transition-opacity group-hover:opacity-100">
                    <span className="grid size-14 place-items-center rounded-full bg-white text-[#141833]"><PlayCircle className="size-7" /></span>
                  </span>
                </Link>
                <div>
                  <h2 id="continue-h" className="text-sm font-bold text-[#9fd9f5]">Continue learning</h2>
                  <p className="mt-2 font-display text-2xl font-extrabold leading-tight">{current.course.title}</p>
                  {current.lastLectureTitle ? <p className="mt-2 text-white/75">Next up: {current.lastLectureTitle}</p> : null}
                  <div className="mt-4 flex flex-wrap items-center gap-5">
                    <span className="[&_span]:!text-white"><LoopMeter value={current.progressPct} size="lg" /></span>
                    {current.totalLectures ? <span className="text-sm text-white/70">{current.completedLectures ?? 0} of {current.totalLectures} lessons done</span> : null}
                  </div>
                  <Link href={resumeHref(current)} className="btn btn-cyan mt-5" data-testid="dashboard-resume">Resume course</Link>
                </div>
              </div>
            </section>
          ) : null}

          {items.length ? (
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
              <section aria-labelledby="courses-h">
                <div className="flex items-end justify-between gap-3">
                  <h2 id="courses-h" className="font-display text-xl font-extrabold">Your courses</h2>
                  <Link href="/student/courses" className="link inline-flex items-center gap-1 text-sm">All courses<ArrowRight className="size-4" /></Link>
                </div>
                <ul className="mt-3 divide-y divide-line rounded-tile border border-line bg-surface">
                  {sorted.slice(0, 5).map((i) => (
                    <li key={i.course.slug} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3">
                      <CourseCover slug={i.course.slug} title={i.course.title} thumbnailUrl={i.course.thumbnailUrl} size="sm" showTitle={false} className="!rounded-lg" />
                      <div className="min-w-0">
                        <Link href={resumeHref(i)} className="line-clamp-1 font-bold hover:text-violet">{i.course.title}</Link>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted"><LoopMeter value={i.progressPct} size="sm" />{i.lastActivityAt ? <span>Last studied {date(i.lastActivityAt)}</span> : <span>Not started</span>}</div>
                      </div>
                      <Link href={resumeHref(i)} className="btn btn-ghost btn-sm">{i.progressPct === 0 ? "Start" : i.progressPct >= 100 ? "Review" : "Resume"}</Link>
                    </li>
                  ))}
                </ul>
              </section>
              <div className="space-y-6">
                <section aria-labelledby="att-h">
                  <h2 id="att-h" className="font-display text-xl font-extrabold">Needs your attention</h2>
                  {attention.length ? (
                    <ul className="mt-3 divide-y divide-line rounded-tile border border-line bg-surface" data-testid="attention">
                      {attention.slice(0, 6).map((a) => (
                        <li key={a.key} className="flex items-start gap-3 px-4 py-3 text-sm">
                          <a.icon className={`mt-0.5 size-4 shrink-0 ${a.tone}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1 text-ink-2">{a.text}</span>
                          <Link href={a.href} className="link shrink-0">{a.cta}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-3 rounded-tile border border-line bg-surface px-4 py-4 text-sm text-ink-2">Nothing waiting. Enjoy your next lesson.</p>}
                </section>
                <ProgramNote placement="student-dashboard" />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
