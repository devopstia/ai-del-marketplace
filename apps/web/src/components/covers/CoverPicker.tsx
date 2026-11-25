"use client";
import { useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { API_URL } from "@/lib/config";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { useToast } from "../Toast";

interface Tpl { id: string; name: string; group: "generic" | "ai" | "it" | "devops"; suggested: boolean }
interface Picker { coverTemplateId: string | null; coverUrl: string | null; templates: Tpl[] }

const toPicker = (r: unknown): Picker => {
  const o = obj(r);
  const c = obj(o.course);
  return {
    coverTemplateId: (c.coverTemplateId as string) ?? null,
    coverUrl: (c.coverUrl as string) ?? null,
    templates: (Array.isArray(o.templates) ? o.templates : []).map((t) => {
      const x = obj(t);
      return { id: String(x.id), name: String(x.name), group: (x.group as Tpl["group"]) ?? "generic", suggested: !!x.suggested };
    }),
  };
};

const TABS = [
  ["suggested", "For your topic"],
  ["generic", "Generic"],
  ["ai", "AI"],
  ["it", "IT and infrastructure"],
  ["devops", "DevOps"],
  ["all", "All"],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * Standard course covers (owner 2026-11-25): instructors pick a platform template; the cover is drawn on the server with
 * their course title. Every preview here is the real generated image. Changes go live at once, even on published courses.
 */
export function CoverPicker({ courseId, title, onSaved }: { courseId: string; title: string; onSaved: () => void }) {
  const toast = useToast();
  const { data, reload } = useApi(`/instructor/courses/${courseId}/cover`, toPicker);
  const [tab, setTab] = useState<Tab | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = (id: string, w: number) => `${API_URL}/instructor/courses/${courseId}/cover-preview/${id}?w=${w}&title=${encodeURIComponent(title)}`;

  const hasSuggested = !!data?.templates.some((t) => t.suggested);
  const active: Tab = tab ?? (hasSuggested ? "suggested" : "generic");
  const shown = useMemo(() => {
    const all = data?.templates ?? [];
    if (active === "all") return all;
    if (active === "suggested") return all.filter((t) => t.suggested);
    return all.filter((t) => t.group === active);
  }, [data, active]);
  const current = data?.coverTemplateId ?? null;
  const pick = chosen ?? current;
  const dirty = !!chosen && chosen !== current;

  async function save() {
    if (!chosen) return;
    setBusy(true);
    try {
      await api(`/instructor/courses/${courseId}/cover`, { method: "PUT", body: { templateId: chosen } });
      toast("ok", "Cover updated. It shows everywhere on the site now.");
      setChosen(null);
      reload();
      onSaved();
    } catch (e) {
      toast("error", errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-panel border border-line bg-surface p-5 sm:p-6" data-testid="cover-picker">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">Course cover</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">Pick a DevOps Easy Learning cover design. Your title is placed and sized for you, and the cover updates when you rename the course. Changes go live right away, even on a published course.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="relative aspect-video overflow-hidden rounded-tile border border-line bg-sunken">
            {pick ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={pick} src={dirty ? preview(pick, 1280) : data?.coverUrl ?? preview(pick, 1280)} alt="Cover preview" className="size-full object-cover" data-testid="cover-preview" />
            ) : <div className="grid size-full place-items-center text-sm text-muted">Loading…</div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {dirty ? (
              <>
                <button type="button" className="btn btn-primary" onClick={save} disabled={busy} data-testid="save-cover">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Use this cover</button>
                <button type="button" className="btn btn-ghost" onClick={() => setChosen(null)} disabled={busy}>Keep current</button>
              </>
            ) : <p className="text-sm text-muted">This is your current cover. Pick another design to preview it here.</p>}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Cover designs">
            {TABS.filter(([k]) => k !== "suggested" || hasSuggested).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={active === k} onClick={() => setTab(k)}
                className={`rounded-full border px-3 py-1 text-sm font-bold ${active === k ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>
          <ul className="mt-3 grid max-h-[26rem] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
            {shown.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setChosen(t.id)} aria-pressed={pick === t.id} title={t.name}
                  className={`group block w-full overflow-hidden rounded-lg border-2 text-left ${pick === t.id ? "border-violet" : "border-transparent hover:border-line-strong"}`} data-testid="cover-option">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview(t.id, 320)} alt="" loading="lazy" className="block aspect-video w-full bg-sunken object-cover" />
                  <span className="flex items-center justify-between gap-2 px-1.5 py-1 text-xs font-bold text-ink-2">
                    <span className="truncate">{t.name}</span>
                    {t.id === current ? <span className="shrink-0 text-mint">Current</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
