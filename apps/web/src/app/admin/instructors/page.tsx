"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, toAdminInstructor } from "@/lib/normalize";
import { date } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";

const map = (r: unknown) => list(r, "instructors").map(toAdminInstructor);

export default function AdminInstructors() {
  const toast = useToast();
  const { data, error, setData } = useApi("/admin/instructors", map);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  async function decide(id: string, a: "approve" | "reject") {
    let note: string | undefined;
    if (a === "reject") {
      note = window.prompt("Why is this application rejected? The applicant sees this note.")?.trim();
      if (!note) return;
    }
    setBusy(id + a);
    try {
      await api(`/admin/instructors/${id}/${a}`, { method: "POST", body: note ? { note } : {} });
      setData((d) => d?.map((i) => (i.userId === id ? { ...i, status: a === "approve" ? "approved" : "rejected" } : i)) ?? null);
      toast("ok", a === "approve" ? "Instructor approved. Their studio is unlocked." : "Application rejected.");
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  const pending = (data ?? []).filter((i) => i.status === "pending");
  const shown = tab === "pending" ? pending : data ?? [];
  return (
    <>
      <PageHead title="Instructors" sub="Approve applications and see who can publish." />
      <div role="tablist" className="mb-5 flex gap-1 border-b border-line">
        {([["pending", `Applications (${pending.length})`], ["all", "All instructors"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${tab === k ? "border-violet" : "border-transparent text-muted"}`}>{l}</button>
        ))}
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <DataTable head={["Instructor", "Headline", "Status", "Payouts", "Applied", ""]} min={820} empty={!shown.length ? <p className="px-4 py-10 text-center text-ink-2">{tab === "pending" ? "No applications waiting." : "No instructors yet."}</p> : null}>
          {shown.map((i) => (
            <tr key={i.userId}>
              <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar name={i.name} size={32} /><span><span className="block font-bold">{i.name}</span><span className="text-xs text-muted">{i.email}</span></span></span></td>
              <td className="max-w-xs px-4 py-3 text-ink-2">{i.headline ?? "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
              <td className="px-4 py-3 text-ink-2">{i.payoutsEnabled ? "Enabled" : "Not set up"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(i.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {i.status !== "approved" ? <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => decide(i.userId, "approve")} data-testid="approve-instructor">{busy === i.userId + "approve" ? <Loader2 className="size-4 animate-spin" /> : null}Approve</button> : null}
                {i.status === "pending" ? <button type="button" className="btn btn-ghost btn-sm ml-1 text-rose" disabled={!!busy} onClick={() => decide(i.userId, "reject")}>Reject</button> : null}
              </td>
            </tr>
          ))}
        </DataTable>
      ) : !error ? <Skeleton className="h-80" /> : null}
    </>
  );
}
