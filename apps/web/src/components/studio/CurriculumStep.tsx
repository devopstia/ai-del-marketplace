"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown, ChevronsDownUp, ChevronsUpDown, ExternalLink, Eye, FileArchive, FileText, FileType2, Film, GripVertical, ListChecks,
  Loader2, Package, Paperclip, PlayCircle, Plus, Search, Trash2, UploadCloud,
} from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { E } from "@/lib/studio-endpoints";
import { bytes, clock, plural } from "@/lib/format";
import type { QuizQuestion, ResourceItem, StudioLecture, StudioSection } from "@/lib/types";
import type { EditorCtx } from "./CourseEditor";
import { StepFooter } from "./CourseEditor";
import { UploadBox } from "./UploadBox";
import { DraftPreview } from "./DraftPreview";
import { uploadResource, uploadVideo } from "./upload";
import { StatusBadge } from "../StatusBadge";
import { useToast } from "../Toast";

/**
 * Curriculum editor (owner 2026-11-25): the whole course on one screen. Drag sections and lessons (also between
 * sections) with the handle, the mouse, touch or the keyboard; upload a lesson's video straight from its row, drop
 * several videos on a section to create one lesson each, attach lesson files (ZIP, PDF, Word, configs), and manage
 * the complete course package. One drag = one save of the whole order (PUT /curriculum); published courses change
 * only in the draft until an admin approves.
 */
const typeIcon = { video: PlayCircle, article: FileText, quiz: ListChecks } as const;
const VIDEO_TYPES = "video/mp4,video/quicktime,video/webm";
const FILE_TYPES = ".zip,.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.csv,.md,.txt,.sh,.py,.js,.ts,.json,.yaml,.yml,.tf,.env.example,.ipynb,.sql,.conf,.ini,.toml,.png,.jpg";
const sid = (id: string) => `sec:${id}`;
const lid = (id: string) => `lec:${id}`;
const raw = (id: string) => id.slice(4);

type Uploads = Record<string, { name: string; pct: number; error?: string }>;

function fileKind(r: ResourceItem) {
  const n = r.title.toLowerCase();
  if (r.mime.includes("zip") || n.endsWith(".zip")) return { label: "ZIP", icon: FileArchive };
  if (r.mime.includes("pdf") || n.endsWith(".pdf")) return { label: "PDF", icon: FileType2 };
  if (n.endsWith(".doc") || n.endsWith(".docx") || r.mime.includes("word")) return { label: "Word", icon: FileText };
  return { label: n.split(".").pop()?.toUpperCase().slice(0, 5) || "File", icon: Paperclip };
}
const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/^\d+\s*/, "").trim().replace(/^./, (c) => c.toUpperCase()) || "New lesson";

