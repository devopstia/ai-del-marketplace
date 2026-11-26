/**
 * Career path weekly plan and skill map (owner 2026-11-26, idea 4; docs/CAREER_PATHS.md). Pure functions: the service
 * gives them real numbers only (lesson lengths, unique seconds watched, completed lessons); nothing is guessed here.
 */

export const MIN_HOURS_PER_WEEK = 1;
export const MAX_HOURS_PER_WEEK = 40;
/** Most lessons a week's list shows (the finish date still counts every lesson). */
export const MAX_WEEK_ITEMS = 12;
const DAY_MS = 86400_000;

export interface PlanLecture { id: string; title: string; remainingSec: number; done: boolean }
export interface PlanStep { courseId: string; slug: string; title: string; hasAccess: boolean; lectures: PlanLecture[] }
export interface WeekItem { lectureId: string; title: string; courseSlug: string; courseTitle: string; remainingSec: number }

export interface WeeklyPlan {
  hoursPerWeek: number;
  /** Study time left in the whole path, in seconds (lessons not completed, minus what was already watched). */
  remainingSec: number;
  /** Weeks left at this pace (0 when everything is done). */
  weeks: number;
  /** Estimated finish date at this pace, or null when the path is complete. */
  finishOn: string | null;
  /** The next lessons, in order, that fit this week's hours (always at least one while something is left). */
  thisWeek: WeekItem[];
  thisWeekSec: number;
  /** The first course in the way that the student doesn't have yet: the week stops there. */
  blockedBy: { courseId: string; slug: string; title: string } | null;
}

export const clampHours = (h: number) => Math.min(MAX_HOURS_PER_WEEK, Math.max(MIN_HOURS_PER_WEEK, Math.round(h)));

/** Seconds left in one lesson: nothing when completed, else its length minus the unique seconds already watched. */
export function lectureRemaining(l: { durationSec: number; watchedSec: number; completed: boolean }) {
  if (l.completed) return 0;
  return Math.max(0, l.durationSec - Math.max(0, l.watchedSec));
}

export function weeklyPlan(steps: PlanStep[], hoursPerWeek: number, now = new Date()): WeeklyPlan {
  const hours = clampHours(hoursPerWeek);
  const budget = hours * 3600;
  const remainingSec = steps.reduce((n, s) => n + s.lectures.reduce((m, l) => m + (l.done ? 0 : l.remainingSec), 0), 0);
  const open = steps.some((s) => s.lectures.some((l) => !l.done));

  const thisWeek: WeekItem[] = [];
  let used = 0;
  let blockedBy: WeeklyPlan['blockedBy'] = null;
  walk: for (const s of steps) {
    const left = s.lectures.filter((l) => !l.done);
    if (!left.length) continue;
    if (!s.hasAccess) { blockedBy = { courseId: s.courseId, slug: s.slug, title: s.title }; break; }
    for (const l of left) {
      if (thisWeek.length >= MAX_WEEK_ITEMS) break walk;
      // Always offer the next lesson, even when it is longer than the whole week; then only what still fits.
      if (thisWeek.length && used + l.remainingSec > budget) break walk;
      thisWeek.push({ lectureId: l.id, title: l.title, courseSlug: s.slug, courseTitle: s.title, remainingSec: l.remainingSec });
      used += l.remainingSec;
    }
  }

  const days = remainingSec > 0 ? Math.ceil(remainingSec / (budget / 7)) : 0;
  const finish = open ? new Date(now.getTime() + Math.max(1, days) * DAY_MS) : null;
  return {
    hoursPerWeek: hours,
    remainingSec,
    weeks: remainingSec > 0 ? Math.ceil(remainingSec / budget) : 0,
    finishOn: finish ? finish.toISOString().slice(0, 10) : null,
    thisWeek,
    thisWeekSec: used,
    blockedBy,
  };
}

export type SkillState = 'done' | 'in_progress' | 'needed';
const RANK: Record<SkillState, number> = { needed: 0, in_progress: 1, done: 2 };

/**
 * Skill map: a skill is done when a course that gives it is complete, in progress when such a course is started,
 * otherwise still needed. A skill given by several courses takes the best state. Order: as the path lists them.
 */
export function skillMap(steps: { skills: string[]; percent: number }[]) {
  const out = new Map<string, { skill: string; state: SkillState }>();
  for (const s of steps) {
    const state: SkillState = s.percent >= 100 ? 'done' : s.percent > 0 ? 'in_progress' : 'needed';
    for (const raw of s.skills) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      const had = out.get(key);
      if (!had || RANK[state] > RANK[had.state]) out.set(key, { skill: had?.skill ?? skill, state });
    }
  }
  return [...out.values()];
}

/** Clean skill tags: trimmed, 1–40 characters, no duplicates (case-insensitive), at most 12. */
export function cleanSkills(skills: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of skills) {
    const s = raw.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
    if (out.length === 12) break;
  }
  return out;
}
