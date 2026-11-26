"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, PlayCircle, Search } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { clock } from "@/lib/format";

interface Hit {
  lectureId: string;
  lectureTitle: string;
  sectionTitle: string;
  startSec: number;
  endSec: number;
  parts: { text: string; match: boolean }[];
}

/**
 * Search what the instructor says in every video of the course and jump to that moment (docs/AI_LEARNING.md).
 * Uses the captions' text through the API's full-text index; no AI involved. Results appear only for what the learner
 * searched: it is not a transcript panel, and captions stay off in the player (AGENTS rule 11).
 */
export function VideoSearchPanel({ slug, currentLectureId, onJump }: { slug: string; currentLectureId: string; onJump: (lectureId: string, sec: number) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      // Clear results when the box is emptied.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHits(null);
      setErr(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setBusy(true);
      api<{ items: Hit[] }>(`/me/courses/${slug}/search`, { query: { q: query }, signal: ctl.signal })
        .then((r) => { setHits(Array.isArray(r?.items) ? r.items : []); setErr(null); })
        .catch((e) => { if (!ctl.signal.aborted) setErr(errMsg(e)); })
        .finally(() => { if (!ctl.signal.aborted) setBusy(false); });
    }, 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, slug]);

  return (
    <div className="max-w-3xl">
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="video-search" className="label">Search inside this course’s videos</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input ref={inputRef} id="video-search" type="search" className="field !pl-9 text-base sm:text-sm" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="A command, tool or idea, e.g. rollback" autoComplete="off" maxLength={200} data-testid="video-search-input" />
          {busy ? <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden /> : null}
        </div>
        <p className="hint">Finds the words spoken in every lesson with captions, and plays the video from that moment.</p>
      </form>

      <div aria-live="polite" className="mt-4">
        {err ? <p className="text-sm text-rose">{err}</p> : null}
        {hits && !err && !hits.length ? <p className="text-sm text-ink-2" data-testid="video-search-empty">No lesson mentions “{q.trim()}”. Try a shorter or different word.</p> : null}
        {hits?.length ? (
          <>
            <p className="mb-2 text-sm text-muted">{hits.length === 30 ? "Top 30 moments" : `${hits.length} moment${hits.length === 1 ? "" : "s"}`}</p>
            <ul className="divide-y divide-line overflow-hidden rounded-tile border border-line bg-surface">
              {hits.map((h) => (
                <li key={`${h.lectureId}-${h.startSec}`}>
                  <button type="button" onClick={() => onJump(h.lectureId, h.startSec)} data-testid="video-search-result" data-lecture-id={h.lectureId} data-start-sec={h.startSec}
                    aria-label={`Play “${h.lectureTitle}” from ${clock(h.startSec)}`}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2 focus-visible:bg-surface-2">
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md bg-violet-soft px-1.5 py-0.5 text-xs font-bold tabular-nums text-violet">
                      <PlayCircle className="size-3.5" aria-hidden />{clock(h.startSec)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug text-ink-2">
                        {h.parts.map((p, i) => (p.match ? <mark key={i} className="rounded-sm bg-amber-soft px-0.5 font-bold text-ink">{p.text}</mark> : <span key={i}>{p.text}</span>))}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {h.lectureId === currentLectureId ? "This lesson" : h.lectureTitle} · {h.sectionTitle}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
