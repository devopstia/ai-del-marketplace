"use client";
import { useEffect, useState } from "react";
import { BarChart3, ShieldCheck } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { list, obj, toStudioCourse } from "@/lib/normalize";

const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
import { clock } from "@/lib/format";
import { PageHead, Kpis, DataTable } from "@/components/shell/AppShell";
import { Empty, Skeleton } from "@/components/Empty";

const mapCourses = (r: unknown) => list(r, "courses").map(toStudioCourse);

interface LessonRow {
  id: string; title: string; section: string; type: string; durationSec: number; viewers: number; enoughData: boolean;
  averageWatchedPct: number | null; retention: number[] | null; biggestDrop: { at: number; drop: number } | null; aiQuestions: number;
  quiz: { learners: number; enoughData: boolean; hardest: { index: number; q: string; wrongPct: number }[] } | null;
}
interface Insights {
  minSample: number;
  totals: { learners: number; viewers: number; averageWatchedPct: number | null; aiQuestions: number };
  attention: { id: string; title: string; at: number; drop: number }[];
  lectures: LessonRow[];
}
const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
const nn = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
function toInsights(r: unknown): Insights {
  const o = obj(r);
  const t = obj(o.totals);
  return {
    minSample: n(o.minSample) || 5,
    totals: { learners: n(t.learners), viewers: n(t.viewers), averageWatchedPct: nn(t.averageWatchedPct), aiQuestions: n(t.aiQuestions) },
    attention: arr(o.attention).map((x) => { const a = obj(x); return { id: String(a.id), title: String(a.title ?? ""), at: n(a.at), drop: n(a.drop) }; }),
    lectures: arr(o.lectures).map((x) => {
      const l = obj(x);
      const q = l.quiz ? obj(l.quiz) : null;
      const d = l.biggestDrop ? obj(l.biggestDrop) : null;
      return {
        id: String(l.id), title: String(l.title ?? ""), section: String(l.section ?? ""), type: String(l.type ?? "video"), durationSec: n(l.durationSec),
        viewers: n(l.viewers), enoughData: l.enoughData === true, averageWatchedPct: nn(l.averageWatchedPct),
        retention: Array.isArray(l.retention) ? (l.retention as unknown[]).map(n) : null,
        biggestDrop: d ? { at: n(d.at), drop: n(d.drop) } : null, aiQuestions: n(l.aiQuestions),
        quiz: q ? { learners: n(q.learners), enoughData: q.enoughData === true, hardest: arr(q.hardest).map((h) => { const y = obj(h); return { index: n(y.index), q: String(y.q ?? ""), wrongPct: n(y.wrongPct) }; }) } : null,
      };
    }),
  };
}

/** Where the drop happens: the boundary between two tenths of the video ("40 %"). */
const tenth = (at: number) => `${at * 10} %`;

/** Ten bars: the share of viewers who watched each tenth of the video. */
function Retention({ curve, title }: { curve: number[]; title: string }) {
  return (
    <span role="img" aria-label={`Viewers still watching “${title}”, by tenth of the video: ${curve.map((v) => `${v} %`).join(", ")}`} className="flex h-8 w-32 items-end gap-[2px]">
      {curve.map((v, i) => <span key={i} className="flex-1 rounded-t-[2px] bg-violet" style={{ height: `${Math.max(4, v)}%`, opacity: 0.45 + v / 180 }} />)}
    </span>
  );
}

