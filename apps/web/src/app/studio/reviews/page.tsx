"use client";
import { useState } from "react";
import { Loader2, MessageSquareReply } from "lucide-react";
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

export default function ReviewsPage() {
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
            <Reply r={r} onDone={(text) => setData((d) => d?.map((x) => (x.id === r.id ? { ...x, instructorReply: text } : x)) ?? null)} />
          </li>
        ))}
      </ul>
    </>
  );
}
