"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { DataTable, PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { PRIORITY, StatusPill, categoryLabel, toTicket, when } from "@/components/support/shared";

const toQueue = (r: unknown) => { const o = obj(r); return { items: (Array.isArray(o.items) ? o.items : []).map(toTicket), total: Number(o.total ?? 0), counts: obj(o.counts) as Record<string, number> }; };
const TABS: [string, string][] = [["active", "Active"], ["new", "New"], ["open", "Open"], ["waiting_user", "Waiting for requester"], ["resolved", "Resolved"], ["closed", "Closed"]];

export default function SupportQueue() {
  const [status, setStatus] = useState("active");
  const [assigned, setAssigned] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const qs = new URLSearchParams({ status, ...(assigned ? { assigned } : {}), ...(search ? { q: search } : {}) }).toString();
  const { data } = useApi(`/admin/support/tickets?${qs}`, toQueue);
  const c = data?.counts ?? {};
  const count = (k: string) => (k === "active" ? (c.new ?? 0) + (c.open ?? 0) + (c.waiting_user ?? 0) + (c.resolved ?? 0) : c[k] ?? 0);
  return (
    <>
      <PageHead title="Support" sub="Requests from students and instructors. Most urgent first, then the longest waiting." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1 text-sm font-bold ${status === k ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>
              {l} <span className="tabular-nums">{count(k)}</span>
            </button>
          ))}
        </div>
        <select className="field !min-h-9 !w-auto !py-1 text-sm" aria-label="Assigned to" value={assigned} onChange={(e) => setAssigned(e.target.value)}>
          <option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>
        </select>
        <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
          <input className="field !min-h-9 !w-64 !py-1 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="SUP number, subject or person" aria-label="Search requests" />
        </form>
      </div>
      {!data ? <Skeleton className="h-64" /> : (
        <DataTable head={["Request", "From", "Priority", "Status", "Assigned", "Updated"]} min={860}
          empty={!data.items.length ? <p className="p-6 text-center text-sm text-muted">No requests here.</p> : null}>
          {data.items.map((t) => (
            <tr key={t.number} className="hover:bg-surface-2/60">
              <td className="px-4 py-3"><Link href={`/admin/support/${t.number}`} className="font-bold text-ink hover:text-violet" data-testid="queue-row">{t.subject}</Link><span className="block text-xs text-muted">{t.number} · {categoryLabel(t.category)}</span></td>
              <td className="px-4 py-3"><span className="block text-ink">{t.requester.name}</span><span className="text-xs text-muted">{t.requester.roles.includes("instructor") ? "Instructor" : "Student"}</span></td>
              <td className="px-4 py-3"><span className={t.priority === "urgent" ? "font-bold text-rose" : t.priority === "high" ? "font-bold text-amber" : "text-ink-2"}>{PRIORITY[t.priority]}</span></td>
              <td className="px-4 py-3"><StatusPill status={t.status} staff /></td>
              <td className="px-4 py-3 text-ink-2">{t.assignedTo?.name ?? "—"}</td>
              <td className="px-4 py-3 text-ink-2">{when(t.updatedAt)}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
