"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ImageUp, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { obj } from "@/lib/normalize";
import { SITE_URL } from "@/lib/seo";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { SharePreviews } from "@/components/social/SharePreviews";

type Family = "pro" | "marketplace" | "enterprise";
interface SiteText { headline: string; subline: string; cta: string }
interface Settings {
  title: string; description: string; family: Family; courseFamily: Family;
  site: Record<Family, SiteText>;
  panels: { template: string; title: string; line: string }[];
  chips: string[];
  disabledTemplates: string[];
}
interface View { settings: Settings; defaults: Settings; families: { key: Family; name: string }[]; templates: { key: string; name: string; accent: string; enabled: boolean }[]; siteUploadUrl: string | null; siteImage: { path: string } | null }

const pick = (s: Settings): Settings => ({ title: s.title, description: s.description, family: s.family, courseFamily: s.courseFamily, site: s.site, panels: s.panels, chips: s.chips, disabledTemplates: s.disabledTemplates });
const toView = (r: unknown): View => {
  const o = obj(r);
  return {
    settings: pick(o.settings as Settings),
    defaults: pick(o.defaults as Settings),
    families: (o.families as View["families"]) ?? [],
    templates: (o.templates as View["templates"]) ?? [],
    siteUploadUrl: typeof o.siteUploadUrl === "string" ? o.siteUploadUrl : null,
    siteImage: (o.siteImage as View["siteImage"]) ?? null,
  };
};

/**
 * Super Admin › Social Media & Sharing (owner 2026-11-28, docs/SOCIAL_SHARING.md): what WhatsApp, Facebook, LinkedIn,
 * X and Telegram show when someone shares the site or a course. Saved settings apply at once (no redeploy): banners are
 * redrawn on the server and get new addresses. Every preview is the real image the server draws.
 */
