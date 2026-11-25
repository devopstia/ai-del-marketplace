"use client";
import { useState } from "react";
import { ClipboardCheck, FileText, ListChecks, Loader2, PlayCircle } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, obj, toStudioCourse } from "@/lib/normalize";
import { clock, date, money, levelLabel } from "@/lib/format";
import type { StudioCourse } from "@/lib/types";
import { PageHead } from "@/components/shell/AppShell";
import { CourseCover } from "@/components/CourseCover";
import { Markdown } from "@/components/Markdown";
import { Empty, Skeleton } from "@/components/Empty";
import { AdminDecision } from "@/components/AdminDecision";
import { VideoPlayer } from "@/components/VideoPlayer";

type QueueItem = StudioCourse & { kind: "course" | "revision"; changes: { area: string; message: string }[] };

const map = (r: unknown): QueueItem[] => list(r, "courses", "queue").map((x) => {
  const o = obj(x);
  return {
    ...toStudioCourse(x),
    kind: o.kind === "revision" ? "revision" : "course",
    changes: (Array.isArray(o.changes) ? o.changes : []).map((ch) => ({ area: String(obj(ch).area ?? ""), message: String(obj(ch).message ?? "") })).filter((ch) => ch.message),
  };
});

/** Admin course detail. For changes to a live course, the proposed content (the revision's draft) is what gets reviewed. */
const toReviewDetail = (x: unknown): StudioCourse => {
  const o = obj(x);
  const draft = obj(obj(o.revision).draft);
  const live = toStudioCourse(x);
  if (!draft.course) return live;
  const proposed = toStudioCourse({ ...obj(draft.course), id: live.id, sections: draft.sections });
  return { ...live, ...proposed, slug: live.slug, status: live.status, instructor: live.instructor, category: proposed.categoryId === live.categoryId ? live.category : null };
};

