"use client";
import { Fragment, useRef, useState } from "react";
import { Loader2, PlayCircle, Send } from "lucide-react";
import Link from "next/link";
import { ApiError, api, errMsg } from "@/lib/api";
import { clock } from "@/lib/format";

interface Citation {
  ref: string;
  lectureId: string;
  lectureTitle: string;
  startSec: number;
}
interface Turn {
  q: string;
  answer?: string;
  covered?: boolean;
  citations?: Citation[];
  error?: string;
}

/** `code` spans inside an answer, as text (never HTML). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`\n]+`)/).map((p, i) =>
        p.startsWith("`") && p.endsWith("`") && p.length > 2 ? <code key={i} className="rounded bg-surface-2 px-1 py-0.5 text-[.9em]">{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

/**
 * "Ask about this course" (docs/AI_LEARNING.md): answers come only from this course's lessons, with citations that play
 * the lesson from the cited moment. The conversation lives only in this tab (React state); the server keeps no
 * question or answer, only a usage count.
 */
export function AskPanel({ slug, lectureId, onJump }: { slug: string; lectureId: string; onJump: (lectureId: string, sec: number) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (question.length < 3 || busy) return;
    const history = turns.filter((t) => t.answer).slice(-2).flatMap((t) => [{ role: "user" as const, text: t.q }, { role: "assistant" as const, text: t.answer! }]);
    setTurns((t) => [...t, { q: question }]);
    setQ("");
    setBusy(true);
    try {
      const r = await api<{ answer: string; covered: boolean; citations: Citation[]; remainingToday?: number }>(`/me/courses/${slug}/ask`, { method: "POST", body: { question, lectureId, ...(history.length ? { history } : {}) } });
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer: r.answer, covered: r.covered, citations: Array.isArray(r.citations) ? r.citations : [] } : x)));
      if (typeof r.remainingToday === "number") setLeft(r.remainingToday);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 429 ? err.message : errMsg(err);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: msg } : x)));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-ink-2">Ask about anything taught in this course. Answers are written by AI <strong className="text-ink">only from this course’s lessons</strong>, with links to the moment in the video. Check important commands in the lesson itself.</p>

      {turns.length ? (
        <ol className="mt-5 space-y-5" data-testid="ask-thread">
          {turns.map((t, i) => {
            const byRef = new Map((t.citations ?? []).map((c, n) => [c.ref, { ...c, n: n + 1 }]));
            return (
              <li key={i}>
                <p className="ml-auto w-fit max-w-[85%] rounded-tile bg-violet-soft px-4 py-2.5 text-sm text-ink">{t.q}</p>
                <div className="mt-2 rounded-tile border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-ink-2" data-testid="ask-answer">
                  {t.error ? <p className="text-rose">{t.error}</p> : t.answer == null ? (
                    <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" aria-hidden />Looking through the lessons…</p>
                  ) : (
                    <>
                      <p className="whitespace-pre-line">
                        {t.answer.split(/(\[[SL]\d+\])/).map((part, j) => {
                          const c = byRef.get(part.slice(1, -1));
                          if (!c) return <Inline key={j} text={part} />;
                          return (
                            <button key={j} type="button" onClick={() => onJump(c.lectureId, c.startSec)} className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-md bg-violet-soft px-1.5 text-xs font-bold tabular-nums text-violet hover:underline"
                              aria-label={`Source ${c.n}: play “${c.lectureTitle}” from ${clock(c.startSec)}`} title={`${c.lectureTitle} · ${clock(c.startSec)}`}>{c.n}</button>
                          );
                        })}
                      </p>
                      {t.citations?.length ? (
                        <ul className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3" aria-label="Sources">
                          {t.citations.map((c, n) => (
                            <li key={c.ref}>
                              <button type="button" onClick={() => onJump(c.lectureId, c.startSec)} className="chip max-w-full hover:bg-violet-soft" data-testid="ask-citation">
                                <span className="tabular-nums text-violet">{n + 1}</span>
                                <PlayCircle className="size-3.5 shrink-0" aria-hidden />
                                <span className="truncate">{c.lectureTitle}</span>
                                {c.ref.startsWith("S") ? <span className="tabular-nums text-muted">{clock(c.startSec)}</span> : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {t.covered === false ? <p className="mt-2 text-xs text-muted">Questions about payments, access or your account: <Link href="/help" className="link">Help</Link>.</p> : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div ref={endRef} />

      <form onSubmit={ask} className="mt-5">
        <label htmlFor="ask-q" className="sr-only">Your question about this course</label>
        <div className="flex items-end gap-2">
          <textarea id="ask-q" rows={2} className="field !min-h-0 flex-1 resize-none text-base sm:text-sm" value={q} maxLength={500} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(e); } }}
            placeholder="e.g. Why do we pin the image tag before a rollback?" data-testid="ask-input" />
          <button type="submit" className="btn btn-primary" disabled={busy || q.trim().length < 3} data-testid="ask-submit"><Send className="size-4" aria-hidden />Ask</button>
        </div>
        <div className="hint flex flex-wrap justify-between gap-x-4">
          <span>The conversation stays in this tab and is gone when you leave.</span>
          {turns.length ? <button type="button" className="link font-normal" onClick={() => setTurns([])} disabled={busy}>Clear conversation</button> : null}
          {left != null ? <span className="tabular-nums">{left} question{left === 1 ? "" : "s"} left today</span> : null}
        </div>
      </form>
    </div>
  );
}
