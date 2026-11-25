import * as T from './course-tree';
import { RevisionsService } from './revisions.service';

/**
 * In-memory fake of the Prisma calls RevisionsService/applyTree make. `$transaction` really is atomic here:
 * the state is restored when the callback throws, like Postgres would.
 */
function fakeDb() {
  const state = {
    course: {
      id: 'c1', instructorId: 'u1', status: 'published', title: 'Live title', subtitle: '', description: 'Live description', language: 'en', level: 'beginner',
      objectives: ['One'], requirements: [], priceCents: 4999, categoryId: 'cat', thumbnailKey: null as string | null, promoVideoAssetId: null as string | null, reviewNote: null as string | null,
    },
    sections: [
      { id: 's1', courseId: 'c1', title: 'Intro', position: 0 },
      { id: 's2', courseId: 'c1', title: 'Old section', position: 1 },
    ],
    lectures: [
      { id: 'l1', sectionId: 's1', title: 'Welcome', position: 0, type: 'video', isPreview: true, articleMd: null, videoAssetId: 'v1', durationSec: 30 },
      { id: 'l2', sectionId: 's2', title: 'Going away', position: 0, type: 'article', isPreview: false, articleMd: 'x', videoAssetId: null, durationSec: 60 },
    ] as any[],
    resources: [] as any[],
    quizzes: [] as any[],
    revisions: [] as any[],
    assets: [
      { id: 'v1', ownerId: 'u1', status: 'ready', durationSec: 30 },
      { id: 'v2', ownerId: 'u1', status: 'ready', durationSec: 95 },
      { id: 'v3', ownerId: 'u1', status: 'processing', durationSec: 0 },
    ],
    failOnLectureUpsert: 0,
  };
  const notIn = (id: string, w: any) => !w?.notIn || !w.notIn.includes(id);
  let seq = 0;
  const db: any = {
    $executeRaw: jest.fn(async () => 1),
    $transaction: jest.fn(async (fn: any) => {
      const saved = JSON.stringify(state);
      try {
        return await fn(db);
      } catch (e) {
        Object.assign(state, JSON.parse(saved));
        throw e;
      }
    }),
    category: { findMany: jest.fn(async () => []) },
    auditLog: { create: jest.fn() },
    course: {
      findUnique: jest.fn(async ({ where, include }: any) => {
        if (where.id !== state.course.id) return null;
        if (!include) return { ...state.course };
        return {
          ...state.course,
          sections: [...state.sections].sort((a, b) => a.position - b.position).map((s) => ({
            ...s,
            lectures: state.lectures.filter((l) => l.sectionId === s.id).sort((a, b) => a.position - b.position).map((l) => ({
              ...l,
              resources: state.resources.filter((r) => r.lectureId === l.id),
              quiz: state.quizzes.find((q) => q.lectureId === l.id) ?? null,
            })),
          })),
        };
      }),
      update: jest.fn(async ({ data }: any) => Object.assign(state.course, data)),
    },
    courseRevision: {
      findFirst: jest.fn(async ({ where }: any) => [...state.revisions].reverse().find((r) => r.courseId === where.courseId && where.status.in.includes(r.status)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const r = { id: `rev${++seq}`, reviewNote: null, submittedAt: null, createdAt: new Date(), updatedAt: new Date(), ...JSON.parse(JSON.stringify(data)) };
        state.revisions.push(r);
        return r;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(state.revisions.find((r) => r.id === where.id), JSON.parse(JSON.stringify(data)))),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = state.revisions.filter((r) => r.id === where.id && (typeof where.status === 'string' ? r.status === where.status : where.status.in.includes(r.status)));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      }),
      delete: jest.fn(async ({ where }: any) => (state.revisions = state.revisions.filter((r) => r.id !== where.id))),
    },
    videoAsset: { findMany: jest.fn(async ({ where }: any) => state.assets.filter((a) => where.id.in.includes(a.id) && (!where.ownerId || a.ownerId === where.ownerId))) },
    section: {
      count: jest.fn(async () => 0),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const s = state.sections.find((x) => x.id === where.id);
        if (s) Object.assign(s, update);
        else state.sections.push({ ...create });
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const gone = state.sections.filter((s) => s.courseId === where.courseId && notIn(s.id, where.id)).map((s) => s.id);
        state.sections = state.sections.filter((s) => !gone.includes(s.id));
        state.lectures = state.lectures.filter((l) => !gone.includes(l.sectionId));
      }),
    },
    lecture: {
      count: jest.fn(async () => 0),
      deleteMany: jest.fn(async ({ where }: any) => (state.lectures = state.lectures.filter((l) => !notIn(l.id, where.id)))),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        if (state.failOnLectureUpsert && --state.failOnLectureUpsert === 0) throw new Error('database went away');
        const l = state.lectures.find((x) => x.id === where.id);
        if (l) Object.assign(l, update);
        else state.lectures.push({ ...create });
      }),
    },
    resource: {
      count: jest.fn(async () => 0),
      deleteMany: jest.fn(async ({ where }: any) => (state.resources = state.resources.filter((r) => r.lectureId !== where.lectureId || !notIn(r.id, where.id)))),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const r = state.resources.find((x) => x.id === where.id);
        if (r) Object.assign(r, update);
        else state.resources.push({ ...create });
      }),
    },
    quiz: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const q = state.quizzes.find((x) => x.lectureId === where.lectureId);
        if (q) Object.assign(q, update);
        else state.quizzes.push({ ...create });
      }),
      deleteMany: jest.fn(async ({ where }: any) => (state.quizzes = state.quizzes.filter((q) => q.lectureId !== where.lectureId))),
    },
  };
  return { db, state };
}

