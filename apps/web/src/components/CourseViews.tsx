import Link from "next/link";
import { Check, Clock, Users, BarChart3, PlayCircle } from "lucide-react";
import type { CourseCard } from "@/lib/types";
import { compact, hours, levelLabel, money, plural } from "@/lib/format";
import { CourseCover } from "./CourseCover";
import { RatingInline } from "./Stars";
import { SaleEnds } from "./SaleEnds";
import type { SaleInfo } from "@/lib/types";

const NEW_FOR_DAYS = 30;
export const MIN_STUDENTS_SHOWN = 10;
const isNew = (publishedAt?: string | null) => !!publishedAt && Date.now() - new Date(publishedAt).getTime() < NEW_FOR_DAYS * 86400_000;

/** Rating once real reviews exist, "New" for 30 days after publishing, and a free-preview mark. */
export function CourseBadges({ c }: { c: CourseCard }) {
  return (
    <>
      {c.sale ? <SaleTag sale={c.sale} /> : null}
      {c.ratingCount ? <RatingInline avg={c.ratingAvg} count={c.ratingCount} /> : null}
      {isNew(c.publishedAt) && !c.sale ? <span className="rounded-full bg-cyan-soft px-2 py-0.5 text-xs font-bold text-cyan-ink">New</span> : null}
      {c.hasPreview ? <span className="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-mint"><PlayCircle className="size-3.5" />Free preview</span> : null}
    </>
  );
}

/** The price a learner pays; while a sale runs, the regular price is shown crossed out beside it. */
export function Price({ cents, currency, className = "", listCents }: { cents: number; currency?: string; className?: string; listCents?: number }) {
  const onSale = !!listCents && listCents > cents;
  if (!onSale) return <span className={`font-display font-extrabold ${cents ? "text-ink" : "text-mint"} ${className}`}>{money(cents, currency)}</span>;
  return (
    <span className="relative inline-flex flex-wrap items-baseline gap-x-2">
      <span className={`font-display font-extrabold text-ink ${className}`}><span className="sr-only">Sale price </span>{money(cents, currency)}</span>
      <s className="text-[0.85em] font-normal text-muted decoration-1"><span className="sr-only">Regular price </span>{money(listCents!, currency)}</s>
    </span>
  );
}

/** "−40%" and when the sale ends; promotion names are shown where there is room. */
export function SaleTag({ sale, withName = false, className = "" }: { sale: SaleInfo; withName?: boolean; className?: string }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}>
      <span className="rounded-full bg-rose-soft px-2 py-0.5 text-xs font-extrabold text-rose">−{sale.percentOff}%</span>
      {withName && sale.name ? <span className="font-bold text-ink">{sale.name}</span> : null}
      <SaleEnds endsAt={sale.endsAt} className="text-xs font-bold text-rose" />
    </span>
  );
}

/** Cover with text beneath — no card chrome, so grids read like a shelf, not a dashboard. */
export function CourseTile({ c, priority = false, coverSeed }: { c: CourseCard; priority?: boolean; coverSeed?: number }) {
  return (
    <Link href={`/courses/${c.slug}`} className="group block rounded-tile" data-testid="course-tile" data-priority={priority || undefined}>
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} seed={coverSeed} showTitle={false} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      <h3 className="mt-3 line-clamp-2 font-display text-[1.02rem] font-bold leading-snug text-ink group-hover:text-violet">{c.title}</h3>
      <p className="mt-1 truncate text-sm text-ink-2">{c.instructor.name}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm empty:hidden"><CourseBadges c={c} /></p>
      <div className="mt-2 flex items-baseline gap-3">
        <Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} className="text-[1.05rem]" />
        <span className="text-sm text-ink-2">{hours(c.totalDurationSec)}</span><span className="text-sm text-ink-2">{levelLabel[c.level]}</span>
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
        <span className="mt-2 block sm:hidden"><Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} className="text-lg" /></span>
      </div>
      <span className="hidden sm:block"><Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} className="text-xl" /></span>
    </Link>
  );
}


/** Result card for the two-column catalogue grid: cover on top, then the facts that help choose. */
export function CourseResultCard({ c, coverSeed }: { c: CourseCard; coverSeed?: number }) {
  return (
    <Link href={`/courses/${c.slug}`} className="group flex flex-col rounded-tile" data-testid="course-row">
      <CourseCover slug={c.slug} title={c.title} category={c.category?.name} thumbnailUrl={c.thumbnailUrl} seed={coverSeed} showTitle={false} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
      <div className="mt-4 flex items-start justify-between gap-4">
        <h3 className="font-display text-lg font-bold leading-snug text-ink group-hover:text-violet">{c.title}</h3>
        <span className="shrink-0 text-right"><Price cents={c.priceCents} listCents={c.listPriceCents} currency={c.currency} className="text-xl" /></span>
      </div>
      {c.subtitle ? <p className="mt-1.5 line-clamp-2 text-[0.95rem] text-ink-2">{c.subtitle}</p> : null}
      {c.outcome ? <p className="mt-2 flex items-start gap-1.5 text-sm text-ink"><Check className="mt-0.5 size-4 shrink-0 text-mint" aria-hidden="true" /><span className="line-clamp-1"><span className="sr-only">You will learn: </span>{c.outcome}</span></p> : null}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <span className="text-ink-2">{c.instructor.name}</span>
        <CourseBadges c={c} />
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
        <span className="inline-flex items-center gap-1.5"><Clock className="size-4 text-muted" />{hours(c.totalDurationSec)}</span>
        {c.lectureCount ? <span>{plural(c.lectureCount, "lecture")}</span> : null}
        <span className="inline-flex items-center gap-1.5"><BarChart3 className="size-4 text-muted" />{levelLabel[c.level]}</span>
        {c.studentCount >= MIN_STUDENTS_SHOWN ? <span className="inline-flex items-center gap-1.5"><Users className="size-4 text-muted" />{compact(c.studentCount)} students</span> : null}
      </p>
    </Link>
  );
}
