"use client";
import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { paged } from "@/lib/normalize";
import { toAdminCourse } from "@/lib/admin-courses";
import { qs } from "@/lib/qs";
import { Pager, useDebounced } from "@/components/Pager";
import { compact, date, money } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Empty";
import { useAuth } from "@/components/AuthProvider";

const map = (r: unknown) => paged(r, toAdminCourse, "courses");
const statuses = ["", "published", "in_review", "changes_requested", "draft", "unpublished", "rejected"];

/** Super Admin › Courses: every course on the platform, whoever teaches it (archived ones are in Archived courses). */
export default function AdminCourses() {
  const { me } = useAuth();
  const superAdmin = !!me?.roles.includes("super_admin");
  const [status, setStatus] = useState("");
  const [featured, setFeatured] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const { data, error } = useApi(`/admin/courses${qs({ q: dq.length > 1 ? dq : undefined, status, featured: featured ? "true" : undefined, page, pageSize: 25 })}`, map);
  const shown = data?.items ?? [];
  return (
    <>
      <PageHead title="Courses" sub={superAdmin ? "Every course on the platform, whoever teaches it. Open one to preview, edit, publish, feature or archive it." : "Every course on the platform, in any status."} actions={<Link href="/admin/courses/archived" className="btn btn-outline btn-sm">Archived courses</Link>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" aria-label="Search courses" className="field !w-72 max-w-full" placeholder="Search title or instructor" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select aria-label="Status" className="field !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {statuses.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm font-bold text-ink-2"><input type="checkbox" className="size-4 accent-[var(--violet)]" checked={featured} onChange={(e) => { setFeatured(e.target.checked); setPage(1); }} />Featured only</label>
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <>
          <DataTable head={["Course", "Instructor", "Status", "Price", "Students", "Updated", ""]} min={860} empty={!shown.length ? <p className="px-4 py-10 text-center text-ink-2">No courses match.</p> : null}>
            {shown.map((c) => (
              <tr key={c.id} data-testid="admin-course-row">
                <td className="max-w-xs px-4 py-3 font-bold">
                  <Link href={`/admin/courses/${c.id}`} className="hover:text-violet">{c.title}</Link>
                  {c.featured ? <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-soft px-2 py-0.5 align-middle text-xs font-bold text-amber"><Star className="size-3" aria-hidden="true" />Featured</span> : null}
                </td>
                <td className="px-4 py-3">{c.instructor?.name ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 tabular-nums">{money(c.priceCents, c.currency)}</td>
                <td className="px-4 py-3 tabular-nums">{compact(c.students)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(c.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  {c.status === "in_review" || c.revision?.status === "in_review" ? <Link href="/admin/review" className="link mr-3 text-sm">Review</Link> : null}
                  <Link href={`/admin/courses/${c.id}`} className="btn btn-outline btn-sm" data-testid="open-course">{superAdmin ? "Manage" : "View"}</Link>
                </td>
              </tr>
            ))}
          </DataTable>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="courses" />
        </>
      ) : !error ? <Skeleton className="h-96" /> : null}
    </>
  );
}
