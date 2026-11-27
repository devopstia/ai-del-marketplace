"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, CheckCircle2, Loader2, PlayCircle, RotateCcw, XCircle } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj } from "@/lib/normalize";

/**
 * Lesson quizzes and assessments (owner 2026-11-28): questions and options shuffled per attempt (unless an option list
 * must keep its order), a progress bar, explanations for the chosen and the correct option, takeaways, a per-topic
 * summary, "Watch this part" back in the lesson video, a practice round on missed questions (not recorded), and
 * bookmarks for questions to review. Grading is by question id, so the shuffle never affects the score.
 */
type Q = { id: string; q: string; options: string[]; code?: string; topic?: string; difficulty?: string; fixedOrder?: boolean };
type Loaded = { kind: string; scenario: string | null; scenarioCode: string | null; draw: string; questions: Q[]; bestScore: number | null; attempts: number; bookmarks: string[] };
type Res = { id: string; chosen: number; correct: number; isCorrect: boolean; why?: string; explanations?: string[]; takeaway?: string; topic?: string; timestamp?: number; videoLectureId?: string; related?: { videoLectureId: string; timestamp: number }[] };
type Outcome = { score: number; passed: boolean; practice: boolean; bestScore: number | null; results: Map<string, Res>; topics: { topic: string; correct: number; total: number }[] };

const shuffle = <T,>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j]!, x[i]!];
  }
  return x;
};
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const KIND_LABEL: Record<string, string> = { module: "Module assessment", final: "Final assessment", scenario: "Scenario assessment" };

function load(raw: unknown): Loaded {
  const o = obj(raw);
  const questions = list(obj(o.quiz ?? o).questions).map((x, i) => {
    const qo = obj(x);
    return {
      id: String(qo.id ?? i),
      q: String(qo.q ?? qo.question ?? ""),
      options: list(qo.options).map(String),
      code: typeof qo.code === "string" ? qo.code : undefined,
      topic: typeof qo.topic === "string" ? qo.topic : undefined,
      difficulty: typeof qo.difficulty === "string" ? qo.difficulty : undefined,
      fixedOrder: qo.fixedOrder === true,
    };
  });
  return {
    kind: typeof o.kind === "string" ? o.kind : "lesson",
    scenario: typeof o.scenario === "string" && o.scenario ? o.scenario : null,
    scenarioCode: typeof o.scenarioCode === "string" && o.scenarioCode ? o.scenarioCode : null,
    draw: typeof o.draw === "string" ? o.draw : "",
    questions,
    bestScore: typeof o.bestScore === "number" ? o.bestScore : null,
    attempts: typeof o.attempts === "number" ? o.attempts : 0,
    bookmarks: list(o.bookmarks).map(String),
  };
}

