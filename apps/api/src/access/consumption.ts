import type { PrismaService } from '../common/prisma.service';

/**
 * How much of a course a student has really watched (owner 2026-11-25; the refund rule): unique seconds of video,
 * from ranges the player reports while it plays. Replaying a part never adds, skipping ahead never counts, and the
 * total is measured against the course's current video lessons (lessons added or removed after purchase included).
 */
export type Range = [number, number];

/** Merges ranges, clamps them to the lesson, drops empty ones. */
export function mergeRanges(ranges: Range[], durationSec: number): Range[] {
  const max = durationSec > 0 ? durationSec : Number.MAX_SAFE_INTEGER;
  const clean = ranges
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(max, Math.max(a, b))] as Range)
    .filter(([a, b]) => b - a >= 0.5)
    .sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const r of clean) {
    const last = out[out.length - 1];
    // Ranges closer than 1.5 s join (a save boundary or a tiny buffer stall, not a skip).
    if (last && r[0] <= last[1] + 1.5) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out.map(([a, b]) => [Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
}
export const rangeSeconds = (ranges: Range[]) => Math.round(ranges.reduce((n, [a, b]) => n + (b - a), 0));
export function parseRanges(raw: unknown): Range[] {
  return Array.isArray(raw) ? raw.filter((r): r is Range => Array.isArray(r) && r.length === 2 && r.every((x) => typeof x === 'number' && Number.isFinite(x))) : [];
}

export interface Consumption { totalSec: number; watchedSec: number; percent: number; lessons: number; lessonsStarted: number }

/** The course's consumption for one student, from stored playback ranges (never an estimate). */
export async function courseConsumption(prisma: PrismaService, userId: string, courseId: string): Promise<Consumption> {
  const lectures = await prisma.lecture.findMany({
    where: { section: { courseId }, type: 'video' },
    select: { durationSec: true, progress: { where: { userId }, select: { watchedSec: true } } },
  });
  const totalSec = lectures.reduce((a, l) => a + l.durationSec, 0);
  const watchedSec = lectures.reduce((a, l) => a + Math.min(l.durationSec, l.progress[0]?.watchedSec ?? 0), 0);
  return {
    totalSec, watchedSec, lessons: lectures.length, lessonsStarted: lectures.filter((l) => (l.progress[0]?.watchedSec ?? 0) > 0).length,
    // One decimal: 25.04 % is over the line; 25.0 % is not.
    percent: totalSec ? Math.round((watchedSec / totalSec) * 1000) / 10 : 0,
  };
}
