"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { qs } from "@/lib/qs";
import { Pager } from "@/components/Pager";
import { paged, toAdminInstructor } from "@/lib/normalize";
import { date } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { TermsDialog } from "@/components/admin/TermsDialog";
import type { AdminInstructor } from "@/lib/types";

const map = (r: unknown) => paged(r, toAdminInstructor, "instructors");

export default function AdminInstructors() {
  const toast = useToast();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [page, setPage] = useState(1);
  const { data, error, setData } = useApi(`/admin/instructors${qs({ status: tab === "pending" ? "pending" : undefined, page, pageSize: 25 })}`, map);
  const waiting = useApi("/admin/instructors?status=pending&pageSize=1", map);
  const [busy, setBusy] = useState<string | null>(null);
  const { me } = useAuth();
  const superAdmin = !!me?.roles.includes("super_admin");
  const [editing, setEditing] = useState<AdminInstructor | null>(null);
  const settings = useApi("/admin/settings", (r) => Number((r as { commission_bps?: number }).commission_bps ?? 2000));
  const defaultShare = (10000 - (settings.data ?? 2000)) / 100;
  const termsLabel = (i: AdminInstructor) =>
    i.isPlatform ? "DEL course" : `${i.commissionBps != null ? `${(10000 - i.commissionBps) / 100}% (agreed)` : `${defaultShare}%`}${i.payToPlatform ? ", paid to DEL" : ""}`;
  async function decide(id: string, a: "approve" | "reject") {
    let note: string | undefined;
    if (a === "reject") {
      note = window.prompt("Why is this application rejected? The applicant sees this note.")?.trim();
      if (!note) return;
    }
    setBusy(id + a);
    try {
      await api(`/admin/instructors/${id}/${a}`, { method: "POST", body: note ? { note } : {} });
      setData((d) => d ? { ...d, items: d.items.map((i) => (i.userId === id ? { ...i, status: a === "approve" ? "approved" : "rejected" } : i)) } : null);
      waiting.reload();
      toast("ok", a === "approve" ? "Instructor approved. Their studio is unlocked." : "Application rejected.");
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  const shown = data?.items ?? [];
  const pendingCount = waiting.data?.total;
  return (
    <>
      <PageHead title="Instructors" sub="Approve applications and see who can publish." />
      <div role="tablist" className="mb-5 flex gap-1 border-b border-line">
        {([["pending", pendingCount == null ? "Applications" : `Applications (${pendingCount})`], ["all", "All instructors"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold ${tab === k ? "border-violet" : "border-transparent text-muted"}`}>{l}</button>
        ))}
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <>
        <DataTable head={["Instructor", "Headline", "Status", "Share", "Payouts", "Applied", ""]} min={820} empty={!shown.length ? <p className="px-4 py-10 text-center text-ink-2">{tab === "pending" ? "No applications waiting." : "No instructors yet."}</p> : null}>
          {shown.map((i) => (
            <tr key={i.userId}>
              <td className="px-4 py-3"><span className="flex items-center gap-3"><Avatar name={i.name} size={32} /><span><span className="block font-bold">{i.name}</span><span className="text-xs text-muted">{i.email}</span></span></span></td>
              <td className="max-w-xs px-4 py-3 text-ink-2">{i.headline ?? "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{termsLabel(i)}</td>
              <td className="px-4 py-3 text-ink-2">{i.isPlatform ? "Not needed" : i.payoutsEnabled ? "Enabled" : "Not set up"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(i.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                {i.status !== "approved" ? <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => decide(i.userId, "approve")} data-testid="approve-instructor">{busy === i.userId + "approve" ? <Loader2 className="size-4 animate-spin" /> : null}Approve</button> : null}
                {i.status === "pending" ? <button type="button" className="btn btn-ghost btn-sm ml-1 text-rose" disabled={!!busy} onClick={() => decide(i.userId, "reject")}>Reject</button> : null}
                {superAdmin && i.status === "approved" && !i.isPlatform ? <button type="button" className="btn btn-outline btn-sm ml-1" onClick={() => setEditing(i)} data-testid="edit-terms">Edit terms</button> : null}
              </td>
            </tr>
          ))}
        </DataTable>
        <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="instructors" />
        <TermsDialog key={editing?.userId ?? "none"} i={editing} defaultSharePercent={defaultShare} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); window.location.reload(); }} />
        </>
      ) : !error ? <Skeleton className="h-80" /> : null}
    </>
  );
}
