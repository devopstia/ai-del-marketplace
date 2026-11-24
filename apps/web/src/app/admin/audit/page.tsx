"use client";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { list, toAudit } from "@/lib/normalize";
import { dateTime } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";

const map = (r: unknown) => list(r, "entries", "logs").map(toAudit);

export default function AuditLog() {
  const { data, error } = useApi("/admin/audit", map);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const shown = (data ?? []).filter((a) => !q || `${a.action} ${a.actor?.name ?? ""} ${a.targetType} ${a.targetId}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Audit log" sub="Every privileged or financial action: who did it, to what, from where." />
      <input type="search" aria-label="Filter audit log" className="field mb-4 !w-80 max-w-full" placeholder="Filter by action, person or target" value={q} onChange={(e) => setQ(e.target.value)} />
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <DataTable head={["When", "Action", "By", "Target", "IP", ""]} min={880} empty={!shown.length ? <p className="px-4 py-10 text-center text-ink-2">No entries.</p> : null}>
          {shown.map((a) => (
            <tr key={a.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{dateTime(a.at)}</td>
              <td className="px-4 py-3 font-bold">{a.action}</td>
              <td className="px-4 py-3">{a.actor?.name ?? "System"}</td>
              <td className="px-4 py-3 text-ink-2">{a.targetType} <span className="text-xs text-muted">{a.targetId.slice(0, 8)}</span>
                {open === a.id && a.meta ? <pre className="mt-2 max-w-md overflow-x-auto rounded-lg bg-surface-2 p-2 text-xs">{JSON.stringify(a.meta, null, 2)}</pre> : null}
              </td>
              <td className="px-4 py-3 text-xs text-muted">{a.ip ?? "—"}</td>
              <td className="px-4 py-3 text-right">{a.meta ? <button type="button" className="link text-xs" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? "Hide" : "Details"}</button> : null}</td>
            </tr>
          ))}
        </DataTable>
      ) : !error ? <Skeleton className="h-96" /> : null}
    </>
  );
}
