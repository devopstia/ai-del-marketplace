"use client";
import { useState } from "react";
import { Flag, Loader2, MessageSquareReply } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { list, toReview } from "@/lib/normalize";
import { date } from "@/lib/format";
import type { Review } from "@/lib/types";
import { PageHead } from "@/components/shell/AppShell";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { Empty, Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";

const map = (r: unknown) => list(r, "reviews").map(toReview);

function Reply({ r, onDone }: { r: Review; onDone: (text: string) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(r.instructorReply ?? "");
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" className="link mt-3 inline-flex items-center gap-1.5 text-sm" onClick={() => setOpen(true)}><MessageSquareReply className="size-4" />{r.instructorReply ? "Edit reply" : "Reply publicly"}</button>;
  return (
    <form className="mt-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        await api(`/instructor/reviews/${r.id}/reply`, { method: "POST", body: { reply: text } });
        onDone(text);
        setOpen(false);
        toast("ok", "Reply posted.");
      } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
    }}>
      <label className="sr-only" htmlFor={`reply-${r.id}`}>Your reply</label>
      <textarea id={`reply-${r.id}`} className="field" value={text} onChange={(e) => setText(e.target.value)} required maxLength={2000} placeholder="Thank them, answer their question, or explain what you’ve changed." />
      <div className="mt-2 flex gap-2"><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Post reply</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

const REASONS: [string, string][] = [["spam", "Spam or advertising"], ["abusive", "Harassment or abuse"], ["fake", "Fake or not a real learner"], ["off_topic", "Not about the course"], ["personal_data", "Personal information"], ["other", "Other policy violation"]];

/** Report a review to DEL. Instructors never delete reviews; honest low ratings stay (owner 2026-11-25). */
function Report({ r, reported, onDone }: { r: Review; reported: boolean; onDone: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (reported) return <span className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted" data-testid="reported"><Flag className="size-4" />Reported to DEL</span>;
  if (!open) return <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-muted hover:text-rose" onClick={() => setOpen(true)} data-testid="report-review"><Flag className="size-4" />Report</button>;
  return (
    <form className="mt-3 max-w-2xl rounded-tile border border-line bg-surface-2/60 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      try {
        await api(`/instructor/reviews/${r.id}/report`, { method: "POST", body: { reason, details } });
        toast("ok", "Reported. DEL reviews it and keeps you posted.");
        setOpen(false);
        onDone();
      } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
    }}>
      <p className="text-sm text-ink-2">Report a review that breaks the review policy. Negative but honest feedback, including one-star ratings, stays published.</p>
      <label className="label mt-3" htmlFor={`rr-${r.id}`}>Reason</label>
      <select id={`rr-${r.id}`} className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <label className="label mt-3" htmlFor={`rd-${r.id}`}>What is wrong with it</label>
      <textarea id={`rd-${r.id}`} className="field" rows={3} required minLength={10} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="For example: it advertises another site; the person never took the course." />
      <div className="mt-3 flex gap-2"><button className="btn btn-primary btn-sm" disabled={busy || details.trim().length < 10} data-testid="send-report">{busy ? <Loader2 className="size-4 animate-spin" /> : null}Send report</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>
  );
}

export default function ReviewsPage() {
  const reports = useApi("/instructor/review-reports", (r) => ((r as { items?: { reviewId: string; status: string }[] }).items ?? []));
  const openReported = new Set((reports.data ?? []).filter((x) => x.status === "open").map((x) => x.reviewId));
  const { data, error, setData } = useApi("/instructor/reviews", map);
  const [filter, setFilter] = useState<"all" | "unanswered">("all");
  const shown = (data ?? []).filter((r) => filter === "all" || !r.instructorReply);
  return (
    <>
      <PageHead title="Reviews" sub="Replies are public on your course page. A thoughtful reply often matters more to future learners than the rating."
        actions={
          <div role="radiogroup" aria-label="Filter" className="flex rounded-lg border border-line bg-surface p-1">
            {(["all", "unanswered"] as const).map((f) => <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-sm font-bold ${filter === f ? "bg-ink text-paper" : "text-ink-2 hover:bg-surface-2"}`}>{f === "all" ? "All" : "Needs a reply"}</button>)}
          </div>
        } />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-80" /> : null}
      {data && !shown.length ? <Empty icon={MessageSquareReply} title={filter === "all" ? "No reviews yet" : "You’ve replied to everything"} body={filter === "all" ? "Reviews appear once learners rate your courses." : "Nice. New reviews will show up here."} /> : null}
      <ul className="divide-y divide-line rounded-panel border border-line bg-surface">
        {shown.map((r) => (
          <li key={r.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={r.user.name} size={40} />
              <div className="min-w-0 flex-1"><p className="font-bold">{r.user.name}</p><p className="text-xs text-muted">{r.course?.title}{r.course ? ", " : ""}{date(r.createdAt)}</p></div>
              <Stars value={r.rating} size={15} />
            </div>
            <p className="mt-3 max-w-3xl text-ink-2">{r.body || <span className="italic text-muted">Rating only, no written review.</span>}</p>
            {r.instructorReply ? <div className="mt-3 max-w-3xl border-l-2 border-violet pl-3 text-sm"><p className="font-bold">Your reply</p><p className="text-ink-2">{r.instructorReply}</p></div> : null}
            <div className="flex flex-wrap items-center gap-x-6">
              <Reply r={r} onDone={(text) => setData((d) => d?.map((x) => (x.id === r.id ? { ...x, instructorReply: text } : x)) ?? null)} />
              <Report r={r} reported={openReported.has(r.id)} onDone={() => reports.reload()} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
