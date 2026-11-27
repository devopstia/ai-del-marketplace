"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj } from "@/lib/normalize";
import { useToast } from "../Toast";

interface Item { courseId: string; title: string; status: string; reason: string }
interface Candidate { id: string; title: string; status: string; own: boolean }

const MAX = 6;
const REASON_MAX = 200;

/**
 * "Related courses" (owner 2026-11-28): the courses suggested as next steps on this course's page, after its last lesson
 * and in learners' Student Studio. Not course content, so it saves at once (no review), audited on the server.
 */
export function RelatedCoursesEditor({ courseId }: { courseId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<Item[] | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([api(`/instructor/courses/${courseId}/related`), api(`/instructor/courses/${courseId}/related/candidates`)]).then(([r, c]) => {
      if (!live) return;
      setItems(list(r, "items").map((x) => { const o = obj(x); return { courseId: String(o.courseId), title: String(o.title ?? ""), status: String(o.status ?? ""), reason: String(o.reason ?? "") }; }));
      setCandidates(list(c, "items").map((x) => { const o = obj(x); return { id: String(o.id), title: String(o.title ?? ""), status: String(o.status ?? ""), own: o.own === true }; }));
    }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [courseId]);

  if (!items) return null;
  const available = candidates.filter((c) => !items.some((i) => i.courseId === c.id));
  const move = (i: number, d: -1 | 1) => setItems((cur) => { const n = [...cur!]; const t = n[i + d]; if (!t) return cur; n[i + d] = n[i]!; n[i] = t; return n; });
  const save = async () => {
    setSaving(true);
    try {
      await api(`/instructor/courses/${courseId}/related`, { method: "PUT", body: { items: items.map((i) => ({ courseId: i.courseId, ...(i.reason.trim() ? { reason: i.reason.trim() } : {}) })) } });
      toast("ok", "Related courses saved.");
    } catch (e) { toast("error", errMsg(e)); } finally { setSaving(false); }
  };

  return (
    <section aria-labelledby="related-edit-h" className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6" data-testid="related-editor">
      <h2 id="related-edit-h" className="font-display text-lg font-bold">Related courses</h2>
      <p className="mt-1 text-sm text-ink-2">Suggest up to {MAX} courses to take next. They appear at the bottom of this course&rsquo;s page, after its last lesson and in learners&rsquo; Student Studio. Learners who already own one see &ldquo;Continue learning&rdquo;. Saved at once; no review needed.</p>
      {items.length ? (
        <ol className="mt-4 space-y-3">
          {items.map((it, i) => (
            <li key={it.courseId} className="rounded-tile border border-line p-3">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 font-bold text-ink">{it.title}{it.status !== "published" ? <span className="ml-2 text-xs font-normal text-muted">(shown once published)</span> : null}</span>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Move ${it.title} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Move ${it.title} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${it.title}`} onClick={() => setItems(items.filter((x) => x.courseId !== it.courseId))}><Trash2 className="size-4" /></button>
              </div>
              <label className="sr-only" htmlFor={`reason-${it.courseId}`}>Why take it next</label>
              <input id={`reason-${it.courseId}`} className="field mt-2" maxLength={REASON_MAX} value={it.reason} placeholder="Why take it next, e.g. “Go further: AI agents and RAG on AWS”"
                onChange={(e) => setItems(items.map((x) => (x.courseId === it.courseId ? { ...x, reason: e.target.value } : x)))} />
            </li>
          ))}
        </ol>
      ) : <p className="mt-4 text-sm text-muted">No related courses yet.</p>}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="related-pick">Add a course</label>
          <select id="related-pick" className="field" value={pick} onChange={(e) => setPick(e.target.value)} disabled={items.length >= MAX || !available.length}>
            <option value="">{available.length ? "Choose a course" : "No other courses available"}</option>
            {available.map((c) => <option key={c.id} value={c.id}>{c.title}{c.status !== "published" ? " (not published yet)" : ""}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-outline" disabled={!pick || items.length >= MAX} onClick={() => { const c = candidates.find((x) => x.id === pick); if (c) setItems([...items, { courseId: c.id, title: c.title, status: c.status, reason: "" }]); setPick(""); }}>
          <Plus className="size-4" />Add
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving} data-testid="related-save">{saving ? <Loader2 className="size-4 animate-spin" /> : null}Save related courses</button>
      </div>
    </section>
  );
}
