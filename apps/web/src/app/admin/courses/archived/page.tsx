"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { paged } from "@/lib/normalize";
import { qs } from "@/lib/qs";
import { date } from "@/lib/format";
import { toAdminCourse } from "@/lib/admin-courses";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Empty";
import { Pager } from "@/components/Pager";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

const map = (r: unknown) => paged(r, toAdminCourse, "courses");
const TABS = [
  { key: "archived", label: "Archived", sub: "Kept for later. Never deleted unless you ask. Enrolled learners keep their access until it ends." },
  { key: "deleting", label: "Deletion scheduled", sub: "Restorable until the deletion date. Content is removed after it, once no paid year of access is still running. Orders, refunds and certificates are always kept." },
  { key: "purged", label: "Deleted", sub: "Videos, files and lessons were removed. The course name stays on receipts and certificates." },
] as const;

/** Super Admin › Courses › Archived courses (owner 2026-11-26): archive vs scheduled deletion, with dates and days left. */
export default function ArchivedCourses() {
  const { me } = useAuth();
  const toast = useToast();
  const superAdmin = !!me?.roles.includes("super_admin");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("archived");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, error, reload } = useApi(`/admin/courses${qs({ view: tab, page, pageSize: 25 })}`, map);
  const t = TABS.find((x) => x.key === tab)!;

  async function act(id: string, action: "restore" | "cancel-deletion", msg: string) {
    setBusy(`${action}:${id}`);
    try { await api(`/admin/courses/${id}/${action}`, { method: "POST" }); toast("ok", msg); reload(); }
    catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }

  return (
    <>
      <PageHead title="Archived courses" sub={t.sub} actions={<Link href="/admin/courses" className="btn btn-outline btn-sm">All courses</Link>} />
      <div role="tablist" aria-label="Archive" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button key={x.key} role="tab" type="button" aria-selected={tab === x.key} className={`btn btn-sm ${tab === x.key ? "btn-primary" : "btn-outline"}`} onClick={() => { setTab(x.key); setPage(1); }} data-testid={`archive-tab-${x.key}`}>{x.label}</button>
        ))}
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <>
          <DataTable head={tab === "deleting" ? ["Course", "Instructor", "Deletion requested", "Deleted on", "Days left", ""] : tab === "archived" ? ["Course", "Instructor", "Archived", "Reason", "Learners", ""] : ["Course", "Instructor", "Deleted", "", "", ""]} min={820}
            empty={!data.items.length ? <p className="px-4 py-10 text-center text-ink-2">{tab === "archived" ? "No archived courses." : tab === "deleting" ? "No deletions scheduled." : "No deleted courses."}</p> : null}>
            {data.items.map((c) => (
              <tr key={c.id} data-testid="archived-row">
                <td className="max-w-xs px-4 py-3 font-bold"><Link href={`/admin/courses/${c.id}`} className="hover:text-violet">{c.title}</Link></td>
                <td className="px-4 py-3">{c.instructor?.name ?? "—"}</td>
                {tab === "archived" ? (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">{c.archivedAt ? date(c.archivedAt) : "—"}</td>
                    <td className="px-4 py-3 text-ink-2">{c.archiveReason ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{c.students}</td>
                  </>
                ) : tab === "deleting" ? (
                  <>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">{c.deleteRequestedAt ? date(c.deleteRequestedAt) : "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-2">{c.deleteAfter ? date(c.deleteAfter) : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status="deleting" /> <span className="ml-1 font-bold tabular-nums">{c.daysLeft ?? 0}</span></td>
                  </>
                ) : (
                  <><td className="whitespace-nowrap px-4 py-3 text-ink-2">{c.purgedAt ? date(c.purgedAt) : "—"}</td><td /><td /></>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {superAdmin && tab !== "purged" ? (
                    <span className="inline-flex flex-wrap justify-end gap-2">
                      {tab === "deleting" ? <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void act(c.id, "cancel-deletion", "Deletion cancelled. The course stays archived.")} data-testid="cancel-deletion">{busy === `cancel-deletion:${c.id}` ? <Loader2 className="size-4 animate-spin" /> : null}Keep archived</button> : null}
                      <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => void act(c.id, "restore", "Course restored to the status it had before.")} data-testid="restore-course">{busy === `restore:${c.id}` ? <Loader2 className="size-4 animate-spin" /> : null}Restore</button>
                    </span>
                  ) : <Link href={`/admin/courses/${c.id}`} className="link text-sm">View</Link>}
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="courses" />
        </>
      ) : !error ? <Skeleton className="h-72" /> : null}
    </>
  );
}
