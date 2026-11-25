"use client";
import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { api, errMsg, uploadFile } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { clock } from "@/lib/format";
import { AUDIENCE_LABEL, toChapters, toItem, type Chapter, type HelpItem } from "@/lib/help";
import { PageHead } from "@/components/shell/AppShell";
import { Empty, Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { VideoPlayer } from "@/components/VideoPlayer";

interface Row extends HelpItem { published: boolean; videoStatus: string | null; chapters: Chapter[] }
interface Data { categories: { key: string; name: string }[]; items: Row[] }
const arr = (x: unknown) => (Array.isArray(x) ? x : []);
const toData = (r: unknown): Data => ({
  categories: arr(obj(r).categories).map((c) => ({ key: String(obj(c).key), name: String(obj(c).name) })),
  items: arr(obj(r).items).map((x) => ({ ...toItem(x), published: !!obj(x).published, videoStatus: (obj(x).videoStatus as string) ?? null, chapters: toChapters(obj(x).chapters) })),
});
const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
/** SRT → WebVTT (the player reads VTT). */
const srtToVtt = (s: string) => "WEBVTT\n\n" + s.replace(/\r/g, "").replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, "$1.$2").trim() + "\n";

function Editor({ data, edit, onDone, onClose }: { data: Data; edit?: Row; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: edit?.title ?? "", slug: edit?.slug ?? "", summary: edit?.summary ?? "", audience: edit?.audience ?? "everyone", category: edit?.category ?? data.categories[0]?.key ?? "getting-started", sort: edit?.sort ?? 0 });
  const [video, setVideo] = useState<File | null>(null);
  const [captions, setCaptions] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState("");
  const set = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v, ...(k === "title" && !edit && x.slug === slugify(x.title) ? { slug: slugify(String(v)) } : {}) }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit && !video) { toast("error", "Choose the video file."); return; }
    try {
      const extra: Record<string, unknown> = {};
      if (video) {
        setBusy("Uploading video… 0%");
        const up = obj(await api("/admin/help/uploads/video", { method: "POST", body: { filename: video.name, contentType: video.type || "video/mp4" } }));
        await uploadFile(String(up.uploadUrl), video, (p) => setBusy(`Uploading video… ${Math.round(p * 100)}%`), "PUT", (up.headers as Record<string, string>) ?? {});
        const id = String(up.assetId);
        if (captions) {
          setBusy("Uploading captions…");
          const c = obj(await api(`/admin/help/uploads/video/${id}/captions`, { method: "POST" }));
          const text = await captions.text();
          const vtt = new File([captions.name.endsWith(".srt") ? srtToVtt(text) : text], "captions.vtt", { type: "text/vtt" });
          await uploadFile(String(c.uploadUrl), vtt, () => {}, "PUT", (c.headers as Record<string, string>) ?? {});
        }
        await api(`/admin/help/uploads/video/${id}/complete`, { method: "POST" });
        extra.videoAssetId = id;
      }
      if (cover) {
        setBusy("Uploading cover…");
        const c = obj(await api("/admin/help/uploads/image", { method: "POST", body: { contentType: cover.type } }));
        await uploadFile(String(c.uploadUrl), cover, () => {}, "PUT", (c.headers as Record<string, string>) ?? {});
        extra.coverKey = String(c.key);
      }
      setBusy("Saving…");
      await api(`/admin/help/videos/${f.slug}`, { method: "PUT", body: { title: f.title, summary: f.summary, audience: f.audience, category: f.category, sort: Number(f.sort) || 0, ...extra } });
      toast("ok", video ? "Saved. The video is processing; publish it when it’s ready." : "Saved.");
      onDone();
    } catch (err) { toast("error", errMsg(err)); } finally { setBusy(""); }
  }

  const label = "grid gap-1 text-sm font-bold";
  return (
    <form onSubmit={save} className="mb-8 rounded-panel border border-line bg-surface p-5" data-testid="help-editor">
      <h2 className="font-display text-lg font-bold">{edit ? `Edit “${edit.title}”` : "New help video"}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>Title<input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} required minLength={3} maxLength={120} /></label>
        <label className={label}>Address<span className="flex items-center gap-1 font-normal text-muted">/help/<input className="field flex-1" value={f.slug} onChange={(e) => set("slug", slugify(e.target.value))} required disabled={!!edit} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-label="Address" /></span></label>
        <label className={`${label} sm:col-span-2`}>Summary<textarea className="field min-h-20" value={f.summary} onChange={(e) => set("summary", e.target.value)} required minLength={3} maxLength={400} /></label>
        <label className={label}>Topic<select className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>{data.categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>For<select className="field" value={f.audience} onChange={(e) => set("audience", e.target.value)}>{Object.entries(AUDIENCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className={label}>Order<input className="field" type="number" min={0} max={999} value={f.sort} onChange={(e) => set("sort", e.target.value)} /></label>
        </div>
        <label className={label}>{edit ? "Replace the video (optional)" : "Video (MP4)"}<input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} className="text-sm font-normal" /></label>
        <label className={label}>Captions (.vtt or .srt, optional){video ? null : <span className="font-normal text-muted">Upload with a video file.</span>}<input type="file" accept=".vtt,.srt,text/vtt" disabled={!video} onChange={(e) => setCaptions(e.target.files?.[0] ?? null)} className="text-sm font-normal" /></label>
        <label className={label}>{edit?.coverUrl ? "Replace the cover (optional)" : "Cover image (optional)"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)} className="text-sm font-normal" /></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={!!busy} data-testid="help-save">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{busy || "Save"}</button>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={!!busy}>Cancel</button>
      </div>
    </form>
  );
}

