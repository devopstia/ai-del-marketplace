"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, BookOpen, CalendarClock, Download, FileText, MessageSquareText, PlayCircle, Receipt } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { list, obj, toLearningItem, toRelatedCourse } from "@/lib/normalize";
import { date, moneyExact } from "@/lib/format";
import type { LearningItem, RelatedCourse } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { CourseCover } from "@/components/CourseCover";
import { LoopMeter } from "@/components/LoopMeter";
import { PageHead } from "@/components/shell/AppShell";
import { resumeHref, useNow } from "@/components/student/MyCourses";
import { ProgramNote } from "@/components/promo/FullProgram";
import { RelatedCourses } from "@/components/RelatedCourses";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { Panel } from "@/components/dashboard/Panel";
import { TimeChart } from "@/components/dashboard/TimeChart";
import { EmptyNote, ErrorNote, PanelSkeleton } from "@/components/dashboard/States";

const DAY = 86_400_000;

type Dash = {
  items: LearningItem[];
  expired: LearningItem[];
  cont: { slug: string; lectureId: string | null; lectureTitle: string | null; moduleTitle: string | null; positionSec: number; remainingSec: number; lessonsLeft: number } | null;
  certificates: { code: string; issuedAt: string; status: string; course: { slug: string; title: string } }[];
  quizzes: { averageScore: number | null; quizzesTaken: number; attempts: number; courses: { slug: string; title: string; quizzes: number; averageScore: number | null }[]; recent: { at: string; score: number; lectureId: string; lectureTitle: string; course: { slug: string; title: string } }[] };
  activity: { days: { date: string; lessons: number; quizzes: number }[]; activeDays: number; streak: number; lessonsOpened: number; quizAttempts: number };
  downloads: { id: string; title: string; at: string; course: { slug: string; title: string } | null }[];
  purchases: { id: string; status: string; totalCents: number; currency: string; paidAt: string; receiptNumber: string | null; orderRef: string; courses: string[] }[];
  freeCourses: { slug: string; title: string; subtitle: string; thumbnailUrl: string | null }[];
};

function toDash(x: unknown): Dash {
  const o = obj(x);
  const learning = obj(o.learning);
  const q = obj(o.quizzes);
  const a = obj(o.activity);
  return {
    items: list(learning, "items").map(toLearningItem),
    expired: list(learning, "expired").map(toLearningItem),
    cont: o.continueLearning ? (o.continueLearning as Dash["cont"]) : null,
    certificates: (o.certificates as Dash["certificates"]) ?? [],
    quizzes: { averageScore: (q.averageScore as number | null) ?? null, quizzesTaken: Number(q.quizzesTaken ?? 0), attempts: Number(q.attempts ?? 0), courses: (q.courses as Dash["quizzes"]["courses"]) ?? [], recent: (q.recent as Dash["quizzes"]["recent"]) ?? [] },
    activity: { days: (a.days as Dash["activity"]["days"]) ?? [], activeDays: Number(a.activeDays ?? 0), streak: Number(a.streak ?? 0), lessonsOpened: Number(a.lessonsOpened ?? 0), quizAttempts: Number(a.quizAttempts ?? 0) },
    downloads: (o.downloads as Dash["downloads"]) ?? [],
    purchases: (o.purchases as Dash["purchases"]) ?? [],
    freeCourses: (o.freeCourses as Dash["freeCourses"]) ?? [],
  };
}

const hoursLeft = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);

