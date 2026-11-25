"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Send, Undo2 } from "lucide-react";
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
    { step: "media", label: "Course cover", ok: !!c.thumbnailUrl, required: false },
    { step: "curriculum", label: "Three or more lectures", ok: lectures.length >= 3, required: false },
    { step: "curriculum", label: "At least one free preview", ok: lectures.some((l) => l.isPreview), required: false },
  ];
}

export function SubmitStep({ course, reload, locked }: EditorCtx) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const items = checklist(course);
  const ready = items.filter((i) => i.required).every((i) => i.ok);
  const live = course.status === "published";
  const rev = course.revision ?? null;
  const editable = rev ? rev.status === "draft" || rev.status === "changes_requested" : false;
  const canSubmit = ready && !locked && (live ? editable && rev!.changes.length > 0 : true);
  const submitLabel = live ? "Submit changes for review" : "Submit for review";
  const statusLine = live
    ? !rev ? "This course is live and has no draft changes." : rev.status === "in_review" ? "Your changes are waiting for a reviewer." : rev.changes.length ? "Your changes are ready to submit." : "No changes yet."
    : locked ? "Waiting for a reviewer." : ready ? "Everything required is in place." : "Complete the required items to submit.";
  return (
    <div className="grid max-w-5xl gap-10 lg:grid-cols-[1fr_320px]">
      <section>
        {live ? (
          <div className="mb-10">
            <h2 className="font-display text-xl font-bold">Changes to the live course</h2>
            <p className="mt-1 text-ink-2">Learners see the live version until a reviewer approves these changes. Then they go live together.</p>
            {rev && rev.changes.length ? (
              <ul className="mt-4 divide-y divide-line rounded-tile border border-line bg-surface" data-testid="revision-changes">
                {rev.changes.map((ch, i) => (
                  <li key={i} className="flex items-baseline gap-3 px-4 py-3">
                    <span className="w-24 shrink-0 text-xs font-bold uppercase tracking-wide text-muted">{ch.area}</span>
                    <span className="text-ink-2">{ch.message}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-4 rounded-tile border border-line bg-surface px-4 py-3 text-ink-2">No changes yet. Edit any step and your changes are saved here as a draft.</p>}
          </div>
        ) : null}
        <h2 className="font-display text-xl font-bold">Before you submit</h2>
        <p className="mt-1 text-ink-2">An admin reviews every course for audio and video quality, accuracy, and working labs. Most reviews finish within three working days.</p>
        {([true, false] as const).map((req) => (
        <div key={String(req)}>
        <h3 className="mt-6 font-display font-bold">{req ? "Required" : "Recommended"}</h3>
        <ul className="mt-2 divide-y divide-line rounded-tile border border-line bg-surface">
          {items.filter((i) => i.required === req).map((i) => (
            <li key={i.label} className="flex items-center gap-3 px-4 py-3">
              {i.ok ? <CheckCircle2 className="size-5 shrink-0 text-mint" /> : <Circle className="size-5 shrink-0 text-muted" />}
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
        {rev?.status === "changes_requested" && rev.reviewNote ? <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-ink-2"><b className="block text-ink">Reviewer note on your changes</b>{rev.reviewNote}</p> : null}
        {!live && course.reviewNote ? <p className="mt-4 whitespace-pre-line rounded-lg bg-surface-2 p-3 text-sm text-ink-2"><b className="block text-ink">Reviewer note</b>{course.reviewNote}</p> : null}
        <button type="button" className="btn btn-primary mt-6 w-full" disabled={!canSubmit || busy} data-testid="submit-review"
          onClick={async () => {
            setBusy(true);
            try {
              await api(E.submit(course.id), { method: "POST" });
              toast("ok", live ? "Changes submitted for review. The live course stays as it is until they are approved." : "Submitted for review. We’ll email you when a reviewer responds.");
              await reload();
            } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
          }}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{submitLabel}
        </button>
        <p className="mt-3 text-xs text-muted">{statusLine}</p>
        {live && rev && editable ? (
          <button type="button" className="btn btn-ghost btn-sm mt-4 w-full text-rose" disabled={busy} data-testid="discard-changes"
            onClick={async () => {
              if (!confirm("Discard all draft changes? The live course is not affected.")) return;
              setBusy(true);
              try {
                await api(E.revision(course.id), { method: "DELETE" });
                toast("ok", "Draft changes discarded.");
                await reload();
              } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
            }}>
            <Undo2 className="size-4" />Discard draft changes
          </button>
        ) : null}
      </aside>
    </div>
  );
}
