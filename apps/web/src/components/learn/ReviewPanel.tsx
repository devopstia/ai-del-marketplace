"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, MessageSquareReply, Pencil, Star } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { Stars } from "@/components/Stars";

export interface MyReview { rating: number; body: string; status: string; instructorReply: string | null; updatedAt: string }
export interface ReviewInfo { average: number; count: number; canReview: boolean; mine: MyReview | null }

export function toReviewInfo(r: unknown): ReviewInfo {
  const o = obj(r); const rt = obj(o.rating); const m = o.myReview ? obj(o.myReview) : null;
  return {
    average: Number(rt.average ?? 0), count: Number(rt.count ?? 0), canReview: o.canReview === true,
    mine: m ? { rating: Number(m.rating), body: String(m.body ?? ""), status: String(m.status ?? "visible"), instructorReply: (m.instructorReply as string) ?? null, updatedAt: String(m.updatedAt ?? m.createdAt ?? "") } : null,
  };
}

const WORDS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** 1–5 stars as a radio group: arrow keys, hover preview, a word for the choice. */
function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Your rating" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}, ${WORDS[n]}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}
            onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange(Math.min(5, (value || 0) + 1)); } if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange(Math.max(1, (value || 2) - 1)); } }}
            className="grid size-11 place-items-center rounded-lg hover:bg-surface-2" data-testid={`star-${n}`}>
            <Star className={`size-7 ${n <= shown ? "text-amber" : "text-muted/50"}`} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <span className="min-w-20 text-sm font-bold text-ink-2" aria-live="polite">{shown ? WORDS[shown] : "Choose a rating"}</span>
    </div>
  );
}

export function ReviewPanel({ slug, info, onSaved }: { slug: string; info: ReviewInfo; onSaved: (i: ReviewInfo) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState(!info.mine);
  const [rating, setRating] = useState(info.mine?.rating ?? 0);
  const [body, setBody] = useState(info.mine?.body ?? "");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) { toast("error", "Choose 1 to 5 stars."); return; }
    setBusy(true);
    try {
      const r = obj(await api(`/courses/${slug}/reviews`, { method: "POST", body: { rating, body: body.trim() } }));
      const cr = obj(r.courseRating);
      onSaved({ ...info, average: Number(cr.average ?? info.average), count: Number(cr.count ?? info.count), mine: { rating, body: body.trim(), status: String(r.status ?? "visible"), instructorReply: (r.instructorReply as string) ?? null, updatedAt: String(r.updatedAt ?? new Date().toISOString()) } });
      toast("ok", info.mine ? "Your review is updated." : "Thanks! Your review is posted.");
      setEditing(false);
    } catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <div className="grid max-w-4xl gap-8 md:grid-cols-[14rem_minmax(0,1fr)]" data-testid="review-panel">
      <div>
        <p className="text-sm font-bold text-muted">Course rating</p>
        {info.count ? (
          <>
            <p className="mt-1 font-display text-5xl font-extrabold tabular-nums" data-testid="course-rating">{info.average.toFixed(1)}</p>
            <Stars value={info.average} size={18} className="mt-1" />
            <p className="mt-1 text-sm text-ink-2" data-testid="review-count">{info.count.toLocaleString("en-US")} review{info.count === 1 ? "" : "s"}</p>
          </>
        ) : <p className="mt-1 text-ink-2" data-testid="course-rating">No reviews yet. Yours can be the first.</p>}
        <Link href={`/courses/${slug}#reviews`} className="link mt-3 inline-block text-sm">Read all reviews</Link>
      </div>

      <div className="min-w-0">
        {!info.canReview ? (
          <p className="rounded-tile border border-line bg-surface p-4 text-ink-2">Only enrolled students can review this course. You’re viewing it as its instructor or an admin.</p>
        ) : editing ? (
          <form onSubmit={save} className="rounded-tile border border-line bg-surface p-5" data-testid="review-form">
            <h2 className="font-display text-xl font-bold">{info.mine ? "Edit your review" : "Rate this course"}</h2>
            <p className="mt-1 text-sm text-ink-2">Your rating helps other engineers choose, and tells the instructor what works.</p>
            <div className="mt-4"><StarInput value={rating} onChange={setRating} /></div>
            <label className="label mt-4" htmlFor="review-body">Your review <span className="font-normal text-muted">(optional)</span></label>
            <textarea id="review-body" className="field min-h-32" maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you build? What was clear, and what could be better?" data-testid="review-body" />
            <p className="hint">{body.length.toLocaleString("en-US")} / 4,000 · Shown on the course page with your name.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={busy || !rating} data-testid="review-save">{busy ? <Loader2 className="size-4 animate-spin" /> : null}{info.mine ? "Update review" : "Post review"}</button>
              {info.mine ? <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setRating(info.mine!.rating); setBody(info.mine!.body); }}>Cancel</button> : null}
            </div>
          </form>
        ) : info.mine ? (
          <div className="rounded-tile border border-line bg-surface p-5" data-testid="my-review">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-muted">Your review</p>
                <div className="mt-1 flex items-center gap-2"><Stars value={info.mine.rating} size={18} /><span className="text-sm font-bold">{WORDS[info.mine.rating]}</span></div>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)} data-testid="review-edit"><Pencil className="size-4" />Edit</button>
            </div>
            {info.mine.body ? <p className="mt-3 whitespace-pre-wrap text-ink-2">{info.mine.body}</p> : <p className="mt-3 text-sm text-muted">No written review. Add a few words any time.</p>}
            <p className="mt-3 text-xs text-muted">{info.mine.updatedAt ? `Last updated ${date(info.mine.updatedAt)}` : null}</p>
            {info.mine.status !== "visible" ? <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-sm font-bold text-amber">Our moderators hid this review from the course page. Only you can see it. Editing it doesn’t make it public again; contact support if you think this is a mistake.</p> : null}
            {info.mine.instructorReply ? (
              <div className="mt-4 border-l-2 border-violet pl-4">
                <p className="flex items-center gap-1.5 text-sm font-bold"><MessageSquareReply className="size-4 text-violet" />Instructor’s reply</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-2">{info.mine.instructorReply}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
