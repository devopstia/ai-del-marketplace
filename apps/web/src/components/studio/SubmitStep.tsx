"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Send } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { E } from "@/lib/studio-endpoints";
import type { StudioCourse } from "@/lib/types";
import type { EditorCtx, Step } from "./CourseEditor";
import { StatusBadge } from "../StatusBadge";
import { useToast } from "../Toast";

export type Check = { step: Step; label: string; ok: boolean; required: boolean };

export function checklist(c: StudioCourse): Check[] {
  const lectures = c.sections.flatMap((s) => s.lectures);
  const videos = lectures.filter((l) => l.type === "video");
  return [
    { step: "details", label: "Description", ok: c.description.trim().length > 0, required: true },
    { step: "details", label: "Category chosen", ok: !!c.categoryId || !!c.category, required: true },
    { step: "curriculum", label: "At least one lecture", ok: lectures.length > 0, required: true },
    { step: "curriculum", label: "Every video lecture has a processed video", ok: videos.every((l) => !!l.videoAssetId && (l.videoStatus ?? "ready") === "ready"), required: true },
    { step: "details", label: "Subtitle", ok: c.subtitle.trim().length > 0, required: false },
    { step: "details", label: "Description of 200 characters or more", ok: c.description.trim().length >= 200, required: false },
    { step: "details", label: "Four or more learning outcomes", ok: c.objectives.filter(Boolean).length >= 4, required: false },
    { step: "media", label: "Course image", ok: !!c.thumbnailUrl || !!c.thumbnailKey, required: false },
    { step: "curriculum", label: "Three or more lectures", ok: lectures.length >= 3, required: false },
    { step: "curriculum", label: "At least one free preview", ok: lectures.some((l) => l.isPreview), required: false },
  ];
}

export function SubmitStep({ course, reload, locked }: EditorCtx) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const items = checklist(course);
  const ready = items.filter((i) => i.required).every((i) => i.ok);
  const canSubmit = ready && !locked && course.status !== "published";
  return (
    <div className="grid max-w-5xl gap-10 lg:grid-cols-[1fr_320px]">
      <section>
        <h2 className="font-display text-xl font-bold">Before you submit</h2>
        <p className="mt-1 text-ink-2">An admin reviews every course for audio and video quality, accuracy, and working labs. Most reviews finish within three working days.</p>
        {([true, false] as const).map((req) => (
        <div key={String(req)}>
        <h3 className="mt-6 font-display font-bold">{req ? "Required" : "Recommended"}</h3>
        <ul className="mt-2 divide-y divide-line rounded-tile border border-line bg-surface">
          {items.filter((i) => i.required === req).map((i) => (
            <li key={i.label} className="flex items-center gap-3 px-4 py-3">
              {i.ok ? <CheckCircle2 className="size-5 shrink-0 text-mint" /> : <Circle className="size-5 shrink-0 text-line-strong" />}
              <span className={`flex-1 ${i.ok ? "text-ink-2" : "font-bold"}`}>{i.label}</span>
              {!i.ok ? <Link href={`?step=${i.step}`} className="link text-sm">Fix</Link> : null}
            </li>
          ))}
        </ul>
        </div>
        ))}
      </section>
      <aside className="h-fit rounded-panel border border-line bg-surface p-6">
        <p className="text-sm text-muted">Current status</p>
        <div className="mt-1"><StatusBadge status={course.status} /></div>
        {course.reviewNote ? <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-ink-2"><b className="block text-ink">Reviewer note</b>{course.reviewNote}</p> : null}
        <button type="button" className="btn btn-primary mt-6 w-full" disabled={!canSubmit || busy} data-testid="submit-review"
          onClick={async () => {
            setBusy(true);
            try {
              await api(E.submit(course.id), { method: "POST" });
              toast("ok", "Submitted for review. We’ll email you when a reviewer responds.");
              await reload();
            } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
          }}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Submit for review
        </button>
        <p className="mt-3 text-xs text-muted">
          {course.status === "published" ? "This course is live." : locked ? "Waiting for a reviewer." : ready ? "Everything required is in place." : "Complete the required items to submit."}
        </p>
      </aside>
    </div>
  );
}