/** Student Studio home (dashboard phase 2, Option A; owner 2026-11-28): continue learning first, then progress, quizzes, activity, certificates, downloads and purchases. */
export default function StudentDashboard() {
  const { me } = useAuth();
  const now = useNow();
  const [d, setD] = useState<Dash | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toReview, setToReview] = useState<{ slug: string; title: string }[]>([]);
  // "Continue your learning journey" (owner 2026-11-28): related courses of the courses you own, never ones you own.
  const [related, setRelated] = useState<RelatedCourse[]>([]);
  const load = useCallback(() => {
    api("/me/dashboard").then((r) => setD(toDash(r))).catch((e) => setErr(errMsg(e)));
  }, []);
  useEffect(() => {
    load();
    api("/me/related-courses").then((r) => setRelated(list(r, "items").map(toRelatedCourse).filter((x) => !x.owned))).catch(() => {});
    api("/me/reviews").then((r) => setToReview((obj(r).toReview as { slug: string; title: string }[]) ?? [])).catch(() => {});
  }, [load]);

  const sorted = useMemo(() => [...(d?.items ?? [])].sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "")), [d]);
  const current = d?.cont ? sorted.find((i) => i.course.slug === d.cont!.slug) : undefined;
  const done = sorted.filter((i) => i.progressPct >= 100);
  const inProgress = sorted.filter((i) => i.progressPct > 0 && i.progressPct < 100);
  const expiring = sorted.filter((i) => i.access?.expiresAt && new Date(i.access.expiresAt).getTime() - now <= 30 * DAY);
  const certReady = done.filter((i) => !i.certificateCode);
  const attention = [
    ...expiring.map((i) => ({ key: `exp-${i.course.slug}`, icon: CalendarClock, tone: "text-amber", text: <>Access to <b>{i.course.title}</b> ends {date(i.access!.expiresAt)}.</>, href: `/courses/${i.course.slug}`, cta: "Renew" })),
    ...(d?.expired.length ? [{ key: "expired", icon: CalendarClock, tone: "text-muted", text: <>{d.expired.length} course{d.expired.length === 1 ? "" : "s"} expired. Your progress is saved.</>, href: "/student/courses", cta: "See" }] : []),
    ...certReady.map((i) => ({ key: `cert-${i.course.slug}`, icon: Award, tone: "text-mint", text: <>You finished <b>{i.course.title}</b>. Your certificate is ready.</>, href: "/student/progress", cta: "Get it" })),
    ...toReview.slice(0, 3).map((c) => ({ key: `rev-${c.slug}`, icon: MessageSquareText, tone: "text-violet", text: <>How was <b>{c.title}</b>? Your rating helps other learners.</>, href: `/learn/${c.slug}?tab=review`, cta: "Rate" })),
  ];

  return (
    <div className="max-w-[1600px]">
      <PageHead title={me ? `Welcome, ${me.name.split(" ")[0]}` : "Dashboard"} sub="Your learning at a glance." />
      {err ? <ErrorNote message={err} onRetry={() => { setErr(null); load(); }} /> : null}
      {!d && !err ? <div className="grid gap-6"><PanelSkeleton className="h-56" /><PanelSkeleton className="h-24" /><PanelSkeleton className="h-64" /></div> : null}
      {d ? (
        <>
          {current && d.cont ? (
            <section aria-labelledby="continue-h" className="overflow-hidden rounded-panel bg-stage text-white" data-qa-on-media data-testid="continue-learning">
              <div className="grid items-center gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,380px)_1fr] md:gap-10">
                <Link href={resumeHref(current)} className="group relative block" aria-label={`Resume ${current.course.title}`}>
                  <CourseCover slug={current.course.slug} title={current.course.title} category={current.course.category?.name} thumbnailUrl={current.course.thumbnailUrl} />
                  <span className="absolute inset-0 grid place-items-center rounded-tile bg-black/30 opacity-90 transition-opacity group-hover:opacity-100">
                    <span className="grid size-14 place-items-center rounded-full bg-white text-[#141833]"><PlayCircle className="size-7" /></span>
                  </span>
                </Link>
                <div className="min-w-0">
                  <h2 id="continue-h" className="text-sm font-bold text-[#9fd9f5]">Continue learning</h2>
                  <p className="mt-2 font-display text-2xl font-extrabold leading-tight sm:text-3xl">{current.course.title}</p>
                  {d.cont.lectureTitle ? (
                    <p className="mt-2 text-white/80">{d.cont.moduleTitle ? <span className="text-white/60">{d.cont.moduleTitle} · </span> : null}{d.cont.lectureTitle}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="[&_span]:!text-white"><LoopMeter value={current.progressPct} size="lg" /></span>
                    <span className="text-sm text-white/75">{d.cont.lessonsLeft} lesson{d.cont.lessonsLeft === 1 ? "" : "s"} left{d.cont.remainingSec ? ` · about ${hoursLeft(d.cont.remainingSec)} of video` : ""}</span>
                  </div>
                  <Link href={resumeHref(current)} className="btn btn-cyan mt-5" data-testid="dashboard-resume">{d.cont.positionSec > 0 ? "Resume where you left off" : "Start the next lesson"}</Link>
                </div>
              </div>
            </section>
          ) : null}

          {!sorted.length ? (
            <section aria-labelledby="start-h" className="rounded-panel border border-line bg-surface p-5 sm:p-6" data-testid="start-first">
              <h2 id="start-h" className="font-display text-xl font-extrabold">Start your first course</h2>
              <p className="mt-1 max-w-2xl text-ink-2">Courses you enrol in appear here with your progress, quizzes and certificates. These are free, so you can start now.</p>
              {d.freeCourses.length ? (
                <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {d.freeCourses.map((c) => (
                    <li key={c.slug}><Link href={`/courses/${c.slug}`} className="group block"><CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} /><p className="mt-2 font-bold group-hover:text-violet">{c.title}</p><p className="text-sm text-muted">Free</p></Link></li>
                  ))}
                </ul>
              ) : null}
              <Link href="/courses" className="btn btn-primary mt-5">Browse all courses</Link>
            </section>
          ) : null}

          <div className={current || !sorted.length ? "mt-6" : ""}>
            <KpiStrip items={[
              { label: "Enrolled courses", value: String(sorted.length), note: d.expired.length ? `${d.expired.length} expired` : undefined },
              { label: "In progress", value: String(inProgress.length) },
              { label: "Completed", value: String(done.length), note: d.certificates.length ? `${d.certificates.length} certificate${d.certificates.length === 1 ? "" : "s"}` : undefined },
              { label: "Quiz average", value: d.quizzes.averageScore === null ? "—" : `${d.quizzes.averageScore}%`, note: d.quizzes.quizzesTaken ? `${d.quizzes.quizzesTaken} quiz${d.quizzes.quizzesTaken === 1 ? "" : "zes"}` : "No quizzes yet" },
              { label: "Learning streak", value: `${d.activity.streak} day${d.activity.streak === 1 ? "" : "s"}`, note: `${d.activity.activeDays} active days in 30` },
              { label: "Lessons opened", value: String(d.activity.lessonsOpened), note: "Last 30 days" },
            ]} />
          </div>

          {sorted.length ? (
            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Panel title="My courses" href="/student/courses" linkLabel="All courses">
                <ul className="-mx-1 divide-y divide-line" data-testid="my-courses">
                  {sorted.slice(0, 6).map((i) => {
                    const soon = i.access?.expiresAt && new Date(i.access.expiresAt).getTime() - now <= 30 * DAY;
                    return (
                      <li key={i.course.slug} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 px-1 py-3">
                        <CourseCover slug={i.course.slug} title={i.course.title} thumbnailUrl={i.course.thumbnailUrl} size="sm" showTitle={false} className="!rounded-lg" />
                        <div className="min-w-0">
                          <Link href={resumeHref(i)} className="line-clamp-1 font-bold hover:text-violet">{i.course.title}</Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <LoopMeter value={i.progressPct} size="sm" />
                            <span>{i.lastActivityAt ? `Last studied ${date(i.lastActivityAt)}` : "Not started"}</span>
                            {soon ? <span className="font-bold text-amber">Access ends {date(i.access!.expiresAt)}</span> : null}
                          </div>
                        </div>
                        <Link href={resumeHref(i)} className="btn btn-ghost btn-sm">{i.progressPct === 0 ? "Start" : i.progressPct >= 100 ? "Review" : "Resume"}</Link>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
              <div className="grid gap-6">
                <Panel title="Needs your attention">
                  {attention.length ? (
                    <ul className="-mx-1 divide-y divide-line" data-testid="attention">
                      {attention.slice(0, 5).map((a) => (
                        <li key={a.key} className="flex items-start gap-3 px-1 py-2.5 text-sm">
                          <a.icon className={`mt-0.5 size-4 shrink-0 ${a.tone}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1 text-ink-2">{a.text}</span>
                          <Link href={a.href} className="link shrink-0">{a.cta}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : <EmptyNote>Nothing waiting. Enjoy your next lesson.</EmptyNote>}
                </Panel>
                {/* One recommendation block at a time: your next courses when there are any, else DEL's full program. */}
                {related.length ? <RelatedCourses items={related} variant="compact" /> : <ProgramNote placement="student-dashboard" />}
              </div>
            </div>
          ) : null}

          {sorted.length ? (
            <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Panel title="Learning activity, last 30 days">
                {d.activity.activeDays ? (
                  <TimeChart points={d.activity.days.map((x) => ({ date: x.date, a: x.lessons, b: x.quizzes }))} labelA="Lessons opened" labelB="Quiz attempts" format={(v) => String(Math.round(v))} height={220} ariaLabel="Your learning activity over the last 30 days" />
                ) : <EmptyNote href={current ? resumeHref(current) : "/student/courses"} action="Open a lesson">No lessons opened in the last 30 days.</EmptyNote>}
              </Panel>
              <Panel title="Quiz results">
                {d.quizzes.quizzesTaken ? (
                  <div data-testid="quiz-results">
                    <ul className="-mx-1 divide-y divide-line text-sm">
                      {d.quizzes.courses.map((c) => (
                        <li key={c.slug} className="flex items-center justify-between gap-3 px-1 py-2">
                          <span className="min-w-0 truncate">{c.title}</span>
                          <span className="shrink-0 tabular-nums text-ink-2">{c.quizzes} quiz{c.quizzes === 1 ? "" : "zes"} · <b className="text-ink">{c.averageScore ?? "—"}%</b></span>
                        </li>
                      ))}
                    </ul>
                    <h3 className="mt-4 text-xs font-bold text-muted">Latest attempts</h3>
                    <ul className="mt-1 -mx-1 divide-y divide-line text-sm">
                      {d.quizzes.recent.slice(0, 3).map((r) => (
                        <li key={`${r.lectureId}-${r.at}`} className="flex items-center justify-between gap-3 px-1 py-2">
                          <span className="min-w-0"><span className="line-clamp-1">{r.lectureTitle}</span><span className="text-xs text-muted">{date(r.at)}</span></span>
                          <span className="flex shrink-0 items-center gap-3"><b className={r.score >= 70 ? "text-mint" : "text-amber"}>{r.score}%</b><Link href={`/learn/${r.course.slug}/${r.lectureId}`} className="link">Retake</Link></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <EmptyNote>Quizzes after lessons show your score here.</EmptyNote>}
              </Panel>
            </div>
          ) : null}

          {sorted.length || d.purchases.length ? (
            <div className="mt-6 grid items-start gap-6 lg:grid-cols-3">
              <Panel title="Certificates" href="/student/progress" linkLabel="All">
                {d.certificates.length ? (
                  <ul className="-mx-1 divide-y divide-line text-sm" data-testid="dash-certificates">
                    {d.certificates.slice(0, 4).map((c) => (
                      <li key={c.code} className="flex items-center gap-3 px-1 py-2">
                        <Award className="size-4 shrink-0 text-mint" aria-hidden="true" />
                        <span className="min-w-0 flex-1"><span className="line-clamp-1 font-bold">{c.course.title}</span><span className="text-xs text-muted">{date(c.issuedAt)}{c.status === "revoked" ? " · revoked" : ""}</span></span>
                        <Link href={`/certificates/${encodeURIComponent(c.code)}`} className="link shrink-0">View</Link>
                        <a href={`${API_URL}/certificates/${encodeURIComponent(c.code)}/certificate.pdf`} className="link shrink-0">PDF</a>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyNote>Finish every lesson of a course to earn its certificate.</EmptyNote>}
              </Panel>
              <Panel title="Recent downloads">
                {d.downloads.length ? (
                  <ul className="-mx-1 divide-y divide-line text-sm">
                    {d.downloads.map((x) => (
                      <li key={x.id} className="flex items-center gap-3 px-1 py-2">
                        {/zip/i.test(x.title) ? <Download className="size-4 shrink-0 text-violet" aria-hidden="true" /> : <FileText className="size-4 shrink-0 text-violet" aria-hidden="true" />}
                        <span className="min-w-0 flex-1"><span className="line-clamp-1">{x.title}</span><span className="text-xs text-muted">{x.course?.title ?? ""}{x.course ? " · " : ""}{date(x.at)}</span></span>
                        {x.course ? <Link href={`/learn/${x.course.slug}`} className="link shrink-0">Open</Link> : null}
                      </li>
                    ))}
                  </ul>
                ) : <EmptyNote>Slides and lab files you download appear here.</EmptyNote>}
              </Panel>
              <Panel title="Purchases" href="/student/purchases" linkLabel="All">
                {d.purchases.length ? (
                  <ul className="-mx-1 divide-y divide-line text-sm" data-testid="dash-purchases">
                    {d.purchases.map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-1 py-2">
                        <Receipt className="size-4 shrink-0 text-violet" aria-hidden="true" />
                        <span className="min-w-0 flex-1"><span className="line-clamp-1">{p.courses.join(", ")}</span><span className="text-xs text-muted">{date(p.paidAt)} · {p.receiptNumber ?? p.orderRef}{p.status !== "paid" ? ` · ${p.status.replace("_", " ")}` : ""}</span></span>
                        <span className="shrink-0 tabular-nums font-bold">{moneyExact(p.totalCents, p.currency)}</span>
                        <Link href={`/student/purchases/${p.id}`} className="link shrink-0">Receipt</Link>
                      </li>
                    ))}
                  </ul>
                ) : <EmptyNote href="/courses" action="Browse courses">No purchases yet. Free courses need none.</EmptyNote>}
              </Panel>
            </div>
          ) : null}

          {!sorted.length ? <div className="mt-6"><ProgramNote placement="student-dashboard" /></div> : null}
          {sorted.length ? <p className="mt-6 text-xs text-muted"><BookOpen className="mr-1 inline size-3.5" aria-hidden="true" />Activity counts the lessons you opened and the quizzes you took each day.</p> : null}
        </>
      ) : null}
    </div>
  );
}
