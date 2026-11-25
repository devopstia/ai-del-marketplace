"use client";
import { CoverPicker } from "../covers/CoverPicker";
import type { EditorCtx } from "./CourseEditor";
import { StepFooter } from "./CourseEditor";
import { UploadBox } from "./UploadBox";
import { uploadVideo } from "./upload";
import { StatusBadge } from "../StatusBadge";

export function MediaStep({ course, patch, reload, goto, locked }: EditorCtx) {
  return (
    <div className="grid max-w-6xl gap-8 lg:grid-cols-2">
      <div className="lg:col-span-2"><CoverPicker courseId={course.id} title={course.title} onSaved={reload} /></div>
      <section className="grid gap-6 lg:col-span-2 lg:grid-cols-2">
        <div className="min-w-0">
        <h2 className="font-display text-xl font-bold">Promo video</h2>
        <p className="mt-1 text-sm text-ink-2">A 1–2 minute trailer: who you are, what learners will build, and one moment from a lab. Learners watch it before buying.</p>
        <div className="mt-4">
          <UploadBox accept="video/mp4,video/quicktime,video/webm" label="Upload promo video" hint="MP4, MOV or WebM. Uploads go straight to private storage." disabled={locked}
            onFile={async (f, prog) => {
              const assetId = await uploadVideo(f, prog, { courseId: course.id });
              await patch({ promoVideoAssetId: assetId }, "Promo video uploaded. It will be ready after processing.");
            }} />
        </div>
        </div>
        <div className="min-w-0">
        <div className="grid aspect-video place-items-center rounded-tile bg-stage text-center text-white/80">
          {course.promoVideoAssetId ? <div><p className="font-bold text-white">Promo video attached</p><p className="mt-1 text-sm">Processing starts automatically after upload.</p></div> : <p className="px-6 text-sm">No promo video yet. Your free preview lectures are shown instead.</p>}
        </div>
        {course.promoVideoAssetId ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <StatusBadge status={course.promoVideo?.status ?? "processing"} />
            {course.promoVideo?.status === "ready" ? "Ready to play." : course.promoVideo?.status === "failed" ? "Processing failed. Upload the video again." : "Being processed. This page updates when it is ready."}
          </p>
        ) : null}
        </div>
      </section>
      <div className="lg:col-span-2"><StepFooter next="curriculum" goto={goto} /></div>
    </div>
  );
}