function CoursePreview({ c: base, onDone }: { c: QueueItem; onDone: () => void }) {
  const detail = useApi(`/admin/courses/${base.id}`, toReviewDetail);
  // The queue item carries the submission date; the detail call does not.
  const c = detail.data?.id ? { ...base, ...detail.data, instructor: detail.data.instructor ?? base.instructor, updatedAt: base.updatedAt } : base;
  const isRevision = base.kind === "revision";
  const [video, setVideo] = useState<{ id: string; url: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Play by video asset, so new videos in proposed changes can be watched before they go live.
  async function play(id: string, assetId: string) {
    setLoading(id); setErr(null);
    try { const r = obj(await api(`/admin/videos/${assetId}/playback`, { method: "POST" })); setVideo({ id, url: String(r.url) }); }
    catch (e) { setErr(errMsg(e)); } finally { setLoading(null); }
  }
  const full = c.sections.length ? c : null;
  const loadingDetail = detail.loading;
  return (
    <article className="rounded-panel border border-line bg-surface">
      <div className="grid gap-5 p-5 sm:grid-cols-[220px_1fr] sm:p-6">
        <CourseCover slug={c.slug || c.id} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} />
        <div className="min-w-0">
          {isRevision ? <p className="mb-1 text-xs font-bold uppercase tracking-wide text-cyan">Changes to a live course</p> : null}
          <h2 className="font-display text-xl font-extrabold leading-tight">{c.title}</h2>
          <p className="mt-1 text-ink-2">{c.subtitle}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-muted">
            <span>By {c.instructor?.name ?? "Instructor"}</span><span>{c.category?.name ?? "No category"}</span><span>{levelLabel[c.level]}</span><span>{money(c.priceCents, c.currency)}</span><span>Submitted {date(c.updatedAt)}</span>
          </p>
        </div>
      </div>
      {isRevision ? (
        <div className="border-t border-line p-5 sm:p-6">
          <h3 className="font-display font-bold">What changes</h3>
          <p className="mt-1 text-sm text-ink-2">Learners keep the live version until you approve. Approving applies every change at once; the content below is the proposed version.</p>
          {base.changes.length ? (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line text-sm" data-testid="review-changes">
              {base.changes.map((ch, i) => <li key={i} className="flex gap-3 px-3 py-2"><span className="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-muted">{ch.area}</span><span>{ch.message}</span></li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-ink-2">No change summary was provided.</p>}
        </div>
      ) : null}
      {video ? <div className="bg-stage p-3 sm:p-4"><VideoPlayer src={video.url} autoPlay title="Lecture under review" /></div> : null}
      {err ? <p className="px-6 pt-4 text-sm text-rose">{err}</p> : null}
      <div className="grid gap-8 border-t border-line p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <h3 className="font-display font-bold">Description</h3>
          <Markdown source={c.description || "_No description._"} className="prose-del mt-2 max-h-72 overflow-y-auto text-sm" />
          {c.objectives.length ? (<><h3 className="mt-5 font-display font-bold">Outcomes</h3><ul className="mt-2 list-disc pl-5 text-sm text-ink-2">{c.objectives.map((o) => <li key={o}>{o}</li>)}</ul></>) : null}
        </div>
        <div>
          <h3 className="font-display font-bold">Curriculum</h3>
          {full ? (
            <ol className="mt-2 space-y-3 text-sm">
              {c.sections.map((s) => (
                <li key={s.id}>
                  <p className="font-bold">{s.title}</p>
                  <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
                    {s.lectures.map((l) => {
                      const I = l.type === "article" ? FileText : l.type === "quiz" ? ListChecks : PlayCircle;
                      return (
                        <li key={l.id} className={`flex items-center gap-2 px-3 py-2 ${video?.id === l.id ? "bg-violet-soft" : ""}`}>
                          <I className="size-4 text-muted" /><span className="flex-1">{l.title}</span>
                          {l.isPreview ? <span className="chip !py-0 text-xs">Preview</span> : null}
                          <span className="tabular-nums text-muted">{l.durationSec ? clock(l.durationSec) : ""}</span>
                          {l.type === "video" && l.videoAssetId ? <button type="button" className="link text-xs" onClick={() => play(l.id, l.videoAssetId!)}>{loading === l.id ? <Loader2 className="size-3.5 animate-spin" /> : "Watch"}</button> : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-sm text-ink-2">{loadingDetail ? "Loading curriculum…" : "This course has no lectures yet."}</p>}
        </div>
      </div>
      <div className="border-t border-line bg-surface-2/40 p-5 sm:p-6">
        <AdminDecision courseId={c.id} actions={["approve", "request-changes", "reject"]} onDone={onDone} revision={isRevision} />
      </div>
    </article>
  );
}

export default function ReviewQueue() {
  const { data, error, reload } = useApi("/admin/review-queue", map);
  const [sel, setSel] = useState<string | null>(null);
  const current = data?.find((c) => c.id === sel) ?? data?.[0];
  return (
    <>
      <PageHead title="Review queue" sub="New courses and changes to live courses, oldest first. Watch a few lectures, check the labs, then decide." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-96" /> : null}
      {data && !data.length ? <Empty icon={ClipboardCheck} title="Nothing to review" body="New submissions from instructors will appear here." /> : null}
      {data && data.length && current ? (
        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <ul className="space-y-2" aria-label="Submitted courses">
            {data.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setSel(c.id)} aria-current={c.id === current.id}
                  className={`w-full rounded-tile border px-4 py-3 text-left ${c.id === current.id ? "border-violet bg-violet-soft" : "border-line bg-surface hover:border-line-strong"}`}>
                  <span className="block font-bold leading-snug">{c.title}</span>
                  <span className="text-xs text-muted">{c.kind === "revision" ? "Changes to live course · " : ""}{c.instructor?.name ?? "Instructor"}, submitted {date(c.updatedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <CoursePreview key={current.id} c={current} onDone={() => { setSel(null); reload(); }} />
        </div>
      ) : null}
    </>
  );
}
