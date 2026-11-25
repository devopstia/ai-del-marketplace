"use client";
import { useCrumb } from "../shell/AppShell";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, toCategory, toStudioCourse } from "@/lib/normalize";
import { E } from "@/lib/studio-endpoints";
import type { Category, StudioCourse } from "@/lib/types";
import { StatusBadge } from "../StatusBadge";
import { Skeleton } from "../Empty";
import { useToast } from "../Toast";
import { DetailsStep } from "./DetailsStep";
import { MediaStep } from "./MediaStep";
import { CurriculumStep } from "./CurriculumStep";
import { PricingStep } from "./PricingStep";
import { SubmitStep, checklist } from "./SubmitStep";

export const STEPS = [
  ["details", "Details"],
  ["media", "Media"],
  ["curriculum", "Curriculum"],
  ["pricing", "Pricing"],
  ["submit", "Review and submit"],
] as const;
export type Step = (typeof STEPS)[number][0];

export interface EditorCtx {
  course: StudioCourse;
  categories: Category[];
  reload: () => Promise<void>;
  patch: (body: Record<string, unknown>, msg?: string) => Promise<boolean>;
  goto: (s: Step) => void;
  locked: boolean;
}

export function CourseEditor({ id }: { id: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const step = (STEPS.find(([k]) => k === sp.get("step"))?.[0] ?? "details") as Step;
  const [course, setCourse] = useState<StudioCourse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useCrumb(course ? course.title || "Untitled course" : null);

  const reload = useCallback(async () => {
    try {
      setCourse(toStudioCourse(await api(E.course(id))));
    } catch (e) {
      setErr(errMsg(e));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    api("/categories").then((r) => setCategories(list(r, "categories").map(toCategory))).catch(() => {});
  }, [reload]);

  const patch = useCallback(async (body: Record<string, unknown>, msg = "Saved.") => {
    try {
      const r = await api(E.course(id), { method: "PATCH", body });
      const next = toStudioCourse(r);
      if (next.id) setCourse((c) => (c ? { ...next, sections: next.sections.length ? next.sections : c.sections } : next));
      else await reload();
      toast("ok", msg);
      return true;
    } catch (e) {
      toast("error", errMsg(e));
      return false;
    }
  }, [id, reload, toast]);

  // Poll while uploaded videos are still being processed by the worker.
  const busy = (st?: string | null) => st === "processing" || st === "uploading";
  const processing = !!course && (busy(course.promoVideo?.status) || course.sections.some((s) => s.lectures.some((l) => busy(l.videoStatus))));
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void reload(), 4000);
    return () => clearInterval(t);
  }, [processing, reload]);

  const goto = useCallback((s: Step) => router.push(`/studio/courses/${id}?step=${s}`, { scroll: true }), [id, router]);

  if (err) return <p className="text-rose">{err}</p>;
  if (!course) return <Skeleton className="h-[60vh]" />;
  const revision = course.revision ?? null;
  // A new course is locked while in review; a published course is locked while its draft changes are in review.
  const locked = course.status === "in_review" || revision?.status === "in_review";
  const ctx: EditorCtx = { course, categories, reload, patch, goto, locked };
  const checks = checklist(course);
  const stepDone: Record<Step, boolean> = {
    details: checks.filter((c) => c.step === "details" && c.required).every((c) => c.ok),
    media: checks.filter((c) => c.step === "media").every((c) => c.ok),
    curriculum: checks.filter((c) => c.step === "curriculum" && c.required).every((c) => c.ok),
    pricing: true,
    submit: course.status === "in_review" || (course.status === "published" && (!revision || revision.status === "in_review")),
  };

  return (
    <div>
      <Link href="/studio/courses" className="link inline-flex items-center gap-1 text-sm"><ArrowLeft className="size-4" />All courses</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3"><StatusBadge status={course.status} /></div>
          <h1 className="mt-2 font-display text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold leading-tight">{course.title || "Untitled course"}</h1>
        </div>
        {course.status === "published" && course.slug ? <Link href={`/courses/${course.slug}`} className="btn btn-outline btn-sm" target="_blank"><ExternalLink className="size-4" />View live page</Link> : null}
      </div>

      {locked ? <p className="mt-5 rounded-tile bg-amber-soft px-4 py-3 text-sm text-ink-2"><b>In review.</b> Editing is paused while an admin reviews {revision ? "your changes. Learners still see the live course" : "this course"}. You’ll be able to edit again if changes are requested.</p> : null}
      {course.status === "published" && !locked ? (
        <p className="mt-5 rounded-tile border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          <b className="text-ink">This course is live.</b>{" "}
          {revision ? <>You have unsubmitted changes. Learners see the live version until a reviewer approves them. <Link href={`/studio/courses/${id}?step=submit`} className="link">Review and submit changes</Link></> : "Edits you make are saved as draft changes and go live after review. Learners keep seeing the current version until then."}
        </p>
      ) : null}
      {revision?.status === "changes_requested" && revision.reviewNote ? (
        <div className="mt-5 rounded-tile border-l-4 border-cyan bg-cyan-soft px-4 py-3 text-sm"><p className="font-bold">Changes requested by the reviewer</p><p className="mt-1 whitespace-pre-line text-ink-2">{revision.reviewNote}</p></div>
      ) : null}
      {course.status === "changes_requested" && course.reviewNote ? (
        <div className="mt-5 rounded-tile border-l-4 border-cyan bg-cyan-soft px-4 py-3 text-sm"><p className="font-bold">Changes requested by the reviewer</p><p className="mt-1 whitespace-pre-line text-ink-2">{course.reviewNote}</p></div>
      ) : null}

      <nav aria-label="Course setup steps" className="mt-7 overflow-x-auto">
        <ol className="flex min-w-max gap-1 border-b border-line">
          {STEPS.map(([k, label], i) => {
            const active = k === step;
            return (
              <li key={k}>
                <Link href={`/studio/courses/${id}?step=${k}`} aria-current={active ? "step" : undefined}
                  className={`-mb-px flex items-center gap-2.5 border-b-2 px-3 py-3 text-sm font-bold sm:px-4 ${active ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                  <span className={`grid size-6 place-items-center rounded-full text-xs tabular-nums ${stepDone[k] ? "bg-mint text-paper" : active ? "bg-violet text-on-violet" : "bg-surface-2 text-ink-2"}`}>
                    {stepDone[k] ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-8">
        {step === "details" ? <DetailsStep {...ctx} /> : null}
        {step === "media" ? <MediaStep {...ctx} /> : null}
        {step === "curriculum" ? <CurriculumStep {...ctx} /> : null}
        {step === "pricing" ? <PricingStep {...ctx} /> : null}
        {step === "submit" ? <SubmitStep {...ctx} /> : null}
      </div>
    </div>
  );
}

/** `onSave` returns false when the save failed (the error is already shown); the editor then stays on this step. */
/** `blocked`: the form has an error the learner must fix first (both buttons disabled, no spinner). */
export function StepFooter({ onSave, saving, next, goto, disabled, nextLabel, blocked }: { onSave?: () => Promise<boolean> | boolean; saving?: boolean; next?: Step; goto: (s: Step) => void; disabled?: boolean; nextLabel?: string; blocked?: boolean }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-10 flex items-center justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      {onSave ? <button type="button" className="btn btn-outline" onClick={onSave} disabled={saving || disabled || blocked}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}Save</button> : null}
      {next ? (
        <button type="button" className="btn btn-primary" disabled={saving || (blocked && !disabled)}
          onClick={async () => { if (onSave && !disabled && (await onSave()) === false) return; goto(next); }}>
          {nextLabel ?? (onSave ? "Save and continue" : "Continue")}
        </button>
      ) : null}
    </div>
  );
}
