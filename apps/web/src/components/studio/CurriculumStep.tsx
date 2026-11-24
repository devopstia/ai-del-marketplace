"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Eye, FileText, ListChecks, Loader2, Plus, PlayCircle, Trash2, Paperclip } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { E } from "@/lib/studio-endpoints";
import { bytes, clock, plural } from "@/lib/format";
import type { StudioLecture, StudioSection, QuizQuestion } from "@/lib/types";
import type { EditorCtx } from "./CourseEditor";
import { StepFooter } from "./CourseEditor";
import { UploadBox } from "./UploadBox";
import { uploadResource, uploadVideo } from "./upload";
import { StatusBadge } from "../StatusBadge";
import { useToast } from "../Toast";

const typeIcon = { video: PlayCircle, article: FileText, quiz: ListChecks } as const;

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}

export function CurriculumStep({ course, reload, goto, locked }: EditorCtx) {
  const toast = useToast();
  const [sections, setSections] = useState<StudioSection[]>(course.sections);
  const [openLecture, setOpenLecture] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(course.sections);
  if (synced !== course.sections) {
    // Server copy changed (after a save/reload): adopt it.
    setSynced(course.sections);
    setSections(course.sections);
  }

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      await reload();
      if (ok) toast("ok", ok);
    } catch (e) {
      toast("error", errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function persistOrder(next: StudioSection[], sectionId?: string) {
    setSections(next);
    try {
      if (sectionId) {
        const s = next.find((x) => x.id === sectionId)!;
        await api(E.lectureOrder(course.id, sectionId), { method: "PUT", body: { ids: s.lectures.map((l) => l.id) } });
      } else {
        await api(E.sectionOrder(course.id), { method: "PUT", body: { ids: next.map((s) => s.id) } });
      }
    } catch (e) {
      toast("error", errMsg(e));
      await reload();
    }
  }

  const totalLectures = sections.reduce((a, s) => a + s.lectures.length, 0);
  const totalSec = sections.reduce((a, s) => a + s.lectures.reduce((b, l) => b + l.durationSec, 0), 0);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Curriculum</h2>
          <p className="mt-1 text-ink-2">{plural(sections.length, "section")}, {plural(totalLectures, "lecture")}, {clock(totalSec)} of video. Mark two or three lectures as free previews so learners can try before buying.</p>
        </div>
        {busy ? <Loader2 className="size-5 animate-spin text-violet" aria-label="Saving" /> : null}
      </div>

      <fieldset disabled={locked} className="mt-6 space-y-5">
        {sections.map((s, si) => (
          <section key={s.id} className="rounded-panel border border-line bg-surface" aria-label={`Section ${si + 1}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <span className="text-sm font-bold text-muted">Section {si + 1}</span>
              <input aria-label={`Section ${si + 1} title`} defaultValue={s.title} key={s.title} className="field !min-h-9 min-w-0 flex-1 !py-1 font-display font-bold"
                onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && run(() => api(E.section(course.id, s.id), { method: "PATCH", body: { title: e.target.value.trim() } }), "Section renamed.")} />
              <span className="flex">
                <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Move section up" disabled={si === 0} onClick={() => persistOrder(move(sections, si, -1))}><ArrowUp className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label="Move section down" disabled={si === sections.length - 1} onClick={() => persistOrder(move(sections, si, 1))}><ArrowDown className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-sm !px-2 text-rose" aria-label="Delete section"
                  onClick={() => confirm(`Delete “${s.title}” and its ${s.lectures.length} lectures?`) && run(() => api(E.section(course.id, s.id), { method: "DELETE" }), "Section deleted.")}><Trash2 className="size-4" /></button>
              </span>
            </div>
            <ul className="divide-y divide-line">
              {s.lectures.map((l, li) => (
                <LectureRow key={l.id} courseId={course.id} l={l} index={li} count={s.lectures.length} open={openLecture === l.id}
                  onToggle={() => setOpenLecture((o) => (o === l.id ? null : l.id))}
                  onMove={(d) => persistOrder(sections.map((x, xi) => (xi === si ? { ...x, lectures: move(x.lectures, li, d) } : x)), s.id)}
                  run={run} />
              ))}
            </ul>
            <AddLecture onAdd={(title, type) => run(() => api(E.lectures(course.id, s.id), { method: "POST", body: { title, type } }), "Lecture added.")} />
          </section>
        ))}
        <AddSection onAdd={(title) => run(() => api(E.sections(course.id), { method: "POST", body: { title } }), "Section added.")} />
      </fieldset>
      <StepFooter next="pricing" goto={goto} />
    </div>
  );
}

function AddSection({ onAdd }: { onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form className="flex flex-wrap gap-2 rounded-panel border-[1.5px] border-dashed border-line-strong p-4" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim()); setT(""); } }}>
      <label htmlFor="new-section" className="sr-only">New section title</label>
      <input id="new-section" className="field min-w-0 flex-1" placeholder="New section title, e.g. “Deploy to Kubernetes”" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn btn-primary" data-testid="add-section"><Plus className="size-4" />Add section</button>
    </form>
  );
}

function AddLecture({ onAdd }: { onAdd: (t: string, type: StudioLecture["type"]) => void }) {
  const [t, setT] = useState("");
  const [type, setType] = useState<StudioLecture["type"]>("video");
  return (
    <form className="flex flex-wrap gap-2 border-t border-line bg-surface-2/40 px-4 py-3" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim(), type); setT(""); } }}>
      <input aria-label="New lecture title" className="field !min-h-10 min-w-0 flex-1" placeholder="New lecture title" value={t} onChange={(e) => setT(e.target.value)} />
      <select aria-label="Lecture type" className="field !min-h-10 !w-auto" value={type} onChange={(e) => setType(e.target.value as StudioLecture["type"])}>
        <option value="video">Video</option><option value="article">Article</option><option value="quiz">Quiz</option>
      </select>
      <button className="btn btn-outline btn-sm !min-h-10" data-testid="add-lecture"><Plus className="size-4" />Add lecture</button>
    </form>
  );
}

function LectureRow({ courseId, l, index, count, open, onToggle, onMove, run }: {
  courseId: string; l: StudioLecture; index: number; count: number; open: boolean; onToggle: () => void; onMove: (d: -1 | 1) => void;
  run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const Icon = typeIcon[l.type];
  const patchL = (body: Record<string, unknown>, ok?: string) => run(() => api(E.lecture(courseId, l.id), { method: "PATCH", body }), ok);
  return (
    <li>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-left">
          <span className="min-w-0 font-bold">{l.title}</span>
          {l.isPreview ? <span className="chip !bg-mint-soft !py-0 !text-mint">Preview</span> : null}
          {l.type === "video" ? (l.videoAssetId ? <StatusBadge status={l.videoStatus ?? "processing"} /> : <span className="chip !py-0">No video</span>) : null}
          <ChevronDown className={`ml-auto hidden size-4 shrink-0 text-muted transition-transform sm:block ${open ? "rotate-180" : ""}`} />
        </button>
        <span className="w-12 text-right text-xs tabular-nums text-muted">{l.durationSec ? clock(l.durationSec) : ""}</span>
        <button type="button" className="btn btn-ghost btn-sm !px-1.5" aria-label={`Move “${l.title}” up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-4" /></button>
        <button type="button" className="btn btn-ghost btn-sm !px-1.5" aria-label={`Move “${l.title}” down`} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown className="size-4" /></button>
      </div>
      {open ? (
        <div className="space-y-5 border-t border-line bg-surface-2/30 px-4 py-5 sm:px-10">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label" htmlFor={`lt-${l.id}`}>Lecture title</label>
              <input id={`lt-${l.id}`} className="field" defaultValue={l.title} onBlur={(e) => e.target.value.trim() && e.target.value !== l.title && patchL({ title: e.target.value.trim() }, "Lecture renamed.")} />
            </div>
            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm font-bold">
              <input type="checkbox" className="size-4 accent-[var(--violet)]" defaultChecked={l.isPreview} onChange={(e) => patchL({ isPreview: e.target.checked }, e.target.checked ? "Free preview on." : "Free preview off.")} data-testid="preview-toggle" />
              <Eye className="size-4 text-muted" />Free preview
            </label>
          </div>

          {l.type === "video" ? (
            <UploadBox compact accept="video/mp4,video/quicktime,video/webm" label={l.videoAssetId ? "Replace video" : "Upload video"} hint="MP4, MOV or WebM. Duration is read automatically after processing."
              onFile={async (f, prog) => {
                const assetId = await uploadVideo(f, prog);
                await patchL({ videoAssetId: assetId }, "Video uploaded. Processing has started.");
              }} />
          ) : null}

          {l.type === "article" ? (
            <div>
              <label className="label" htmlFor={`la-${l.id}`}>Article text (Markdown)</label>
              <textarea id={`la-${l.id}`} className="field min-h-40" defaultValue={l.articleMd ?? ""} onBlur={(e) => e.target.value !== (l.articleMd ?? "") && patchL({ articleMd: e.target.value }, "Article saved.")} />
            </div>
          ) : null}

          {l.type === "quiz" ? <QuizEditor courseId={courseId} lectureId={l.id} initial={l.quiz?.questions ?? []} run={run} /> : null}

          <div>
            <p className="label">Downloadable resources</p>
            {l.resources?.length ? (
              <ul className="mb-2 divide-y divide-line rounded-lg border border-line bg-surface">
                {l.resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Paperclip className="size-4 text-muted" /><span className="flex-1 truncate">{r.title}</span><span className="text-xs text-muted">{bytes(r.sizeBytes)}</span>
                    <button type="button" className="btn btn-ghost btn-sm !px-1.5 text-rose" aria-label={`Delete ${r.title}`} onClick={() => run(() => api(E.resource(courseId, r.id), { method: "DELETE" }), "Resource removed.")}><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
            ) : null}
            <UploadBox compact accept=".zip,.pdf,.sh,.py,.yaml,.yml,.json,.md,.txt,.tf" label="Add a lab file" hint="ZIP, PDF, scripts or config files. Only enrolled learners can download."
              onFile={async (f, prog) => { await uploadResource(f, courseId, l.id, f.name, prog); await run(async () => {}, "Resource uploaded."); }} />
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => confirm(`Delete lecture “${l.title}”?`) && run(() => api(E.lecture(courseId, l.id), { method: "DELETE" }), "Lecture deleted.")}>
              <Trash2 className="size-4" />Delete lecture
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function QuizEditor({ courseId, lectureId, initial, run }: { courseId: string; lectureId: string; initial: QuizQuestion[]; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const blank = (): QuizQuestion => ({ q: "", options: ["", "", ""], correct: 0, why: "" });
  const [qs, setQs] = useState<QuizQuestion[]>(initial.length ? initial : [blank()]);
  const upd = (i: number, p: Partial<QuizQuestion>) => setQs((x) => x.map((q, j) => (j === i ? { ...q, ...p } : q)));
  return (
    <div>
      <p className="label">Quiz questions</p>
      <p className="hint !mt-0 mb-3">3–5 scenario questions work best. Each needs 3–5 options, the correct one, and why it’s right.</p>
      <ol className="space-y-4">
        {qs.map((q, i) => (
          <li key={i} className="rounded-tile border border-line bg-surface p-4">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 font-display font-bold text-violet tabular-nums">{i + 1}.</span>
              <input aria-label={`Question ${i + 1}`} className="field" value={q.q} placeholder="A deploy fails only in production. What do you check first?" onChange={(e) => upd(i, { q: e.target.value })} />
              <button type="button" className="btn btn-ghost btn-sm mt-1 !px-1.5" aria-label={`Remove question ${i + 1}`} onClick={() => setQs((x) => x.filter((_, j) => j !== i))} disabled={qs.length === 1}><Trash2 className="size-4" /></button>
            </div>
            <fieldset className="mt-3 space-y-2 pl-6">
              <legend className="sr-only">Options for question {i + 1}</legend>
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${lectureId}-${i}`} aria-label={`Option ${oi + 1} is correct`} checked={q.correct === oi} onChange={() => upd(i, { correct: oi })} className="size-4 accent-[var(--mint)]" />
                  <input aria-label={`Option ${oi + 1}`} className="field !min-h-9 !py-1" value={o} onChange={(e) => upd(i, { options: q.options.map((x, xj) => (xj === oi ? e.target.value : x)) })} />
                </div>
              ))}
              <div className="flex gap-2">
                {q.options.length < 5 ? <button type="button" className="btn btn-ghost btn-sm text-violet" onClick={() => upd(i, { options: [...q.options, ""] })}>Add option</button> : null}
                {q.options.length > 3 ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => upd(i, { options: q.options.slice(0, -1), correct: Math.min(q.correct ?? 0, q.options.length - 2) })}>Remove last option</button> : null}
              </div>
              <input aria-label={`Why the answer to question ${i + 1} is correct`} className="field !min-h-9 !py-1" value={q.why ?? ""} placeholder="Why this answer is correct" onChange={(e) => upd(i, { why: e.target.value })} />
            </fieldset>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {qs.length < 5 ? <button type="button" className="btn btn-ghost btn-sm text-violet" onClick={() => setQs((x) => [...x, blank()])}><Plus className="size-4" />Add question</button> : null}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api(E.quiz(courseId, lectureId), { method: "PUT", body: { questions: qs } }), "Quiz saved.")}>Save quiz</button>
      </div>
    </div>
  );
}