const actor = { user: { id: 'u1', email: 'u1@x', name: 'U1', roles: ['instructor' as const] }, ip: null };
const admin = { user: { id: 'boss', email: 'b@x', name: 'Boss', roles: ['admin' as const] }, ip: null };
const liveOf = (state: ReturnType<typeof fakeDb>['state']) => JSON.stringify({ c: state.course, s: state.sections, l: state.lectures, r: state.resources, q: state.quizzes });

function build() {
  const { db, state } = fakeDb();
  const audit = { log: jest.fn() };
  return { svc: new RevisionsService(db, audit as any), db, state, audit };
}

async function editAndSubmit(svc: RevisionsService) {
  await svc.mutate('c1', (t) => {
    T.updateCourseFields(t, { title: 'New title', priceCents: 5999 });
    const s = T.addSection(t, 'Bonus');
    T.addLecture(t, s.id, { title: 'New video', video: { videoAssetId: 'v2', durationSec: 0 } });
    T.deleteSection(t, 's2');
    T.addResource(t, 'l1', { title: 'Lab files', storageKey: 'resources/u1/r/lab.zip', sizeBytes: 100, mime: 'application/zip' });
    T.setQuiz(t, 'l1', [{ q: 'Q?', options: ['a', 'b', 'c'], correct: 2, why: 'w' }]);
  });
  await svc.submit(actor, 'c1');
}

