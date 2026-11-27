"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ImageUp, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { obj } from "@/lib/normalize";
import { useApi } from "@/lib/useApi";
import { useToast } from "../Toast";

export interface Opt { key: string; name: string }
interface View {
  published: boolean;
  choice: { family: string | null; template: string | null; headline: string | null; uploadUrl: string | null };
  effective: { family: string; template: string };
  defaults: { family: string; template: string };
  families: Opt[];
  templates: Opt[];
  imageUrl: string | null;
}
const opts = (v: unknown): Opt[] => (Array.isArray(v) ? v : []).map((x) => ({ key: String(obj(x).key), name: String(obj(x).name) }));
const toView = (r: unknown): View => {
  const o = obj(r);
  const ch = obj(o.choice);
  const ef = obj(o.effective);
  const df = obj(o.defaults);
  const s = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    published: !!obj(o.course).published,
    choice: { family: s(ch.family), template: s(ch.template), headline: s(ch.headline), uploadUrl: s(ch.uploadUrl) },
    effective: { family: String(ef.family ?? "pro"), template: String(ef.template ?? "general") },
    defaults: { family: String(df.family ?? "pro"), template: String(df.template ?? "general") },
    families: opts(o.families),
    templates: opts(o.templates),
    imageUrl: s(o.imageUrl),
  };
};


/**
 * Sharing banner of one course (docs/SOCIAL_SHARING.md): the 1200×630 picture link previews show. Drawn on the server
 * from the course title in one of the platform's banner styles; the instructor (or a super admin, `base` = /admin/…)
 * picks the style and topic design, may write a shorter headline, or uploads a finished 1200×630 banner. Never a video
 * frame. The preview is the real generated image.
 */
export function ShareBannerEditor({ base, title }: { base: string; title: string }) {
  const toast = useToast();
  const { data, reload } = useApi(`${base}/share`, toView);
  const [family, setFamily] = useState<string | null | undefined>(undefined);
  const [template, setTemplate] = useState<string | null | undefined>(undefined);
  const [headline, setHeadline] = useState<string | undefined>(undefined);
  const [shownHeadline, setShownHeadline] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState<"save" | "upload" | "remove" | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // The preview follows the headline after a short pause, not on every key.
  useEffect(() => {
    const t = window.setTimeout(() => setShownHeadline(headline), 500);
    return () => window.clearTimeout(t);
  }, [headline]);

  if (!data) return <section className="rounded-panel border border-line bg-surface p-6 text-sm text-muted">Loading the sharing banner…</section>;

  const fam = family === undefined ? data.choice.family : family;
  const tpl = template === undefined ? data.choice.template : template;
  const head = headline === undefined ? (data.choice.headline ?? "") : headline;
  const dirty = family !== undefined || template !== undefined || headline !== undefined;
  const upload = data.choice.uploadUrl;
  const q = new URLSearchParams({ ...(fam ? { family: fam } : {}), ...(tpl ? { template: tpl } : {}), headline: shownHeadline ?? head });
  // Preview: the uploaded banner, else the drawn one with the choices on screen (never stored until saved).
  const src = upload && !dirty ? upload : `${API_URL}${base}/share-preview?${q.toString()}`;
  const famName = (k: string) => data.families.find((f) => f.key === k)?.name ?? k;
  const tplName = (k: string) => data.templates.find((t) => t.key === k)?.name ?? k;

  async function save() {
    setBusy("save");
    try {
      await api(`${base}/share`, { method: "PUT", body: { family: fam ?? null, template: tpl ?? null, headline: head.trim() || null } });
      toast("ok", data!.published ? "Sharing banner saved. New shares use it now." : "Sharing banner saved. It goes live when the course is published.");
      setFamily(undefined); setTemplate(undefined); setHeadline(undefined);
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  async function sendFile(f: File) {
    setBusy("upload");
    const fd = new FormData();
    fd.append("image", f);
    try {
      await api(`${base}/share-upload`, { method: "POST", body: fd });
      toast("ok", "Banner uploaded. It replaces the drawn banner for this course.");
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); if (file.current) file.current.value = ""; }
  }
  async function removeUpload() {
    setBusy("remove");
    try {
      await api(`${base}/share-upload`, { method: "DELETE" });
      toast("ok", "Uploaded banner removed. The drawn banner is back.");
      reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  const select = "field mt-1";
  return (
    <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" data-testid="share-banner-editor">
      <h2 className="font-display text-xl font-bold">Sharing banner</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-2">The picture WhatsApp, Facebook, LinkedIn, X and Telegram show when someone shares this course. It is drawn from your course title and updates when the title or price changes.{data.published ? "" : " It goes live when the course is published."}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="relative overflow-hidden rounded-tile border border-line bg-sunken" style={{ aspectRatio: "1200 / 630" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={src} src={src} alt={`Sharing banner preview for ${title}`} className="size-full object-cover" data-testid="share-preview" />
          </div>
          <p className="mt-2 text-xs text-muted">{upload && !dirty ? "Your uploaded banner (1200×630)." : dirty ? "Preview of your changes. Save to use it." : "The banner in use now."}</p>
        </div>

        <div className="min-w-0 space-y-4">
          {upload ? (
            <div className="rounded-lg border border-line bg-sunken p-3 text-sm text-ink-2">
              An uploaded banner is in use. Remove it to go back to a drawn banner.
              <button type="button" className="btn btn-outline mt-3 w-full sm:w-auto" onClick={() => void removeUpload()} disabled={!!busy} data-testid="share-remove-upload">
                {busy === "remove" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}Remove uploaded banner
              </button>
            </div>
          ) : (
            <>
              <label className="block text-sm font-bold">Style
                <select className={select} value={fam ?? ""} onChange={(e) => setFamily(e.target.value || null)} data-testid="share-family">
                  <option value="">Platform default ({famName(data.defaults.family)})</option>
                  {data.families.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold">Topic design
                <select className={select} value={tpl ?? ""} onChange={(e) => setTemplate(e.target.value || null)} data-testid="share-template">
                  <option value="">For this course&apos;s topic ({tplName(data.defaults.template)})</option>
                  {data.templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold">Headline <span className="font-normal text-muted">(optional)</span>
                <input className={select} value={head} maxLength={90} onChange={(e) => setHeadline(e.target.value)} placeholder={title} data-testid="share-headline" />
                <span className="mt-1 block text-xs font-normal text-muted">Empty uses the course title. &quot;Title: Subtitle&quot; puts the subtitle on its own line.</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirty || !!busy} data-testid="share-save">
                  {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Save banner
                </button>
                {dirty ? <button type="button" className="btn btn-ghost" onClick={() => { setFamily(undefined); setTemplate(undefined); setHeadline(undefined); }} disabled={!!busy}><RotateCcw className="size-4" />Undo changes</button> : null}
              </div>
            </>
          )}
          <div className="border-t border-line pt-4">
            <p className="text-sm font-bold">Or upload your own banner</p>
            <p className="mt-1 text-xs text-muted">PNG, JPG or WebP, exactly 1200×630 px (or larger with the same shape), up to 5 MB. Keep text away from the edges. Hidden details (location, camera data) are removed.</p>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id={`share-file-${base}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendFile(f); }} data-testid="share-file" />
            <label htmlFor={`share-file-${base}`} className={`btn btn-outline mt-3 cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
              {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <ImageUp className="size-4" />}{upload ? "Replace uploaded banner" : "Upload a banner"}
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
