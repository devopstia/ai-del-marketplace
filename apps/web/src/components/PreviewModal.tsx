"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, PlayCircle, ShoppingCart } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { clock, money } from "@/lib/format";
import type { CourseDetail, LectureOutline } from "@/lib/types";
import { Modal } from "./Modal";
import { VideoPlayer } from "./VideoPlayer";
import { usePurchase } from "./PurchaseCard";
import { usePaymentsMode } from "./TestModeNotice";

/** The enrol action beside the preview player, through the same purchase path as the purchase card. */
function PreviewAction({ course }: { course: CourseDetail }) {
  const { authLoading, enrolled, inCart, busy, buyNow } = usePurchase(course);
  const payMode = usePaymentsMode();
  const free = course.priceCents === 0;
  if (enrolled) return <Link href={`/learn/${course.slug}`} className="btn btn-primary w-full" data-testid="preview-cta">Go to course</Link>;
  if (!free && payMode === "off") return null;
  if (inCart && !free) return <Link href="/cart" className="btn btn-primary w-full" data-testid="preview-cta"><ShoppingCart className="size-4" />Go to cart</Link>;
  return (
    <button type="button" className="btn btn-primary w-full" disabled={!!busy || authLoading} onClick={buyNow} data-testid="preview-cta">
      {busy === "buy" ? <Loader2 className="size-4 animate-spin" /> : null}
      {free ? "Start learning for free" : `Enroll now · ${money(course.priceCents, course.currency)}`}
    </button>
  );
}

export function PreviewModal({ courseTitle, slug, previews, lectureId, onClose, course, overviewIds = [] }: { courseTitle: string; slug: string; previews: LectureOutline[]; lectureId: string | null; onClose: () => void; course?: CourseDetail; overviewIds?: string[] }) {
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
          {lec ? (
            <div className="mt-3">
              {overviewIds.includes(lec.id) ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9fd9f5]" data-testid="preview-overview-label">Course overview</p> : null}
              <p className="font-display font-bold text-white">{lec.title}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col border-t border-line p-3 md:border-l md:border-t-0">
          <p className="px-2 pb-2 pt-1 text-sm font-bold text-muted">Free previews</p>
          <ul>
            {previews.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => load(p.id)} aria-current={p.id === current}
                  className={`flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-surface-2 ${p.id === current ? "bg-violet-soft font-bold" : ""}`}>
                  <PlayCircle className="mt-0.5 size-4 shrink-0 text-violet" />
                  <span className="flex-1">
                    {overviewIds.includes(p.id) ? <span className="mb-0.5 block text-xs font-bold text-violet" data-testid="preview-overview-row">Course overview</span> : null}
                    {p.title}
                  </span>
                  <span className="tabular-nums text-muted">{p.durationSec ? clock(p.durationSec) : ""}</span>
                </button>
              </li>
            ))}
          </ul>
          {course ? <div className="mt-3 border-t border-line px-2 pb-1 pt-3 md:mt-auto">
            <PreviewAction course={course} />
          </div> : null}
        </div>
      </div>
    </Modal>
  );
}
