import type { Prisma } from '../generated/prisma/client';
import { type CurrentPrice, toPriceInput } from '../common/sale-pricing';

/** Prisma include for the public course card. */
export const cardInclude = {
  instructor: { select: { id: true, name: true, instructorProfile: { select: { isPlatform: true } } } },
  category: { select: { slug: true, name: true } },
  sections: { select: { lectures: { select: { durationSec: true, isPreview: true } } } },
} satisfies Prisma.CourseInclude;

export type CardRow = Prisma.CourseGetPayload<{ include: typeof cardInclude }>;

/** Pricing inputs of a card row. */
export const cardPriceInput = (c: CardRow) => toPriceInput(c);

/** Public course card. `priceCents` is what a learner pays now; `listPriceCents` is the regular price. */
export function toCard(c: CardRow, imageUrl: (k: string | null) => string | null, price?: CurrentPrice) {
  const lectures = c.sections.flatMap((s) => s.lectures);
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    // The generated standard cover (custom uploads are not used: owner 2026-11-25).
    thumbnailUrl: imageUrl(c.coverKey),
    instructor: { id: c.instructor.id, name: c.instructor.name },
    category: c.category,
    priceCents: price?.priceCents ?? c.priceCents,
    listPriceCents: c.priceCents,
    sale: price?.sale ?? null,
    currency: c.currency,
    ratingAvg: Math.round(c.ratingAvg * 10) / 10,
    ratingCount: c.ratingCount,
    studentCount: c.studentCount,
    totalDurationSec: lectures.reduce((n, l) => n + l.durationSec, 0),
    lectureCount: lectures.length,
    hasPreview: lectures.some((l) => l.isPreview),
    outcome: c.objectives?.[0] ?? null,
    level: c.level,
    language: c.language,
    publishedAt: c.publishedAt,
  };
}
