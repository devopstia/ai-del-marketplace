"use client";
import { useEffect, useState } from "react";
import { Loader2, PlayCircle, Sparkles } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { clock } from "@/lib/format";

interface Notes {
  status: "ready" | "generating" | "unavailable" | "failed";
  summary?: string;
  keyPoints?: string[];
  questions?: { question: string; answer: string; atSec: number }[];
}

const POLL_MS = 5000;
const MAX_POLLS = 36; // 3 minutes

/**
 * AI study notes of one lesson (docs/AI_LEARNING.md): generated once from the lesson transcript and shared by every
 * learner; prepared on first open (the panel waits for them).
 */
export function StudyNotesPanel({ lectureId, onJump }: { lectureId: string; onJump: (sec: number) => void }) {
  const [notes, setNotes] = useState<Notes | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(null);
    setErr(null);
    const load = () => {
      api<Notes>(`/lectures/${lectureId}/study-notes`).then((n) => {
        if (stop) return;
        setNotes(n);
        if (n?.status === "generating" && ++polls < MAX_POLLS) timer = setTimeout(load, POLL_MS);
        else if (n?.status === "generating") setErr("The study notes are taking longer than usual. Open this tab again in a few minutes.");
      }).catch((e) => { if (!stop) setErr(errMsg(e)); });
    };
    load();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [lectureId]);

  const label = (
    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted" data-testid="study-notes-label">
      <Sparkles className="size-3.5" aria-hidden />AI-generated from the lesson transcript
    </p>
  );

  if (err) return <div className="max-w-3xl">{label}<p className="mt-3 text-sm text-rose">{err}</p></div>;
  if (!notes || notes.status === "generating") {
    return (
      <div className="max-w-3xl" aria-live="polite">
        {label}
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-2"><Loader2 className="size-4 animate-spin text-violet" aria-hidden />{notes ? "Preparing study notes from this lesson’s transcript. This takes up to a minute, the first time only." : "Loading…"}</p>
      </div>
    );
  }
  if (notes.status === "unavailable") return <div className="max-w-3xl">{label}<p className="mt-3 text-sm text-ink-2">This lesson’s transcript is too short for study notes.</p></div>;
  if (notes.status === "failed") return <div className="max-w-3xl">{label}<p className="mt-3 text-sm text-ink-2">Study notes couldn’t be prepared for this lesson. The video and its captions are unaffected.</p></div>;

  return (
    <div className="max-w-3xl" data-testid="study-notes">
      {label}
      <h2 className="mt-3 font-display text-lg font-bold">Summary</h2>
      <p className="mt-1 text-ink-2">{notes.summary}</p>
      {notes.keyPoints?.length ? (
        <>
          <h2 className="mt-6 font-display text-lg font-bold">Key points</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-2">{notes.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
        </>
      ) : null}
      {notes.questions?.length ? (
        <>
          <h2 className="mt-6 font-display text-lg font-bold">Check yourself</h2>
          <ol className="mt-2 divide-y divide-line overflow-hidden rounded-tile border border-line bg-surface">
            {notes.questions.map((q, i) => (
              <li key={i}>
                <details className="group px-4 py-3">
                  <summary className="cursor-pointer list-none font-bold text-ink marker:hidden">
                    <span className="mr-2 tabular-nums text-muted">{i + 1}.</span>{q.question}
                    <span className="ml-2 text-sm font-normal text-violet group-open:hidden">Show answer</span>
                  </summary>
                  <p className="mt-2 text-sm text-ink-2">{q.answer}</p>
                  {q.atSec > 0 ? (
                    <button type="button" className="btn btn-ghost btn-sm mt-1 !px-2" onClick={() => onJump(q.atSec)}>
                      <PlayCircle className="size-4" aria-hidden />Watch from {clock(q.atSec)}
                    </button>
                  ) : null}
                </details>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <p className="hint mt-4">Notes can miss nuance: the lesson video is the reference.</p>
    </div>
  );
}
