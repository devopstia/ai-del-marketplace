"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { clock } from "@/lib/format";
import type { LectureOutline } from "@/lib/types";
import { Modal } from "./Modal";
import { VideoPlayer } from "./VideoPlayer";

export function PreviewModal({ courseTitle, slug, previews, lectureId, onClose }: { courseTitle: string; slug: string; previews: LectureOutline[]; lectureId: string | null; onClose: () => void }) {
  const [current, setCurrent] = useState<string | null>(lectureId);
  const [src, setSrc] = useState<{ url: string; format: "mp4" | "hls"; captionsUrl?: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setCurrent(id);
    setSrc(null);
    setErr(null);
    setLoading(true);
    try {
      const r = obj(await api(id === "promo" ? `/courses/${slug}/promo-playback` : `/lectures/${id}/preview-playback`, { method: "POST" }));
      setSrc({ url: String(r.url), format: r.format === "hls" ? "hls" : "mp4", captionsUrl: (r.captionsUrl as string) ?? null });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    // Fetch a signed preview URL whenever a different lecture is opened from outside.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lectureId) void load(lectureId);
  }, [lectureId, load]);

  const lec = previews.find((p) => p.id === current);
  return (
    <Modal open={!!lectureId} onClose={onClose} title={`Course preview: ${courseTitle}`} wide>
      <div className="grid md:grid-cols-[1fr_280px]">
        <div className="bg-stage p-3 md:p-4">
          {src ? (
            <VideoPlayer src={src.url} format={src.format} captionsUrl={src.captionsUrl} autoPlay title={lec?.title} />
          ) : (
            <div className="grid aspect-video place-items-center rounded-tile bg-black/60 text-white/85">
              {loading ? <Loader2 className="size-8 animate-spin" aria-label="Loading preview" /> : <p className="max-w-sm px-6 text-center text-sm">{err ?? "Pick a free preview to start watching."}</p>}
            </div>
          )}
          {lec ? <p className="mt-3 font-display font-bold text-white">{lec.title}</p> : null}
        </div>
        <div className="border-t border-line p-3 md:border-l md:border-t-0">
          <p className="px-2 pb-2 pt-1 text-sm font-bold text-muted">Free previews</p>
          <ul>
            {previews.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => load(p.id)} aria-current={p.id === current}
                  className={`flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-surface-2 ${p.id === current ? "bg-violet-soft font-bold" : ""}`}>
                  <PlayCircle className="mt-0.5 size-4 shrink-0 text-violet" />
                  <span className="flex-1">{p.title}</span>
                  <span className="tabular-nums text-muted">{p.durationSec ? clock(p.durationSec) : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
