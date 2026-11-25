"use client";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { obj } from "@/lib/normalize";
import { date } from "@/lib/format";
import { Stars } from "@/components/Stars";
import { CourseCover } from "@/components/CourseCover";
import { Empty, Skeleton } from "@/components/Empty";
import { PageHead } from "@/components/shell/AppShell";

interface Mine { id: string; rating: number; body: string; status: string; instructorReply: string | null; updatedAt: string; course: { slug: string; title: string; thumbnailUrl: string | null; ratingAvg: number; ratingCount: number } }
interface Pending { slug: string; title: string; thumbnailUrl: string | null }

/** Your reviews (edit them in the course player, where you took the course) and courses still waiting for a rating. */
export default function StudentReviews() {
  const { data, error } = useApi("/me/reviews", (r) => ({ items: (obj(r).items as Mine[]) ?? [], toReview: (obj(r).toReview as Pending[]) ?? [] }));
  return (
    <div className="max-w-4xl">
      <PageHead title="Course reviews" sub="Your ratings help other learners choose. You can change a review at any time." />
      {error ? <p className="text-rose">{error}</p> : null}
      {!data && !error ? <Skeleton className="h-48" /> : null}
      {data && data.toReview.length ? (
        <section aria-labelledby="todo-h" className="mb-10">
          <h2 id="todo-h" className="font-display text-xl font-extrabold">Waiting for your rating</h2>
          <ul className="mt-3 divide-y divide-line rounded-tile border border-line bg-surface">
            {data.toReview.map((c) => (
              <li key={c.slug} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3" data-testid="to-review">
                <CourseCover slug={c.slug} title={c.title} thumbnailUrl={c.thumbnailUrl} size="sm" showTitle={false} className="!rounded-lg" />
                <p className="line-clamp-2 font-bold">{c.title}</p>
                <Link href={`/learn/${c.slug}?tab=review`} className="btn btn-outline btn-sm">Rate course</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data ? (
        <section aria-labelledby="mine-h">
          <h2 id="mine-h" className="font-display text-xl font-extrabold">Your reviews</h2>
          {!data.items.length ? <div className="mt-3"><Empty icon={MessageSquareText} title="No reviews yet" body="Rate a course from its player once you have tried a few lessons." /></div> : (
            <ul className="mt-3 space-y-3">
              {data.items.map((r) => (
                <li key={r.id} className="rounded-tile border border-line bg-surface p-5" data-testid="my-review">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={`/courses/${r.course.slug}`} className="font-display text-lg font-bold hover:text-violet">{r.course.title}</Link>
                    <Link href={`/learn/${r.course.slug}?tab=review`} className="link text-sm">Edit review</Link>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted"><Stars value={r.rating} /><span>{r.rating} of 5 · updated {date(r.updatedAt)}</span>{r.status === "hidden" ? <span className="rounded-full bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber">Hidden by moderation</span> : null}</p>
                  {r.body ? <p className="mt-2 whitespace-pre-line text-ink-2">{r.body}</p> : null}
                  {r.instructorReply ? <p className="mt-3 border-l-2 border-violet pl-3 text-sm text-ink-2"><b className="text-ink">Instructor reply:</b> {r.instructorReply}</p> : null}
                  <p className="mt-3 text-xs text-muted">Course rating {r.course.ratingAvg.toFixed(1)} from {r.course.ratingCount} review{r.course.ratingCount === 1 ? "" : "s"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
