"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj, strs } from "@/lib/normalize";
import { PageHead, useCrumb } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

interface Step { courseId: string; title: string; instructor: string; status: string; skills: string; note: string }
interface Form { title: string; slug: string; summary: string; description: string; steps: Step[] }
interface Option { id: string; title: string; instructor: string }

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const EMPTY: Form = { title: "", slug: "", summary: "", description: "", steps: [] };

function toForm(r: unknown): { form: Form; status: string; followers: number } {
  const o = obj(r);
  return {
    status: String(o.status ?? "draft"),
    followers: Number(o.followerCount ?? 0),
    form: {
      title: String(o.title ?? ""), slug: String(o.slug ?? ""), summary: String(o.summary ?? ""), description: String(o.description ?? ""),
      steps: list(o.steps).map((x) => { const s = obj(x); const c = obj(s.course); return { courseId: String(s.courseId), title: String(c.title ?? ""), instructor: String(c.instructor ?? ""), status: String(c.status ?? ""), skills: strs(s.skills).join(", "), note: String(s.note ?? "") }; }),
    },
  };
}

/** Career path editor (super admin; admins with content.manage see it read-only). docs/CAREER_PATHS.md. */
export default function PathEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const sup = !!me?.roles.includes("super_admin");
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY : null);
  const [status, setStatus] = useState("draft");
  const [followers, setFollowers] = useState(0);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  useCrumb(isNew ? "New path" : form?.title);

  useEffect(() => {
    if (isNew) return;
    api(`/admin/paths/${id}`).then((r) => { const v = toForm(r); setForm(v.form); setStatus(v.status); setFollowers(v.followers); }).catch((e) => toast("error", errMsg(e)));
  }, [id, isNew, toast]);

  useEffect(() => {
    if (!sup) return;
    const t = setTimeout(() => {
      api("/admin/paths/course-options", { query: q.trim() ? { q: q.trim() } : {} })
        .then((r) => setOptions(list(obj(r).items).map((x) => { const o = obj(x); return { id: String(o.id), title: String(o.title ?? ""), instructor: String(o.instructor ?? "") }; })))
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, sup]);

  if (!form) return <Skeleton className="h-96 max-w-4xl" />;
  const f = form;
  const set = (patch: Partial<Form>) => setForm({ ...f, ...patch });
  const setStep = (i: number, patch: Partial<Step>) => set({ steps: f.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => { const s = [...f.steps]; [s[i], s[i + d]] = [s[i + d]!, s[i]!]; set({ steps: s }); };
  const used = new Set(f.steps.map((s) => s.courseId));
  const body = () => ({
    title: f.title, slug: f.slug, summary: f.summary, description: f.description,
    steps: f.steps.map((s) => ({ courseId: s.courseId, skills: s.skills.split(",").map((x) => x.trim()).filter(Boolean), note: s.note })),
  });

  async function run(kind: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(kind);
    try {
      const r = await fn();
      toast("ok", ok);
      if (r && obj(r).id) { const v = toForm(r); setForm(v.form); setStatus(v.status); setFollowers(v.followers); }
      return r;
    } catch (e) { toast("error", errMsg(e)); return null; } finally { setBusy(null); }
  }
  async function save() {
    const r = await run("save", () => api(isNew ? "/admin/paths" : `/admin/paths/${id}`, { method: isNew ? "POST" : "PUT", body: body() }), isNew ? "Path created as a draft." : "Path saved.");
    if (r && isNew) router.replace(`/admin/paths/${String(obj(r).id)}`);
  }
  async function remove() {
    if (!confirm(`Delete ${f.title}?${followers ? ` ${followers} student${followers === 1 ? " follows" : "s follow"} it.` : ""}`)) return;
    const r = await run("delete", () => api(`/admin/paths/${id}`, { method: "DELETE" }), "Path deleted.");
    if (r) router.replace("/admin/paths");
  }

  const ro = !sup;
  return (
    <div className="max-w-4xl">
      <PageHead
        title={isNew ? "New career path" : f.title || "Career path"}
        sub={isNew ? "Saved as a draft. Publish when it has at least two published courses and a summary." : `${status === "published" ? "Published" : "Draft"}${followers ? ` · ${followers} following` : ""}`}
        actions={!isNew && status === "published" ? <a href={`/paths/${f.slug}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm"><ExternalLink className="size-4" aria-hidden="true" />Open public page</a> : null}
      />
      {ro ? <p className="mb-5 rounded-tile border border-line bg-surface-2/50 p-3 text-sm text-ink-2">Only a super admin can change career paths.</p> : null}

      <fieldset disabled={ro} className="grid gap-5 rounded-panel border border-line bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold">Name
            <input className="field font-normal" value={f.title} maxLength={80} placeholder="DevOps engineer" onChange={(e) => set({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })} />
          </label>
          <label className="grid gap-1.5 text-sm font-bold">Link
            <span className="flex items-center gap-1 font-normal"><span className="text-muted">/paths/</span><input className="field" value={f.slug} maxLength={80} onChange={(e) => { setSlugTouched(true); set({ slug: slugify(e.target.value) }); }} /></span>
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-bold">Summary <span className="font-normal text-muted">One or two sentences for cards and search results ({280 - f.summary.length} left)</span>
          <textarea className="field min-h-20 font-normal" maxLength={280} value={f.summary} onChange={(e) => set({ summary: e.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold">Description <span className="font-normal text-muted">Optional, shown on the path page (Markdown)</span>
          <textarea className="field min-h-28 font-normal" maxLength={5000} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
      </fieldset>

      <h2 className="mt-8 font-display text-lg font-bold">Courses, in order</h2>
      <fieldset disabled={ro}>
        {f.steps.length ? (
          <ol className="mt-3 grid gap-3" data-testid="path-editor-steps">
            {f.steps.map((s, i) => (
              <li key={s.courseId} className="grid gap-3 rounded-panel border border-line bg-surface p-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
                <span className="font-display text-lg font-extrabold tabular-nums text-violet">{i + 1}</span>
                <div className="grid min-w-0 gap-3">
                  <p className="font-bold">{s.title} <span className="font-normal text-muted">· {s.instructor}</span>{s.status && s.status !== "published" ? <span className="ml-2 rounded-full bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber">Not published</span> : null}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-sm"><span>Skills it gives <span className="text-muted">(comma separated)</span></span>
                    <input className="field" value={s.skills} placeholder="Docker, Containers" onChange={(e) => setStep(i, { skills: e.target.value })} />
                  </label>
                  <label className="grid gap-1 text-sm"><span>Note <span className="text-muted">(optional)</span></span>
                    <input className="field" value={s.note} maxLength={300} placeholder="Why this course comes here" onChange={(e) => setStep(i, { note: e.target.value })} />
                  </label>
                  </div>
                </div>
                {!ro ? (
                  <div className="flex gap-1 sm:flex-col">
                    <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Move ${s.title} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></button>
                    <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Move ${s.title} down`} disabled={i === f.steps.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></button>
                    <button type="button" className="btn btn-ghost btn-sm !px-2 text-rose" aria-label={`Remove ${s.title}`} onClick={() => set({ steps: f.steps.filter((_, j) => j !== i) })}><X className="size-4" /></button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : <p className="mt-2 text-ink-2">No courses yet. Add published courses below.</p>}
      </fieldset>

      {!ro ? (
        <div className="mt-4 rounded-panel border border-dashed border-line-strong p-4">
          <label htmlFor="course-search" className="text-sm font-bold">Add a published course</label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input id="course-search" className="field !pl-9" value={q} placeholder="Search course titles" onChange={(e) => setQ(e.target.value)} />
          </div>
          <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto">
            {options.filter((o) => !used.has(o.id)).map((o) => (
              <li key={o.id}>
                <button type="button" className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-surface-2" onClick={() => set({ steps: [...f.steps, { courseId: o.id, title: o.title, instructor: o.instructor, status: "published", skills: "", note: "" }] })}>
                  <Plus className="size-4 shrink-0 text-violet" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-bold">{o.title}</span>
                  <span className="shrink-0 text-sm text-muted">{o.instructor}</span>
                </button>
              </li>
            ))}
            {!options.filter((o) => !used.has(o.id)).length ? <li className="px-2 py-2.5 text-sm text-muted">No other published course matches.</li> : null}
          </ul>
        </div>
      ) : null}

      {!ro ? (
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <button type="button" className="btn btn-primary" disabled={!!busy || f.title.trim().length < 3 || f.slug.length < 3} onClick={() => void save()} data-testid="save-path">
            {busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}{isNew ? "Create draft" : "Save"}
          </button>
          {!isNew && status !== "published" ? (
            <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => void run("publish", () => api(`/admin/paths/${id}/publish`, { method: "POST" }), "Path published.")} data-testid="publish-path">Publish</button>
          ) : null}
          {!isNew && status === "published" ? (
            <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => void run("unpublish", () => api(`/admin/paths/${id}/unpublish`, { method: "POST" }), "Path unpublished. It is a draft again.")}>Unpublish</button>
          ) : null}
          {!isNew && status !== "published" ? (
            <button type="button" className="btn btn-ghost text-rose" disabled={!!busy} onClick={() => void remove()}><Trash2 className="size-4" aria-hidden="true" />Delete</button>
          ) : null}
          <Link href="/admin/paths" className="btn btn-ghost ml-auto">Back to paths</Link>
          {!isNew ? <p className="w-full text-xs text-muted">Save your changes before publishing. Publishing uses the saved version.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
