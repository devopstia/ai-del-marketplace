/**
 * End to end: register → add to cart → checkout (dev test payment) → enrolled → playback URL → progress.
 * Runs the real Nest app against a separate database `marketplace_e2e` on the Docker Compose Postgres
 * (127.0.0.1:5433, password from the root .env). Set E2E_DATABASE_URL to point elsewhere.
 * If the database is unreachable the suite is skipped with a warning (start it: docker compose up -d postgres redis).
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
import { configureApp } from '../src/bootstrap';
import { JobsService } from '../src/common/jobs';
import { PrismaService } from '../src/common/prisma.service';
import { resetEnvCache } from '../src/config/env';

const API_DIR = join(__dirname, '..');
const ROOT_ENV = join(API_DIR, '..', '..', '.env');

function rootEnv(): Record<string, string> {
  if (!existsSync(ROOT_ENV)) return {};
  return Object.fromEntries(
    readFileSync(ROOT_ENV, 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

async function prepareDatabase(): Promise<string | null> {
  const env = rootEnv();
  const url = process.env.E2E_DATABASE_URL ?? (env.POSTGRES_PASSWORD ? `postgresql://del:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:5433/marketplace_e2e` : null);
  if (!url) return null;
  const admin = new URL(url);
  const dbName = admin.pathname.slice(1);
  admin.pathname = '/postgres';
  const c = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 3000 });
  try {
    await c.connect();
  } catch {
    return null;
  }
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

describe('e2e: buy and learn', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) {
      console.warn('\n[e2e] SKIPPED: Postgres not reachable. Run `docker compose up -d postgres redis` (and ./scripts/make-env.sh) first.\n');
      return;
    }
    const env = rootEnv();
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: url,
      REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380',
      DEV_TEST_PAYMENTS: 'true',
      STRIPE_SECRET_KEY: '',
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_PUBLIC_ENDPOINT: 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: env.S3_ACCESS_KEY ?? 'test',
      S3_SECRET_KEY: env.S3_SECRET_KEY ?? 'test-secret',
      WEB_URL: 'http://127.0.0.1:3000',
    });
    resetEnvCache();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JobsService)
      .useValue({ processVideo: jest.fn(), sendEmail: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    // Minimal catalogue: one approved instructor with one published, paid course.
    const teacher = await prisma.user.create({ data: { email: 'teacher@e2e.example', name: 'Teacher', passwordHash: 'x', roles: ['student', 'instructor'] } });
    await prisma.instructorProfile.create({ data: { userId: teacher.id, status: 'approved' } });
    const cat = await prisma.category.create({ data: { slug: 'e2e', name: 'E2E' } });
    const course = await prisma.course.create({
      data: { slug: 'e2e-course', title: 'E2E Course', instructorId: teacher.id, categoryId: cat.id, priceCents: 2500, status: 'published', publishedAt: new Date(), description: 'd' },
    });
    const section = await prisma.section.create({ data: { courseId: course.id, title: 'S1', position: 0 } });
    const asset = await prisma.videoAsset.create({ data: { ownerId: teacher.id, provider: 'local', status: 'ready', storageKey: 'videos/e2e/source.mp4', durationSec: 15 } });
    const lecture = await prisma.lecture.create({ data: { sectionId: section.id, title: 'L1', position: 0, type: 'video', videoAssetId: asset.id, durationSec: 15 } });
    await prisma.lecture.create({ data: { sectionId: section.id, title: 'L2', position: 1, type: 'article', articleMd: '# hi' } });
    Object.assign(ids, { course: course.id, lecture: lecture.id });
    available = true;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('register → cart → checkout → test payment → enrolled → playback → progress', async () => {
    if (!available) return;
    const agent = request.agent(app.getHttpServer());

    const boot = await agent.get('/api/auth/me').expect(200);
    expect(boot.body.user).toBeNull();
    const csrf: string = boot.body.csrf;
    expect(csrf.length).toBeGreaterThan(20);

    // CSRF is enforced
    await agent.post('/api/auth/register').send({ email: 'buyer@e2e.example', password: 'Long-enough-pw1', name: 'Buyer' }).expect(403);

    const reg = await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: 'buyer@e2e.example', password: 'Long-enough-pw1', name: 'Buyer' }).expect(201);
    expect(reg.body.user.roles).toEqual(['student']);
    const setCookie = ([] as string[]).concat(reg.headers['set-cookie'] ?? []);
    expect(setCookie.find((c) => c.startsWith('sid='))).toMatch(/HttpOnly/i);

    const list = await agent.get('/api/courses').expect(200);
    expect(list.body.items.map((c: any) => c.slug)).toContain('e2e-course');
    expect(list.body.items[0].totalDurationSec).toBe(15);

    await agent.post(`/api/lectures/${ids.lecture}/playback`).set('X-CSRF-Token', csrf).expect(403);

    const cart = await agent.post('/api/cart').set('X-CSRF-Token', csrf).send({ courseId: ids.course }).expect(201);
    expect(cart.body).toMatchObject({ count: 1, totalCents: 2500 });

    const checkout = await agent.post('/api/checkout').set('X-CSRF-Token', csrf).expect(200);
    expect(checkout.body.mode).toBe('test');
    expect(checkout.body.url).toBe(`http://127.0.0.1:3000/checkout/test-payment?order=${checkout.body.orderId}`);
    const orderId = checkout.body.orderId;

    const paid = await agent.post(`/api/dev/test-payments/${orderId}/complete`).set('X-CSRF-Token', csrf).expect(200);
    expect(paid.body).toMatchObject({ alreadyFulfilled: false, enrolledCourseIds: [ids.course] });
    expect(paid.body.order.status).toBe('paid');
    const again = await agent.post(`/api/dev/test-payments/${orderId}/complete`).set('X-CSRF-Token', csrf).expect(200);
    expect(again.body.alreadyFulfilled).toBe(true);

    const line = await prisma.orderLine.findFirstOrThrow({ where: { orderId } });
    expect(line).toMatchObject({ priceCents: 2500, commissionBps: 2000, instructorShareCents: 2000, transferStatus: 'pending' }); // default 20%: instructor keeps 80%
    expect(await prisma.enrollment.count({ where: { courseId: ids.course } })).toBe(1);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: ids.course } })).studentCount).toBe(1);

    const learning = await agent.get('/api/me/learning').expect(200);
    expect(learning.body.items[0]).toMatchObject({ course: { slug: 'e2e-course' }, progress: { total: 2, completed: 0, percent: 0 } });

    const pb = await agent.post(`/api/lectures/${ids.lecture}/playback`).set('X-CSRF-Token', csrf).expect(200);
    expect(pb.body.format).toBe('mp4');
    expect(pb.body.url).toContain('http://127.0.0.1:9000/del-media/videos/e2e/source.mp4');
    expect(pb.body.url).toContain('X-Amz-Signature=');
    expect(new Date(pb.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const prog = await agent.put(`/api/lectures/${ids.lecture}/progress`).set('X-CSRF-Token', csrf).send({ positionSec: 15, completed: true }).expect(200);
    expect(prog.body).toMatchObject({ positionSec: 15, completed: true, courseProgress: { completed: 1, total: 2, percent: 50 } });
    const prog2 = await agent.put(`/api/lectures/${ids.lecture}/progress`).set('X-CSRF-Token', csrf).send({ positionSec: 4 }).expect(200);
    expect(prog2.body).toMatchObject({ positionSec: 4, completed: true }); // completion is sticky

    const mine = await agent.get('/api/me/courses/e2e-course').expect(200);
    expect(mine.body.lastLectureId).toBe(ids.lecture);
    expect(JSON.stringify(mine.body)).not.toContain('videos/e2e');

    const orders = await agent.get('/api/orders').expect(200);
    expect(orders.body.items[0]).toMatchObject({ id: orderId, status: 'paid', totalCents: 2500 });

    // Errors have one shape
    const bad = await agent.put(`/api/lectures/${ids.lecture}/progress`).set('X-CSRF-Token', csrf).send({ positionSec: -1 }).expect(400);
    expect(bad.body.error).toMatchObject({ code: 'validation_failed' });

    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf).expect(200);
    await agent.get('/api/me/learning').expect(401);
  });

  // ---------- Phase 1 ----------
  const PW = 'Long-enough-pw1';
  async function userAgent(email: string, roles: any[], profile?: { isPlatform?: boolean }) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0], passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles } });
    if (profile) await prisma.instructorProfile.create({ data: { userId: user.id, status: 'approved', isPlatform: !!profile.isPlatform } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200);
    const send = (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: object) => agent[method](url).set('X-CSRF-Token', csrf).send(body ?? {});
    return { user, agent, send };
  }
  async function publishedCourse(instructorId: string, slug: string, priceCents: number) {
    const course = await prisma.course.create({ data: { slug, title: slug, instructorId, categoryId: (await prisma.category.findFirstOrThrow()).id, priceCents, status: 'published', publishedAt: new Date(), description: 'd' } });
    const section = await prisma.section.create({ data: { courseId: course.id, title: 'S1', position: 0 } });
    const asset = await prisma.videoAsset.create({ data: { ownerId: instructorId, provider: 'local', status: 'ready', storageKey: `videos/${slug}/source.mp4`, durationSec: 20 } });
    const lecture = await prisma.lecture.create({ data: { sectionId: section.id, title: 'L1', position: 0, type: 'video', videoAssetId: asset.id, durationSec: 20 } });
    return { course, section, lecture };
  }

  it('revisions: a published course changes only when an admin approves, all at once', async () => {
    if (!available) return;
    const teacher = await userAgent('rev-teacher@e2e.example', ['student', 'instructor'], {});
    const admin = await userAgent('rev-admin@e2e.example', ['student', 'admin']);
    const { course, section, lecture } = await publishedCourse(teacher.user.id, 'rev-course', 1999);
    const newVideo = await prisma.videoAsset.create({ data: { ownerId: teacher.user.id, provider: 'local', status: 'ready', storageKey: 'videos/rev2/source.mp4', durationSec: 42 } });

    const edited = await teacher.send('patch', `/api/instructor/courses/${course.id}`, { title: 'Revised title', priceCents: 2999 }).expect(200);
    expect(edited.body).toMatchObject({ version: 'draft', title: 'Revised title', revision: { status: 'draft' } });
    const lec = await teacher.send('post', `/api/instructor/courses/${course.id}/sections/${section.id}/lectures`, { title: 'New', videoAssetId: newVideo.id }).expect(201);
    await teacher.send('patch', `/api/instructor/courses/${course.id}/lectures/${lecture.id}`, { title: 'Renamed L1', summary: 'What L1 covers' }).expect(200);

    const pub = await request(app.getHttpServer()).get('/api/courses/rev-course').expect(200);
    expect(pub.body).toMatchObject({ title: 'rev-course', priceCents: 1999, totals: { lectures: 1 } });
    expect(await prisma.lecture.count({ where: { section: { courseId: course.id } } })).toBe(1);

    await teacher.send('post', `/api/instructor/courses/${course.id}/submit`).expect(200);
    await teacher.send('patch', `/api/instructor/courses/${course.id}`, { title: 'Locked edit' }).expect(409);
    const queue = await admin.agent.get('/api/admin/review-queue').expect(200);
    const item = queue.body.items.find((i: any) => i.id === course.id);
    expect(item.kind).toBe('revision');
    expect(item.changes.map((c: any) => c.message)).toEqual(expect.arrayContaining(['Title: “rev-course” → “Revised title”', 'Price: $19.99 → $29.99']));

    // Atomic: a video that stops being ready makes approval fail and nothing changes.
    await prisma.videoAsset.update({ where: { id: newVideo.id }, data: { status: 'processing' } });
    await admin.send('post', `/api/admin/courses/${course.id}/approve`).expect(409);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.id } })).title).toBe('rev-course');
    await prisma.videoAsset.update({ where: { id: newVideo.id }, data: { status: 'ready' } });

    const ok = await admin.send('post', `/api/admin/courses/${course.id}/approve`, { note: 'ok' }).expect(200);
    expect(ok.body).toMatchObject({ status: 'published', revision: { status: 'approved' } });
    const after = await request(app.getHttpServer()).get('/api/courses/rev-course').expect(200);
    expect(after.body).toMatchObject({ title: 'Revised title', priceCents: 2999, totals: { lectures: 2, durationSec: 62 } });
    expect(after.body.curriculum[0].lectures[0]).toMatchObject({ id: lecture.id, title: 'Renamed L1', summary: 'What L1 covers' });
    expect(after.body.curriculum[0].lectures[1].id).toBe(lec.body.id);

    // Reject keeps the live course.
    await teacher.send('patch', `/api/instructor/courses/${course.id}`, { title: 'Nope' }).expect(200);
    await teacher.send('post', `/api/instructor/courses/${course.id}/submit`).expect(200);
    await admin.send('post', `/api/admin/courses/${course.id}/reject`, { note: 'no' }).expect(200);
    expect((await request(app.getHttpServer()).get('/api/courses/rev-course')).body.title).toBe('Revised title');
  });

  it('pricing rules, featured instructor counts, pagination, partial refund, guest cart', async () => {
    if (!available) return;
    const teacher = await userAgent('p-teacher@e2e.example', ['student', 'instructor'], {});
    const del = await userAgent('p-del@e2e.example', ['student', 'instructor'], { isPlatform: true });
    const admin = await userAgent('p-admin@e2e.example', ['student', 'admin']);
    const buyer = await userAgent('p-buyer@e2e.example', ['student']);
    const a = await publishedCourse(teacher.user.id, 'p-teacher-a', 3999);
    const b = await publishedCourse(teacher.user.id, 'p-teacher-b', 0);
    const d = await publishedCourse(del.user.id, 'p-del', 2999);

    // pricing
    const bad = await teacher.send('post', '/api/instructor/courses', { title: 'Cheap course', priceCents: 300 }).expect(400);
    expect(bad.body.error.details).toEqual([{ field: 'priceCents', path: 'priceCents', message: 'Price must be 0 (free) or between $4.99 and $999.99' }]);
    await teacher.send('post', '/api/instructor/courses', { title: 'Too expensive', priceCents: 100000 }).expect(400);
    await teacher.send('post', '/api/instructor/courses', { title: 'Fine course', priceCents: 499 }).expect(201);

    // guest cart → merge after sign-in
    const guest = request.agent(app.getHttpServer());
    const gcsrf = (await guest.get('/api/auth/me')).body.csrf;
    const preview = await guest.post('/api/cart/preview').set('X-CSRF-Token', gcsrf).send({ courseIds: [a.course.id, d.course.id] }).expect(200);
    expect(preview.body).toMatchObject({ count: 2, totalCents: 6998, unavailableIds: [] });
    const merged = await buyer.send('post', '/api/cart/merge', { courseIds: [a.course.id, d.course.id, b.course.id] }).expect(200);
    expect(merged.body.merge.added).toHaveLength(3);
    const checkout = await buyer.send('post', '/api/checkout').expect(200);
    await buyer.send('post', `/api/dev/test-payments/${checkout.body.orderId}/complete`).expect(200);
    // A second learner in two of the teacher's courses: featured counts distinct learners.
    const other = await userAgent('p-other@e2e.example', ['student']);
    await prisma.enrollment.create({ data: { userId: other.user.id, courseId: a.course.id, source: 'admin' } });

    const featured = await request(app.getHttpServer()).get('/api/instructors/featured?limit=24').expect(200);
    const t = featured.body.items.find((i: any) => i.id === teacher.user.id);
    expect(t).toMatchObject({ courseCount: 2, studentCount: 2, reviewCount: 0, ratingAvg: null, isPlatform: false });
    expect(featured.body.items.find((i: any) => i.id === del.user.id)).toMatchObject({ courseCount: 1, studentCount: 1, isPlatform: true });

    // order detail + partial refund
    const detail = await admin.agent.get(`/api/admin/orders/${checkout.body.orderId}`).expect(200);
    expect(detail.body.lines).toHaveLength(3);
    const delLine = detail.body.lines.find((l: any) => l.course.id === d.course.id);
    expect(delLine).toMatchObject({ instructor: { isPlatform: true }, commissionBps: 10000, instructorShareCents: 0, transferStatus: 'none', refundable: true });
    expect(detail.body.lines.find((l: any) => l.course.id === a.course.id)).toMatchObject({ commissionBps: 2000, commissionCents: 800, instructorShareCents: 3199 });
    const refunded = await admin.send('post', `/api/admin/orders/${checkout.body.orderId}/refund`, { lineIds: [delLine.id] }).expect(200);
    expect(refunded.body).toMatchObject({ status: 'partially_refunded', refundedCents: 2999 });
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: buyer.user.id, courseId: d.course.id } } })).toMatchObject({ revokedAt: expect.any(Date) });
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: buyer.user.id, courseId: a.course.id } } })).toMatchObject({ revokedAt: null });

    // pagination
    const p1 = await admin.agent.get('/api/admin/users?page=1&pageSize=2').expect(200);
    const total = await prisma.user.count();
    expect(p1.body).toMatchObject({ page: 1, pageSize: 2, total, totalPages: Math.ceil(total / 2) });
    expect(p1.body.items).toHaveLength(2);
    const last = await admin.agent.get(`/api/admin/users?page=${Math.ceil(total / 2)}&pageSize=2`).expect(200);
    expect(last.body.items.length).toBe(total % 2 || 2);
    const audit = await admin.agent.get('/api/admin/audit?q=p-buyer@e2e.example&pageSize=100').expect(200);
    expect(audit.body.total).toBeGreaterThan(0);
    expect(audit.body.items.every((i: any) => i.actor?.email === 'p-buyer@e2e.example' || JSON.stringify(i).includes('p-buyer'))).toBe(true);
  });
});
