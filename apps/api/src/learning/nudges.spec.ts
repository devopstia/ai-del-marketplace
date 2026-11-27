import { resetEnvCache } from '../config/env';
import { render } from '../email/templates';
import { dueStep, linkedCourseSlugs, optOutToken, sendLearningNudges, verifyOptOutToken } from './nudges';

const DAY = 86_400_000;

describe('free-course learning emails', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET ??= 'unit-test-session-secret-1234567890';
    resetEnvCache();
  });

  it('each step has a window; nothing is sent twice and no backlog after a deploy', () => {
    expect(dueStep(0, [])?.key).toBe('welcome');
    expect(dueStep(1.5 * DAY, ['welcome'])).toBeNull();
    expect(dueStep(2.5 * DAY, [])).toBeNull(); // between windows
    expect(dueStep(4 * DAY, [])?.key).toBe('keep-going'); // a late welcome is skipped, not sent
    expect(dueStep(8 * DAY, ['welcome'])?.key).toBe('next-courses');
    expect(dueStep(12 * DAY, [])).toBeNull();
  });

  it('finds the paid courses a free course links to, in order, without itself', () => {
    const md = ['[AWS](https://ai-devopseasylearning.com/courses/ai-aws) and [Azure](/courses/ai-azure)', 'again [AWS](/courses/ai-aws), self [x](/courses/intro)'];
    expect(linkedCourseSlugs(md, 'intro')).toEqual(['ai-aws', 'ai-azure']);
  });

  it('the one-click link is signed per user', () => {
    const t = optOutToken('u1');
    expect(verifyOptOutToken('u1', t)).toBe(true);
    expect(verifyOptOutToken('u2', t)).toBe(false);
    expect(verifyOptOutToken('u1', 'x'.repeat(t.length))).toBe(false);
  });

  function world(o: { ageDays: number; sent?: string[]; done?: number; certificate?: boolean; links?: boolean; owned?: string[] }) {
    const now = new Date('2026-12-10T12:00:00Z');
    const enr = { userId: 'u1', courseId: 'c1', createdAt: new Date(now.getTime() - o.ageDays * DAY), nudgesSent: [...(o.sent ?? [])], user: { id: 'u1', email: 'a@x.test', name: 'Ada Lovelace' }, course: { id: 'c1', slug: 'intro', title: 'Intro to AI', instructorId: 'i1' } };
    const lectures = [
      { id: 'l1', type: 'video', title: 'What AI is', articleMd: null },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `l${i + 2}`, type: 'video', title: `L${i}`, articleMd: null })),
      { id: 'a1', type: 'article', title: 'Next', articleMd: o.links === false ? 'no links' : '[AWS](/courses/ai-aws) [Azure](/courses/ai-azure)' },
    ];
    const emails: any[] = [];
    const prisma: any = {
      enrollment: {
        findMany: jest.fn(async ({ where }: any) => (where.createdAt ? [enr] : (o.owned ?? ['c1']).map((courseId) => ({ courseId })))),
        updateMany: jest.fn(async ({ data }: any) => { if (enr.nudgesSent.includes(data.nudgesSent.push)) return { count: 0 }; enr.nudgesSent.push(data.nudgesSent.push); return { count: 1 }; }),
      },
      certificate: { findUnique: jest.fn(async () => (o.certificate ? { code: 'DEL-1' } : null)) },
      lecture: { findMany: jest.fn(async () => lectures) },
      lectureProgress: { count: jest.fn(async () => o.done ?? 0) },
      course: { findMany: jest.fn(async () => [{ id: 'p1', slug: 'ai-aws', title: 'AI for DevOps on AWS', subtitle: 'Bedrock' }, { id: 'p2', slug: 'ai-azure', title: 'AI for DevOps on Azure', subtitle: null }]) },
    };
    const jobs: any = { sendEmail: jest.fn(async (j: any) => emails.push(j)) };
    return { now, enr, prisma, jobs, emails };
  }

  it('day 0: the welcome email, once', async () => {
    const w = world({ ageDays: 0.1 });
    await sendLearningNudges(w.prisma, w.jobs, w.now);
    await sendLearningNudges(w.prisma, w.jobs, w.now);
    expect(w.emails.map((e) => e.template)).toEqual(['learn-welcome']);
    expect(w.emails[0]).toMatchObject({ to: 'a@x.test', dedupeKey: 'nudge:welcome:u1:c1', data: expect.objectContaining({ firstLesson: 'What AI is', lessons: 9 }) });
    expect(String(w.emails[0].data.optOutUrl)).toContain('/email/learning-emails?u=u1&t=');
  });

  it('day 3: "keep going" only under 20% progress', async () => {
    const slow = world({ ageDays: 3.5, sent: ['welcome'], done: 1 });
    await sendLearningNudges(slow.prisma, slow.jobs, slow.now);
    expect(slow.emails.map((e) => e.template)).toEqual(['learn-keep-going']);
    const busy = world({ ageDays: 3.5, sent: ['welcome'], done: 5 });
    await sendLearningNudges(busy.prisma, busy.jobs, busy.now);
    expect(busy.emails).toHaveLength(0);
    expect(busy.enr.nudgesSent).toContain('keep-going'); // marked, so it isn't checked again
  });

  it('day 7: the linked paid courses, minus owned ones; skipped when there is nothing to suggest', async () => {
    const w = world({ ageDays: 7.5, sent: ['welcome', 'keep-going'], owned: ['c1', 'p2'] });
    await sendLearningNudges(w.prisma, w.jobs, w.now);
    expect(w.emails[0].template).toBe('learn-next-courses');
    expect(w.emails[0].data.courses).toEqual([{ title: 'AI for DevOps on AWS', slug: 'ai-aws', subtitle: 'Bedrock' }]);
    const none = world({ ageDays: 7.5, links: false });
    await sendLearningNudges(none.prisma, none.jobs, none.now);
    expect(none.emails).toHaveLength(0);
  });

  it('stops once the course is finished (certificate)', async () => {
    const w = world({ ageDays: 3.5, sent: ['welcome'], certificate: true });
    await sendLearningNudges(w.prisma, w.jobs, w.now);
    expect(w.emails).toHaveLength(0);
  });

  it('the job only looks at active, opted-in learners of published free courses', async () => {
    const w = world({ ageDays: 0.1 });
    await sendLearningNudges(w.prisma, w.jobs, w.now);
    const where = w.prisma.enrollment.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ revokedAt: null, course: { priceCents: 0, status: 'published' }, user: { status: 'active', learningEmailsOptOutAt: null } });
  });

  it('templates render with the opt-out link and a text part', () => {
    const optOutUrl = 'https://x.test/email/learning-emails?u=u1&t=abc';
    for (const [t, data] of [
      ['learn-welcome', { name: 'Ada', course: 'Intro', slug: 'intro', firstLesson: 'What AI is', lessons: 12, optOutUrl }],
      ['learn-keep-going', { name: 'Ada', course: 'Intro', slug: 'intro', done: 1, total: 13, optOutUrl }],
      ['learn-next-courses', { name: 'Ada', course: 'Intro', slug: 'intro', courses: [{ title: 'AWS', slug: 'ai-aws', subtitle: 'Bedrock' }], optOutUrl }],
    ] as const) {
      const r = render(t, data as any)!;
      expect(r.html).toContain('learning-emails?u=u1');
      expect(r.text).toContain('Turn them off');
    }
    const done = render('course-completed', { name: 'Ada', course: 'Intro', slug: 'intro', code: 'DEL-1', certUrl: 'https://x.test/certificates/DEL-1', linkedInUrl: 'https://www.linkedin.com/profile/add?x=1', reviewed: false })!;
    expect(done.subject).toContain('certificate');
    expect(done.text).toContain('?tab=review');
    expect(render('course-completed', { name: 'Ada', course: 'Intro', slug: 'intro', code: 'DEL-1', certUrl: 'u', reviewed: true })!.text).not.toContain('?tab=review');
  });
});
