"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Eye, EyeOff, Flag, Loader2, MessageSquareText, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { WatchedBadge } from "@/components/WatchedBadge";
import { qs } from "@/lib/qs";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { PageHead } from "@/components/shell/AppShell";
import { Stars } from "@/components/Stars";
import { Empty, Skeleton } from "@/components/Empty";
import { Modal } from "@/components/Modal";
import { Pager, useDebounced } from "@/components/Pager";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";
import { ListFilters, type FilterOptions } from "@/components/ListFilters";
import { useUrlFilters } from "@/lib/url-filters";

interface Rep { id: string; reasonLabel: string; details: string; status: string; createdAt: string; reporter: string | null; resolvedBy: string | null; resolution: string | null }
interface Row { id: string; rating: number; body: string; status: "visible" | "hidden"; createdAt: string; instructorReply: string | null; watchedPercent?: number | null; completed?: boolean; author: { name: string; email: string }; course: { title: string; slug: string; instructor: { name: string } }; reports: Rep[] }
type Act = { kind: "hidden" | "visible" | "delete"; row: Row } | { kind: "dismiss"; row: Row; report: Rep };

/**
 * Super Admin Studio › Marketplace › Course reviews (owner 2026-11-25): every review, with filters; reports from
 * instructors first. Hide/restore with a reason (admins with reviews.moderate), delete only as super admin.
 * A low rating is never a reason to remove a review.
 */
export default function CourseReviews() {
  return <Suspense fallback={<Skeleton className="h-64" />}><CourseReviewsInner /></Suspense>;
}

const FILTER_KEYS = ["view", "rating", "q", "course", "instructor", "page"] as const;