export default function SocialSharingAdmin() {
  const toast = useToast();
  const { me } = useAuth();
  const sup = !!me?.roles.includes("super_admin");
  const [view, setView] = useState<View | null>(null);
  const [d, setD] = useState<Settings | null>(null);
  const [busy, setBusy] = useState<"save" | "restore" | "upload" | "remove" | null>(null);
  const [shown, setShown] = useState<Settings | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const host = useSiteHost();

  function load(v: View) { setView(v); setD(v.settings); setShown(v.settings); }
  useEffect(() => { if (sup) api("/admin/social").then((r) => load(toView(r))).catch((e) => toast("error", errMsg(e))); }, [sup, toast]);
  // Previews follow the form after a short pause, not on every key.
  useEffect(() => { const t = window.setTimeout(() => setShown(d), 600); return () => window.clearTimeout(t); }, [d]);

  const dirty = useMemo(() => !!view && !!d && JSON.stringify(view.settings) !== JSON.stringify(d), [view, d]);
  const previewUrl = (family: Family) => (shown ? `${API_URL}/admin/social/preview?family=${family}&draft=${encodeURIComponent(JSON.stringify(shown))}` : "");

  if (!sup) return <><PageHead title="Social Media & Sharing" /><p className="text-ink-2">Only a super admin can open this page.</p></>;
  if (!view || !d) return <><PageHead title="Social Media & Sharing" /><Skeleton className="h-96 max-w-5xl" /></>;

  const set = (p: Partial<Settings>) => setD({ ...d, ...p });
  const text = d.site[d.family];
  const setText = (p: Partial<SiteText>) => set({ site: { ...d.site, [d.family]: { ...text, ...p } } });
  const famName = (k: Family) => view.families.find((f) => f.key === k)?.name ?? k;
  const live = view.siteUploadUrl && !dirty ? view.siteUploadUrl : previewUrl(d.family);

  async function save() {
    setBusy("save");
    try { load(toView(await api("/admin/social", { method: "PUT", body: d }))); toast("ok", "Saved. New shares use these settings now."); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  async function restore() {
    if (!window.confirm("Restore every sharing setting to its default? A custom site banner upload is removed too.")) return;
    setBusy("restore");
    try { load(toView(await api("/admin/social/restore-defaults", { method: "POST" }))); toast("ok", "Defaults restored."); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  async function upload(f: File) {
    setBusy("upload");
    const fd = new FormData();
    fd.append("image", f);
    try { load(toView(await api("/admin/social/site-upload", { method: "POST", body: fd }))); toast("ok", "Site banner uploaded. It replaces the drawn banner."); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); if (file.current) file.current.value = ""; }
  }
  async function removeUpload() {
    setBusy("remove");
    try { load(toView(await api("/admin/social/site-upload", { method: "DELETE" }))); toast("ok", "Uploaded banner removed. The drawn banner is back."); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  const count = (s: string, max: number) => <span className={`text-xs ${s.length > max ? "text-rose" : "text-muted"}`}>{s.length}/{max}</span>;
  return (
    <>
      <PageHead title="Social Media & Sharing" sub="What WhatsApp, Facebook, LinkedIn, X and Telegram show when someone shares the site or a course. Changes apply at once and are recorded in the audit log." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="meta-h">
            <h2 id="meta-h" className="font-display text-lg font-bold">Default title and description</h2>
            <p className="mt-1 text-sm text-ink-2">Used by the homepage and by pages without their own. Course pages use the course title and subtitle.</p>
            <label className="label mt-4 flex justify-between" htmlFor="s-title"><span>Title</span>{count(d.title, 70)}</label>
            <input id="s-title" className="field" maxLength={70} value={d.title} onChange={(e) => set({ title: e.target.value })} />
            <label className="label mt-4 flex justify-between" htmlFor="s-desc"><span>Description</span>{count(d.description, 160)}</label>
            <textarea id="s-desc" className="field" maxLength={160} value={d.description} onChange={(e) => set({ description: e.target.value })} />
          </section>

          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="site-h">
            <h2 id="site-h" className="font-display text-lg font-bold">Site banner</h2>
            <p className="mt-1 text-sm text-ink-2">Shown for the homepage, the catalogue, topic pages and every page without its own picture. Pick a style; each keeps its own wording.</p>
            <fieldset className="mt-4">
              <legend className="label">Style</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {view.families.map((f) => (
                  <label key={f.key} className={`block cursor-pointer overflow-hidden rounded-tile border-2 ${d.family === f.key ? "border-violet" : "border-line hover:border-line-strong"}`}>
                    <input type="radio" name="family" className="sr-only" checked={d.family === f.key} onChange={() => set({ family: f.key })} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl(f.key)} alt="" loading="lazy" className="block w-full bg-sunken" style={{ aspectRatio: "1200 / 630" }} />
                    <span className="flex items-center justify-between gap-2 px-2.5 py-2 text-sm font-bold">{f.name}{d.family === f.key ? <Check className="size-4 shrink-0 text-violet" aria-hidden="true" /> : null}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="label mt-5" htmlFor="s-head">Headline <span className="font-normal text-muted">(up to three lines; the last line, or the second, is coloured)</span></label>
            <textarea id="s-head" className="field" rows={3} maxLength={90} value={text.headline} onChange={(e) => setText({ headline: e.target.value.split("\n").slice(0, 3).join("\n") })} />
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <div className="min-w-0"><label className="label" htmlFor="s-sub">Supporting line</label><input id="s-sub" className="field" maxLength={120} value={text.subline} onChange={(e) => setText({ subline: e.target.value })} /></div>
              <div className="min-w-0"><label className="label" htmlFor="s-cta">Button text</label><input id="s-cta" className="field" maxLength={28} value={text.cta} onChange={(e) => setText({ cta: e.target.value })} /></div>
            </div>
            {d.family === "pro" ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {d.panels.map((p, i) => (
                  <fieldset key={i} className="min-w-0 rounded-lg border border-line p-3">
                    <legend className="px-1 text-sm font-bold">Panel {i + 1}</legend>
                    <label className="label" htmlFor={`p${i}-t`}>Design</label>
                    <select id={`p${i}-t`} className="field" value={p.template} onChange={(e) => set({ panels: d.panels.map((x, j) => (j === i ? { ...x, template: e.target.value } : x)) })}>
                      {view.templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                    </select>
                    <label className="label mt-2" htmlFor={`p${i}-n`}>Name</label>
                    <input id={`p${i}-n`} className="field" maxLength={24} value={p.title} onChange={(e) => set({ panels: d.panels.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                    <label className="label mt-2" htmlFor={`p${i}-l`}>Line</label>
                    <input id={`p${i}-l`} className="field" maxLength={40} value={p.line} onChange={(e) => set({ panels: d.panels.map((x, j) => (j === i ? { ...x, line: e.target.value } : x)) })} />
                  </fieldset>
                ))}
              </div>
            ) : d.family === "enterprise" ? (
              <div className="mt-4"><label className="label" htmlFor="s-chips">Topic chips <span className="font-normal text-muted">(up to five, comma separated)</span></label>
                <input id="s-chips" className="field" value={d.chips.join(", ")} onChange={(e) => set({ chips: e.target.value.split(",").map((x) => x.trimStart()).slice(0, 5) })} onBlur={() => set({ chips: d.chips.map((x) => x.trim()).filter(Boolean) })} />
              </div>
            ) : <p className="hint mt-4">The cards show your top three published courses: featured first (Courses › Feature), then the newest. They change when those courses change.</p>}

            <div className="mt-6 border-t border-line pt-4">
              <p className="text-sm font-bold">Or upload a finished site banner</p>
              <p className="mt-1 text-xs text-muted">PNG, JPG or WebP, 1200×630 px (or larger with the same shape), up to 5 MB. Hidden details (location, camera data) are removed.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <input ref={file} id="site-file" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
                <label htmlFor="site-file" className={`btn btn-outline cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>{busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}{view.siteUploadUrl ? "Replace uploaded banner" : "Upload a banner"}</label>
                {view.siteUploadUrl ? <button type="button" className="btn btn-ghost" onClick={() => void removeUpload()} disabled={!!busy}>{busy === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Remove upload</button> : null}
              </div>
              {view.siteUploadUrl ? <p className="mt-2 text-sm text-ink-2">An uploaded banner is in use; the style above applies again when you remove it.</p> : null}
            </div>
          </section>

          <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="course-h">
            <h2 id="course-h" className="font-display text-lg font-bold">Course banners</h2>
            <p className="mt-1 text-sm text-ink-2">Every published course gets its own banner from its title, topic and price (a &quot;Free course&quot; badge when it is free). Instructors can choose another style, topic design or headline in their studio.</p>
            <label className="label mt-4" htmlFor="s-cfam">Default style for courses</label>
            <select id="s-cfam" className="field max-w-md" value={d.courseFamily} onChange={(e) => set({ courseFamily: e.target.value as Family })}>
              {view.families.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
            </select>
            <fieldset className="mt-5">
              <legend className="label">Topic designs instructors can use</legend>
              <ul className="grid gap-2 sm:grid-cols-2">
                {view.templates.map((t) => (
                  <li key={t.key}>
                    <label className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm">
                      <input type="checkbox" className="size-4 accent-[var(--violet)]" checked={t.key === "general" || !d.disabledTemplates.includes(t.key)} disabled={t.key === "general"}
                        onChange={(e) => set({ disabledTemplates: e.target.checked ? d.disabledTemplates.filter((k) => k !== t.key) : [...d.disabledTemplates, t.key] })} />
                      <span className="size-3 shrink-0 rounded-full" style={{ background: t.accent }} aria-hidden="true" />
                      <span className="min-w-0 truncate font-bold">{t.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted">{t.key === "general" ? "always on" : ""}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <p className="hint mt-2">A course using a design you turn off moves to its topic&apos;s default.</p>
            </fieldset>
          </section>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-t border-line bg-paper/95 px-1 py-3 backdrop-blur" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty || !!busy} data-testid="social-save">{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save changes</button>
            {dirty ? <button type="button" className="btn btn-ghost" onClick={() => setD(view.settings)} disabled={!!busy}>Undo changes</button> : null}
            <button type="button" className="btn btn-outline ml-auto" onClick={() => void restore()} disabled={!!busy} data-testid="social-restore">{busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Restore defaults</button>
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start" aria-labelledby="prev-h">
          <h2 id="prev-h" className="font-display text-lg font-bold">Preview · {view.siteUploadUrl && !dirty ? "uploaded banner" : famName(d.family)}</h2>
          <SharePreviews image={live} title={d.title} description={d.description} host={host} />
        </aside>
      </div>
    </>
  );
}

/** The address people share: this site's host in the browser (the build-time host on the server render). */
const noop = () => () => {};
function useSiteHost() { return useSyncExternalStore(noop, () => window.location.host, () => new URL(SITE_URL).host); }
