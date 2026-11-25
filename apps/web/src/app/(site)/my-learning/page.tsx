"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Award, BookOpen, Loader2, PlayCircle } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj, paged, toCourseCard, toLearningItem } from "@/lib/normalize";
import { useApi } from "@/lib/useApi";
import { InstallHint } from "@/components/pwa/InstallHint";
import { CourseResultRow, CourseTile } from "@/components/CourseViews";
import { date, hours } from "@/lib/format";
import type { LearningItem } from "@/lib/types";
import { CourseCover } from "@/components/CourseCover";
import { LoopMeter } from "@/components/LoopMeter";
import { Empty, Skeleton } from "@/components/Empty";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

const mapPopular = (r: unknown) => paged(r, toCourseCard).items;

const tabs = [["all", "All courses"], ["progress", "In progress"], ["done", "Completed"]] as const;

function resumeHref(i: LearningItem) {
  return i.lastLectureId ? `/learn/${i.course.slug}/${i.lastLectureId}` : `/learn/${i.course.slug}`;
}

function CertificateAction({ item, onIssued }: { item: LearningItem; onIssued: (code: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (item.certificateCode) return <Link href={`/certificates/${item.certificateCode}`} className="link inline-flex items-center gap-1 text-sm"><Award className="size-4" />View certificate</Link>;
  if (item.progressPct < 100) return null;
  return (
    <button type="button" className="link inline-flex items-center gap-1 text-sm" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const r = obj(await api(`/courses/${item.course.slug}/certificate`, { method: "POST" }));
        onIssued(String(r.code ?? obj(r.certificate).code));
      } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
    }}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />}Get your certificate
    </button>
  );
}