function CourseReviewsInner() {
  const toast = useToast();
  const { has } = useAuth();
  // Filters live in the URL; no view = "Reported".
  const [f, setF] = useUrlFilters(FILTER_KEYS);
  const view: "reported" | "all" | "hidden" = f.view === "all" || f.view === "hidden" ? f.view : "reported";
  const rating = f.rating;
  const page = Math.max(1, Number(f.page) || 1);
  const [q, setQ] = useState(f.q);
  const dq = useDebounced(q.trim());
  useEffect(() => {
    const v = dq.length > 1 ? dq : "";
    if (v !== f.q) setF({ q: v, page: null });
  }, [dq, f.q, setF]);
  const opts = useApi("/admin/reviews/filters", (r) => obj(r) as unknown as FilterOptions);
  const filtered = !!(f.q || f.rating || f.course || f.instructor);
  const { data, error, reload } = useApi(`/admin/reviews${qs({ reported: view === "reported" ? "true" : undefined, status: view === "hidden" ? "hidden" : undefined, rating: rating || undefined, q: f.q || undefined, courseId: f.course || undefined, instructorId: f.instructor || undefined, page, pageSize: 20 })}`,
    (r) => obj(r) as unknown as { items: Row[]; total: number; page: number; pageSize: number; counts: { total: number; hidden: number; openReports: number } });
  const [act, setAct] = useState<Act | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!act) return;
    setBusy(true);
    try {
      if (act.kind === "delete") await api(`/admin/reviews/${act.row.id}`, { method: "DELETE", body: { reason } });
      else if (act.kind === "dismiss") await api(`/admin/review-reports/${act.report.id}/dismiss`, { method: "POST", body: { note: reason } });
      else await api(`/admin/reviews/${act.row.id}/status`, { method: "POST", body: { status: act.kind, reason } });
      toast("ok", { delete: "Review deleted. The course rating was recalculated.", dismiss: "Report dismissed. The review stays.", hidden: "Review hidden. The course rating was recalculated.", visible: "Review restored." }[act.kind]);
      setAct(null); setReason(""); reload();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(false); }
  }

  const c = data?.counts;
  return (
    <>
      <PageHead title="Course reviews" sub="Moderate spam, abuse, fake reviews and personal data. Honest feedback stays, including one-star ratings. Every action needs a reason and is recorded." />
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
        <div role="tablist" className="flex gap-1">
          {([["reported", `Reported${c?.openReports ? ` (${c.openReports})` : ""}`], ["all", `All${c ? ` (${c.total})` : ""}`], ["hidden", `Hidden${c?.hidden ? ` (${c.hidden})` : ""}`]] as const).map(([k, l]) => (
            <button key={k} role="tab" type="button" aria-selected={view === k} onClick={() => setF({ view: k === "reported" ? null : k, page: null })} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold ${view === k ? "border-violet text-ink" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          <input type="search" aria-label="Search reviews" className="field !w-60" placeholder="Course, learner or words" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Rating" className="field !w-auto" value={rating} onChange={(e) => setF({ rating: e.target.value, page: null })}><option value="">Any rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}</select>
        </div>
      </div>
      <ListFilters label="Filter reviews" options={opts.data} values={{ instructor: f.instructor, course: f.course }} onChange={(v) => setF({ instructor: v.instructor, course: v.course, page: null })} />
      {error ? <p className="mt-4 text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="mt-5 h-64" /> : null}
      {data && !data.items.length ? <div className="mt-6"><Empty icon={MessageSquareText} title={filtered ? "No reviews match these filters" : view === "reported" ? "No reports waiting" : "No reviews here"} body={filtered ? "Change or clear the filters to see more." : view === "reported" ? "Instructors can report reviews that break the policy; they appear here." : "Reviews appear once learners rate courses."} /></div> : null}
      {data?.items.length ? (
        <>
          <ul className="mt-5 space-y-3">
            {data.items.map((r) => {
              const open = r.reports.filter((x) => x.status === "open");
              return (
                <li key={r.id} className={`rounded-tile border bg-surface p-5 ${open.length ? "border-amber/60" : "border-line"}`} data-testid="moderation-row">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size={15} /><span className="text-sm font-bold">{r.author.name}</span><span className="text-xs text-muted">{r.author.email} · {date(r.createdAt)}</span>{r.status === "hidden" ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-2">Hidden</span> : null}</p>
                      <p className="mt-1 text-sm text-muted"><Link href={`/courses/${r.course.slug}`} className="link">{r.course.title}</Link> · {r.course.instructor.name}</p>
                      <WatchedBadge watchedPercent={r.watchedPercent} completed={r.completed} className="mt-1" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.status === "visible"
                        ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setAct({ kind: "hidden", row: r })} data-testid="hide-review"><EyeOff className="size-4" />Hide</button>
                        : <button type="button" className="btn btn-outline btn-sm" onClick={() => setAct({ kind: "visible", row: r })}><Eye className="size-4" />Restore</button>}
                      {has("super_admin") ? <button type="button" className="btn btn-ghost btn-sm text-rose" onClick={() => setAct({ kind: "delete", row: r })} data-testid="delete-review"><Trash2 className="size-4" />Delete</button> : null}
                    </div>
                  </div>
                  <p className="mt-3 max-w-3xl whitespace-pre-line text-ink-2">{r.body || <span className="italic text-muted">Rating only.</span>}</p>
                  {r.reports.length ? (
                    <ul className="mt-4 space-y-2">
                      {r.reports.map((x) => (
                        <li key={x.id} className="flex flex-wrap items-start gap-3 rounded-lg bg-surface-2/70 px-3 py-2 text-sm">
                          <Flag className={`mt-0.5 size-4 shrink-0 ${x.status === "open" ? "text-amber" : "text-muted"}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1"><b className="text-ink">{x.reasonLabel}</b> · reported by {x.reporter ?? "an instructor"} on {date(x.createdAt)}<span className="block text-ink-2">{x.details}</span>{x.status !== "open" ? <span className="block text-xs text-muted">{x.status === "dismissed" ? "Dismissed" : "Acted on"} by {x.resolvedBy}: {x.resolution}</span> : null}</span>
                          {x.status === "open" ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAct({ kind: "dismiss", row: r, report: x })}>Dismiss</button> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(n) => setF({ page: n > 1 ? n : null })} noun="reviews" />
        </>
      ) : null}
      <Modal open={!!act} onClose={() => { setAct(null); setReason(""); }} title={act ? { hidden: "Hide this review", visible: "Restore this review", delete: "Delete this review", dismiss: "Dismiss the report" }[act.kind] : ""}>
        {act ? (
          <div className="space-y-4 p-5">
            <p className="text-ink-2">{act.kind === "delete" ? "The review is removed for good and the course rating is recalculated. A copy is kept in the audit log." : act.kind === "hidden" ? "Learners no longer see it and it no longer counts in the rating. You can restore it later." : act.kind === "visible" ? "It becomes public again and counts in the rating." : "The review stays as it is."}</p>
            <blockquote className="border-l-2 border-line pl-3 text-sm text-ink-2">{act.row.rating}★ {act.row.body.slice(0, 200) || "Rating only"}</blockquote>
            <div><label className="label" htmlFor="mod-reason">{act.kind === "dismiss" ? "Note" : "Reason (kept in the moderation history)"}</label><input id="mod-reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={act.kind === "dismiss" ? "Honest feedback, no policy violation" : "Advertising, not a course review"} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setAct(null)}>Cancel</button>
              <button type="button" className={`btn ${act.kind === "delete" ? "btn-danger" : "btn-primary"}`} disabled={busy || reason.trim().length < (act.kind === "dismiss" ? 3 : 5)} onClick={confirm} data-testid="confirm-moderation">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{{ hidden: "Hide review", visible: "Restore review", delete: "Delete for good", dismiss: "Dismiss report" }[act.kind]}</button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
