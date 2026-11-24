"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj } from "@/lib/normalize";
import type { QuizQuestion } from "@/lib/types";

type Result = { score: number; total: number; passed: boolean; perQuestion: { correct: boolean; correctIndex?: number; why?: string }[] };

export function QuizPanel({ lectureId, onPassed }: { lectureId: string; onPassed?: () => void }) {
  const [qs, setQs] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/lectures/${lectureId}/quiz`).then((r) => {
      const o = obj(r);
      const q = list(obj(o.quiz ?? o).questions).map((x) => {
        const qo = obj(x);
        return { q: String(qo.q ?? qo.question ?? ""), options: list(qo.options).map(String), why: qo.why as string | undefined };
      });
      setQs(q);
      setAnswers(q.map(() => null));
    }).catch((e) => setErr(errMsg(e)));
  }, [lectureId]);

  if (err) return <p className="text-ink-2">{err}</p>;
  if (!qs) return <Loader2 className="size-6 animate-spin text-violet" />;
  if (!qs.length) return <p className="text-ink-2">This lecture has no quiz.</p>;

  async function submit() {
    setBusy(true);
    try {
      const r = obj(await api(`/lectures/${lectureId}/quiz`, { method: "POST", body: { answers } }));
      const a = obj(r.attempt ?? r);
      const results = list(a.results ?? r.results);
      // API: { score 0–100, passed, results: [{ index, chosen, correct (index), isCorrect, why }] }
      const per = qs!.map((_, i) => {
        const x = obj(results.find((y) => obj(y).index === i) ?? results[i]);
        return { correct: Boolean(x.isCorrect), correctIndex: typeof x.correct === "number" ? x.correct : undefined, why: (x.why as string) ?? qs![i]!.why };
      });
      const right = per.filter((p) => p.correct).length;
      const passed = a.passed != null ? Boolean(a.passed) : right / qs!.length >= 0.7;
      setResult({ score: right, total: qs!.length, passed, perQuestion: per });
      if (passed) onPassed?.();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl" data-testid="quiz">
      {result ? (
        <div className={`mb-6 rounded-tile p-4 ${result.passed ? "bg-mint-soft" : "bg-amber-soft"}`}>
          <p className="font-display text-xl font-extrabold">You scored {result.score} of {result.total}</p>
          <p className="text-sm text-ink-2">{result.passed ? "Nice work. Review the explanations below, then move on." : "Read the explanations, rewatch the lecture, and try again."}</p>
        </div>
      ) : null}
      <ol className="space-y-8">
        {qs.map((q, qi) => {
          const res = result?.perQuestion[qi];
          return (
            <li key={qi}>
              <fieldset>
                <legend className="font-display text-lg font-bold"><span className="mr-2 text-violet tabular-nums">{qi + 1}.</span>{q.q}</legend>
                <div className="mt-3 grid gap-2">
                  {q.options.map((opt, oi) => {
                    const chosen = answers[qi] === oi;
                    const isRight = res && res.correctIndex === oi;
                    return (
                      <label key={oi} className={`flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] px-4 py-3 ${chosen ? "border-violet bg-violet-soft" : "border-line hover:border-line-strong"} ${isRight ? "!border-mint" : ""}`}>
                        <input type="radio" name={`q${qi}`} className="mt-1 accent-[var(--violet)]" checked={chosen} disabled={!!result}
                          onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))} />
                        <span className="flex-1">{opt}</span>
                        {res && chosen ? (res.correct ? <CheckCircle2 className="size-5 text-mint" /> : <XCircle className="size-5 text-rose" />) : null}
                      </label>
                    );
                  })}
                </div>
                {res?.why ? <p className="mt-2 text-sm text-ink-2"><span className="font-bold">Why: </span>{res.why}</p> : null}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-8 flex gap-3">
        {result ? (
          <button type="button" className="btn btn-outline" onClick={() => { setResult(null); setAnswers(qs.map(() => null)); }}>Try again</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy || answers.some((a) => a === null)} onClick={submit} data-testid="quiz-submit">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}Submit answers
          </button>
        )}
      </div>
    </div>
  );
}