export function CurriculumStep({ course, reload, goto, locked }: EditorCtx) {
  const toast = useToast();
  const [sections, setSections] = useState<StudioSection[]>(course.sections);
  const [synced, setSynced] = useState(course.sections);
  const [open, setOpen] = useState<Set<string>>(() => new Set(course.sections.reduce((n, s) => n + s.lectures.length, 0) <= 40 ? course.sections.map((s) => s.id) : course.sections.slice(0, 1).map((s) => s.id)));
  const [edit, setEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<Uploads>({});
  const [active, setActive] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const before = useRef<StudioSection[] | null>(null);
  if (synced !== course.sections) {
    // Server copy changed (after a save or reload): adopt it, and open any section that just appeared.
    const fresh = course.sections.filter((x) => !synced.some((y) => y.id === x.id)).map((x) => x.id);
    setSynced(course.sections);
    setSections(course.sections);
    if (fresh.length) setOpen((o) => new Set([...o, ...fresh]));
  }

  // Keep processing videos fresh until they're ready.
  const processing = sections.some((s) => s.lectures.some((l) => l.videoStatus === "processing" || l.videoStatus === "uploading"));
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void reload(), 6000);
    return () => clearInterval(t);
  }, [processing, reload]);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try { await fn(); await reload(); if (ok) toast("ok", ok); }
    catch (e) { toast("error", errMsg(e)); }
    finally { setBusy(false); }
  }

  async function saveLayout(next: StudioSection[]) {
    setSections(next);
    setBusy(true);
    try {
      await api(`${E.course(course.id)}/curriculum`, { method: "PUT", body: { sections: next.map((s) => ({ id: s.id, lectureIds: s.lectures.map((l) => l.id) })) } });
      await reload();
    } catch (e) {
      toast("error", `${errMsg(e)} The previous order was kept.`);
      await reload();
    } finally { setBusy(false); }
  }

  /** Video for one lesson, with its progress shown on the lesson row. */
  async function uploadLessonVideo(lectureId: string, f: File) {
    setUploads((u) => ({ ...u, [lectureId]: { name: f.name, pct: 0 } }));
    try {
      const assetId = await uploadVideo(f, (p) => setUploads((u) => ({ ...u, [lectureId]: { name: f.name, pct: p } })), { courseId: course.id });
      await api(E.lecture(course.id, lectureId), { method: "PATCH", body: { videoAssetId: assetId } });
      setUploads((u) => { const n = { ...u }; delete n[lectureId]; return n; });
      await reload();
      toast("ok", `${f.name} uploaded. Processing has started.`);
    } catch (e) {
      setUploads((u) => ({ ...u, [lectureId]: { name: f.name, pct: 0, error: errMsg(e) } }));
    }
  }

  /** Several videos dropped on a section: one new lesson per file, in file-name order, uploaded one after another. */
  async function addVideoLessons(sectionId: string, files: File[]) {
    const vids = files.filter((f) => f.type.startsWith("video/")).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (!vids.length) { toast("error", "Drop MP4, MOV or WebM video files."); return; }
    for (const f of vids) {
      try {
        const r = obj(await api(E.lectures(course.id, sectionId), { method: "POST", body: { title: titleFromFile(f.name), type: "video" } }));
        const id = String(r.id ?? obj(r.lecture).id ?? "");
        await reload();
        if (id) await uploadLessonVideo(id, f);
      } catch (e) { toast("error", `${f.name}: ${errMsg(e)}`); }
    }
  }

  // ---------- drag and drop ----------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sectionOf = (id: string, list = sections) => list.find((s) => sid(s.id) === id || s.lectures.some((l) => lid(l.id) === id));
  function onDragStart(e: DragStartEvent) { setActive(String(e.active.id)); before.current = sections; }
  function onDragOver(e: DragOverEvent) {
    const a = String(e.active.id), o = e.over ? String(e.over.id) : null;
    if (!o || !a.startsWith("lec:")) return;
    const from = sectionOf(a), to = o.startsWith("drop:") ? sections.find((s) => s.id === o.slice(5)) : sectionOf(o);
    if (!from || !to || from.id === to.id) return;
    // Move the lesson into the other section while hovering, so the list opens a gap where it will land.
    setSections((list) => {
      const l = from.lectures.find((x) => lid(x.id) === a)!;
      const idx = o.startsWith("lec:") ? to.lectures.findIndex((x) => lid(x.id) === o) : to.lectures.length;
      return list.map((s) => (s.id === from.id ? { ...s, lectures: s.lectures.filter((x) => x.id !== l.id) } : s.id === to.id ? { ...s, lectures: [...s.lectures.slice(0, Math.max(0, idx)), l, ...s.lectures.slice(Math.max(0, idx))] } : s));
    });
    setOpen((x) => new Set([...x, to.id]));
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const a = String(e.active.id), o = e.over ? String(e.over.id) : null;
    const start = before.current; before.current = null;
    if (!o) { if (start) setSections(start); return; }
    let next = sections;
    if (a.startsWith("sec:")) {
      const target = o.startsWith("sec:") ? o : sid(sectionOf(o)?.id ?? "");
      const i = sections.findIndex((s) => sid(s.id) === a), j = sections.findIndex((s) => sid(s.id) === target);
      if (i < 0 || j < 0) return;
      next = arrayMove(sections, i, j);
    } else {
      const s = sectionOf(a);
      if (s && o.startsWith("lec:") && sectionOf(o)?.id === s.id) {
        const i = s.lectures.findIndex((x) => lid(x.id) === a), j = s.lectures.findIndex((x) => lid(x.id) === o);
        next = sections.map((x) => (x.id === s.id ? { ...x, lectures: arrayMove(x.lectures, i, j) } : x));
      }
    }
    const order = (list: StudioSection[] | null) => JSON.stringify(list?.map((s) => [s.id, s.lectures.map((l) => l.id)]));
    if (order(next) !== order(start)) void saveLayout(next);
  }

  const totalLectures = sections.reduce((a, s) => a + s.lectures.length, 0);
  const totalSec = sections.reduce((a, s) => a + s.lectures.reduce((b, l) => b + l.durationSec, 0), 0);
  const missingVideo = sections.reduce((a, s) => a + s.lectures.filter((l) => l.type === "video" && !l.videoAssetId).length, 0);
  const withFiles = sections.reduce((a, s) => a + s.lectures.filter((l) => l.resources?.length).length, 0);
  const numbering = useMemo(() => { let n = 0; const m = new Map<string, number>(); sections.forEach((s) => s.lectures.forEach((l) => m.set(l.id, ++n))); return m; }, [sections]);
  const needle = q.trim().toLowerCase();
  const dragging = active ? (active.startsWith("sec:") ? sections.find((s) => sid(s.id) === active)?.title : sections.flatMap((s) => s.lectures).find((l) => lid(l.id) === active)?.title) : null;
  // The live course opens in the player; draft changes of a live course open in the studio preview (owner only).
  const canPreview = course.version !== "draft";

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">Curriculum</h2>
          <p className="mt-1 text-sm text-ink-2">{plural(sections.length, "section")} · {plural(totalLectures, "lesson")} · {clock(totalSec)} of video · {withFiles} with lesson files{missingVideo ? <> · <span className="font-bold text-amber">{plural(missingVideo, "lesson")} without a video</span></> : null}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy ? <span className="flex items-center gap-1.5 text-sm text-muted" role="status"><Loader2 className="size-4 animate-spin text-violet" />Saving</span> : null}
          {canPreview ? <Link href={`/learn/${course.slug}`} target="_blank" className="btn btn-outline btn-sm" data-testid="preview-course"><Eye className="size-4" />Preview as a student</Link> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-tile border border-line bg-surface-2/50 px-4 py-3 text-sm text-ink-2 sm:grid-cols-3">
        <p className="flex gap-2"><GripVertical className="mt-0.5 size-4 shrink-0 text-violet" /><span><b className="text-ink">Drag</b> the handle to reorder sections and lessons, or to move a lesson to another section.</span></p>
        <p className="flex gap-2"><Film className="mt-0.5 size-4 shrink-0 text-violet" /><span><b className="text-ink">Upload video</b> on each lesson row, or drop several videos on a section to create one lesson per file.</span></p>
        <p className="flex gap-2"><Paperclip className="mt-0.5 size-4 shrink-0 text-violet" /><span><b className="text-ink">Lesson files</b> (ZIP, PDF, Word, configs) belong to the lesson where learners need them.</span></p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {totalLectures > 12 ? (
          <span className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input type="search" aria-label="Find a lesson" className="field !pl-9" placeholder="Find a lesson" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value) setOpen(new Set(sections.map((s) => s.id))); }} />
          </span>
        ) : <span className="flex-1" />}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(new Set(sections.map((s) => s.id)))}><ChevronsUpDown className="size-4" />Expand all</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(new Set())}><ChevronsDownUp className="size-4" />Collapse all</button>
      </div>

      <fieldset disabled={locked} className="mt-4 min-w-0 space-y-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActive(null); if (before.current) setSections(before.current); }}
          accessibility={{ screenReaderInstructions: { draggable: "Press space to pick up. Use the arrow keys to move, space to drop, escape to cancel." } }}>
          <SortableContext items={sections.map((s) => sid(s.id))} strategy={verticalListSortingStrategy}>
            {sections.map((s, si) => (
              <SectionCard key={s.id} s={s} index={si} open={open.has(s.id)} locked={locked}
                onToggle={() => setOpen((x) => { const n = new Set(x); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                onRename={(t) => run(() => api(E.section(course.id, s.id), { method: "PATCH", body: { title: t } }), "Section renamed.")}
                onDelete={() => confirm(`Delete “${s.title}” and its ${s.lectures.length} lessons? Their videos stay in your uploads.`) && run(() => api(E.section(course.id, s.id), { method: "DELETE" }), "Section deleted.")}
                onDropVideos={(files) => void addVideoLessons(s.id, files)}
                onAdd={(title, type) => run(() => api(E.lectures(course.id, s.id), { method: "POST", body: { title, type } }), "Lesson added.")}>
                <SortableContext items={s.lectures.map((l) => lid(l.id))} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-line" data-testid="lesson-list">
                    {s.lectures.filter((l) => !needle || l.title.toLowerCase().includes(needle)).map((l) => (
                      <LessonRow key={l.id} courseId={course.id} slug={course.slug} l={l} n={numbering.get(l.id) ?? 0} editing={edit === l.id} canPreview={canPreview} locked={locked}
                        onPreview={() => setPreview(l.id)} upload={uploads[l.id]} onEdit={() => setEdit((x) => (x === l.id ? null : l.id))} onVideo={(f) => void uploadLessonVideo(l.id, f)} run={run} />
                    ))}
                    {!s.lectures.length ? <EmptyDrop sectionId={s.id} /> : null}
                  </ul>
                </SortableContext>
              </SectionCard>
            ))}
          </SortableContext>
          <DragOverlay>{dragging ? <div className="rounded-tile border border-violet bg-surface px-4 py-2.5 font-bold shadow-float">{dragging}</div> : null}</DragOverlay>
        </DndContext>
        <AddSection onAdd={(title) => run(() => api(E.sections(course.id), { method: "POST", body: { title } }), "Section added.")} />
      </fieldset>

      <CoursePackage courseId={course.id} locked={locked} />
      {!canPreview ? <DraftPreview courseId={course.id} lectureId={preview} onClose={() => setPreview(null)} /> : null}
      <StepFooter next="pricing" goto={goto} />
    </div>
  );
}

function EmptyDrop({ sectionId }: { sectionId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop:${sectionId}` });
  return <li ref={setNodeRef} className={`px-4 py-6 text-center text-sm ${isOver ? "bg-violet-soft text-violet" : "text-muted"}`}>No lessons yet. Add one below, drop videos here, or drag a lesson in.</li>;
}

function SectionCard({ s, index, open, locked, onToggle, onRename, onDelete, onDropVideos, onAdd, children }: {
  s: StudioSection; index: number; open: boolean; locked: boolean; onToggle: () => void; onRename: (t: string) => void; onDelete: () => void;
  onDropVideos: (f: File[]) => void; onAdd: (t: string, type: StudioLecture["type"]) => void; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: sid(s.id), disabled: locked });
  const [fileOver, setFileOver] = useState(false);
  const dur = s.lectures.reduce((a, l) => a + l.durationSec, 0);
  return (
    <section ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} aria-label={`Section ${index + 1}: ${s.title}`} data-testid="curriculum-section"
      className={`rounded-panel border bg-surface ${isDragging ? "border-violet opacity-60" : "border-line"} ${fileOver ? "ring-2 ring-violet" : ""}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setFileOver(true); } }}
      onDragLeave={() => setFileOver(false)}
      onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setFileOver(false); if (!locked) onDropVideos(Array.from(e.dataTransfer.files)); }}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink active:cursor-grabbing" aria-label={`Drag section ${s.title}`} data-testid="section-handle"><GripVertical className="size-4" /></button>
        <button type="button" onClick={onToggle} aria-expanded={open} className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink" aria-label={open ? `Collapse ${s.title}` : `Expand ${s.title}`}><ChevronDown className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`} /></button>
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted">Section {index + 1}</span>
        <input aria-label={`Section ${index + 1} title`} defaultValue={s.title} key={s.title} className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-display font-bold text-ink hover:border-line focus:border-violet focus:outline-none"
          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.title) onRename(v); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <span className="hidden shrink-0 text-xs tabular-nums text-muted sm:inline">{plural(s.lectures.length, "lesson")}{dur ? ` · ${clock(dur)}` : ""}</span>
        <button type="button" className="btn btn-ghost btn-sm !px-2 text-rose" aria-label={`Delete section ${s.title}`} onClick={onDelete}><Trash2 className="size-4" /></button>
      </div>
      {open ? (
        <>
          <div className="border-t border-line">{children}</div>
          <AddLecture onAdd={onAdd} onFiles={onDropVideos} />
        </>
      ) : null}
    </section>
  );
}