export default function MyLearning() {
  const { me } = useAuth();
  const [items, setItems] = useState<LearningItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("all");

  useEffect(() => {
    api("/me/learning").then((r) => setItems(list(r, "courses", "enrollments").map(toLearningItem))).catch((e) => setErr(errMsg(e)));
  }, []);

  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "")), [items]);
  const current = sorted.find((i) => i.progressPct > 0 && i.progressPct < 100) ?? sorted.find((i) => i.progressPct < 100);
  const shown = sorted.filter((i) => tab === "all" || (tab === "done" ? i.progressPct >= 100 : i.progressPct < 100));
  const popular = useApi("/courses?sort=popular&pageSize=8", mapPopular);
  const owned = new Set((items ?? []).map((i) => i.course.slug));
  const suggestions = (popular.data ?? []).filter((c) => !owned.has(c.slug)).slice(0, 4);
  const allDone = !!items?.length && items.every((i) => i.progressPct >= 100);
  const issue = (slug: string) => (code: string) => setItems((xs) => xs?.map((x) => (x.course.slug === slug ? { ...x, certificateCode: code } : x)) ?? null);

  return (
    <div className="container-x pt-10">
      <h1 className="font-display text-[clamp(2rem,4vw,2.8rem)] font-extrabold">My learning</h1>
      {me ? <p className="mt-1 text-ink-2">Welcome back, {me.name.split(" ")[0]}.</p> : null}
      {err ? <p className="mt-6 text-rose">{err}</p> : null}
      {!items && !err ? <div className="mt-8 grid gap-6 md:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : null}
      {items && !items.length ? (
        <div className="mt-10"><Empty icon={BookOpen} title="Start your first course" body="Courses you enrol in appear here with your progress. Every course has free previews, so try before you buy." href="/courses" cta="Find a course" /></div>
      ) : null}

      {current ? (
        <section aria-labelledby="continue-h" className="mt-8 overflow-hidden rounded-panel bg-stage text-white">
          <div className="grid items-center gap-6 p-4 sm:p-6 md:grid-cols-[minmax(0,420px)_1fr] md:gap-10 md:p-8">
            <Link href={resumeHref(current)} className="group relative block">
              <CourseCover slug={current.course.slug} title={current.course.title} category={current.course.category?.name} thumbnailUrl={current.course.thumbnailUrl} />
              <span className="absolute inset-0 grid place-items-center rounded-tile bg-black/30 opacity-90 transition-opacity group-hover:opacity-100">
                <span className="grid size-16 place-items-center rounded-full bg-white text-[#141833]"><PlayCircle className="size-8" /></span>
              </span>
            </Link>
            <div>
              <h2 id="continue-h" className="text-sm font-bold text-[#9fd9f5]">Continue where you left off</h2>
              <p className="mt-2 font-display text-2xl font-extrabold leading-tight md:text-3xl">{current.course.title}</p>
              {current.lastLectureTitle ? <p className="mt-2 text-white/75">Continue where you left off: {current.lastLectureTitle}</p> : null}
              <div className="mt-5 flex flex-wrap items-center gap-6">
                <span className="[&_span]:!text-white"><LoopMeter value={current.progressPct} size="lg" /></span>
                {current.totalLectures ? <span className="text-sm text-white/70">{current.completedLectures ?? 0} of {current.totalLectures} lectures done</span> : null}
              </div>
              <Link href={resumeHref(current)} className="btn btn-cyan mt-6" data-testid="resume">Resume course</Link>
            </div>
          </div>
        </section>
      ) : null}

      {allDone ? (
        <section className="mt-8 flex flex-col gap-5 rounded-panel bg-stage p-6 text-white sm:flex-row sm:items-center sm:p-8">
          <span className="[&_span]:!text-white"><LoopMeter value={100} size="lg" /></span>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-extrabold">You’ve finished every course you’re enrolled in</h2>
            <p className="mt-1 text-white/75">Your certificates are below. Pick a next course to keep the loop going.</p>
          </div>
          <Link href="/courses" className="btn btn-cyan">Find your next course</Link>
        </section>
      ) : null}

      {items && items.length ? (
        <section className="mt-12">
          <div role="tablist" aria-label="Filter courses" className="flex gap-1 border-b border-line">
            {tabs.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${tab === k ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                {l}
              </button>
            ))}
          </div>
          <ul className="mt-2 divide-y divide-line">
            {shown.map((i) => (
              <li key={i.course.slug} className="grid grid-cols-[110px_1fr] items-center gap-4 py-5 sm:grid-cols-[200px_1fr_auto] sm:gap-6" data-testid="learning-item">
                <Link href={resumeHref(i)}><CourseCover slug={i.course.slug} title={i.course.title} thumbnailUrl={i.course.thumbnailUrl} size="sm" className="sm:hidden" /><CourseCover slug={i.course.slug} title={i.course.title} category={i.course.category?.name} thumbnailUrl={i.course.thumbnailUrl} className="hidden sm:block" /></Link>
                <div className="min-w-0">
                  <Link href={resumeHref(i)} className="font-display text-lg font-bold leading-snug hover:text-violet">{i.course.title}</Link>
                  <p className="text-sm text-muted">{i.course.instructor.name}{i.course.totalDurationSec ? `, ${hours(i.course.totalDurationSec)}` : ""}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <LoopMeter value={i.progressPct} size="sm" />
                    {i.lastActivityAt ? <span className="text-xs text-muted">Last studied {date(i.lastActivityAt)}</span> : null}
                    <CertificateAction item={i} onIssued={issue(i.course.slug)} />
                  </div>
                </div>
                <Link href={resumeHref(i)} className="btn btn-outline btn-sm col-span-2 sm:col-span-1">{i.progressPct === 0 ? "Start course" : i.progressPct >= 100 ? "Review course" : "Resume"}</Link>
              </li>
            ))}
            {!shown.length ? <li className="py-10 text-center text-ink-2">No courses in this list yet.</li> : null}
          </ul>
        </section>
      ) : null}

      {items && suggestions.length ? (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-extrabold">Popular courses to try next</h2>
          <p className="mt-1 text-ink-2">Most enrolled courses you haven’t started yet.</p>
          {/* A full row of tiles only when there are enough courses; fewer are listed, so no empty grid slots. */}
          {suggestions.length >= 4
            ? <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">{suggestions.map((c) => <CourseTile key={c.slug} c={c} />)}</div>
            : <div className="mt-4 divide-y divide-line border-y border-line">{suggestions.map((c) => <CourseResultRow key={c.slug} c={c} />)}</div>}
        </section>
      ) : null}
      <InstallHint />
    </div>
  );
}
