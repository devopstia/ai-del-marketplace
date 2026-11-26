/** Rate limits for "Ask about this course" (pure; counts come from the ai_usage table). */
export interface AskLimits {
  perMinute: number;
  perDay: number;
  platformPerDay: number;
}
export interface AskCounts {
  /** This learner's questions in the last 60 seconds, including the one being checked. */
  lastMinute: number;
  /** This learner's questions since 00:00 UTC, including the one being checked. */
  today: number;
  /** Everyone's questions since 00:00 UTC, including the one being checked. */
  platformToday: number;
}
export type LimitDecision = { ok: true; remainingToday: number } | { ok: false; reason: 'minute' | 'day' | 'platform'; retryAfterSec: number; message: string };

export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function limitDecision(c: AskCounts, l: AskLimits, now = new Date()): LimitDecision {
  const untilTomorrow = Math.ceil((startOfUtcDay(now).getTime() + 86_400_000 - now.getTime()) / 1000);
  if (c.platformToday > l.platformPerDay) return { ok: false, reason: 'platform', retryAfterSec: untilTomorrow, message: 'The course assistant has reached today’s limit. Please try again tomorrow.' };
  if (c.today > l.perDay) return { ok: false, reason: 'day', retryAfterSec: untilTomorrow, message: `You’ve asked ${l.perDay} questions today, the daily limit. You can ask again tomorrow.` };
  if (c.lastMinute > l.perMinute) return { ok: false, reason: 'minute', retryAfterSec: 60, message: 'You’re asking quickly. Please wait a minute and try again.' };
  return { ok: true, remainingToday: Math.max(0, l.perDay - c.today) };
}