export default function AdminHelp() {
  const toast = useToast();
  const { data, error, reload } = useApi("/admin/help/videos", toData);
  const [form, setForm] = useState<"new" | Row | null>(null);
  const [preview, setPreview] = useState<{ slug: string; url: string; captionsUrl: string | null } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast("ok", ok); reload(); } catch (e) { toast("error", errMsg(e)); } };
  const openPreview = async (r: Row) => {
    if (preview?.slug === r.slug) { setPreview(null); return; }
    try { const p = obj(await api(`/admin/help/videos/${r.slug}/preview`)); setPreview({ slug: r.slug, url: String(p.url), captionsUrl: (p.captionsUrl as string) ?? null }); } catch (e) { toast("error", errMsg(e)); }
  };
  const catName = (k: string) => data?.categories.find((c) => c.key === k)?.name ?? k;
  const status = (r: Row) => (r.videoStatus !== "ready" ? (r.videoStatus === "failed" ? ["Video failed", "text-rose"] : ["Processing", "text-amber"]) : r.published ? ["Published", "text-mint"] : ["Draft", "text-ink-2"]);

  return (
    <div className="max-w-5xl">
      <PageHead title="Platform videos" sub="Short “how to use DEL” videos for students and instructors, shown at /help. Videos made with video-academy/ are published here by its publish tool, or upload one yourself."
        actions={!form ? <button type="button" className="btn btn-primary" onClick={() => setForm("new")} data-testid="new-help-video"><Plus className="size-4" />New video</button> : null} />
      {form && data ? <Editor data={data} edit={form === "new" ? undefined : form} onClose={() => setForm(null)} onDone={() => { setForm(null); reload(); }} /> : null}
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-64" /> : null}
      {data && !data.items.length && !form ? <Empty icon={Play} title="No help videos yet" body="Add one here, or publish the videos made with video-academy/ (see docs/HELP_VIDEOS.md)." /> : null}
      {data && data.items.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-tile border border-line bg-surface" data-testid="help-admin-list">
          {data.items.map((r) => {
            const [st, tone] = status(r);
            return (
              <li key={r.slug} className="p-3">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {r.coverUrl ? <img src={r.coverUrl} alt="" className="size-full object-cover" /> : null}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{r.title}</p>
                    <p className="text-sm text-ink-2">{catName(r.category)} · {AUDIENCE_LABEL[r.audience]} · order {r.sort}{r.durationSec ? ` · ${clock(r.durationSec)}` : ""}{r.chapters.length ? ` · ${r.chapters.length} chapters` : ""}</p>
                    <p className={`text-sm font-bold ${tone}`}>{st}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.videoStatus === "ready" ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void openPreview(r)} aria-expanded={preview?.slug === r.slug}><Play className="size-4" />Preview</button> : null}
                    {r.published ? <Link href={`/help/${r.slug}`} className="btn btn-ghost btn-sm">Open</Link> : null}
                    {r.videoStatus === "ready" ? (
                      <button type="button" className="btn btn-ghost btn-sm" data-testid="help-publish" onClick={() => void run(() => api(`/admin/help/videos/${r.slug}/publish`, { method: "POST", body: { published: !r.published } }), r.published ? "Unpublished." : "Published.")}>
                        {r.published ? <><EyeOff className="size-4" />Unpublish</> : <><Eye className="size-4" />Publish</>}
                      </button>
                    ) : null}
                    <button type="button" className="btn btn-ghost btn-sm !px-2" aria-label={`Edit ${r.title}`} onClick={() => setForm(r)}><Pencil className="size-4" /></button>
                    <button type="button" className="btn btn-ghost btn-sm !px-2 text-rose" aria-label={`Delete ${r.title}`} onClick={() => confirm(`Delete “${r.title}”? It disappears from /help.`) && void run(() => api(`/admin/help/videos/${r.slug}`, { method: "DELETE" }), "Deleted.")}><Trash2 className="size-4" /></button>
                  </div>
                </div>
                {preview?.slug === r.slug ? <div className="mt-3 max-w-3xl"><VideoPlayer src={preview.url} captionsUrl={preview.captionsUrl} title={r.title} /></div> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
