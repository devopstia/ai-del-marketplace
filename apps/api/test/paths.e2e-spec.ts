/**
 * End to end: career paths (owner 2026-11-26, idea 4; docs/CAREER_PATHS.md). Same database setup as app.e2e-spec.ts
 * (a separate database `marketplace_e2e` on the Docker Compose Postgres, truncated first); skipped when unreachable.
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
import { ALL_ADMIN_PERMISSIONS } from '../src/common/permissions';
import { PrismaService } from '../src/common/prisma.service';
import { seal } from '../src/common/seal';
import { resetEnvCache } from '../src/config/env';

const API_DIR = join(__dirname, '..');
const ROOT_ENV = join(API_DIR, '..', '..', '.env');

function rootEnv(): Record<string, string> {
  if (!existsSync(ROOT_ENV)) return {};
  return Object.fromEntries(readFileSync(ROOT_ENV, 'utf8').split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

async function prepareDatabase(): Promise<string | null> {
  const env = rootEnv();
  const url = process.env.E2E_DATABASE_URL ?? (env.POSTGRES_PASSWORD ? `postgresql://del:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:5433/marketplace_e2e` : null);
  if (!url) return null;
  const admin = new URL(url);
  const dbName = admin.pathname.slice(1);
  admin.pathname = '/postgres';
  const c = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 3000 });
  try { await c.connect(); } catch { return null; }
  const exists = await c.query('select 1 from pg_database where datname = $1', [dbName]);
  if (!exists.rowCount) await c.query(`create database "${dbName.replace(/"/g, '')}"`);
  await c.end();
  execFileSync(join(API_DIR, '..', '..', 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], { cwd: API_DIR, env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  const db = new Client({ connectionString: url });
  await db.connect();
  const tables = await db.query(`select tablename from pg_tables where schemaname='public' and tablename <> '_prisma_migrations'`);
  await db.query(`truncate ${tables.rows.map((r) => `"${r.tablename}"`).join(', ')} cascade`);
  await db.end();
  return url;
}

describe('e2e: career paths', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  const PW = 'Long-enough-pw1';
  const MFA_SEED = newSecret();

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) {
      console.warn('\n[e2e paths] SKIPPED: Postgres not reachable. Run `docker compose up -d postgres redis` first.\n');
      return;
    }
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', DEV_TEST_PAYMENTS: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(JobsService).useValue({ processVideo: jest.fn(), sendEmail: jest.fn() }).compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    available = true;
  });

  afterAll(async () => { await app?.close(); });

  async function userAgent(email: string, roles: any[], adminPermissions: string[] = ALL_ADMIN_PERMISSIONS) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0], passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles, adminPermissions: roles.includes('admin') ? adminPermissions : [], mfaSecret: seal('mfa', MFA_SEED), mfaEnabledAt: new Date() } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200, { mfa: 'verify' });
    await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: codeAt(MFA_SEED, stepAt()) }).expect(200);
    const send = (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: object) => agent[method](url).set('X-CSRF-Token', csrf).send(body ?? {});
    return { user, agent, send };
  }

  async function course(instructorId: string, categoryId: string, slug: string, priceCents: number, lectureSecs: number[], status: 'published' | 'draft' = 'published') {
    const c = await prisma.course.create({ data: { slug, title: `Course ${slug}`, instructorId, categoryId, priceCents, status, publishedAt: status === 'published' ? new Date() : null, description: 'd' } });
    const section = await prisma.section.create({ data: { courseId: c.id, title: 'S1', position: 0 } });
    const lectures = [];
    for (const [i, sec] of lectureSecs.entries()) lectures.push(await prisma.lecture.create({ data: { sectionId: section.id, title: `${slug} L${i + 1}`, position: i, type: 'video', durationSec: sec } }));
    return { course: c, lectures };
  }

  it('super admin writes and publishes; public pages; students follow with a real weekly plan and skill map', async () => {
    if (!available) return;
    const http = request(app.getHttpServer());
    const teacher = await prisma.user.create({ data: { email: 'paths-teacher@e2e.example', name: 'Teacher', passwordHash: 'x', roles: ['student', 'instructor'] } });
    await prisma.instructorProfile.create({ data: { userId: teacher.id, status: 'approved' } });
    const cat = await prisma.category.create({ data: { slug: 'paths-e2e', name: 'Paths' } });
    const linux = await course(teacher.id, cat.id, 'paths-linux', 0, [1800, 1800]);
    const docker = await course(teacher.id, cat.id, 'paths-docker', 2500, [3600, 3600]);
    const draft = await course(teacher.id, cat.id, 'paths-draft', 1000, [600], 'draft');

    const sup = await userAgent('paths-super@e2e.example', ['student', 'admin', 'super_admin']);
    const viewer = await userAgent('paths-admin@e2e.example', ['student', 'admin'], ['content.manage']);
    const student = await userAgent('paths-student@e2e.example', ['student']);

    // Nothing published: the public list is empty (the site hides every entry point).
    expect((await http.get('/api/paths').expect(200)).body.items).toEqual([]);
    expect((await student.agent.get('/api/me/paths').expect(200)).body).toEqual({ items: [], available: 0 });
    expect((await student.agent.get('/api/me/paths/summary').expect(200)).body).toEqual({ available: 0, following: 0 });

    const body = {
      title: 'DevOps engineer', slug: 'devops-engineer', summary: 'From Linux to containers.', description: 'Start here.',
      steps: [
        { courseId: linux.course.id, skills: ['Linux', ' Bash ', 'linux'], note: 'Start here' },
        { courseId: docker.course.id, skills: ['Docker', 'Containers'] },
      ],
    };
    // Only a super admin writes; an admin with content.manage can look; students can't open the admin API.
    await student.send('post', '/api/admin/paths', body).expect(403);
    await viewer.send('post', '/api/admin/paths', body).expect(403);
    await sup.send('post', '/api/admin/paths', { ...body, slug: 'Bad Slug' }).expect(400);
    await sup.send('post', '/api/admin/paths', { ...body, steps: [body.steps[0], body.steps[0]] }).expect(400);
    const created = await sup.send('post', '/api/admin/paths', body).expect(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({ status: 'draft', steps: [{ courseId: linux.course.id, skills: ['Linux', 'Bash'] }, { courseId: docker.course.id }] });
    await sup.send('post', '/api/admin/paths', body).expect(409); // slug taken
    expect((await viewer.agent.get('/api/admin/paths').expect(200)).body.items).toHaveLength(1);
    expect((await viewer.agent.get('/api/admin/paths/course-options?q=docker').expect(200)).body.items.map((c: any) => c.slug)).toEqual(['paths-docker']);

    // A draft is not public and can't be followed.
    await http.get('/api/paths/devops-engineer').expect(404);
    await student.send('put', '/api/me/paths/devops-engineer', {}).expect(404);

    // Publishing needs every course published.
    await sup.send('put', `/api/admin/paths/${id}`, { ...body, steps: [...body.steps, { courseId: draft.course.id, skills: ['Helm'] }] }).expect(200);
    expect((await sup.send('post', `/api/admin/paths/${id}/publish`).expect(400)).body.error.code).toBe('course_not_published');
    await sup.send('put', `/api/admin/paths/${id}`, { ...body, steps: [body.steps[0]] }).expect(200);
    expect((await sup.send('post', `/api/admin/paths/${id}/publish`).expect(400)).body.error.code).toBe('too_few_steps');
    await sup.send('put', `/api/admin/paths/${id}`, body).expect(200);
    await sup.send('post', `/api/admin/paths/${id}/publish`).expect(200);
    // A published path can't be edited into an unpublishable one.
    await sup.send('put', `/api/admin/paths/${id}`, { ...body, steps: [body.steps[0]] }).expect(400);

    const list = await http.get('/api/paths').expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ slug: 'devops-engineer', courseCount: 2, totalDurationSec: 10800, totalPriceCents: 2500, skills: ['Linux', 'Bash', 'Docker', 'Containers'] });
    const detail = await http.get('/api/paths/devops-engineer').expect(200);
    expect(detail.body.steps.map((s: any) => s.course.slug)).toEqual(['paths-linux', 'paths-docker']);
    expect(detail.body.steps[0]).toMatchObject({ position: 1, note: 'Start here' });

    // Follow: sign-in required; the plan stops at the course not bought yet.
    await http.put('/api/me/paths/devops-engineer').send({}).expect(403); // no CSRF token / not signed in
    const f = await student.send('put', '/api/me/paths/devops-engineer', { hoursPerWeek: 1 }).expect(200);
    expect(f.body).toMatchObject({ following: true, hoursPerWeek: 1, remainingPriceCents: 2500, progress: { coursesDone: 0, courseCount: 2, lecturesDone: 0, lectureCount: 4 } });
    expect(f.body.steps.map((s: any) => s.access)).toEqual(['none', 'none']);
    expect(f.body.plan).toMatchObject({ remainingSec: 10800, blockedBy: { slug: 'paths-linux' }, thisWeek: [] });

    // Enrol in the free course and watch half of the first lesson (unique seconds).
    await prisma.enrollment.create({ data: { userId: student.user.id, courseId: linux.course.id, source: 'free' } });
    await student.send('put', `/api/lectures/${linux.lectures[0].id}/progress`, { positionSec: 900, played: [[0, 900]] }).expect(200);
    const p1 = (await student.agent.get('/api/me/paths/devops-engineer').expect(200)).body;
    expect(p1.steps[0].access).toBe('owned');
    expect(p1.plan.remainingSec).toBe(10800 - 900);
    expect(p1.plan.thisWeek.map((w: any) => w.lectureId)).toEqual([linux.lectures[0].id, linux.lectures[1].id]); // 15 + 30 min ≤ 1 h
    expect(p1.plan.blockedBy).toMatchObject({ slug: 'paths-docker' });
    expect(p1.skills).toEqual([{ skill: 'Linux', state: 'needed' }, { skill: 'Bash', state: 'needed' }, { skill: 'Docker', state: 'needed' }, { skill: 'Containers', state: 'needed' }]);

    // Finish the course: its skills are done, the plan moves on.
    for (const l of linux.lectures) await student.send('put', `/api/lectures/${l.id}/progress`, { positionSec: 1800, completed: true }).expect(200);
    const p2 = (await student.agent.get('/api/me/paths').expect(200)).body;
    expect(p2.available).toBe(1);
    expect((await student.agent.get('/api/me/paths/summary').expect(200)).body).toEqual({ available: 1, following: 1 });
    expect(p2.items[0].progress).toMatchObject({ coursesDone: 1, lecturesDone: 2 });
    expect(p2.items[0].skills.slice(0, 2)).toEqual([{ skill: 'Linux', state: 'done' }, { skill: 'Bash', state: 'done' }]);
    expect(p2.items[0].plan.remainingSec).toBe(7200);

    // Hours per week can change; the hours are validated.
    await student.send('put', '/api/me/paths/devops-engineer', { hoursPerWeek: 0 }).expect(400);
    expect((await student.send('put', '/api/me/paths/devops-engineer', { hoursPerWeek: 10 }).expect(200)).body.hoursPerWeek).toBe(10);

    // An unpublished course disappears from the public path.
    await prisma.course.update({ where: { id: docker.course.id }, data: { status: 'unpublished' } });
    expect((await http.get('/api/paths/devops-engineer').expect(200)).body.steps).toHaveLength(1);
    await prisma.course.update({ where: { id: docker.course.id }, data: { status: 'published' } });

    // Unpublish, then delete (a published path can't be deleted); every change is audited.
    await sup.send('delete', `/api/admin/paths/${id}`).expect(409);
    await sup.send('post', `/api/admin/paths/${id}/unpublish`).expect(200);
    await http.get('/api/paths/devops-engineer').expect(404);
    expect((await student.agent.get('/api/me/paths').expect(200)).body).toEqual({ items: [], available: 0 });
    await sup.send('delete', `/api/admin/paths/${id}`).expect(200);
    const actions = (await prisma.auditLog.findMany({ where: { targetId: id }, orderBy: { at: 'asc' } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['career_path.created', 'career_path.updated', 'career_path.published', 'career_path.unpublished', 'career_path.deleted']));
    await student.send('delete', '/api/me/paths/devops-engineer').expect(200);
  });
});