/** Instructor Studio › Insights (owner 2026-11-26): what learners actually watch, get wrong and ask, per lesson. */
export default function InsightsPage() {
  const courses = useApi("/instructor/courses", mapCourses);
  const [courseId, setCourseId] = useState("");
  // ?course=<id> opens that course; otherwise the first one
  useEffect(() => {
    const first = courses.data?.[0]?.id;
    if (courseId || !first) return;
    const fromUrl = new URLSearchParams(window.location.search).get("course");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCourseId(courses.data?.some((c) => c.id === fromUrl) ? fromUrl! : first);
  }, [courses.data, courseId]);
  const { data, error } = useApi(courseId ? `/instructor/courses/${courseId}/insights` : null, toInsights);
  const quizzes = (data?.lectures ?? []).filter((l) => l.quiz);
  const videos = (data?.lectures ?? []).filter((l) => l.type === "video");

  return (
    <>
      <PageHead title="Insights" sub="Where learners stop watching, which quiz questions they get wrong, and how often they ask the AI assistant. Use it to improve weak lessons."
        actions={courses.data?.length ? (
          <select aria-label="Course" className="field !w-auto max-w-full" value={courseId} onChange={(e) => { setCourseId(e.target.value); try { history.replaceState(null, "", `?course=${e.target.value}`); } catch { /* ignore */ } }}>
            {courses.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        ) : null} />
      {courses.error || error ? <p className="text-rose">{courses.error ?? error}</p> : null}
      {courses.data && !courses.data.length ? (
        <Empty icon={BarChart3} title="No courses yet" body="Insights appear here once learners start watching your courses." href="/studio/courses" cta="Go to courses" />
      ) : !data ? (!error ? <Skeleton className="h-80" /> : null) : (
        <div data-testid="insights">
          <Kpis items={[
            { label: "Learners", value: String(data.totals.learners), note: "Active enrolments" },
            { label: "Watched a lesson", value: String(data.totals.viewers) },
            { label: "Average watched", value: data.totals.averageWatchedPct != null ? `${data.totals.averageWatchedPct} %` : "Not yet", note: data.totals.averageWatchedPct != null ? "Unique share of each lesson, averaged" : `Needs ${data.minSample} viewers on a lesson` },
            { label: "Questions to the AI", value: String(data.totals.aiQuestions), note: "About this course" },
          ]} />
          <p className="mt-4 flex items-start gap-2 text-sm text-ink-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" />
            Figures for a lesson or quiz appear once at least {data.minSample} learners have watched or taken it, so no single learner can be singled out. No names are shown and your own viewing isn’t counted. Learners’ questions to the AI aren’t stored, only how many were asked.</p>

          {data.attention.length ? (
            <section className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="attention">
              <h2 id="attention" className="font-display text-lg font-bold">Look at these first</h2>
              <ul className="mt-3 divide-y divide-line">
                {data.attention.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                    <span className="min-w-0 font-bold">{a.title}</span>
                    <span className="text-sm text-ink-2"><b className="tabular-nums text-ink">{a.drop} %</b> of viewers stop around {tenth(a.at)} of the video</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <h2 className="mb-3 mt-10 font-display text-lg font-bold">Lessons</h2>
          <DataTable head={["Lesson", "Viewers", "Average watched", "Still watching (start → end)", "Biggest drop", "AI questions"]} min={860}
            empty={!videos.length ? <p className="px-4 py-10 text-center text-ink-2">This course has no video lessons yet.</p> : null}>
            {videos.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3"><span className="block font-bold">{l.title}</span><span className="text-xs text-muted">{l.section}{l.durationSec ? ` · ${clock(l.durationSec)}` : ""}</span></td>
                <td className="px-4 py-3 tabular-nums">{l.viewers}</td>
                <td className="px-4 py-3 tabular-nums">{l.averageWatchedPct != null ? `${l.averageWatchedPct} %` : <span className="text-muted">Needs {data.minSample}</span>}</td>
                <td className="px-4 py-3">{l.retention ? <Retention curve={l.retention} title={l.title} /> : <span className="text-muted">Not enough viewers yet</span>}</td>
                <td className="px-4 py-3">{l.biggestDrop ? <span><b className="tabular-nums">{l.biggestDrop.drop} %</b> <span className="text-ink-2">stop near {tenth(l.biggestDrop.at)}</span></span> : <span className="text-muted">—</span>}</td>
                <td className="px-4 py-3 tabular-nums">{l.aiQuestions}</td>
              </tr>
            ))}
          </DataTable>

          {quizzes.length ? (
            <section className="mt-10" aria-labelledby="quizzes">
              <h2 id="quizzes" className="mb-3 font-display text-lg font-bold">Quiz questions learners get wrong</h2>
              <div className={`grid gap-4 ${quizzes.length > 1 ? "lg:grid-cols-2" : ""}`}>
                {quizzes.map((l) => (
                  <div key={l.id} className="rounded-panel border border-line bg-surface p-5">
                    <h3 className="font-bold">{l.title}</h3>
                    <p className="text-xs text-muted">{l.quiz!.learners} learner{l.quiz!.learners === 1 ? "" : "s"} took it (latest attempt each)</p>
                    {l.quiz!.enoughData ? (
                      <ul className="mt-3 space-y-3">
                        {l.quiz!.hardest.map((h) => (
                          <li key={h.index}>
                            <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0">Q{h.index + 1}. {h.q}</span><span className="shrink-0 font-bold tabular-nums">{h.wrongPct} % wrong</span></div>
                            <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-rose" style={{ width: `${h.wrongPct}%` }} /></div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-3 text-sm text-ink-2">Shown once {data.minSample} learners have taken this quiz.</p>}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