describe('RevisionsService: edits to a published course', () => {
  it('editing creates a draft and leaves the live course untouched', async () => {
    const { svc, state, db } = build();
    const before = liveOf(state);
    await svc.mutate('c1', (t) => T.updateCourseFields(t, { title: 'Changed', priceCents: 999 }));
    await svc.mutate('c1', (t) => T.addSection(t, 'Another'));
    expect(liveOf(state)).toBe(before);
    expect(state.revisions).toHaveLength(1);
    expect(state.revisions[0]).toMatchObject({ status: 'draft', snapshot: { course: { title: 'Changed', priceCents: 999 } } });
    expect(state.revisions[0].snapshot.sections.map((s: any) => s.title)).toEqual(['Intro', 'Old section', 'Another']);
    expect(db.course.update).not.toHaveBeenCalled();
    expect(db.lecture.upsert).not.toHaveBeenCalled();
  });

  it('the submitted revision is locked and the live course is still untouched', async () => {
    const { svc, state } = build();
    const before = liveOf(state);
    await editAndSubmit(svc);
    expect(state.revisions[0].status).toBe('in_review');
    await expect(svc.mutate('c1', (t) => T.updateCourseFields(t, { title: 'x' }))).rejects.toMatchObject({ code: 'course_locked' });
    expect(liveOf(state)).toBe(before);
  });

  it('cannot submit when nothing changed', async () => {
    const { svc } = build();
    await expect(svc.submit(actor, 'c1')).rejects.toMatchObject({ code: 'no_changes' });
    await svc.mutate('c1', () => undefined);
    await expect(svc.submit(actor, 'c1')).rejects.toMatchObject({ code: 'no_changes' });
  });

  it('cannot submit a draft whose new video is still processing', async () => {
    const { svc } = build();
    await svc.mutate('c1', (t) => T.updateLecture(t, 'l1', { video: { videoAssetId: 'v3', durationSec: 0 } }));
    await expect(svc.submit(actor, 'c1')).rejects.toMatchObject({ code: 'not_ready' });
  });

  it('approval applies every change at once (new videos, resources, quiz, price) and keeps existing ids', async () => {
    const { svc, state } = build();
    await editAndSubmit(svc);
    const draft = state.revisions[0].snapshot as T.CourseTree;
    await svc.approve(admin, 'c1', 'Thanks');
    expect(state.course).toMatchObject({ title: 'New title', priceCents: 5999, reviewNote: 'Thanks' });
    expect(state.sections.map((s) => s.title)).toEqual(['Intro', 'Bonus']);
    const bonus = draft.sections[1];
    expect(state.sections[1].id).toBe(bonus.id);
    const added = state.lectures.find((l) => l.title === 'New video');
    expect(added).toMatchObject({ id: bonus.lectures[0].id, sectionId: bonus.id, videoAssetId: 'v2', durationSec: 95 });
    expect(state.lectures.find((l) => l.id === 'l1')).toBeTruthy(); // kept: learners keep their progress
    expect(state.lectures.find((l) => l.id === 'l2')).toBeUndefined(); // its section was removed
    expect(state.resources).toEqual([expect.objectContaining({ lectureId: 'l1', title: 'Lab files', storageKey: 'resources/u1/r/lab.zip' })]);
    expect(state.quizzes).toEqual([expect.objectContaining({ lectureId: 'l1' })]);
    expect(state.revisions[0]).toMatchObject({ status: 'approved', decidedById: 'boss' });
  });

  it('approval is atomic: a failure half-way leaves the live course and the revision as they were', async () => {
    const { svc, state } = build();
    await editAndSubmit(svc);
    const before = liveOf(state);
    state.failOnLectureUpsert = 2; // the second lecture write fails, after course/sections were written
    await expect(svc.approve(admin, 'c1')).rejects.toThrow('database went away');
    expect(liveOf(state)).toBe(before);
    expect(state.revisions[0].status).toBe('in_review');
  });

  it('approval refuses videos that are not ready, changing nothing', async () => {
    const { svc, state } = build();
    await editAndSubmit(svc);
    state.assets.find((a) => a.id === 'v2')!.status = 'processing';
    const before = liveOf(state);
    await expect(svc.approve(admin, 'c1')).rejects.toMatchObject({ code: 'video_not_ready' });
    expect(liveOf(state)).toBe(before);
  });

  it('reject keeps the live course; request-changes keeps it too and lets the instructor edit and resubmit', async () => {
    const { svc, state } = build();
    const before = liveOf(state);
    await editAndSubmit(svc);
    await svc.decide(admin, 'c1', 'changes_requested', 'Please fix the price');
    expect(liveOf(state)).toBe(before);
    expect(state.revisions[0]).toMatchObject({ status: 'changes_requested', reviewNote: 'Please fix the price' });
    await svc.mutate('c1', (t) => T.updateCourseFields(t, { priceCents: 4999 }));
    await svc.submit(actor, 'c1');
    await svc.decide(admin, 'c1', 'rejected', 'Not this time');
    expect(liveOf(state)).toBe(before);
    expect(state.revisions[0].status).toBe('rejected');
    // A rejected revision is closed: the next edit starts a fresh draft from the live course.
    await svc.mutate('c1', (t) => T.updateCourseFields(t, { subtitle: 'fresh' }));
    expect(state.revisions).toHaveLength(2);
    expect(state.revisions[1].snapshot.course).toMatchObject({ title: 'Live title', subtitle: 'fresh' });
  });

  it('a decision needs a revision in review', async () => {
    const { svc } = build();
    await expect(svc.approve(admin, 'c1')).rejects.toMatchObject({ code: 'invalid_status' });
    await svc.mutate('c1', (t) => T.updateCourseFields(t, { title: 'x' }));
    await expect(svc.decide(admin, 'c1', 'rejected', 'no')).rejects.toMatchObject({ code: 'invalid_status' });
  });

  it('summary lists the changes for the studio and the admin queue', async () => {
    const { svc, state } = build();
    await editAndSubmit(svc);
    const s = await svc.summary(state.revisions[0]);
    expect(s.status).toBe('in_review');
    expect(s.changes.map((c) => c.message)).toEqual(expect.arrayContaining(['Title: “Live title” → “New title”', 'Price: $49.99 → $59.99', 'Section added: “Bonus”', 'Section removed: “Old section”']));
  });
});
