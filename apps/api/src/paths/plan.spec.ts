import { cleanSkills, lectureRemaining, MAX_WEEK_ITEMS, type PlanStep, skillMap, weeklyPlan } from './plan';

const NOW = new Date('2026-11-26T10:00:00Z');
const lec = (id: string, remainingSec: number, done = false) => ({ id, title: `Lesson ${id}`, remainingSec, done });
const step = (slug: string, lectures: PlanStep['lectures'], hasAccess = true): PlanStep => ({ courseId: `c-${slug}`, slug, title: `Course ${slug}`, hasAccess, lectures });

describe('lectureRemaining', () => {
  it('is the length minus unique seconds watched, never negative, zero once completed', () => {
    expect(lectureRemaining({ durationSec: 600, watchedSec: 0, completed: false })).toBe(600);
    expect(lectureRemaining({ durationSec: 600, watchedSec: 250, completed: false })).toBe(350);
    expect(lectureRemaining({ durationSec: 600, watchedSec: 900, completed: false })).toBe(0);
    expect(lectureRemaining({ durationSec: 600, watchedSec: 10, completed: true })).toBe(0);
  });
});

describe('weeklyPlan', () => {
  it('fills the week in path order and dates the finish from the remaining time', () => {
    // 2 h a week; lesson 1 is done, 3.5 h left
    const steps = [step('a', [lec('1', 3600, true), lec('2', 3600), lec('3', 1800)]), step('b', [lec('4', 3600), lec('5', 3600)])];
    const p = weeklyPlan(steps, 2, NOW);
    expect(p.remainingSec).toBe(3600 + 1800 + 3600 + 3600);
    expect(p.thisWeek.map((w) => w.lectureId)).toEqual(['2', '3']); // 1.5 h; lesson 4 would make 2.5 h
    expect(p.thisWeekSec).toBe(5400);
    expect(p.weeks).toBe(2); // 3.5 h / 2 h
    expect(p.finishOn).toBe('2026-12-09'); // 12 600 s / (7200 / 7) s a day = 12.25 → 13 days
    expect(p.blockedBy).toBeNull();
  });

  it('always offers the next lesson, even when it is longer than the week', () => {
    const p = weeklyPlan([step('a', [lec('1', 5 * 3600), lec('2', 60)])], 1, NOW);
    expect(p.thisWeek.map((w) => w.lectureId)).toEqual(['1']);
  });

  it('stops at the first course the student has not bought', () => {
    const p = weeklyPlan([step('a', [lec('1', 600)]), step('b', [lec('2', 600)], false), step('c', [lec('3', 600)])], 10, NOW);
    expect(p.thisWeek.map((w) => w.lectureId)).toEqual(['1']);
    expect(p.blockedBy).toEqual({ courseId: 'c-b', slug: 'b', title: 'Course b' });
    expect(p.remainingSec).toBe(1800); // the finish date still counts every course
  });

  it('skips finished courses, even ones no longer owned', () => {
    const p = weeklyPlan([step('a', [lec('1', 0, true)], false), step('b', [lec('2', 600)])], 5, NOW);
    expect(p.blockedBy).toBeNull();
    expect(p.thisWeek.map((w) => w.lectureId)).toEqual(['2']);
  });

  it('caps the list but not the finish date', () => {
    const many = Array.from({ length: 30 }, (_, i) => lec(String(i), 60));
    const p = weeklyPlan([step('a', many)], 40, NOW);
    expect(p.thisWeek).toHaveLength(MAX_WEEK_ITEMS);
    expect(p.remainingSec).toBe(1800);
    expect(p.finishOn).toBe('2026-11-27'); // under a day → tomorrow
  });

  it('is complete when nothing is left', () => {
    const p = weeklyPlan([step('a', [lec('1', 0, true)])], 5, NOW);
    expect(p).toMatchObject({ remainingSec: 0, weeks: 0, finishOn: null, thisWeek: [], blockedBy: null });
  });

  it('clamps the hours to 1–40', () => {
    expect(weeklyPlan([], 0, NOW).hoursPerWeek).toBe(1);
    expect(weeklyPlan([], 99, NOW).hoursPerWeek).toBe(40);
  });
});

describe('skillMap', () => {
  it('done, in progress or needed, best state wins, first spelling kept', () => {
    const m = skillMap([
      { skills: ['Docker', 'Linux'], percent: 100 },
      { skills: ['docker', 'Kubernetes'], percent: 40 },
      { skills: ['Helm', 'kubernetes'], percent: 0 },
    ]);
    expect(m).toEqual([
      { skill: 'Docker', state: 'done' },
      { skill: 'Linux', state: 'done' },
      { skill: 'Kubernetes', state: 'in_progress' },
      { skill: 'Helm', state: 'needed' },
    ]);
  });
});

describe('cleanSkills', () => {
  it('trims, drops blanks and duplicates, caps length and count', () => {
    expect(cleanSkills(['  Docker ', 'docker', '', 'CI/CD  pipelines'])).toEqual(['Docker', 'CI/CD pipelines']);
    expect(cleanSkills(['x'.repeat(60)])[0]).toHaveLength(40);
    expect(cleanSkills(Array.from({ length: 20 }, (_, i) => `s${i}`))).toHaveLength(12);
  });
});
