"use client";
import Link from "next/link";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { dateTime } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";

interface Check { name: string; ok: boolean; detail: string; ms?: number }
interface QueueRow { name: string; key: string; ok: boolean; workers: number; waiting: number; active: number; delayed: number; failed: number; error: string | null }
interface Health { checkedAt: string; environment: string; checks: Check[]; queues: QueueRow[]; attention: { failedVideos: number; packagingFailed: number; deletionsWaitingForAccess: number; failedSignInsLastDay: number } }
const toHealth = (r: unknown) => obj(r) as unknown as Health;

/** Super Admin › System health (owner 2026-11-26): live checks of what the marketplace depends on. */
export default function SystemHealth() {
  const { data, error, loading, reload } = useApi("/admin/system", toHealth);
  const att = data?.attention;
  const attention = att ? [
    { label: "Videos that failed to process", n: att.failedVideos, href: "/admin/protection" },
    { label: "Videos that failed to package", n: att.packagingFailed, href: "/admin/protection" },
    { label: "Course deletions waiting for learners’ access to end", n: att.deletionsWaitingForAccess, href: "/admin/courses/archived" },
    { label: "Failed sign-in attempts in the last 24 hours", n: att.failedSignInsLastDay, href: "/admin/audit" },
  ] : [];
  return (
    <div className="max-w-5xl">
      <PageHead title="System health" sub={data ? `Checked ${dateTime(data.checkedAt)}.` : "Live checks of the services the marketplace depends on."}
        actions={<button type="button" className="btn btn-outline btn-sm" disabled={loading} onClick={reload} data-testid="health-refresh"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Check again</button>} />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data ? (!error ? <Skeleton className="h-80" /> : null) : (
        <div className="space-y-6" data-testid="system-health">
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-3 rounded-tile border border-line bg-surface p-4">
                {c.ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint" aria-hidden="true" /> : <TriangleAlert className="mt-0.5 size-5 shrink-0 text-rose" aria-hidden="true" />}
                <span className="min-w-0"><span className="block font-bold">{c.name}</span><span className="text-sm text-ink-2">{c.detail}{c.ms != null ? ` · ${c.ms} ms` : ""}</span></span>
              </li>
            ))}
          </ul>
          <section aria-labelledby="q-h">
            <h2 id="q-h" className="mb-3 font-display text-lg font-bold">Background jobs</h2>
            <DataTable head={["Queue", "Workers", "Waiting", "Running", "Scheduled", "Failed"]} min={560}>
              {data.queues.map((q) => (
                <tr key={q.key}>
                  <td className="px-4 py-3 font-bold">{q.name}{q.error ? <span className="ml-2 text-xs text-rose">{q.error}</span> : null}</td>
                  <td className={`px-4 py-3 tabular-nums ${q.workers ? "text-mint" : "font-bold text-rose"}`}>{q.workers || "None running"}</td>
                  <td className="px-4 py-3 tabular-nums">{q.waiting}</td>
                  <td className="px-4 py-3 tabular-nums">{q.active}</td>
                  <td className="px-4 py-3 tabular-nums">{q.delayed}</td>
                  <td className={`px-4 py-3 tabular-nums ${q.failed ? "font-bold text-amber" : ""}`}>{q.failed}</td>
                </tr>
              ))}
            </DataTable>
          </section>
          <section aria-labelledby="att-h">
            <h2 id="att-h" className="mb-3 font-display text-lg font-bold">Needs attention</h2>
            <ul className="divide-y divide-line rounded-tile border border-line bg-surface">
              {attention.map((a) => (
                <li key={a.label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 text-ink-2">{a.label}</span>
                  {a.n ? <Link href={a.href} className="font-display text-lg font-bold tabular-nums text-amber hover:underline">{a.n}</Link> : <span className="font-display text-lg font-bold tabular-nums text-muted">0</span>}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