function AddLecture({ onAdd, onFiles }: { onAdd: (t: string, type: StudioLecture["type"]) => void; onFiles: (f: File[]) => void }) {
  const [t, setT] = useState("");
  const [type, setType] = useState<StudioLecture["type"]>("video");
  const input = useRef<HTMLInputElement>(null);
  return (
    <form className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-3 py-3" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim(), type); setT(""); } }}>
      <input aria-label="New lesson title" className="field !min-h-10 min-w-0 flex-1 basis-full sm:basis-0" placeholder="New lesson title" value={t} onChange={(e) => setT(e.target.value)} />
      <select aria-label="Lesson type" className="field !min-h-10 !w-auto" value={type} onChange={(e) => setType(e.target.value as StudioLecture["type"])}>
        <option value="video">Video</option><option value="article">Article</option><option value="quiz">Quiz</option>
      </select>
      <button className="btn btn-outline btn-sm !min-h-10" data-testid="add-lecture"><Plus className="size-4" />Add lesson</button>
      <button type="button" className="btn btn-ghost btn-sm !min-h-10" onClick={() => input.current?.click()} data-testid="add-videos"><UploadCloud className="size-4" />Add videos</button>
      <input ref={input} type="file" multiple accept={VIDEO_TYPES} className="sr-only" tabIndex={-1} aria-label="Add videos as new lessons" onChange={(e) => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); e.target.value = ""; }} />
    </form>
  );
}

