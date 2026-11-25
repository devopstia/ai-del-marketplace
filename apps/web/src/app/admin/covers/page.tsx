"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";
import { api, ensureCsrf, errMsg } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";

type Group = "generic" | "ai" | "it" | "devops";
interface Palette { bg: [string, string]; ink: string; a: string; b: string; tone: "dark" | "light" }
interface Tpl { id: string; key: string; name: string; layout: string; motif: string; palette: Palette; topics: string[]; group: Group; active: boolean; sort: number; builtIn: boolean; courseCount: number }
interface Data { layouts: string[]; motifs: string[]; items: Tpl[] }

const arr = (x: unknown) => (Array.isArray(x) ? x : []);
const toData = (r: unknown): Data => {
  const o = obj(r);
  return {
    layouts: arr(o.layouts).map(String),
    motifs: arr(o.motifs).map(String),
    items: arr(o.items).map((t) => {
      const x = obj(t);
      const p = obj(x.palette);
      return {
        id: String(x.id), key: String(x.key), name: String(x.name), layout: String(x.layout), motif: String(x.motif),
        palette: { bg: (arr(p.bg).map(String).slice(0, 2) as [string, string]), ink: String(p.ink), a: String(p.a), b: String(p.b), tone: p.tone === "light" ? "light" : "dark" },
        topics: arr(x.topics).map(String), group: (x.group as Group) ?? "generic", active: !!x.active, sort: Number(x.sort ?? 0), builtIn: !!x.builtIn, courseCount: Number(x.courseCount ?? 0),
      };
    }),
  };
};
const FILTERS: [string, string][] = [["all", "All"], ["generic", "Generic"], ["ai", "AI"], ["it", "IT and infrastructure"], ["devops", "DevOps"], ["inactive", "Inactive"]];
const SAMPLE = "Your course title goes here";

