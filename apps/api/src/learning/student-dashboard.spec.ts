import { activitySeries, dayKey, quizSummary } from './student-dashboard.service';

const now = new Date('2026-11-28T15:00:00Z');
const at = (iso: string) => new Date(iso);

describe('student dashboard: activity', () => {
  it('builds 30 UTC days ending today, every day present', () => {
    const a = activitySeries(now, 30, [], []);
    expect(a.days).toHaveLength(30);
    expect(a.days[29]!.date).toBe('2026-11-28');
    expect(a.days[0]!.date).toBe('2026-10-30');
    expect(a.activeDays).toBe(0);
    expect(a.streak).toBe(0);
  });

  it('counts a lesson once per day however often it was opened, plus quiz attempts', () => {
    const a = activitySeries(now, 30, [
      { lectureId: 'l1', at: at('2026-11-28T08:00:00Z') },
      { lectureId: 'l1', at: at('2026-11-28T09:00:00Z') },
      { lectureId: 'l2', at: at('2026-11-28T10:00:00Z') },
    ], [{ at: at('2026-11-28T11:00:00Z') }]);
    expect(a.days[29]).toEqual({ date: '2026-11-28', lessons: 2, quizzes: 1 });
    expect(a.lessonsOpened).toBe(2);
    expect(a.quizAttempts).toBe(1);
  });

  it('streak counts consecutive active days ending today, or yesterday if today is still empty', () => {
    const opened = ['2026-11-25', '2026-11-26', '2026-11-27'].map((d) => ({ lectureId: d, at: at(`${d}T12:00:00Z`) }));
    expect(activitySeries(now, 30, opened, []).streak).toBe(3);
    expect(activitySeries(now, 30, [...opened, { lectureId: 'x', at: at('2026-11-28T01:00:00Z') }], []).streak).toBe(4);
    expect(activitySeries(now, 30, [{ lectureId: 'old', at: at('2026-11-20T12:00:00Z') }], []).streak).toBe(0);
  });

  it('ignores activity outside the window', () => {
    const a = activitySeries(now, 30, [{ lectureId: 'old', at: at('2026-09-01T12:00:00Z') }], []);
    expect(a.lessonsOpened).toBe(0);
    expect(dayKey(at('2026-11-28T23:59:59Z'))).toBe('2026-11-28');
  });
});

describe('student dashboard: quiz results', () => {
  const c1 = { slug: 'c1', title: 'Course one' };
  const c2 = { slug: 'c2', title: 'Course two' };
  it('uses the best score per quiz, averages per course and overall, latest attempts first', () => {
    const q = quizSummary([
      { score: 50, at: at('2026-11-20T10:00:00Z'), quizId: 'q1', lectureId: 'l1', lectureTitle: 'Quiz 1', course: c1 },
      { score: 100, at: at('2026-11-21T10:00:00Z'), quizId: 'q1', lectureId: 'l1', lectureTitle: 'Quiz 1', course: c1 },
      { score: 80, at: at('2026-11-22T10:00:00Z'), quizId: 'q2', lectureId: 'l2', lectureTitle: 'Quiz 2', course: c1 },
      { score: 60, at: at('2026-11-23T10:00:00Z'), quizId: 'q3', lectureId: 'l3', lectureTitle: 'Quiz 3', course: c2 },
    ]);
    expect(q.quizzesTaken).toBe(3);
    expect(q.attempts).toBe(4);
    expect(q.averageScore).toBe(80); // (100 + 80 + 60) / 3
    expect(q.courses).toEqual([{ slug: 'c1', title: 'Course one', quizzes: 2, averageScore: 90 }, { slug: 'c2', title: 'Course two', quizzes: 1, averageScore: 60 }]);
    expect(q.recent[0]!.lectureId).toBe('l3');
  });

  it('is empty, not zero, without attempts', () => {
    const q = quizSummary([]);
    expect(q.averageScore).toBeNull();
    expect(q.courses).toEqual([]);
  });
});
