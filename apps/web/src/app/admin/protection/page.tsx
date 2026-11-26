"use client";
import { useState } from "react";
import { Globe2, Layers, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

const LABELS: [string, string][] = [["ready", "Protected"], ["queued", "Waiting"], ["processing", "Packaging now"], ["failed", "Failed"], ["unsupported", "Needs re-encoding"], ["none", "Not started"]];

interface Status { enabled: boolean; cdn: boolean; renditions: string; singleQuality: number; counts: Record<string, number> }

/** Admin › Platform › Video protection: encryption, delivery (CloudFront) and qualities (docs/VIDEO_DELIVERY.md). */
export default function ProtectionPage() {
  const { me } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const status = useApi("/admin/playback/status", (r) => {
    const o = obj(r);
    return { enabled: o.enabled === true, cdn: o.cdn === true, renditions: String(o.renditions ?? ""), singleQuality: Number(o.singleQuality ?? 0), counts: obj(o.counts) as Record<string, number> } as Status;
  });
  const s = status.data;
  const qualities = s?.renditions ? s.renditions.split(",").map((h) => `${h.trim()}p`).join(" and ") : "";
  const superAdmin = !!me?.roles.includes("super_admin");
  async function repackage() {
    setBusy(true);
    try {
      const r = obj(await api("/admin/playback/repackage", { method: "POST" }));
      toast("ok", `${Number(r.queued ?? 0)} video${Number(r.queued) === 1 ? "" : "s"} queued. Learners keep watching the current copy until each one is ready.`);
      status.reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <div className="max-w-4xl">
      <PageHead title="Video protection" sub="Paid lessons stream as encrypted video through a short session tied to the learner, so the files can't be downloaded or shared as links." />
      <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="pkg">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pkg" className="font-display text-lg font-bold">Encrypted videos</h2>
          {s ? <span className={`text-sm font-bold ${s.enabled ? "text-mint" : "text-amber"}`}>{s.enabled ? "Protection on" : "Protection off (signed file links)"}</span> : null}
        </div>
        {!s ? <Skeleton className="mt-4 h-16" /> : (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="protection-counts">
            {LABELS.filter(([k]) => k === "ready" || s.counts[k]).map(([k, l]) => (
              <div key={k} className="rounded-tile border border-line px-4 py-3">
                <dt className="text-sm text-ink-2">{l}</dt>
                <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{s.counts[k] ?? 0}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-4 text-sm text-ink-2">Until a video is packaged, learners get a short-lived link to the original file, so nothing stops playing. Free previews always use that link.</p>
      </section>

      {s ? (
        <section className="mt-6 divide-y divide-line rounded-panel border border-line bg-surface" aria-labelledby="delivery" data-testid="video-delivery">
          <h2 id="delivery" className="px-5 pb-3 pt-5 font-display text-lg font-bold">Delivery</h2>
          <div className="flex items-start gap-3 px-5 py-4">
            <Globe2 className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-bold">{s.cdn ? "Worldwide network (CloudFront)" : "Direct from storage"}</p>
              <p className="text-sm text-ink-2">{s.cdn ? "Video pieces come from the Amazon location nearest each learner, including Lagos, Nairobi, Johannesburg and Cape Town. Links are signed per viewing session." : "Video pieces come straight from the storage bucket through short-lived signed links."}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3 px-5 py-4">
            <Layers className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" />
            <div className="min-w-[13rem] flex-1">
              <p className="font-bold">Qualities</p>
              <p className="text-sm text-ink-2">{qualities ? `Every new video gets ${qualities} in addition to the original, and the player picks what the connection can carry.` : "Only the original quality is kept."}{s.singleQuality ? ` ${s.singleQuality} video${s.singleQuality === 1 ? " was" : "s were"} packaged before this and ${s.singleQuality === 1 ? "has" : "have"} one quality.` : ""}</p>
            </div>
            {superAdmin && s.singleQuality && qualities ? (
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => void repackage()} data-testid="repackage">
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}Add {qualities} to {s.singleQuality} video{s.singleQuality === 1 ? "" : "s"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