/** Template editor with a live preview drawn by the same server renderer. */
function Editor({ edit, data, onDone, onClose }: { edit?: Tpl; data: Data; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const base = edit ?? data.items[0];
  const [name, setName] = useState(edit?.name ?? "");
  const [layout, setLayout] = useState(base?.layout ?? "statement");
  const [motif, setMotif] = useState(base?.motif ?? "waves");
  const [pal, setPal] = useState<Palette>(base?.palette ?? { bg: ["#141833", "#231c63"], ink: "#f2f1ff", a: "#9d8fff", b: "#58c3f2", tone: "dark" });
  const [topics, setTopics] = useState((edit?.topics ?? ["general"]).join(", "));
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hexOk = (v: string) => /^#[0-9a-f]{6}$/i.test(v);
  const valid = name.trim().length >= 2 && [...pal.bg, pal.ink, pal.a, pal.b].every(hexOk);

  useEffect(() => {
    if (![...pal.bg, pal.ink, pal.a, pal.b].every(hexOk)) return;
    let url: string | null = null;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/admin/cover-templates/preview`, {
          method: "POST", credentials: "include", signal: ctrl.signal,
          headers: { "Content-Type": "application/json", "X-CSRF-Token": (await ensureCsrf()) ?? "" },
          body: JSON.stringify({ layout, motif, palette: pal, title: SAMPLE, topic: "Topic", w: 960 }),
        });
        if (r.ok) { url = URL.createObjectURL(await r.blob()); setSrc(url); }
      } catch { /* superseded or offline: keep the last preview */ }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); if (url) URL.revokeObjectURL(url); };
  }, [layout, motif, pal]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const body = { name: name.trim(), layout, motif, palette: pal, topics: topics.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      if (edit) {
        const r = obj(await api(`/admin/cover-templates/${edit.id}`, { method: "PATCH", body }));
        toast("ok", Number(r.coursesRegenerated) ? `Template saved; ${r.coursesRegenerated} course covers regenerated.` : "Template saved.");
      } else {
        await api("/admin/cover-templates", { method: "POST", body });
        toast("ok", "Template added. Instructors can pick it now.");
      }
      onDone();
    } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
  }
  const colour = (label: string, value: string, set: (v: string) => void) => (
    <label className="grid gap-1 text-sm">
      <span className="font-bold text-ink-2">{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" value={hexOk(value) ? value : "#000000"} onChange={(e) => set(e.target.value)} className="h-9 w-11 cursor-pointer rounded border border-line bg-surface p-0.5" aria-label={`${label} colour`} />
        <input className="field !min-h-9 !py-1 font-mono text-sm" value={value} onChange={(e) => set(e.target.value)} aria-invalid={!hexOk(value)} aria-label={`${label} hex value`} />
      </span>
    </label>
  );

  return (
    <form onSubmit={save} className="mb-8 rounded-panel border border-line bg-surface p-5 sm:p-6" data-testid="template-editor">
      <h2 className="font-display text-xl font-bold">{edit ? `Edit “${edit.name}”` : "New cover template"}</h2>
      {edit?.courseCount ? <p className="mt-1 text-sm text-ink-2">{edit.courseCount} {edit.courseCount === 1 ? "course uses" : "courses use"} this template; their covers are regenerated when you save.</p> : null}
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="aspect-video overflow-hidden rounded-tile border border-line bg-sunken">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {src ? <img src={src} alt="Live preview" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm text-muted">Preview loading…</div>}
          </div>
          <p className="hint">Live preview with a sample title. Real covers use each course’s title and topic.</p>
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <label className="grid gap-1 text-sm"><span className="font-bold text-ink-2">Name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Waves teal" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm"><span className="font-bold text-ink-2">Layout</span><select className="field" value={layout} onChange={(e) => setLayout(e.target.value)}>{data.layouts.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>
            <label className="grid gap-1 text-sm"><span className="font-bold text-ink-2">Design</span><select className="field" value={motif} onChange={(e) => setMotif(e.target.value)}>{data.motifs.map((m) => <option key={m} value={m}>{m}</option>)}</select></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {colour("Background from", pal.bg[0], (v) => setPal({ ...pal, bg: [v, pal.bg[1]] }))}
            {colour("Background to", pal.bg[1], (v) => setPal({ ...pal, bg: [pal.bg[0], v] }))}
            {colour("Title", pal.ink, (v) => setPal({ ...pal, ink: v }))}
            {colour("Accent", pal.a, (v) => setPal({ ...pal, a: v }))}
            {colour("Second accent", pal.b, (v) => setPal({ ...pal, b: v }))}
            <label className="grid gap-1 text-sm"><span className="font-bold text-ink-2">Ground</span><select className="field" value={pal.tone} onChange={(e) => setPal({ ...pal, tone: e.target.value as Palette["tone"] })}><option value="dark">Dark</option><option value="light">Light</option></select></label>
          </div>
          <label className="grid gap-1 text-sm"><span className="font-bold text-ink-2">Suggested for topics</span><input className="field" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="topic slugs, comma separated, e.g. kubernetes, cloud-ai" /><span className="hint">Courses in these topics see this template first. Use “general” for any course.</span></label>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" disabled={busy || !valid} data-testid="save-template">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{edit ? "Save template" : "Add template"}</button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function AdminCovers() {
  const toast = useToast();
  const { me } = useAuth();
  const canEdit = !!me?.roles.includes("super_admin");
  const { data, reload } = useApi("/admin/cover-templates", toData);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState<null | "new" | Tpl>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (filter === "inactive") return all.filter((t) => !t.active);
    return filter === "all" ? all : all.filter((t) => t.group === filter);
  }, [data, filter]);
  const counts = useMemo(() => ({ total: data?.items.length ?? 0, active: data?.items.filter((t) => t.active).length ?? 0, used: data?.items.reduce((n, t) => n + t.courseCount, 0) ?? 0 }), [data]);

  async function patch(t: Tpl, body: object, ok: string) {
    setBusy(t.id);
    try {
      const r = obj(await api(`/admin/cover-templates/${t.id}`, { method: "PATCH", body }));
      toast("ok", Number(r.coursesMoved) ? `${ok} ${r.coursesMoved} ${Number(r.coursesMoved) === 1 ? "course moved" : "courses moved"} to another template.` : ok);
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  async function move(t: Tpl, dir: -1 | 1) {
    const all = data!.items;
    const i = all.findIndex((x) => x.id === t.id);
    const other = all[i + dir];
    if (!other) return;
    setBusy(t.id);
    try {
      await api(`/admin/cover-templates/${t.id}`, { method: "PATCH", body: { sort: other.sort } });
      await api(`/admin/cover-templates/${other.id}`, { method: "PATCH", body: { sort: t.sort } });
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHead
        title="Cover templates"
        sub="Every course uses one of these designs; the cover is drawn with the course’s own title. Instructors pick a template in their studio."
        actions={canEdit && !form ? <button type="button" className="btn btn-primary" onClick={() => setForm("new")} data-testid="new-template"><Plus className="size-4" />New template</button> : null}
      />
      {!canEdit ? <p className="mb-6 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">Only a super admin can add, edit, reorder or deactivate templates.</p> : null}
      {form && data ? <Editor edit={form === "new" ? undefined : form} data={data} onDone={() => { setForm(null); reload(); }} onClose={() => setForm(null)} /> : null}
      {!data ? <Skeleton className="h-96" /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter templates">
              {FILTERS.map(([k, l]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-sm font-bold ${filter === k ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>{l}</button>
              ))}
            </div>
            <p className="text-sm text-muted">{counts.active} active of {counts.total} · used by {counts.used} {counts.used === 1 ? "course" : "courses"}</p>
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((t) => (
              <li key={t.id} className={`overflow-hidden rounded-tile border border-line bg-surface ${t.active ? "" : "opacity-70"}`} data-testid="template-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${API_URL}/admin/cover-templates/${t.id}/preview?w=640&title=${encodeURIComponent(SAMPLE)}&topic=Topic&v=${encodeURIComponent(JSON.stringify(t.palette) + t.layout + t.motif)}`} alt={`${t.name} template`} loading="lazy" className="block aspect-video w-full bg-sunken object-cover" />
                <div className="grid gap-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display font-bold text-ink">{t.name}</p>
                      <p className="text-xs text-muted">{t.layout} · {t.motif} · {t.palette.tone} · used by {t.courseCount}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${t.active ? "bg-mint-soft text-mint" : "bg-surface-2 text-muted"}`}>{t.active ? "Active" : "Inactive"}</span>
                  </div>
                  {t.topics.length ? <p className="truncate text-xs text-ink-2">Suggested for: {t.topics.join(", ")}</p> : null}
                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(t)} disabled={!!busy}><Pencil className="size-3.5" />Edit</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(t, { active: !t.active }, t.active ? "Template deactivated." : "Template activated.")} disabled={!!busy} data-testid="toggle-template">
                        {busy === t.id ? <Loader2 className="size-3.5 animate-spin" /> : null}{t.active ? "Deactivate" : "Activate"}
                      </button>
                      {filter === "all" ? (
                        <span className="ml-auto flex gap-1">
                          <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Move ${t.name} earlier`} onClick={() => move(t, -1)} disabled={!!busy}><ArrowUp className="size-3.5" /></button>
                          <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Move ${t.name} later`} onClick={() => move(t, 1)} disabled={!!busy}><ArrowDown className="size-3.5" /></button>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
