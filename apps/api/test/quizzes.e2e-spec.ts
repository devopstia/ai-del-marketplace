/**
 * e2e (owner 2026-11-28, docs/COURSE_STANDARD.md §8a): quiz banks and assessments. Old quizzes ({ q, options, correct,
 * why }) and old attempts keep working; new banks carry explanations per option, topics and timestamps; sampled
 * assessments grade exactly the questions handed out; a retry of missed questions is never recorded; bookmarks are
 * per student; only enrolled students (or the owner) take a quiz. Real Postgres like the other e2e suites.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as argon2 from 'argon2';
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ARGON2_OPTS } from '../src/auth/auth.service';
import { codeAt, newSecret, stepAt } from '../src/auth/totp';
import { configureApp } from '../src/bootstrap';
import { JobsService } from '../src/common/jobs';
import { PrismaService } from '../src/common/prisma.service';
import { seal } from '../src/common/seal';
import { resetEnvCache } from '../src/config/env';
import { questionId } from '../src/learning/quiz-model';

const API_DIR = join(__dirname, '..');
const ROOT_ENV = join(API_DIR, '..', '..', '.env');
const rootEnv = (): Record<string, string> => (existsSync(ROOT_ENV) ? Object.fromEntries(readFileSync(ROOT_ENV, 'utf8').split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) : {});

async function prepareDatabase(): Promise<string | null> {
  const env = rootEnv();
  const url = process.env.E2E_DATABASE_URL ?? (env.POSTGRES_PASSWORD ? `postgresql://del:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:5433/marketplace_e2e` : null);
  if (!url) return null;
  const admin = new URL(url);
  const dbName = admin.pathname.slice(1);
  admin.pathname = '/postgres';
  const c = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 3000 });
  try { await c.connect(); } catch { return null; }
  if (!(await c.query('select 1 from pg_database where datname = $1', [dbName])).rowCount) await c.query(`create database "${dbName.replace(/"/g, '')}"`);
  await c.end();
  execFileSync(join(API_DIR, '..', '..', 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { cwd: API_DIR, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  const db = new Client({ connectionString: url });
  await db.connect();
  const tables = await db.query(`select tablename from pg_tables where schemaname='public' and tablename <> '_prisma_migrations'`);
  await db.query(`truncate ${tables.rows.map((r) => `"${r.tablename}"`).join(', ')} cascade`);
  await db.end();
  return url;
}

const bank = (n: number, topic = 'State') =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    q: `Terraform question number ${i + 1}: which file records what Terraform created?`,
    options: ['main.tf', 'terraform.tfstate', 'variables.tf', '.terraform.lock.hcl'],
    correct: 1,
    why: 'The state file maps your configuration to real resources.',
    explanations: ['Configuration, not records.', 'Correct: the state file.', 'Inputs only.', 'Provider versions only.'],
    takeaway: 'Keep state remote and locked.',
    difficulty: 'applied' as const,
    type: 'concept' as const,
    topic: i % 2 ? topic : 'Plan',
    timestamp: 30 + i,
  }));

describe('e2e: quiz banks and assessments', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  const PW = 'Long-enough-pw1';
  const MFA = newSecret();

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) { console.warn('\n[e2e quizzes] SKIPPED: Postgres not reachable.\n'); return; }
    const env = rootEnv();
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', MFA_REQUIRED: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: env.S3_ACCESS_KEY ?? 'test', S3_SECRET_KEY: env.S3_SECRET_KEY ?? 'test-secret', WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JobsService).useValue({ processVideo: jest.fn(), packageHls: jest.fn(), sendEmail: jest.fn(), settleFee: jest.fn(), scheduleRecurring: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    available = true;
  });
  afterAll(async () => { await app?.close(); });

  async function as(email: string, roles: string[]) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0]!, passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles: roles as never, mfaSecret: seal('mfa', MFA), mfaEnabledAt: new Date(), emailVerifiedAt: new Date() } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200);
    await prisma.user.update({ where: { id: user.id }, data: { mfaLastStep: null } });
    await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: codeAt(MFA, stepAt()) }).expect(200);
    const send = (m: 'post' | 'put' | 'delete', url: string) => agent[m](url).set('X-CSRF-Token', csrf);
    return { user, agent, send };
  }

  let seq = 0;
  /** A course with a video lesson then its quiz in module 1; a second module with another lesson quiz and an assessment. */
  async function course(instructorId: string, status: 'published' | 'draft' = 'published') {
    const n = ++seq;
    const c = await prisma.course.create({ data: { title: `Quiz course ${n}`, slug: `quiz-course-${n}`, instructorId, status, priceCents: 0, publishedAt: status === 'published' ? new Date() : null } });
    const s1 = await prisma.section.create({ data: { courseId: c.id, title: 'Module 1', position: 0 } });
    const video = await prisma.lecture.create({ data: { sectionId: s1.id, title: 'State explained', position: 0, type: 'video', durationSec: 900 } });
    const q1 = await prisma.lecture.create({ data: { sectionId: s1.id, title: 'Quiz: state', position: 1, type: 'quiz' } });
    const s2 = await prisma.section.create({ data: { courseId: c.id, title: 'Module 2', position: 1 } });
    const q2 = await prisma.lecture.create({ data: { sectionId: s2.id, title: 'Quiz: plans', position: 0, type: 'quiz' } });
    const fin = await prisma.lecture.create({ data: { sectionId: s2.id, title: 'Final assessment', position: 1, type: 'quiz' } });
    return { c, s1, video, q1, q2, fin };
  }
  const enrol = (userId: string, courseId: string) => prisma.enrollment.create({ data: { userId, courseId, source: 'free' } });

  it('old quizzes and old attempts keep working (answers in order; results unchanged)', async () => {
    if (!available) return;
    const t = await as('quiz-teacher1@e2e.example', ['student', 'instructor']);
    const s = await as('quiz-student1@e2e.example', ['student']);
    const k = await course(t.user.id);
    await enrol(s.user.id, k.c.id);
    const legacy = [{ q: 'Two plus two?', options: ['3', '4', '5'], correct: 1, why: 'Arithmetic.' }, { q: 'Capital of France?', options: ['Paris', 'Rome', 'Lima'], correct: 0, why: 'Geography.' }];
    const quiz = await prisma.quiz.create({ data: { lectureId: k.q1.id, questions: legacy } });
    await prisma.quizAttempt.create({ data: { userId: s.user.id, quizId: quiz.id, score: 50, answers: [1, 1] } });

    const g = (await s.agent.get(`/api/lectures/${k.q1.id}/quiz`).expect(200)).body;
    expect(g.questions.map((q: { id: string }) => q.id)).toEqual(legacy.map((q) => questionId(q)));
    expect(g.questions[0]).not.toHaveProperty('correct');
    expect(g).toMatchObject({ kind: 'lesson', poolSize: 2, attempts: 1, bestScore: 50 });
    const r = (await s.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ answers: [1, 0] }).expect(200)).body;
    expect(r).toMatchObject({ score: 100, passed: true, bestScore: 100 });
    expect(r.results[0]).toMatchObject({ index: 0, chosen: 1, correct: 1, isCorrect: true, why: 'Arithmetic.' });
    await s.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ answers: [1] }).expect(400);
  });

  it('a bank with explanations: graded by question id with the signed draw; topics, takeaways and "watch this part"', async () => {
    if (!available) return;
    const t = await as('quiz-teacher2@e2e.example', ['student', 'instructor']);
    const s = await as('quiz-student2@e2e.example', ['student']);
    const k = await course(t.user.id);
    await enrol(s.user.id, k.c.id);
    await t.send('put', `/api/instructor/courses/${k.c.id}/lectures/${k.q1.id}/quiz`).send({ questions: bank(12) }).expect(200);

    const g = (await s.agent.get(`/api/lectures/${k.q1.id}/quiz`).expect(200)).body;
    expect(g.questions).toHaveLength(12);
    expect(g.questions[0]).toMatchObject({ id: 't1', difficulty: 'applied', type: 'concept', topic: 'Plan' });
    expect(JSON.stringify(g)).not.toMatch(/explanations|takeaway|"correct"/);
    // the student answers in any order (the page shuffles); grading is by id
    const responses = [...g.questions].reverse().map((q: { id: string }, i: number) => ({ id: q.id, choice: i === 0 ? 0 : 1 }));
    const r = (await s.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ responses, draw: g.draw }).expect(200)).body;
    expect(r.score).toBe(92);
    const miss = r.results.find((x: { isCorrect: boolean }) => !x.isCorrect);
    expect(miss).toMatchObject({ id: 't12', chosen: 0, correct: 1, explanations: expect.any(Array), takeaway: 'Keep state remote and locked.', timestamp: 41, videoLectureId: k.video.id });
    expect(r.topics).toEqual(expect.arrayContaining([{ topic: 'State', correct: 5, total: 6 }, { topic: 'Plan', correct: 6, total: 6 }]));
    // the attempt is stored by question id
    const stored = await prisma.quizAttempt.findFirst({ where: { userId: s.user.id }, orderBy: { at: 'desc' } });
    expect(stored!.answers).toMatchObject({ v: 2, mode: 'full', items: expect.arrayContaining([{ id: 't12', chosen: 0, correct: false }]) });

    // a full attempt must answer exactly the questions handed out, with a genuine draw
    await s.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ responses: responses.slice(1), draw: g.draw }).expect(400);
    await s.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ responses, draw: g.draw.replace(/.$/, (c: string) => (c === 'A' ? 'B' : 'A')) }).expect(400);
    await s.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ responses: [{ id: 'nope', choice: 0 }], mode: 'retry' }).expect(400);

    // retry the missed one: explained, not recorded, never completes anything
    const before = await prisma.quizAttempt.count({ where: { userId: s.user.id } });
    const retry = (await s.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ responses: [{ id: 't12', choice: 1 }], mode: 'retry' }).expect(200)).body;
    expect(retry).toMatchObject({ score: 100, practice: true, passed: false });
    expect(await prisma.quizAttempt.count({ where: { userId: s.user.id } })).toBe(before);
  });

  it('expanding a bank keeps old attempts readable: ids are stable for questions without an author id', async () => {
    if (!available) return;
    const old = { q: 'Which command shows the plan?', options: ['terraform plan', 'terraform show', 'terraform fmt'], correct: 0, why: 'plan previews changes.' };
    const expanded = [old, ...bank(3).map(({ id: _id, ...q }) => q)];
    expect(questionId(expanded[0]!)).toBe(questionId(old));
    expect(new Set(expanded.map(questionId)).size).toBe(4);
  });

  it('a sampled final assessment draws from the course\'s lesson quizzes and grades only what it handed out', async () => {
    if (!available) return;
    const t = await as('quiz-teacher3@e2e.example', ['student', 'instructor']);
    const s = await as('quiz-student3@e2e.example', ['student']);
    const k = await course(t.user.id);
    await enrol(s.user.id, k.c.id);
    await t.send('put', `/api/instructor/courses/${k.c.id}/lectures/${k.q1.id}/quiz`).send({ questions: bank(10) }).expect(200);
    await t.send('put', `/api/instructor/courses/${k.c.id}/lectures/${k.q2.id}/quiz`).send({ questions: bank(10).map((q) => ({ ...q, q: q.q.replace('Terraform', 'Plan') })) }).expect(200);
    const own = bank(5).map((q) => ({ ...q, id: `f${q.id}`, q: q.q.replace('Terraform', 'Final') }));
    await t.send('put', `/api/instructor/courses/${k.c.id}/lectures/${k.fin.id}/quiz`).send({ questions: own, settings: { kind: 'final', pool: 'course', sampleSize: 15, scenario: 'Your team inherits a broken pipeline.' } }).expect(200);
    // too large a sample for the quiz's own questions is refused when it doesn't pool
    await t.send('put', `/api/instructor/courses/${k.c.id}/lectures/${k.fin.id}/quiz`).send({ questions: own, settings: { kind: 'final', sampleSize: 15 } }).expect(400);

    const g = (await s.agent.get(`/api/lectures/${k.fin.id}/quiz`).expect(200)).body;
    expect(g).toMatchObject({ kind: 'final', poolSize: 25, scenario: 'Your team inherits a broken pipeline.' });
    expect(g.questions).toHaveLength(15);
    const responses = g.questions.map((q: { id: string }) => ({ id: q.id, choice: 1 }));
    const r = (await s.send('post', `/api/lectures/${k.fin.id}/quiz`).send({ responses, draw: g.draw }).expect(200)).body;
    expect(r.score).toBe(100);
    // a question from the pool that wasn't drawn can't be swapped in
    const g2 = (await s.agent.get(`/api/lectures/${k.fin.id}/quiz`).expect(200)).body;
    const outside = (await prisma.quiz.findUniqueOrThrow({ where: { lectureId: k.q1.id } })).id.slice(0, 8);
    const swapped = g2.questions.map((q: { id: string }, i: number) => ({ id: i === 0 && !g2.questions.some((x: { id: string }) => x.id === `${outside}.t1`) ? `${outside}.t1` : q.id, choice: 1 }));
    if (swapped[0].id !== g2.questions[0].id) await s.send('post', `/api/lectures/${k.fin.id}/quiz`).send({ responses: swapped, draw: g2.draw }).expect(400);
  });

  it('bookmarks are per student and only for questions of the quiz; outsiders cannot open the quiz', async () => {
    if (!available) return;
    const t = await as('quiz-teacher4@e2e.example', ['student', 'instructor']);
    const s = await as('quiz-student4@e2e.example', ['student']);
    const o = await as('quiz-other4@e2e.example', ['student']);
    const k = await course(t.user.id);
    await enrol(s.user.id, k.c.id);
    await t.send('put', `/api/instructor/courses/${k.c.id}/lectures/${k.q1.id}/quiz`).send({ questions: bank(4) }).expect(200);

    await s.send('put', `/api/lectures/${k.q1.id}/quiz/bookmarks/t2`).expect(200);
    await s.send('put', `/api/lectures/${k.q1.id}/quiz/bookmarks/t2`).expect(200); // idempotent
    await s.send('put', `/api/lectures/${k.q1.id}/quiz/bookmarks/zzz`).expect(404);
    expect((await s.agent.get(`/api/lectures/${k.q1.id}/quiz`).expect(200)).body.bookmarks).toEqual(['t2']);
    await s.send('delete', `/api/lectures/${k.q1.id}/quiz/bookmarks/t2`).expect(200);
    expect((await s.agent.get(`/api/lectures/${k.q1.id}/quiz`).expect(200)).body.bookmarks).toEqual([]);

    // not enrolled: no quiz, no bookmark, no answers
    await o.agent.get(`/api/lectures/${k.q1.id}/quiz`).expect(403);
    await o.send('put', `/api/lectures/${k.q1.id}/quiz/bookmarks/t1`).expect(403);
    await o.send('post', `/api/lectures/${k.q1.id}/quiz`).send({ answers: [1, 1, 1, 1] }).expect(403);
  });

  it('staff validation: answer index, one explanation per option, duplicates, 60-question cap', async () => {
    if (!available) return;
    const t = await as('quiz-teacher5@e2e.example', ['student', 'instructor']);
    const k = await course(t.user.id, 'draft');
    const put = (body: object) => t.send('put', `/api/instructor/courses/${k.c.id}/lectures/${k.q1.id}/quiz`).send(body);
    await put({ questions: bank(60) }).expect(200);
    await put({ questions: [...bank(60), ...bank(1).map((q) => ({ ...q, id: 'x', q: 'One more question here?' }))] }).expect(400);
    await put({ questions: [{ ...bank(1)[0], correct: 4 }] }).expect(400);
    await put({ questions: [{ ...bank(1)[0], explanations: ['only one'] }] }).expect(400);
    await put({ questions: [bank(1)[0], { ...bank(1)[0], id: 'other' }] }).expect(400);
    await put({ questions: [{ q: 'Two options are enough?', options: ['Yes', 'No'], correct: 0, why: 'True/false style.' }] }).expect(200);
    await put({ questions: [{ q: 'Unknown field?', options: ['a', 'b'], correct: 0, why: 'x', secret: 1 }] } as object).expect(400);
  });
});
