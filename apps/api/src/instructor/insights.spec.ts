import { averageWatched, biggestDrop, quizMisses, retentionCurve } from './insights';
import { InsightsService } from './insights.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
const actor = (id: string, roles: string[] = ['student', 'instructor']) => ({ user: { id, email: `${id}@x`, name: id, roles: roles as any }, ip: null });

describe('InsightsService (service-layer ownership)', () => {
  function build() {
    const views = Array.from({ length: 6 }, (_, i) => ({ userId: `s${i}`, lectureId: 'l1', watchedRanges: i < 3 ? [[0, 100]] : [[0, 30]], watchedSec: i < 3 ? 100 : 30 }));
    const prisma: any = {
      course: { findUnique: jest.fn(async () => ({ id: 'c1', title: 'C', slug: 'c', instructorId: 'owner' })) },
      section: { findMany: jest.fn(async () => [{ title: 'S', lectures: [{ id: 'l1', title: 'Intro', type: 'video', durationSec: 100, quiz: null }, { id: 'l2', title: 'Short', type: 'video', durationSec: 60, quiz: null }] }]) },
      lectureProgress: { findMany: jest.fn(async () => views) },
      quizAttempt: { findMany: jest.fn(async () => []) },
      aiUsage: { groupBy: jest.fn(async () => [{ lectureId: 'l1', _count: { _all: 4 } }]), count: jest.fn(async () => 4) },
      enrollment: { count: jest.fn(async () => 6) },
    };
    const audit = { log: jest.fn() };
    return { svc: new InsightsService(prisma, audit as any), prisma, audit };
  }

  it("refuses another instructor's course (404, nothing read)", async () => {
    const { svc, prisma } = build();
    await expect(svc.course(actor('intruder') as any, 'c1')).rejects.toMatchObject({ status: 404 });
    expect(prisma.lectureProgress.findMany).not.toHaveBeenCalled();
  });

  it('a plain admin is refused too; a super admin may look, and it is audited', async () => {
    await expect(build().svc.course(actor('a', ['admin']) as any, 'c1')).rejects.toMatchObject({ status: 404 });
    const { svc, audit } = build();
    await svc.course(actor('su', ['super_admin']) as any, 'c1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'course.insights_viewed', targetId: 'c1' }));
  });

  it('owner: curves only with enough viewers, own viewing left out, no learner ids in the result', async () => {
    const { svc, prisma, audit } = build();
    const r = await svc.course(actor('owner') as any, 'c1');
    expect(prisma.lectureProgress.findMany.mock.calls[0][0].where.userId).toEqual({ not: 'owner' });
    expect(audit.log).not.toHaveBeenCalled();
    const [l1, l2] = r.lectures;
    expect(l1).toMatchObject({ viewers: 6, enoughData: true, averageWatchedPct: 65, aiQuestions: 4, biggestDrop: { at: 3, drop: 50 } });
    expect(l1!.retention).toEqual([100, 100, 100, 50, 50, 50, 50, 50, 50, 50]);
    expect(l2).toMatchObject({ viewers: 0, enoughData: false, retention: null, averageWatchedPct: null });
    expect(r.attention).toEqual([{ id: 'l1', title: 'Intro', at: 3, drop: 50 }]);
    expect(JSON.stringify(r)).not.toMatch(/"s\d"/);
  });
});

describe('instructor insights (owner 2026-11-26)', () => {
  it('retention: a tenth counts when at least half of it was played; skips and replays do not count twice', () => {
    // 100 s video, tenths of 10 s
    const full: [number, number][] = [[0, 100]];
    const firstHalf: [number, number][] = [[0, 50]];
    const skipper: [number, number][] = [[0, 10], [90, 100]]; // jumped to the end
    const replayer: [number, number][] = [[0, 20], [0, 20], [10, 24]]; // 24 s unique: tenth 3 has only 4 s (< 5 s)
    expect(retentionCurve([full, firstHalf, skipper, replayer], 100)).toEqual([100, 75, 50, 50, 50, 25, 25, 25, 25, 50]);
    expect(retentionCurve([], 100)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(retentionCurve([[[0, 5]]], 100)).toEqual([100, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('finds the steepest fall between neighbouring tenths', () => {
    expect(biggestDrop([100, 90, 85, 40, 38, 30, 30, 29, 28, 20])).toEqual({ at: 3, drop: 45 });
    expect(biggestDrop([50, 50, 60])).toBeNull();
  });

  it('average unique share watched, capped at the whole video', () => {
    expect(averageWatched([100, 50, 0, 500], 100)).toBe(63); // (1 + .5 + 0 + 1) / 4 = 62.5
    expect(averageWatched([], 100)).toBe(0);
  });

  it('quiz: hardest questions first from latest attempts, only with enough learners and the current question count', () => {
    const qs = [{ q: 'A', correct: 0 }, { q: 'B', correct: 1 }, { q: 'C', correct: 2 }];
    // the last attempt is from an older version of the quiz (two questions) and is left out
    const answers = [[0, 1, 0], [0, 0, 0], [1, 0, 2], [0, 1, 2], [0, 0, 1], [0, 1]];
    expect(quizMisses(qs, answers)).toEqual([
      { index: 1, q: 'B', wrongPct: 60, answered: 5 },
      { index: 2, q: 'C', wrongPct: 60, answered: 5 },
      { index: 0, q: 'A', wrongPct: 20, answered: 5 },
    ]);
    expect(quizMisses(qs, answers.slice(0, 4))).toEqual([]); // fewer than 5 learners: nothing shown
  });
});
