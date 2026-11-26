"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, obj, toCategory, toStudioCourse } from "@/lib/normalize";
import { compact, date, money, plural } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { CourseCover } from "@/components/CourseCover";
import { Empty, Skeleton } from "@/components/Empty";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";

const mapCourses = (r: unknown) => list(r, "courses").map(toStudioCourse);
const mapCats = (r: unknown) => list(r, "categories").map(toCategory);

function NewCourse({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const cats = useApi(open ? "/categories" : null, mapCats);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Create a course">
      <form className="space-y-5 p-5" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const r = obj(await api("/instructor/courses", { method: "POST", body: { title, categoryId: categoryId || undefined } }));
          const id = String(r.id ?? obj(r.course).id);
          router.push(`/studio/courses/${id}`);
        } catch (err) { toast("error", errMsg(err)); setBusy(false); }
      }}>
        <div>
          <label className="label" htmlFor="nc-title">Working title</label>
          <input id="nc-title" className="field" required minLength={4} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ship an MCP server to Kubernetes" />
          <p className="hint">You can change it later. Learners see it once the course is published.</p>
        </div>
        <div>
          <label className="label" htmlFor="nc-cat">Category</label>
          <select id="nc-cat" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose later</option>
            {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} data-testid="create-course">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Create course</button>
        </div>
      </form>
    </Modal>
  );
}

function CoursesInner() {
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Open the create dialog when arriving from a "New course" link.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (sp.get("new")) setOpen(true);
  }, [sp]);
  const { data, error } = useApi("/instructor/courses", mapCourses);
  return (
    <>
      <PageHead title="Courses" sub="Drafts, courses in review and everything you’ve published." actions={<button type="button" className="btn btn-primary" onClick={() => setOpen(true)} data-testid="new-course"><Plus className="size-4" />New course</button>} />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-64" /> : null}
      {data && !data.length ? <Empty icon={BookOpen} title="Create your first course" body="Start with a working title. The studio walks you through details, media, curriculum, pricing and review." /> : null}
      {data && data.length ? (
        <ul className="grid gap-4">
          {data.map((c) => (
            <li key={c.id}>
              <Link href={`/studio/courses/${c.id}`} className="grid gap-4 rounded-panel border border-line bg-surface p-3 hover:border-line-strong sm:grid-cols-[180px_1fr_auto] sm:items-center sm:p-4">
                <CourseCover slug={c.slug || c.id} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} size="sm" />
                <div className="min-w-0 px-1">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} />{c.revision ? <span className="chip !py-0 text-xs">{c.revision.status === "in_review" ? "Changes in review" : c.revision.status === "changes_requested" ? "Changes requested" : "Draft changes"}</span> : null}{c.category ? <span className="text-xs text-muted">{c.category.name}</span> : null}</div>
                  <p className="mt-1.5 font-display text-lg font-bold leading-snug">{c.title || "Untitled course"}</p>
                  <p className="mt-1 text-sm text-muted">{c.lectureCount ? `${plural(c.lectureCount, "lecture")}, ` : ""}updated {date(c.updatedAt)}</p>
                  {c.status === "changes_requested" && c.reviewNote ? <p className="mt-2 line-clamp-2 rounded-lg bg-cyan-soft px-3 py-2 text-sm text-ink-2"><b>Reviewer:</b> {c.reviewNote}</p> : null}
                </div>
                <dl className="flex gap-6 px-1 text-sm sm:flex-col sm:gap-1 sm:text-right">
                  <div><dt className="sr-only">Price</dt><dd className="font-display font-bold">{money(c.priceCents, c.currency)}</dd></div>
                  <div><dt className="sr-only">Students</dt><dd className="text-muted">{compact(c.studentCount ?? 0)} {(c.studentCount ?? 0) === 1 ? "student" : "students"}</dd></div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <NewCourse open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function StudioCourses() {
  return <Suspense><CoursesInner /></Suspense>;
}