export function QuizPanel({ lectureId, onPassed, onWatch }: { lectureId: string; onPassed?: () => void; onWatch?: (lectureId: string, sec: number) => void }) {
  const [data, setData] = useState<Loaded | null>(null);
  /** Display order: question ids, and per question the original option indexes in the order shown. */
  const [order, setOrder] = useState<{ ids: string[]; opts: Record<string, number[]> }>({ ids: [], opts: {} });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** A practice round on missed questions: only these ids. */
  const [practice, setPractice] = useState<string[] | null>(null);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [marks, setMarks] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const arrange = useCallback((qs: Q[], ids?: string[]) => {
    const pick = ids ? qs.filter((q) => ids.includes(q.id)) : qs;
    setOrder({
      ids: shuffle(pick.map((q) => q.id)),
      opts: Object.fromEntries(pick.map((q) => [q.id, q.fixedOrder ? q.options.map((_, i) => i) : shuffle(q.options.map((_, i) => i))])),
    });
    setAnswers({});
    setOutcome(null);
  }, []);

  const fetchQuiz = useCallback(() => {
    setErr(null);
    api(`/lectures/${lectureId}/quiz`).then((r) => {
      const d = load(r);
      setData(d);
      setMarks(new Set(d.bookmarks));
      setPractice(null);
      setOnlyMarked(false);
      arrange(d.questions);
    }).catch((e) => setErr(errMsg(e)));
  }, [lectureId, arrange]);
  // Load the quiz (a fresh draw and shuffle) whenever another lesson is opened.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchQuiz(); }, [fetchQuiz]);

  const byId = useMemo(() => new Map((data?.questions ?? []).map((q) => [q.id, q])), [data]);
  if (err) return <p className="text-ink-2">{err}</p>;
  if (!data) return <Loader2 className="size-6 animate-spin text-violet" aria-label="Loading quiz" />;
  if (!data.questions.length) return <p className="text-ink-2">This lecture has no quiz.</p>;

  const asked = order.ids;
  const shown = onlyMarked ? asked.filter((id) => marks.has(id)) : asked;
  const answered = asked.filter((id) => answers[id] !== undefined).length;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const responses = asked.map((id) => ({ id, choice: answers[id]! }));
      const body = practice ? { responses, mode: "retry" } : { responses, draw: data!.draw, mode: "full" };
      const r = obj(await api(`/lectures/${lectureId}/quiz`, { method: "POST", body }));
      const results = new Map(list(r.results).map((x) => {
        const o = obj(x);
        const res: Res = {
          id: String(o.id), chosen: Number(o.chosen), correct: Number(o.correct), isCorrect: Boolean(o.isCorrect),
          why: typeof o.why === "string" ? o.why : undefined,
          explanations: Array.isArray(o.explanations) ? o.explanations.map(String) : undefined,
          takeaway: typeof o.takeaway === "string" ? o.takeaway : undefined,
          topic: typeof o.topic === "string" ? o.topic : undefined,
          timestamp: typeof o.timestamp === "number" ? o.timestamp : undefined,
          videoLectureId: typeof o.videoLectureId === "string" ? o.videoLectureId : undefined,
          related: Array.isArray(o.related) ? o.related.map((x) => obj(x)).filter((x) => typeof x.videoLectureId === "string" && typeof x.timestamp === "number").map((x) => ({ videoLectureId: String(x.videoLectureId), timestamp: Number(x.timestamp) })) : undefined,
        };
        return [res.id, res];
      }));
      const out: Outcome = {
        score: Number(r.score ?? 0), passed: Boolean(r.passed), practice: Boolean(r.practice),
        bestScore: typeof r.bestScore === "number" ? r.bestScore : data!.bestScore, results,
        topics: list(r.topics).map((t) => ({ topic: String(obj(t).topic), correct: Number(obj(t).correct), total: Number(obj(t).total) })),
      };
      setOutcome(out);
      if (!out.practice) setData((d) => (d ? { ...d, bestScore: out.bestScore, attempts: d.attempts + 1 } : d));
      if (out.passed) onPassed?.();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleMark(id: string) {
    const on = !marks.has(id);
    setMarks((m) => { const n = new Set(m); if (on) n.add(id); else n.delete(id); return n; });
    try {
      await api(`/lectures/${lectureId}/quiz/bookmarks/${encodeURIComponent(id)}`, { method: on ? "PUT" : "DELETE" });
    } catch (e) {
      setMarks((m) => { const n = new Set(m); if (on) n.delete(id); else n.add(id); return n; });
      setErr(errMsg(e));
    }
  }

  const missed = outcome ? [...outcome.results.values()].filter((r) => !r.isCorrect).map((r) => r.id) : [];
  const right = outcome ? [...outcome.results.values()].filter((r) => r.isCorrect).length : 0;
  const label = practice ? "Practice: missed questions" : KIND_LABEL[data.kind];

  return (
    <div className="max-w-3xl" data-testid="quiz">
      {label ? <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-violet" data-testid="quiz-kind">{label}</p> : null}
      {data.scenario && !practice ? (
        <div className="mb-6 rounded-tile border border-line bg-surface-2 p-4 text-ink-2" data-testid="quiz-scenario">
          <p className="mb-1 text-sm font-bold text-ink">Scenario</p>
          <p className="whitespace-pre-line">{data.scenario}</p>
          {data.scenarioCode ? <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface p-3 text-sm text-ink"><code>{data.scenarioCode}</code></pre> : null}
        </div>
      ) : null}

      {outcome ? (
        <div className={`mb-6 rounded-tile p-4 ${outcome.passed || (outcome.practice && missed.length === 0) ? "bg-mint-soft" : "bg-amber-soft"}`} data-testid="quiz-result" aria-live="polite">
          <p className="font-display text-xl font-extrabold">{outcome.score}% · {right} of {outcome.results.size} correct</p>
          <p className="text-sm text-ink-2">
            {outcome.practice
              ? "Practice round: not recorded. Your best score stays as it is."
              : outcome.passed ? "Nice work. Review the explanations below, then move on." : "Read the explanations, rewatch the parts you missed, and try again."}
            {!outcome.practice && outcome.bestScore != null ? ` Best score: ${outcome.bestScore}%.` : ""}
          </p>
          {outcome.topics.length > 1 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Score by topic" data-testid="quiz-topics">
              {outcome.topics.map((t) => (
                <li key={t.topic} className={`rounded-full border px-3 py-1 text-sm ${t.correct === t.total ? "border-mint" : "border-amber"} bg-surface`}>
                  <span className="font-bold">{t.topic}</span> <span className="tabular-nums text-ink-2">{t.correct}/{t.total}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="mb-6" data-testid="quiz-progress">
          <div className="flex items-center justify-between text-sm text-ink-2">
            <span className="tabular-nums">{answered} of {asked.length} answered</span>
            {data.bestScore != null && !practice ? <span className="tabular-nums">Best score {data.bestScore}% · {data.attempts} attempt{data.attempts === 1 ? "" : "s"}</span> : null}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={asked.length} aria-valuenow={answered}>
            <div className="h-full rounded-full bg-violet transition-[width] motion-reduce:transition-none" style={{ width: `${asked.length ? (answered / asked.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {marks.size ? (
        <label className="mb-4 inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" className="accent-[var(--violet)]" checked={onlyMarked} onChange={(e) => setOnlyMarked(e.target.checked)} data-testid="quiz-only-marked" />
          Show bookmarked questions only ({asked.filter((id) => marks.has(id)).length})
        </label>
      ) : null}

      <ol className="space-y-8">
        {shown.map((id) => {
          const q = byId.get(id)!;
          const n = asked.indexOf(id) + 1;
          const res = outcome?.results.get(id);
          const opts = order.opts[id] ?? q.options.map((_, i) => i);
          const marked = marks.has(id);
          return (
            <li key={id} data-testid="quiz-question">
              <fieldset>
                <div className="flex items-start gap-3">
                  <legend className="flex-1 font-display text-lg font-bold"><span className="mr-2 text-violet tabular-nums">{n}.</span>{q.q}</legend>
                  <button type="button" className="btn btn-ghost btn-sm -mr-2 shrink-0" aria-pressed={marked} aria-label={marked ? "Remove bookmark" : "Bookmark this question"} title={marked ? "Bookmarked" : "Bookmark to review"} onClick={() => void toggleMark(id)} data-testid="quiz-bookmark">
                    {marked ? <BookmarkCheck className="size-4 text-violet" /> : <Bookmark className="size-4" />}
                  </button>
                </div>
                {q.topic || q.difficulty ? (
                  <p className="mt-1 text-xs text-muted">{[q.topic, q.difficulty ? q.difficulty[0]!.toUpperCase() + q.difficulty.slice(1) : null].filter(Boolean).join(" · ")}</p>
                ) : null}
                {q.code ? <pre className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 text-sm"><code>{q.code}</code></pre> : null}
                <div className="mt-3 grid gap-2">
                  {opts.map((oi) => {
                    const chosen = answers[id] === oi;
                    const isRight = res && res.correct === oi;
                    const isWrongPick = res && chosen && !res.isCorrect;
                    return (
                      <label key={oi} className={`flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] px-4 py-3 ${chosen ? "border-violet bg-violet-soft" : "border-line hover:border-line-strong"} ${isRight ? "!border-mint" : ""} ${isWrongPick ? "!border-rose" : ""}`}>
                        <input type="radio" name={`q-${id}`} className="mt-1 accent-[var(--violet)]" checked={chosen} disabled={!!outcome}
                          onChange={() => setAnswers((a) => ({ ...a, [id]: oi }))} />
                        <span className="flex-1">{q.options[oi]}</span>
                        {res && isRight ? <CheckCircle2 className="size-5 shrink-0 text-mint" aria-label="Correct answer" /> : null}
                        {isWrongPick ? <XCircle className="size-5 shrink-0 text-rose" aria-label="Your answer" /> : null}
                      </label>
                    );
                  })}
                </div>
                {res ? (
                  <div className="mt-3 space-y-2 text-sm text-ink-2" data-testid="quiz-explanation">
                    {!res.isCorrect && res.explanations?.[res.chosen] ? <p><span className="font-bold text-ink">Your answer: </span>{res.explanations[res.chosen]}</p> : null}
                    {res.explanations?.[res.correct] ? <p><span className="font-bold text-ink">Correct answer: </span>{res.explanations[res.correct]}</p> : null}
                    {res.why ? <p><span className="font-bold text-ink">Why: </span>{res.why}</p> : null}
                    {res.takeaway ? <p className="rounded-lg border-l-[3px] border-violet bg-violet-soft px-3 py-2 text-ink"><span className="font-bold">Takeaway: </span>{res.takeaway}</p> : null}
                    {res.timestamp !== undefined && res.videoLectureId && onWatch ? (
                      <button type="button" className="btn btn-ghost btn-sm -ml-2 text-violet" onClick={() => onWatch(res.videoLectureId!, res.timestamp!)} data-testid="quiz-watch">
                        <PlayCircle className="size-4" />Watch this part ({clock(res.timestamp)})
                      </button>
                    ) : null}
                    {res.related?.length && onWatch ? (
                      <p className="flex flex-wrap items-center gap-x-1">
                        <span>Also covered:</span>
                        {res.related.map((r, ri) => (
                          <button key={ri} type="button" className="btn btn-ghost btn-sm text-violet" onClick={() => onWatch(r.videoLectureId, r.timestamp)}>
                            <PlayCircle className="size-4" />{clock(r.timestamp)}{res.related!.length > 1 ? ` (${ri + 1})` : ""}
                          </button>
                        ))}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {err ? <p className="mt-4 text-sm text-rose" role="alert">{err}</p> : null}
      <div className="mt-8 flex flex-wrap gap-3">
        {outcome ? (
          <>
            {missed.length ? (
              <button type="button" className="btn btn-primary" onClick={() => { setPractice(missed); setOnlyMarked(false); arrange(data.questions, missed); }} data-testid="quiz-retry-missed">
                <RotateCcw className="size-4" />Retry {missed.length} missed question{missed.length === 1 ? "" : "s"}
              </button>
            ) : null}
            <button type="button" className={missed.length ? "btn btn-outline" : "btn btn-primary"} onClick={fetchQuiz} data-testid="quiz-again">Take the full quiz again</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary" disabled={busy || answered < asked.length} onClick={submit} data-testid="quiz-submit">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}{practice ? "Check answers" : "Submit answers"}
            </button>
            {practice ? <button type="button" className="btn btn-outline" onClick={fetchQuiz}>Back to the full quiz</button> : null}
          </>
        )}
      </div>
    </div>
  );
}
