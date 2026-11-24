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
import { Client } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
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
    expect(line).toMatchObject({ priceCents: 2500, commissionBps: 0, instructorShareCents: 2500, transferStatus: 'pending' });
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
});
