import { mergeRanges, type Range } from '../access/consumption';
import { attemptItems, questionId, type QuizQuestion } from '../learning/quiz-model';

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
 * one learner counts once). Answers are matched by question id (attempts since 2026-11-28) or, for older attempts, by
 * position when the attempt had the current number of questions; a question needs enough learners to be shown.
 */
export function quizMisses(questions: { id?: string; q: string; correct: number }[], latestAnswers: unknown[]): { index: number; q: string; wrongPct: number; answered: number }[] {
  const tally = new Map<string, { answered: number; wrong: number }>();
  for (const a of latestAnswers) {
    if (Array.isArray(a) && (a.length !== questions.length || !a.every((x) => typeof x === 'number'))) continue; // older version of the quiz
    for (const it of attemptItems(a, questions as QuizQuestion[])) {
      const t = tally.get(it.id) ?? { answered: 0, wrong: 0 };
      t.answered++;
      if (!it.correct) t.wrong++;
      tally.set(it.id, t);
    }
  }
  return questions
    .map((q, i) => ({ index: i, q: q.q, t: tally.get(questionId(q)) ?? { answered: 0, wrong: 0 } }))
    .filter((x) => x.t.answered >= MIN_SAMPLE)
    .map((x) => ({ index: x.index, q: x.q, answered: x.t.answered, wrongPct: Math.round((x.t.wrong / x.t.answered) * 100) }))
    .sort((a, b) => b.wrongPct - a.wrongPct || a.index - b.index);
}
