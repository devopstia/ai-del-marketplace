import type { Prisma } from '../generated/prisma/client';

/** Prisma include for the public course card. */
export const cardInclude = {
  instructor: { select: { id: true, name: true } },
  category: { select: { slug: true, name: true } },
  sections: { select: { lectures: { select: { durationSec: true } } } },
} satisfies Prisma.CourseInclude;

export type CardRow = Prisma.CourseGetPayload<{ include: typeof cardInclude }>;

export function toCard(c: CardRow, imageUrl: (k: string | null) => string | null) {
  const lectures = c.sections.flatMap((s) => s.lectures);
  return {
    id: c.id,
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    thumbnailUrl: imageUrl(c.thumbnailKey),
    instructor: { id: c.instructor.id, name: c.instructor.name },
    category: c.category,
    priceCents: c.priceCents,
    currency: c.currency,
    ratingAvg: Math.round(c.ratingAvg * 10) / 10,
    ratingCount: c.ratingCount,
    studentCount: c.studentCount,
    totalDurationSec: lectures.reduce((n, l) => n + l.durationSec, 0),
    lectureCount: lectures.length,
    level: c.level,
    language: c.language,
    publishedAt: c.publishedAt,
  };
}
