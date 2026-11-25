"use client";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";

const LABELS: [string, string][] = [["ready", "Protected"], ["queued", "Waiting"], ["processing", "Packaging now"], ["failed", "Failed"], ["unsupported", "Needs re-encoding"], ["none", "Not started"]];

export default function ProtectionPage() {
  const status = useApi("/admin/playback/status", (r) => ({ enabled: obj(r).enabled === true, counts: obj(obj(r).counts) as Record<string, number> }));
  return (
    <div className="max-w-4xl">
      <PageHead title="Video protection" sub="Paid lectures stream as encrypted video through a short session tied to the learner, so the files can't be downloaded or shared as links." />
      <section className="rounded-panel border border-line bg-surface p-5" aria-labelledby="pkg">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="pkg" className="font-display text-lg font-bold">Encrypted videos</h2>
          {status.data ? <span className={`text-sm font-semibold ${status.data.enabled ? "text-emerald-400" : "text-amber-400"}`}>{status.data.enabled ? "Protection on" : "Protection off (signed file links)"}</span> : null}
        </div>
        {!status.data ? <Skeleton className="mt-4 h-16" /> : (
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="protection-counts">
            {LABELS.filter(([k]) => k === "ready" || status.data!.counts[k]).map(([k, l]) => (
              <div key={k} className="rounded-tile border border-line px-4 py-3">
                <dt className="text-sm text-ink-2">{l}</dt>
                <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{status.data!.counts[k] ?? 0}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-4 text-sm text-ink-2">Until a video is packaged, learners get a short-lived link to the original file, so nothing stops playing. Free previews always use that link.</p>
      </section>
    </div>
  );
}
