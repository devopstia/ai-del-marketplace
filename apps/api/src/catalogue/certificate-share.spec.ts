import { certificateUrl, linkedInAddUrl, quizSummary } from './certificate-share';
import { summariseWatch, watchKey, watchOf } from '../access/consumption';

describe('certificate sharing', () => {
  it('builds the public link without a double slash', () => {
    expect(certificateUrl('https://ai-devopseasylearning.com/', 'DEL-ABC123')).toBe('https://ai-devopseasylearning.com/certificates/DEL-ABC123');
  });

  it('fills LinkedIn add-to-profile with only public certificate facts', () => {
    const url = new URL(linkedInAddUrl({ courseTitle: 'AI for DevOps & SRE', issuedAt: new Date('2026-11-26T23:30:00Z'), code: 'DEL-ABC123', certUrl: 'https://x.test/certificates/DEL-ABC123' }));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/profile/add');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startTask: 'CERTIFICATION_NAME', name: 'AI for DevOps & SRE', organizationName: 'DevOps Easy Learning',
      issueYear: '2026', issueMonth: '11', certUrl: 'https://x.test/certificates/DEL-ABC123', certId: 'DEL-ABC123',
    });
  });

  it('uses the best attempt per quiz', () => {
    expect(quizSummary([], [])).toBeNull();
    expect(quizSummary(['a', 'b', 'c'], [{ quizId: 'a', score: 50 }, { quizId: 'a', score: 90 }, { quizId: 'b', score: 60 }, { quizId: 'z', score: 100 }]))
      .toEqual({ total: 3, passed: 1, averageBest: 75 });
  });
});

describe('reviewer watch (unique seconds, same as refunds)', () => {
  const lectures = [
    { id: 'v1', courseId: 'c', durationSec: 600, isVideo: true },
    { id: 'v2', courseId: 'c', durationSec: 400, isVideo: true },
    { id: 'a1', courseId: 'c', durationSec: 0, isVideo: false },
    { id: 'q1', courseId: 'text', durationSec: 0, isVideo: false },
  ];
  it('measures watched seconds against all video lessons, capped per lesson', () => {
    const m = summariseWatch(lectures, [
      { userId: 'u', lectureId: 'v1', watchedSec: 9999, completed: true },
      { userId: 'u', lectureId: 'v2', watchedSec: 20, completed: false },
    ], [{ userId: 'u', courseId: 'c' }]);
    expect(m.get(watchKey('u', 'c'))).toEqual({ watchedPercent: 62, completed: false });
  });
  it('marks completed only when every lesson is done', () => {
    const done = ['v1', 'v2', 'a1'].map((lectureId) => ({ userId: 'u', lectureId, watchedSec: lectureId === 'v1' ? 600 : lectureId === 'v2' ? 400 : 0, completed: true }));
    expect(watchOf(summariseWatch(lectures, done, [{ userId: 'u', courseId: 'c' }]), 'u', 'c')).toEqual({ watchedPercent: 100, completed: true });
  });
  it('reports 0 for a reviewer who watched nothing and null for a course without video', () => {
    const m = summariseWatch(lectures, [], [{ userId: 'u', courseId: 'c' }, { userId: 'u', courseId: 'text' }]);
    expect(watchOf(m, 'u', 'c')).toEqual({ watchedPercent: 0, completed: false });
    expect(watchOf(m, 'u', 'text')).toEqual({ watchedPercent: null, completed: false });
    expect(watchOf(m, 'nobody', 'c')).toEqual({ watchedPercent: null, completed: false });
  });
  it('does not mix up two reviewers', () => {
    const m = summariseWatch(lectures, [{ userId: 'a', lectureId: 'v1', watchedSec: 300, completed: false }], [{ userId: 'a', courseId: 'c' }, { userId: 'b', courseId: 'c' }]);
    expect(watchOf(m, 'a', 'c').watchedPercent).toBe(30);
    expect(watchOf(m, 'b', 'c').watchedPercent).toBe(0);
  });
});