function LessonRow({ courseId, slug, l, n, editing, canPreview, locked, upload, onEdit, onVideo, onPreview, run }: {
  courseId: string; slug: string; l: StudioLecture; n: number; editing: boolean; canPreview: boolean; locked: boolean; upload?: Uploads[string]; onPreview: () => void;
  onEdit: () => void; onVideo: (f: File) => void; run: (fn: () => Promise<unknown>, ok?: string) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: lid(l.id), disabled: locked });
  const Icon = typeIcon[l.type];
  const video = useRef<HTMLInputElement>(null);
  const patchL = (body: Record<string, unknown>, ok?: string) => run(() => api(E.lecture(courseId, l.id), { method: "PATCH", body }), ok);
  const files = l.resources ?? [];
  const kinds = Array.from(new Set(files.map((r) => fileKind(r).label)));
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? "relative z-10 bg-surface-2 opacity-70" : ""} data-testid="lesson-row">
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} className="grid size-8 shrink-0 cursor-grab place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink active:cursor-grabbing" aria-label={`Drag lesson ${l.title}`} data-testid="lesson-handle"><GripVertical className="size-4" /></button>
        <span className="w-7 shrink-0 text-right text-xs font-bold tabular-nums text-muted">{n}</span>
        <Icon className="size-4 shrink-0 text-muted" aria-label={l.type} />
        <button type="button" onClick={onEdit} aria-expanded={editing} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-1 text-left">
          <span className="min-w-0 font-bold">{l.title}</span>
          {l.type === "video" ? (l.videoAssetId ? (l.videoStatus && l.videoStatus !== "ready" ? <StatusBadge status={l.videoStatus} /> : null) : !upload ? <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber">No video yet</span> : null) : null}
          {kinds.map((k) => <span key={k} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-2">+ {k}</span>)}
          {l.isPreview ? <span className="rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-mint">Free preview</span> : null}
        </button>
        <span className="hidden w-12 shrink-0 text-right text-xs tabular-nums text-muted sm:inline">{l.durationSec ? clock(l.durationSec) : ""}</span>
        {l.type === "video" ? (
          <>
            <button type="button" className={`btn btn-sm shrink-0 ${l.videoAssetId ? "btn-ghost" : "btn-outline"}`} onClick={() => video.current?.click()} disabled={!!upload && !upload.error} data-testid="row-upload-video">
              <UploadCloud className="size-4" /><span className="max-sm:sr-only">{l.videoAssetId ? "Replace" : "Upload video"}</span>
            </button>
            <input ref={video} type="file" accept={VIDEO_TYPES} className="sr-only" tabIndex={-1} aria-label={`Video for ${l.title}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideo(f); e.target.value = ""; }} />
          </>
        ) : null}
        {canPreview && (l.type !== "video" || l.videoStatus === "ready") ? <Link href={`/learn/${slug}/${l.id}`} target="_blank" className="btn btn-ghost btn-sm !px-2 max-sm:hidden" aria-label={`Preview ${l.title}`} title="Preview as a student"><ExternalLink className="size-4" /></Link>
          : !canPreview ? <button type="button" onClick={onPreview} className="btn btn-ghost btn-sm !px-2" aria-label={`Preview ${l.title} (draft)`} title="Preview your changes" data-testid="draft-preview-lesson"><Eye className="size-4" /></button> : null}
        <button type="button" onClick={onEdit} className="btn btn-ghost btn-sm !px-2" aria-label={editing ? `Close ${l.title}` : `Edit ${l.title}`}><ChevronDown className={`size-4 transition-transform ${editing ? "rotate-180" : ""}`} /></button>
      </div>
      {upload ? (
        <div className="px-3 pb-3 sm:pl-[5.5rem]" role="status">
          {upload.error ? (
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-rose">Upload of {upload.name} failed: {upload.error} <button type="button" className="btn btn-outline btn-sm" onClick={() => video.current?.click()}>Try again</button></p>
          ) : (
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(upload.pct * 100)} aria-label={`Uploading ${upload.name}`}>
              <div className="flex justify-between text-xs text-muted"><span className="truncate">Uploading {upload.name}</span><span className="tabular-nums">{Math.round(upload.pct * 100)}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gradient-to-r from-violet to-cyan transition-[width]" style={{ width: `${Math.round(upload.pct * 100)}%` }} /></div>
            </div>
          )}
        </div>
      ) : null}
      {editing ? (
        <div className="space-y-5 border-t border-line bg-surface-2/30 px-4 py-5 sm:px-12">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label" htmlFor={`lt-${l.id}`}>Lesson title</label>
              <input id={`lt-${l.id}`} className="field" defaultValue={l.title} onBlur={(e) => e.target.value.trim() && e.target.value !== l.title && patchL({ title: e.target.value.trim() }, "Lesson renamed.")} />
            </div>
            <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm font-bold">
              <input type="checkbox" className="size-4 accent-[var(--violet)]" defaultChecked={l.isPreview} onChange={(e) => patchL({ isPreview: e.target.checked }, e.target.checked ? "Free preview on." : "Free preview off.")} data-testid="preview-toggle" />
              <Eye className="size-4 text-muted" />Free preview
            </label>
          </div>

          {l.type === "video" ? (
            <UploadBox compact accept={VIDEO_TYPES} label={l.videoAssetId ? "Replace this lesson’s video" : "Upload this lesson’s video"} hint="MP4, MOV or WebM. The length is read automatically after processing."
              onFile={async (f) => { onVideo(f); }} />
          ) : null}

          {l.type === "article" ? (
            <div>
              <label className="label" htmlFor={`la-${l.id}`}>Article text (Markdown)</label>
              <textarea id={`la-${l.id}`} className="field min-h-40" defaultValue={l.articleMd ?? ""} onBlur={(e) => e.target.value !== (l.articleMd ?? "") && patchL({ articleMd: e.target.value }, "Article saved.")} />
            </div>
          ) : null}

          {l.type === "quiz" ? <QuizEditor courseId={courseId} lectureId={l.id} initial={l.quiz?.questions ?? []} run={run} /> : null}

          <div>
            <p className="label">Lesson files</p>
            <p className="hint !mt-0 mb-2">What learners need to follow this lesson: the demo code (ZIP), instructions (PDF), notes (Word), configuration files. Only enrolled learners can download them.</p>
            {files.length ? (
              <ul className="mb-2 divide-y divide-line rounded-lg border border-line bg-surface" data-testid="lesson-files">
                {files.map((r) => {
                  const k = fileKind(r);
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <k.icon className="size-4 text-violet" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{r.title}</span><span className="text-xs text-muted">{k.label} · {bytes(r.sizeBytes)}</span>
                      <button type="button" className="btn btn-ghost btn-sm !px-1.5 text-rose" aria-label={`Delete ${r.title}`} onClick={() => run(() => api(E.resource(courseId, r.id), { method: "DELETE" }), "File removed.")}><Trash2 className="size-4" /></button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <MultiFileUpload label="Add lesson files" onFile={(f, p) => uploadResource(f, courseId, l.id, f.name, p)} after={() => run(async () => {}, "Files added to the lesson.")} />
          </div>

          <div className="flex justify-end border-t border-line pt-4">
            <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => confirm(`Delete lesson “${l.title}”?`) && run(() => api(E.lecture(courseId, l.id), { method: "DELETE" }), "Lesson deleted.")}>
              <Trash2 className="size-4" />Delete lesson
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Several files at once, one after another, each with its own progress and error. */
function MultiFileUpload({ label, onFile, after, accept = FILE_TYPES }: { label: string; onFile: (f: File, p: (x: number) => void) => Promise<unknown>; after: () => void; accept?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<{ name: string; pct: number; error?: string; done?: boolean }[]>([]);
  const [over, setOver] = useState(false);
  async function handle(list: File[]) {
    if (!list.length) return;
    setItems(list.map((f) => ({ name: f.name, pct: 0 })));
    for (const [i, f] of list.entries()) {
      try {
        if (f.size > 200 * 1024 * 1024) throw new Error("larger than 200 MB");
        await onFile(f, (p) => setItems((x) => x.map((y, j) => (j === i ? { ...y, pct: p } : y))));
        setItems((x) => x.map((y, j) => (j === i ? { ...y, pct: 1, done: true } : y)));
      } catch (e) { setItems((x) => x.map((y, j) => (j === i ? { ...y, error: errMsg(e) } : y))); }
    }
    after();
  }
  const busy = items.some((x) => !x.done && !x.error);
  return (
    <div onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); if (!busy) void handle(Array.from(e.dataTransfer.files)); }}
      className={`rounded-tile border-[1.5px] border-dashed p-3 ${over ? "border-violet bg-violet-soft" : "border-line-strong"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Paperclip className="size-5 shrink-0 text-violet" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm"><b>{label}</b><span className="block text-xs text-muted">Drop files here or choose several at once. Up to 200 MB each.</span></p>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}Choose files</button>
        <input ref={input} type="file" multiple accept={accept} className="sr-only" tabIndex={-1} aria-label={label} onChange={(e) => { void handle(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>
      {items.length ? (
        <ul className="mt-3 space-y-1.5 text-xs">
          {items.map((x, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{x.name}</span>
              {x.error ? <span className="font-bold text-rose">{x.error}</span> : x.done ? <span className="font-bold text-mint">Uploaded</span> : <span className="tabular-nums text-muted">{Math.round(x.pct * 100)}%</span>}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Complete course package: course-level downloads (all the code and docs in one place), on top of lesson files. */
function CoursePackage({ courseId, locked }: { courseId: string; locked: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<ResourceItem[] | null>(null);
  const load = () => api(`${E.course(courseId)}/package`).then((r) => setItems((obj(r).items as ResourceItem[]) ?? [])).catch(() => setItems([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [courseId]);
  async function addOne(f: File, p: (x: number) => void) {
    const r = obj(await api(E.uploadResource, { method: "POST", body: { filename: f.name, contentType: f.type || "application/octet-stream", sizeBytes: f.size, courseId } }));
    const { uploadFile } = await import("@/lib/api");
    await uploadFile(String(r.uploadUrl ?? r.url), f, p, "PUT", (obj(r.headers) as Record<string, string>) ?? {});
    await api(`${E.course(courseId)}/package`, { method: "POST", body: { title: f.name, storageKey: String(r.storageKey ?? r.key) } });
  }
  return (
    <section className="mt-10 rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="pkg-h" data-testid="course-package">
      <div className="flex items-start gap-3">
        <Package className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" />
        <div>
          <h3 id="pkg-h" className="font-display text-lg font-bold">Complete course package <span className="text-sm font-normal text-muted">(optional)</span></h3>
          <p className="mt-1 text-sm text-ink-2">One download with everything from the course, for learners who want it all at the end. It adds to the lesson files; it doesn’t replace them. Changes here apply right away.</p>
        </div>
      </div>
      {items?.length ? (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {items.map((r) => {
            const k = fileKind(r);
            return (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <k.icon className="size-4 text-violet" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{r.title}</span><span className="text-xs text-muted">{bytes(r.sizeBytes)}</span>
                <button type="button" className="btn btn-ghost btn-sm !px-1.5 text-rose" disabled={locked} aria-label={`Remove ${r.title}`} onClick={async () => { try { await api(`${E.course(courseId)}/package/${r.id}`, { method: "DELETE" }); await load(); } catch (e) { toast("error", errMsg(e)); } }}><Trash2 className="size-4" /></button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {!locked ? <div className="mt-4"><MultiFileUpload label="Add package files" onFile={addOne} after={() => void load()} /></div> : null}
    </section>
  );
}

function AddSection({ onAdd }: { onAdd: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <form className="flex flex-wrap gap-2 rounded-panel border-[1.5px] border-dashed border-line-strong p-4" onSubmit={(e) => { e.preventDefault(); if (t.trim()) { onAdd(t.trim()); setT(""); } }}>
      <label htmlFor="new-section" className="sr-only">New section title</label>
      <input id="new-section" className="field min-w-0 flex-1 basis-full sm:basis-0" placeholder="New section title, e.g. “Deploy n8n with Docker Compose”" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn btn-primary" data-testid="add-section"><Plus className="size-4" />Add section</button>
    </form>
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
