"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { obj } from "@/lib/normalize";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

export function ReviewForm({ slug, enrolled: enrolledProp }: { slug: string; enrolled?: boolean }) {
  const { me } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [enrolled, setEnrolled] = useState(!!enrolledProp);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!me || enrolledProp) return;
    api(`/me/access/${slug}`).then((r) => { if (obj(r).access) setEnrolled(true); }).catch(() => {});
  }, [me, slug, enrolledProp]);

  if (!me || !enrolled || done) return null;
  return (
    <form
      className="panel mb-8 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!rating) return toast("error", "Choose a star rating first.");
        setBusy(true);
        try {
          await api(`/courses/${slug}/reviews`, { method: "POST", body: { rating, body } });
          toast("ok", "Review posted. Thanks for helping other learners choose.");
          setDone(true);
          router.refresh();
        } catch (err) {
          toast("error", errMsg(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3 className="font-display font-bold">Rate this course</h3>
      <p className="text-sm text-muted">Only enrolled learners can review, so every rating here is from a real student.</p>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)} className="rounded p-0.5">
            <Star className={`size-7 ${(hover || rating) >= n ? "text-amber" : "text-muted/45"}`} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <label htmlFor="review-body" className="label mt-4">What should other learners know?</label>
      <textarea id="review-body" className="field" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="What did you build? What could be clearer?" />
      <button className="btn btn-primary mt-3" disabled={busy}>Post review</button>
    </form>
  );
}
