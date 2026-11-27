import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import { CourseCover } from "./CourseCover";
import { money } from "@/lib/format";
import type { RelatedCourse } from "@/lib/types";

/**
 * "Continue your learning journey" (owner 2026-11-28; docs/COURSE_PLATFORM_REFERENCE.md › Recommendations).
 * One component, three places: the course page (`section`), the player after the last lesson and the Student Studio
 * (`compact`). Optional and unobtrusive: renders nothing when there's nothing to recommend, never inside a video, never a
 * pop-up. A course the viewer already owns shows "Continue learning", never a price.
 */
export function RelatedCourses({ items, variant = "section", title = "Continue your learning journey", intro, max = 3, className = "" }: {
  items: RelatedCourse[];
  variant?: "section" | "compact";
  title?: string;
  intro?: string;
  max?: number;
  className?: string;
}) {
  const list = items.filter((r) => r.slug).slice(0, max);
  if (!list.length) return null;
  if (variant === "compact") {
    return (
      <section aria-labelledby="related-h" className={`rounded-panel border border-line bg-surface p-4 sm:p-5 ${className}`} data-testid="related-courses">
        <h2 id="related-h" className="font-display text-base font-bold text-ink">{title}</h2>
        {intro ? <p className="mt-1 text-sm text-ink-2">{intro}</p> : null}
        <ul className="mt-3 divide-y divide-line">
          {list.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-0">
              <Link href={`/courses/${r.slug}`} className="w-24 shrink-0 sm:w-28" tabIndex={-1} aria-hidden="true">
                <CourseCover slug={r.slug} title={r.title} thumbnailUrl={r.coverUrl} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/courses/${r.slug}`} className="line-clamp-2 font-display text-sm font-bold leading-snug text-ink hover:text-violet">{r.title}</Link>
                {r.reason ? <p className="mt-0.5 line-clamp-2 text-[0.82rem] text-ink-2">{r.reason}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1"><Cta r={r} compact /></div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  return (
    <section aria-labelledby="related-h" className={className} data-testid="related-courses">
      <h2 id="related-h" className="font-display text-2xl font-extrabold">{title}</h2>
      {intro ? <p className="mt-1 max-w-2xl text-ink-2">{intro}</p> : null}
      <ul className={`mt-6 grid gap-5 ${list.length > 1 ? "sm:grid-cols-2" : "max-w-md"} ${list.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {list.map((r) => (
          <li key={r.id} className="flex min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface">
            <Link href={`/courses/${r.slug}`} aria-hidden="true" tabIndex={-1}>
              <CourseCover slug={r.slug} title={r.title} thumbnailUrl={r.coverUrl} className="!rounded-none" />
            </Link>
            <div className="flex flex-1 flex-col p-4">
              <Link href={`/courses/${r.slug}`} className="font-display font-bold leading-snug text-ink hover:text-violet">{r.title}</Link>
              {r.reason ? <p className="mt-1.5 text-sm text-ink-2">{r.reason}</p> : r.subtitle ? <p className="mt-1.5 line-clamp-3 text-sm text-ink-2">{r.subtitle}</p> : null}
              <div className="mt-auto flex items-center justify-between gap-3 pt-4"><Cta r={r} /></div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Cta({ r, compact = false }: { r: RelatedCourse; compact?: boolean }) {
  if (r.owned) {
    return (
      <Link href={`/learn/${r.slug}`} className={compact ? "link inline-flex items-center gap-1 text-sm" : "btn btn-outline btn-sm"} data-testid="related-continue">
        <PlayCircle className="size-4" />Continue learning
      </Link>
    );
  }
  const sale = r.priceCents < r.listPriceCents;
  return (
    <>
      <span className={`whitespace-nowrap font-display font-bold tabular-nums text-ink ${compact ? "text-sm" : ""}`}>
        {sale ? <s className="mr-1.5 text-sm font-normal text-muted">{money(r.listPriceCents, r.currency)}</s> : null}
        {money(r.priceCents, r.currency)}
      </span>
      <Link href={`/courses/${r.slug}`} className={compact ? "link inline-flex items-center gap-1 text-sm" : "btn btn-outline btn-sm"} aria-label={`View ${r.title}`}>
        View course<ArrowRight className="size-4" />
      </Link>
    </>
  );
}
