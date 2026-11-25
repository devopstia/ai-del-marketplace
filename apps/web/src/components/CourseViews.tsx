import Link from "next/link";
import { Clock, Users, BarChart3 } from "lucide-react";
import type { CourseCard } from "@/lib/types";
import { compact, hours, levelLabel, money, plural } from "@/lib/format";
import { CourseCover } from "./CourseCover";
import { RatingInline } from "./Stars";

export function Price({ cents, currency, className = "" }: { cents: number; currency?: string; className?: string }) {
  return <span className={`font-display font-extrabold ${cents ? "text-ink" : "text-mint"} ${className}`}>{money(cents, currency)}</span>;
}

/** Cover with text beneath — no card chrome, so grids read like a shelf, not a dashboard. */
export function CourseTile({ c, priority = false }: { c: CourseCard; priority?: boolean }) {
  return (
    <Link href={`/courses/${c.slug}`} className="group block rounded-tile" data-testid="course-tile" data-priority={priority || undefined}>
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      <h3 className="mt-3 line-clamp-2 font-display text-[1.02rem] font-bold leading-snug text-ink group-hover:text-violet">{c.title}</h3>
      <p className="mt-1 truncate text-sm text-muted">{c.instructor.name}</p>
      <div className="mt-1.5"><RatingInline avg={c.ratingAvg} count={c.ratingCount} /></div>
      <div className="mt-1.5 flex items-baseline gap-3">
        <Price cents={c.priceCents} currency={c.currency} className="text-[1.05rem]" />
        <span className="text-xs text-muted">{hours(c.totalDurationSec)}</span><span className="text-xs text-muted">{levelLabel[c.level]}</span>
      </div>
    </Link>
  );
}

/** Horizontal result row for search: cover, facts, price. */
export function CourseResultRow({ c }: { c: CourseCard }) {
  return (
    <Link href={`/courses/${c.slug}`} className="group grid grid-cols-[112px_1fr] gap-4 rounded-tile py-5 sm:grid-cols-[240px_1fr_auto] sm:gap-6" data-testid="course-row">
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} size="sm" className="sm:hidden" />
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} className="hidden sm:block" />
      <div className="min-w-0">
        <h3 className="font-display text-[1.05rem] font-bold leading-snug text-ink group-hover:text-violet sm:text-lg">{c.title}</h3>
        <p className="mt-1 line-clamp-2 hidden text-[0.95rem] text-ink-2 sm:block">{c.subtitle}</p>
        <p className="mt-1 text-sm text-muted">{c.instructor.name}</p>
        <div className="mt-1.5"><RatingInline avg={c.ratingAvg} count={c.ratingCount} /></div>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{hours(c.totalDurationSec)}</span>
          {c.lectureCount ? <span>{plural(c.lectureCount, "lecture")}</span> : null}
          <span className="inline-flex items-center gap-1"><BarChart3 className="size-3.5" />{levelLabel[c.level]}</span>
          {c.studentCount ? <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{compact(c.studentCount)} students</span> : null}
        </p>
        <Price cents={c.priceCents} currency={c.currency} className="mt-2 block text-lg sm:hidden" />
      </div>
      <Price cents={c.priceCents} currency={c.currency} className="hidden text-xl sm:block" />
    </Link>
  );
}

/** Result card for the two-column catalogue grid: cover on top, then the same facts as the result row. */
export function CourseResultCard({ c }: { c: CourseCard }) {
  return (
    <Link href={`/courses/${c.slug}`} className="group flex flex-col rounded-tile" data-testid="course-row">
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      <div className="mt-4 flex items-start justify-between gap-4">
        <h3 className="font-display text-lg font-bold leading-snug text-ink group-hover:text-violet">{c.title}</h3>
        <Price cents={c.priceCents} currency={c.currency} className="shrink-0 text-xl" />
      </div>
      {c.subtitle ? <p className="mt-1.5 line-clamp-2 text-[0.95rem] text-ink-2">{c.subtitle}</p> : null}
      <p className="mt-1.5 text-sm text-muted">{c.instructor.name}</p>
      <div className="mt-1.5"><RatingInline avg={c.ratingAvg} count={c.ratingCount} /></div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><Clock className="size-3.5" />{hours(c.totalDurationSec)}</span>
        {c.lectureCount ? <span>{plural(c.lectureCount, "lecture")}</span> : null}
        <span className="inline-flex items-center gap-1"><BarChart3 className="size-3.5" />{levelLabel[c.level]}</span>
        {c.studentCount ? <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{compact(c.studentCount)} {c.studentCount === 1 ? "student" : "students"}</span> : null}
      </p>
    </Link>
  );
}
