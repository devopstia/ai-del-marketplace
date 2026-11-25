"use client";
import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { paged, toStudioCourse } from "@/lib/normalize";
import { qs } from "@/lib/qs";
import { Pager, useDebounced } from "@/components/Pager";
import { compact, date, money } from "@/lib/format";
import { PageHead, DataTable } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/Empty";
import { Modal } from "@/components/Modal";
import { AdminDecision } from "@/components/AdminDecision";

const map = (r: unknown) => paged(r, toStudioCourse, "courses");
const statuses = ["", "published", "in_review", "changes_requested", "draft", "unpublished", "rejected"];

export default function AdminCourses() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounced(q.trim());
  const { data, error, reload } = useApi(`/admin/courses${qs({ q: dq.length > 1 ? dq : undefined, status, page, pageSize: 25 })}`, map);
  const [unpub, setUnpub] = useState<string | null>(null);
  const shown = data?.items ?? [];
  return (
    <>
      <PageHead title="Courses" sub="Every course on the platform, in any status." />
      <div className="mb-4 flex flex-wrap gap-2">
        <input type="search" aria-label="Search courses" className="field !w-72 max-w-full" placeholder="Search title or instructor" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select aria-label="Status" className="field !w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          {statuses.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All statuses"}</option>)}
        </select>
      </div>
      {error ? <p className="text-rose">{error}</p> : null}
      {data ? (
        <>
        <DataTable head={["Course", "Instructor", "Status", "Price", "Students", "Updated", ""]} min={860} empty={!shown.length ? <p className="px-4 py-10 text-center text-ink-2">No courses match.</p> : null}>
          {shown.map((c) => (
            <tr key={c.id}>
              <td className="max-w-xs px-4 py-3 font-bold">{c.status === "published" && c.slug ? <Link href={`/courses/${c.slug}`} className="hover:text-violet">{c.title}</Link> : c.title}</td>
              <td className="px-4 py-3">{c.instructor?.name ?? "—"}</td>
              <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
              <td className="px-4 py-3 tabular-nums">{money(c.priceCents, c.currency)}</td>
              <td className="px-4 py-3 tabular-nums">{compact(c.studentCount ?? 0)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-2">{date(c.updatedAt)}</td>
              <td className="px-4 py-3 text-right">
                {c.status === "in_review" || (c.revision?.status === "in_review") ? <Link href="/admin/review" className="link text-sm">Review</Link> : c.status === "published" ? <button type="button" className="link text-sm !text-rose" onClick={() => setUnpub(c.id)}>Unpublish</button> : null}
              </td>
            </tr>
          ))}
        </DataTable>
        <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} noun="courses" />
        </>
      ) : !error ? <Skeleton className="h-96" /> : null}
      <Modal open={!!unpub} onClose={() => setUnpub(null)} title="Unpublish course">
        <div className="p-5">
          <p className="mb-4 text-ink-2">Enrolled learners keep access. The course disappears from search and can’t be bought until it’s approved again.</p>
          {unpub ? <AdminDecision courseId={unpub} actions={["unpublish"]} onDone={() => { setUnpub(null); reload(); }} /> : null}
        </div>
      </Modal>
    </>
  );
}
