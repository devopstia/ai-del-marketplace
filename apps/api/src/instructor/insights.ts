import { mergeRanges, type Range } from '../access/consumption';

/**
 * Instructor insights (owner 2026-11-26, idea 5): pure numbers from what learners actually played and answered. Nothing is
 * estimated, and nothing is shown for fewer than MIN_SAMPLE learners so no single learner can be singled out.
 */
export const MIN_SAMPLE = 5;
export const BUCKETS = 10;
/** A tenth of a video counts as watched when the learner played at least half of it. */
const WATCHED_SHARE = 0.5;

/**
 * Retention: for each tenth of the video, the share (0–100) of viewers who watched at least half of that tenth, from their
 * merged playback ranges. Skipping ahead doesn't count as watching, replays don't count twice.
 */
export function retentionCurve(viewers: Range[][], durationSec: number, buckets = BUCKETS): number[] {
  if (!viewers.length || durationSec <= 0) return Array.from({ length: buckets }, () => 0);
  const size = durationSec / buckets;
  const counts = new Array<number>(buckets).fill(0);
  for (const raw of viewers) {
    const ranges = mergeRanges(raw, durationSec);
    for (let b = 0; b < buckets; b++) {
      const lo = b * size, hi = (b + 1) * size;
      let covered = 0;
      for (const [a, z] of ranges) covered += Math.max(0, Math.min(hi, z) - Math.max(lo, a));
      if (covered >= size * WATCHED_SHARE) counts[b]!++;
    }
  }
  return counts.map((c) => Math.round((c / viewers.length) * 100));
}

/** The steepest fall between two neighbouring tenths: where learners stop watching. Null when nothing falls. */
export function biggestDrop(curve: number[]): { at: number; drop: number } | null {
  let best: { at: number; drop: number } | null = null;
  for (let i = 1; i < curve.length; i++) {
    const drop = curve[i - 1]! - curve[i]!;
    if (drop > 0 && (!best || drop > best.drop)) best = { at: i, drop };
  }
  return best;
}

/** Average unique share of the video watched (0–100), from each viewer's watched seconds. */
export function averageWatched(watchedSec: number[], durationSec: number): number {
  if (!watchedSec.length || durationSec <= 0) return 0;
  const sum = watchedSec.reduce((a, s) => a + Math.min(1, Math.max(0, s) / durationSec), 0);
  return Math.round((sum / watchedSec.length) * 100);
}

/**
 * Quiz questions answered wrong most often, from each learner's latest attempt (a retry replaces the earlier answer, so
 * one learner counts once). Attempts made with a different number of questions (the quiz was edited) are left out.
 */
export function quizMisses(questions: { q: string; correct: number }[], latestAnswers: unknown[]): { index: number; q: string; wrongPct: number; answered: number }[] {
  const valid = latestAnswers.filter((a): a is number[] => Array.isArray(a) && a.length === questions.length && a.every((x) => typeof x === 'number'));
  if (valid.length < MIN_SAMPLE) return [];
  return questions
    .map((q, i) => ({ index: i, q: q.q, answered: valid.length, wrongPct: Math.round((valid.filter((a) => a[i] !== q.correct).length / valid.length) * 100) }))
    .sort((a, b) => b.wrongPct - a.wrongPct || a.index - b.index);
}
