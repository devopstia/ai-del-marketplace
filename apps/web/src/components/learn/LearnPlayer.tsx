"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, FileText, ListChecks, Loader2, PanelRightClose, PanelRightOpen, PlayCircle, Star } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj, toCourseDetail } from "@/lib/normalize";
import { clock, hours, date } from "@/lib/format";
import type { CourseDetail, LectureOutline, Playback, ResourceItem } from "@/lib/types";
import { LoopMark } from "../Logo";
import { LoopMeter } from "../LoopMeter";
import { ThemeToggle } from "../ThemeToggle";
import { VideoPlayer } from "../VideoPlayer";
import { Markdown } from "../Markdown";
import { QuizPanel } from "./QuizPanel";
import { ResourcesPanel } from "./ResourcesPanel";
import { NotesPanel } from "./NotesPanel";
import { ReviewPanel, toReviewInfo, type ReviewInfo } from "./ReviewPanel";
import { RatingInline } from "@/components/Stars";
import { useToast } from "../Toast";

const SAVE_EVERY_MS = 10_000;
const AUTOPLAY_SECONDS = 5;

type Tab = "overview" | "content" | "resources" | "quiz" | "notes" | "review" | "package";

export function LearnPlayer({ slug, lectureId: initialLecture }: { slug: string; lectureId: string }) {
  // Lessons change in place (history.pushState): the player stays mounted, so full screen survives "Next".
  const pathname = usePathname();
  const lectureId = pathname.match(/^\/learn\/[^/]+\/([^/?#]+)/)?.[1] ?? initialLecture;
  const stageRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewInfo | null>(null);
  const [pkg, setPkg] = useState<ResourceItem[]>([]);
  const [access, setAccess] = useState<{ state: string; expiresAt: string; daysLeft: number } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [playErr, setPlayErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  // ?tab=review (from Student Studio › Course reviews) opens the review tab
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "review" || t === "notes" || t === "content") setTab(t as Tab);
  }, []);
  const [sidebar, setSidebar] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const lastSaved = useRef(0);
  const posRef = useRef(0);
  const retried = useRef(false);

  // Course outline with this learner's progress
  useEffect(() => {
    api(`/me/courses/${slug}`).then((r) => {
      const c = toCourseDetail(r);
      setCourse(c);
      setReviews(toReviewInfo(r));
      setPkg(Array.isArray(obj(r).packageFiles) ? (obj(r).packageFiles as ResourceItem[]) : []);
      const ai = obj(obj(r).accessInfo);
      setAccess(ai.expiresAt ? { state: String(ai.state), expiresAt: String(ai.expiresAt), daysLeft: Number(ai.daysLeft ?? 0) } : null);
    }).catch((e) => setLoadErr(errMsg(e)));
  }, [slug]);
  // Keep the current lesson's section open in the outline.
  useEffect(() => {
    if (!course) return;
    const sec = course.sections.find((s) => s.lectures.some((l) => l.id === lectureId)) ?? course.sections[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sec) setOpenSections((o) => (o.has(sec.id) ? o : new Set([...o, sec.id])));
  }, [course, lectureId]);

  const flat = useMemo(() => course?.sections.flatMap((s) => s.lectures) ?? [], [course]);
  const idx = flat.findIndex((l) => l.id === lectureId);
  const lecture: LectureOutline | undefined = flat[idx];
  const prev = idx > 0 ? flat[idx - 1] : undefined;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : undefined;
  const done = flat.filter((l) => l.completed).length;
  const pct = flat.length ? (done / flat.length) * 100 : 0;
  const sectionOf = course?.sections.find((s) => s.lectures.some((l) => l.id === lectureId));

  // Signed playback URL for video lectures
  const loadPlayback = useCallback(async (resumeAt: number) => {
    setPlayErr(null);
    try {
      const r = obj(await api(`/lectures/${lectureId}/playback`, { method: "POST" }));
      const serverPos = r.positionSec != null ? Number(r.positionSec) : undefined;
      setPlayback({ url: String(r.url), format: r.format === "hls" ? "hls" : "mp4", expiresAt: r.expiresAt as string, captionsUrl: (r.captionsUrl as string) ?? null, protected: r.protected === true, positionSec: resumeAt > 0 ? resumeAt : serverPos ?? 0 });
    } catch (e) {
      setPlayErr(errMsg(e));
    }
  }, [lectureId]);

  useEffect(() => {
    // Reset per-lecture state, then fetch the new lecture's playback URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayback(null);
    setCountdown(null);
    setTab((t) => (t === "quiz" || t === "resources" ? "overview" : t));
    retried.current = false;
    lastSaved.current = 0;
    if (lecture?.type === "video") void loadPlayback(lecture.completed ? 0 : lecture.positionSec ?? 0);
    // Only refetch when the lecture changes, not when its progress fields update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture?.type, lectureId, loadPlayback]);

  const markLocal = useCallback((id: string, patch: Partial<LectureOutline>) => {
    setCourse((c) => c && { ...c, sections: c.sections.map((s) => ({ ...s, lectures: s.lectures.map((l) => (l.id === id ? { ...l, ...patch } : l)) })) });
  }, []);

  // Seconds actually played, as [start, end] ranges: the server merges them so replays and skips never count
  // (one-year access and the 25% refund rule, docs/ACCESS_AND_REFUNDS.md).
  const segRef = useRef<{ start: number; last: number } | null>(null);
  const playedRef = useRef<[number, number][]>([]);
  const track = useCallback((t: number) => {
    const s = segRef.current;
    if (s && t >= s.last && t - s.last <= 2.5) { s.last = t; return; }
    if (s && s.last - s.start >= 0.5) playedRef.current.push([s.start, s.last]);
    segRef.current = { start: t, last: t };
  }, []);
  const takePlayed = useCallback(() => {
    const s = segRef.current;
    if (s && s.last - s.start >= 0.5) { playedRef.current.push([s.start, s.last]); segRef.current = { start: s.last, last: s.last }; }
    const out = playedRef.current.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10] as [number, number]);
    playedRef.current = [];
    return out;
  }, []);

  const save = useCallback(async (positionSec: number, completed: boolean, id = lectureId) => {
    lastSaved.current = Date.now();
    const played = takePlayed();
    try {
      await api(`/lectures/${id}/progress`, { method: "PUT", body: { positionSec: Math.floor(positionSec), completed, ...(played.length ? { played } : {}) } });
      if (completed) markLocal(id, { completed: true });
    } catch { /* progress is best-effort; next save retries */ }
  }, [lectureId, markLocal, takePlayed]);

  // Save position when leaving the page
  useEffect(() => {
    const flush = () => {
      if (lecture?.type === "video" && posRef.current > 0) void save(posRef.current, !!lecture.completed);
    };
    window.addEventListener("pagehide", flush);
    return () => { window.removeEventListener("pagehide", flush); flush(); };
  }, [lecture, save]);

  // Autoplay next countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (next) go(next);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, next, slug]);

  function go(l?: LectureOutline) {
    if (!l || l.id === lectureId) return;
    if (lecture?.type === "video" && posRef.current > 0) void save(posRef.current, !!lecture.completed);
    posRef.current = 0;
    window.history.pushState(null, "", `/learn/${slug}/${l.id}`);
    if (!document.fullscreenElement) window.scrollTo({ top: 0 });
  }

  if (loadErr) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="font-display text-2xl font-bold">You don’t have access to this course right now</p>
          <p className="mt-2 max-w-md text-ink-2">If your 12 months of access ended, renew it on the course page: your progress is saved and you continue where you left off.</p>
          <p className="mt-1 text-sm text-muted">{loadErr}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href={`/courses/${slug}`} className="btn btn-primary" data-testid="renew-from-player">Renew or view the course</Link>
            <Link href="/student/courses" className="btn btn-outline">My courses</Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs: [Tab, string][] = [
    ["overview", "Overview"],
    ["content", "Contents"],
    ...(lecture?.hasResources ? ([["resources", "Lesson files"]] as [Tab, string][]) : []),
    ...(pkg.length ? ([["package", "Course package"]] as [Tab, string][]) : []),
    ...(lecture?.hasQuiz || lecture?.type === "quiz" ? ([["quiz", "Quiz"]] as [Tab, string][]) : []),
    ["notes", "Notes"],
    ["review", reviews?.mine ? "Your review" : "Rate course"],
  ];

  const outline = course ? (
    <nav aria-label="Course content" className="text-sm">
      {course.sections.map((s, si) => {
        const isOpen = openSections.has(s.id);
        const sDone = s.lectures.filter((l) => l.completed).length;
        return (
          <div key={s.id} className="border-b border-line">
            <button type="button" aria-expanded={isOpen} onClick={() => setOpenSections((o) => { const n = new Set(o); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
              className="flex w-full items-start gap-2 bg-surface-2/50 px-4 py-3 text-left hover:bg-surface-2">
              <span className="flex-1">
                <span className="block font-display font-bold text-ink">Section {si + 1}: {s.title}</span>
                <span className="text-xs text-muted">{sDone} / {s.lectures.length} done, {hours(s.lectures.reduce((a, l) => a + l.durationSec, 0))}</span>
              </span>
              <ChevronDown className={`mt-1 size-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen ? (
              <ul>
                {s.lectures.map((l) => {
                  const current = l.id === lectureId;
                  const Icon = l.type === "article" ? FileText : l.type === "quiz" ? ListChecks : PlayCircle;
                  return (
                    <li key={l.id} className={`flex items-start gap-3 px-4 py-2.5 ${current ? "bg-violet-soft" : "hover:bg-surface-2"}`}>
                      <button type="button" role="checkbox" aria-checked={!!l.completed} aria-label={`Mark “${l.title}” ${l.completed ? "not complete" : "complete"}`}
                        onClick={() => { markLocal(l.id, { completed: !l.completed }); void save(l.id === lectureId ? posRef.current : l.positionSec ?? 0, !l.completed, l.id); }}
                        className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] ${l.completed ? "border-mint bg-mint text-white" : "border-line-strong bg-surface"}`}>
                        {l.completed ? <Check className="size-3" strokeWidth={3} /> : null}
                      </button>
                      <Link href={`/learn/${slug}/${l.id}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(l); }} aria-current={current ? "page" : undefined} className="min-w-0 flex-1">
                        <span className={`block leading-snug ${current ? "font-bold text-ink" : "text-ink-2"}`}>{l.title}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><Icon className="size-3.5" />{l.durationSec ? clock(l.durationSec) : l.type === "quiz" ? "Quiz" : "Reading"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  ) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <Link href="/student/courses" className="btn btn-ghost btn-sm !px-2" aria-label="Back to My courses"><ArrowLeft className="size-5" /></Link>
        <Link href="/" aria-label="DevOps Easy Learning home" className="hidden sm:block"><LoopMark className="h-5 w-10" /></Link>
        <span className="hidden h-6 w-px bg-line sm:block" />
        <p className="min-w-0 flex-1 truncate font-display font-bold">{course?.title ?? "Loading course…"}</p>
        {reviews?.count ? (
          <button type="button" onClick={() => setTab("review")} className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-sm hover:bg-surface-2 xl:flex" aria-label={`Course rating ${reviews.average.toFixed(1)} from ${reviews.count} reviews. Open reviews`}>
            <Star className="size-4 text-amber" fill="currentColor" strokeWidth={0} /><span className="font-bold tabular-nums">{reviews.average.toFixed(1)}</span><span className="text-muted tabular-nums">({reviews.count})</span>
          </button>
        ) : null}
        <span className="hidden items-center gap-2 text-sm text-muted md:flex"><LoopMeter value={pct} size="sm" label={false} /><span className="tabular-nums">{done} of {flat.length} complete</span></span>
        <ThemeToggle />
        <button type="button" className="btn btn-ghost btn-sm hidden !px-2 lg:inline-flex" onClick={() => setSidebar((s) => !s)} aria-label={sidebar ? "Hide course content" : "Show course content"} aria-pressed={sidebar}>
          {sidebar ? <PanelRightClose className="size-5" /> : <PanelRightOpen className="size-5" />}
        </button>
      </header>

      <div className="flex flex-1">
        <div className="min-w-0 flex-1">
          {access?.state === "expiring" ? (
            <p className="flex flex-wrap items-center justify-center gap-x-2 border-b border-line bg-amber-soft px-4 py-2 text-center text-sm font-bold text-amber" data-testid="access-expiring">
              Your access to this course ends on {date(access.expiresAt)} ({access.daysLeft} day{access.daysLeft === 1 ? "" : "s"} left).
              <Link href={`/courses/${slug}`} className="underline underline-offset-2">Renew for 12 more months</Link>
            </p>
          ) : null}
          <div className="bg-stage">
            <div ref={stageRef} className="player-stage mx-auto max-w-[1200px] px-0 sm:px-4 sm:py-4">
              {!lecture ? (
                <div className="grid aspect-video place-items-center"><Loader2 className="size-8 animate-spin text-white/70" /></div>
              ) : lecture.type === "video" ? (
                playback ? (
                  <VideoPlayer
                    key={playback.url}
                    src={playback.url}
                    format={playback.format}
                    captionsUrl={playback.captionsUrl}
                    protectedStream={playback.protected}
                    autoPlay
                    title={lecture.title}
                    fullscreenRef={stageRef}
                    onPrev={prev ? () => go(prev) : undefined}
                    onNext={next ? () => go(next) : undefined}
                    prevTitle={prev?.title}
                    nextTitle={next?.title}
                    startAt={playback.positionSec ?? 0}
                    onTime={(t, d) => {
                      posRef.current = t;
                      track(t);
                      if (Date.now() - lastSaved.current > SAVE_EVERY_MS) void save(t, !!lecture.completed || (d > 0 && t / d > 0.95));
                    }}
                    onPause={(t) => void save(t, !!lecture.completed)}
                    onEnded={(t) => { void save(t, true); if (next) setCountdown(AUTOPLAY_SECONDS); }}
                    onError={() => {
                      // Signed URLs expire: fetch a fresh one once and resume where we were.
                      if (!retried.current) { retried.current = true; void loadPlayback(posRef.current); }
                      else setPlayErr("The video couldn’t be loaded. Check your connection and reload the page.");
                    }}
                    overlay={countdown !== null && next ? (
                      <div className="absolute inset-0 z-10 grid place-items-center bg-black/75 p-4 text-center text-white">
                        <div>
                          <p className="text-sm text-white/70">Up next in {countdown}s</p>
                          <p className="mt-1 max-w-md font-display text-xl font-bold">{next.title}</p>
                          <div className="mt-5 flex justify-center gap-3">
                            <button type="button" className="btn btn-cyan" onClick={() => go(next)}>Play now</button>
                            <button type="button" className="btn border border-white/30 text-white hover:bg-white/10" onClick={() => setCountdown(null)}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  />
                ) : (
                  <div className="grid aspect-video place-items-center text-white/80">
                    {playErr ? <div className="max-w-md px-6 text-center"><p>{playErr}</p><button type="button" className="btn btn-cyan mt-4" onClick={() => void loadPlayback(posRef.current)}>Try again</button></div> : <Loader2 className="size-8 animate-spin" />}
                  </div>
                )
              ) : (
                <div className="bg-surface px-5 py-10 text-ink sm:rounded-tile sm:px-10">
                  {lecture.type === "quiz" ? (
                    <>
                      <h1 className="mb-6 font-display text-2xl font-extrabold">{lecture.title}</h1>
                      <QuizPanel lectureId={lecture.id} onPassed={() => void save(0, true)} />
                    </>
                  ) : (
                    <article className="mx-auto max-w-3xl">
                      <h1 className="font-display text-3xl font-extrabold">{lecture.title}</h1>
                      <Markdown source={lecture.articleMd || "This reading has no text yet."} className="prose-del mt-4 text-[1.05rem]" />
                      {!lecture.completed ? <button type="button" className="btn btn-primary mt-8" onClick={() => void save(0, true)}><Check className="size-4" />Mark as complete</button> : <p className="mt-8 flex items-center gap-2 font-bold text-mint"><Check className="size-5" />Completed</p>}
                    </article>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5">
            <button type="button" className="btn btn-ghost btn-sm" disabled={!prev} onClick={() => go(prev)} data-testid="prev-lecture"><ChevronLeft className="size-4" />Previous</button>
            <p className="hidden min-w-0 truncate text-center text-sm text-muted sm:block">{sectionOf ? `${sectionOf.title}: ` : ""}<span className="font-bold text-ink">{lecture?.title}</span></p>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!next} onClick={() => go(next)} data-testid="next-lecture">Next<ChevronRight className="size-4" /></button>
          </div>

          <div className="px-4 sm:px-8">
            <div role="tablist" aria-label="Lecture" className="flex gap-1 overflow-x-auto border-b border-line">
              {tabs.map(([k, l]) => (
                <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-bold sm:px-4 ${k === "content" ? "lg:hidden" : ""} ${tab === k ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div role="tabpanel" className="py-8">
              {tab === "overview" && course ? (
                <div className="max-w-3xl">
                  <h1 className="font-display text-2xl font-extrabold">{lecture?.title}</h1>
                  {lecture?.description ? <Markdown source={lecture.description} className="prose-del mt-3" /> : null}
                  {lecture?.hasResources ? (
                    <section className="mt-6" aria-labelledby="lesson-files-h">
                      <h2 id="lesson-files-h" className="font-display text-lg font-bold">Files for this lesson</h2>
                      <p className="mt-1 text-sm text-ink-2">Watch the lesson, download these files, follow along on your own machine, then continue to the next lesson.</p>
                      <div className="mt-3"><ResourcesPanel lectureId={lecture.id} compact /></div>
                    </section>
                  ) : null}
                  <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-sm">
                    <div><dt className="text-muted">Course</dt><dd className="font-bold">{course.title}</dd></div>
                    <div><dt className="text-muted">Instructor</dt><dd className="font-bold">{course.instructor.name}</dd></div>
                    <div><dt className="text-muted">Your progress</dt><dd className="mt-0.5"><LoopMeter value={pct} size="sm" /></dd></div>
                    {reviews ? (
                      <div><dt className="text-muted">Course rating</dt><dd className="mt-0.5 flex flex-wrap items-center gap-2">
                        <RatingInline avg={reviews.average} count={reviews.count} />
                        {reviews.canReview ? <button type="button" className="link text-sm" onClick={() => setTab("review")} data-testid="open-review">{reviews.mine ? `Your rating: ${reviews.mine.rating}★` : "Rate this course"}</button> : null}
                      </dd></div>
                    ) : null}
                  </dl>
                  {next ? (
                    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                      <p className="min-w-0 text-sm text-ink-2">Up next: <span className="font-bold text-ink">{next.title}</span></p>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => go(next)}>Play next lesson<ChevronRight className="size-4" /></button>
                    </div>
                  ) : null}
                  {lecture?.hasResources ? <p className="mt-4 text-sm text-ink-2">This lesson has lab files: open <button type="button" className="link" onClick={() => setTab("resources")}>Lab files</button> to download them.</p> : null}
                  <p className="mt-6 hidden text-sm text-muted sm:block">Keyboard: Space or K to play and pause, J and L to skip 10 seconds, F for full screen, C for captions.</p>
                  {pct >= 100 ? <Link href="/student/progress" className="btn btn-primary mt-6">Get your certificate</Link> : null}
                </div>
              ) : null}
              {tab === "content" ? <div className="-mx-4 border-t border-line lg:hidden">{outline}</div> : null}
              {tab === "resources" ? <ResourcesPanel lectureId={lectureId} /> : null}
              {tab === "package" ? (
                <div>
                  <p className="mb-3 max-w-2xl text-ink-2">Everything from the course in one place: demo code, configuration files and documents. Each lesson also has its own files.</p>
                  <ResourcesPanel items={pkg} kind="package" />
                </div>
              ) : null}
              {tab === "quiz" ? <QuizPanel lectureId={lectureId} onPassed={() => { void save(posRef.current, true); toast("ok", "Quiz passed."); }} /> : null}
              {tab === "notes" ? <NotesPanel lectureId={lectureId} /> : null}
              {tab === "review" && reviews ? <ReviewPanel slug={slug} info={reviews} onSaved={setReviews} /> : null}
            </div>
          </div>
        </div>

        {sidebar ? (
          <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[360px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block" aria-label="Course content sidebar">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <h2 className="font-display font-bold">Course content</h2>
              <LoopMeter value={pct} size="sm" />
            </div>
            {outline ?? <div className="p-4"><Loader2 className="size-5 animate-spin text-violet" /></div>}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
