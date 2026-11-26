"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Paperclip } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { E } from "@/lib/studio-endpoints";
import { bytes, clock } from "@/lib/format";
import { Modal } from "../Modal";
import { Markdown } from "../Markdown";
import { VideoPlayer } from "../VideoPlayer";

interface Preview {
  version: "draft" | "live";
  section: { id: string; title: string };
  lecture: { id: string; title: string; type: "video" | "article" | "quiz"; durationSec: number; articleMd: string | null; summary: string };
  video: { status: string; durationSec: number; playback: { url: string; format?: string; captionsUrl?: string | null } | null } | null;
  quiz: { q: string; options: string[]; correct: number; why: string }[] | null;
  resources: { id: string; title: string; sizeBytes: number }[];
}

/**
 * Studio preview of one lesson as it is in the draft changes of a live course (learners still see the live version).
 * The API checks that this person owns the course (or reviews courses) and returns a short-lived signed video URL.
 */
export function DraftPreview({ courseId, lectureId, onClose }: { courseId: string; lectureId: string | null; onClose: () => void }) {
  const [data, setData] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!lectureId) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null); setErr(null);
    api(`${E.lecture(courseId, lectureId)}/preview`)
      .then((r) => { if (alive) setData(obj(r) as unknown as Preview); })
      .catch((e) => { if (alive) setErr(errMsg(e)); });
    return () => { alive = false; };
  }, [courseId, lectureId]);
  const l = data?.lecture;
  return (
    <Modal open={!!lectureId} onClose={onClose} title={l ? `Preview: ${l.title}` : "Lesson preview"} wide>
      <div className="space-y-5 p-5" data-testid="draft-preview">
        {err ? <p className="text-rose">{err}</p> : null}
        {!data && !err ? <p className="flex items-center gap-2 text-muted"><Loader2 className="size-4 animate-spin" />Loading the lesson</p> : null}
        {data && l ? (
          <>
            <p className="rounded-tile bg-amber-soft px-3 py-2 text-sm text-ink">
              {data.version === "draft" ? "Your unpublished changes. Learners keep seeing the live course until DEL approves them." : "This lesson as learners will see it."}
              <span className="text-ink-2"> · {data.section.title}</span>
            </p>
            {l.type === "video" ? (
              data.video?.playback ? (
                <div className="overflow-hidden rounded-tile bg-stage" data-qa-on-media>
                  <VideoPlayer src={data.video.playback.url} format={data.video.playback.format === "hls" ? "hls" : "mp4"} captionsUrl={data.video.playback.captionsUrl ?? null} title={l.title} />
                </div>
              ) : (
                <p className="rounded-tile border border-line bg-surface-2 px-4 py-8 text-center text-ink-2">{data.video ? "The video is still processing. Try again in a minute." : "No video yet: upload one from the lesson row."}</p>
              )
            ) : null}
            {l.summary ? <p className="text-ink-2">{l.summary}</p> : null}
            {l.articleMd ? <div className="max-w-3xl"><Markdown source={l.articleMd} /></div> : l.type === "article" ? <p className="text-muted">The article is empty.</p> : null}
            {data.quiz?.length ? (
              <ol className="space-y-4" aria-label="Quiz questions">
                {data.quiz.map((q, i) => (
                  <li key={i} className="rounded-tile border border-line bg-surface p-4">
                    <p className="font-bold">{i + 1}. {q.q}</p>
                    <ul className="mt-2 space-y-1.5">
                      {q.options.map((o, j) => (
                        <li key={j} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${j === q.correct ? "bg-mint-soft font-bold text-ink" : "bg-surface-2/60 text-ink-2"}`}>
                          {j === q.correct ? <Check className="mt-0.5 size-4 shrink-0 text-mint" aria-label="Correct answer" /> : <span className="size-4 shrink-0" aria-hidden="true" />}{o}
                        </li>
                      ))}
                    </ul>
                    {q.why ? <p className="mt-2 text-sm text-muted">{q.why}</p> : null}
                  </li>
                ))}
              </ol>
            ) : l.type === "quiz" ? <p className="text-muted">No questions yet.</p> : null}
            {data.resources.length ? (
              <div>
                <h3 className="font-display font-bold">Lesson files</h3>
                <ul className="mt-2 divide-y divide-line rounded-tile border border-line">
                  {data.resources.map((r) => <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm"><Paperclip className="size-4 shrink-0 text-muted" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{r.title}</span><span className="text-xs tabular-nums text-muted">{bytes(r.sizeBytes)}</span></li>)}
                </ul>
              </div>
            ) : null}
            {l.durationSec ? <p className="text-xs text-muted">Length {clock(l.durationSec)}</p> : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
