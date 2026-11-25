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
import { PayoutsService } from '../src/commerce/payouts.service';
import { RefundsService } from '../src/commerce/refunds.service';
import { simulatedStripeFee, splitLine, splitOrder } from '../src/commerce/money';
import { AuditService } from '../src/common/audit.service';

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

  it('catalogue: several topics at once, facet counts, free-preview flag', async () => {
    if (!available) return;
    const teacher = await prisma.user.findUniqueOrThrow({ where: { email: 'teacher@e2e.example' } });
    const cat2 = await prisma.category.create({ data: { slug: 'e2e-two', name: 'E2E two' } });
    const free = await prisma.course.create({
      data: { slug: 'e2e-free', title: 'Free one', instructorId: teacher.id, categoryId: cat2.id, priceCents: 0, level: 'advanced', status: 'published', publishedAt: new Date(), description: 'd' },
    });
    const s = await prisma.section.create({ data: { courseId: free.id, title: 'S', position: 0 } });
    await prisma.lecture.create({ data: { sectionId: s.id, title: 'Preview', position: 0, type: 'article', articleMd: 'x', isPreview: true } });
    try {
      const http = request(app.getHttpServer());
      const both = await http.get('/api/courses?category=e2e&category=e2e-two').expect(200);
      expect(both.body.items.map((c: any) => c.slug).sort()).toEqual(['e2e-course', 'e2e-free']);
      expect((await http.get('/api/courses?category=e2e,e2e-two').expect(200)).body.total).toBe(2);
      const one = await http.get('/api/courses?category=e2e-two').expect(200);
      expect(one.body.items.map((c: any) => c.slug)).toEqual(['e2e-free']);
      expect(one.body.items[0].hasPreview).toBe(true);
      // A facet ignores its own filter but respects the others.
      expect(one.body.facets.category).toEqual({ e2e: 1, 'e2e-two': 1 });
      expect(one.body.facets.price).toEqual({ free: 1, paid: 0 });
      const paid = await http.get('/api/courses?price=paid').expect(200);
      expect(paid.body.facets.category).toEqual({ e2e: 1 });
      expect(paid.body.facets.price).toEqual({ free: 1, paid: 1 });
      expect(paid.body.items[0].hasPreview).toBe(false);
    } finally {
      await prisma.course.delete({ where: { id: free.id } });
      await prisma.category.delete({ where: { id: cat2.id } });
    }
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

    const noConsent = await agent.post('/api/checkout').set('X-CSRF-Token', csrf).expect(400);
    expect(noConsent.body.error.code).toBe('consent_required');
    const checkout = await agent.post('/api/checkout').set('X-CSRF-Token', csrf).send({ immediateAccessConsent: true }).expect(200);
    expect(checkout.body.mode).toBe('test');
    expect(checkout.body.url).toBe(`http://127.0.0.1:3000/checkout/test-payment?order=${checkout.body.orderId}`);
    const orderId = checkout.body.orderId;

    const paid = await agent.post(`/api/dev/test-payments/${orderId}/complete`).set('X-CSRF-Token', csrf).expect(200);
    expect(paid.body).toMatchObject({ alreadyFulfilled: false, enrolledCourseIds: [ids.course] });
    expect(paid.body.order.status).toBe('paid');
    const again = await agent.post(`/api/dev/test-payments/${orderId}/complete`).set('X-CSRF-Token', csrf).expect(200);
    expect(again.body.alreadyFulfilled).toBe(true);

    const line = await prisma.orderLine.findFirstOrThrow({ where: { orderId } });
    // default 20%: the instructor keeps 80% of the amount left after the (simulated) Stripe fee; paid after a 16-day hold
    const fee = simulatedStripeFee(2500);
    expect(line).toMatchObject({ priceCents: 2500, commissionBps: 2000, feeCents: fee, netCents: 2500 - fee, instructorShareCents: splitLine(2500, fee, 2000).instructorShareCents, transferStatus: 'pending', payee: 'instructor' });
    expect(line.transferDueAt!.getTime() - (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paidAt!.getTime()).toBe(16 * 86400000);
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
    // Reviewers can watch the new (not yet live) video; instructors and students cannot use the admin route.
    const pb = await admin.send('post', `/api/admin/videos/${newVideo.id}/playback`).expect(200);
    expect(pb.body.url).toEqual(expect.any(String));
    await teacher.send('post', `/api/admin/videos/${newVideo.id}/playback`).expect(403);
    await admin.send('post', `/api/admin/videos/00000000-0000-0000-0000-000000000000/playback`).expect(404);

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
    const checkout = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true }).expect(200);
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
    const aLine = detail.body.lines.find((l: any) => l.course.id === a.course.id);
    expect(aLine).toMatchObject({ commissionBps: 2000, payee: 'instructor' });
    expect(aLine.commissionCents).toBe(aLine.netCents - aLine.instructorShareCents);
    expect(detail.body.lines.reduce((n: number, l: any) => n + l.feeCents, 0)).toBe(simulatedStripeFee(6998));
    expect(detail.body).toMatchObject({ feeSource: 'simulated', stripeFeeCents: simulatedStripeFee(6998) });
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

  it('payments: after-fee split, refund policy, hold + release, netting, super-admin terms', async () => {
    if (!available) return;
    const teacher = await userAgent('m-teacher@e2e.example', ['student', 'instructor'], {});
    const admin = await userAgent('m-admin@e2e.example', ['student', 'admin']);
    const boss = await userAgent('m-super@e2e.example', ['student', 'admin', 'super_admin']);
    const buyer = await userAgent('m-buyer@e2e.example', ['student']);
    const c100 = await publishedCourse(teacher.user.id, 'm-hundred', 10000);
    const c50 = await publishedCourse(teacher.user.id, 'm-fifty', 5000);

    // Terms: only a super admin may change them; the instructor sees the result.
    await admin.send('put', `/api/admin/instructors/${teacher.user.id}/terms`, { commissionBps: 1000, note: 'Launch partner' }).expect(403);
    const t = await boss.send('put', `/api/admin/instructors/${teacher.user.id}/terms`, { commissionBps: 1000, note: 'Launch partner 90/10' }).expect(200);
    expect(t.body).toMatchObject({ instructorSharePercent: 90, source: 'agreement', defaultInstructorSharePercent: 80 });
    await admin.send('put', '/api/admin/settings', { commission_bps: 3000 }).expect(403);
    const seen = await teacher.agent.get('/api/instructor/terms').expect(200);
    expect(seen.body).toMatchObject({ instructorSharePercent: 90, holdDays: 16, refundWindowDays: 14 });
    expect(await prisma.auditLog.count({ where: { action: 'commission.terms_changed', targetId: teacher.user.id } })).toBe(1);
    // back to the default for the rest of the test
    await boss.send('put', `/api/admin/instructors/${teacher.user.id}/terms`, { commissionBps: null, note: 'Back to the standard terms' }).expect(200);

    // Buy both courses in one checkout: one fee, split by price, 80% of each line's net.
    await buyer.send('post', '/api/cart', { courseId: c100.course.id }).expect(201);
    await buyer.send('post', '/api/cart', { courseId: c50.course.id }).expect(201);
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true }).expect(200);
    await buyer.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: co.body.orderId }, include: { lines: { orderBy: { priceCents: 'desc' } } } });
    const expected = splitOrder(simulatedStripeFee(15000), [{ baseCents: 10000, platformBps: 2000 }, { baseCents: 5000, platformBps: 2000 }]);
    expect(order).toMatchObject({ stripeFeeCents: simulatedStripeFee(15000), feeSource: 'simulated', immediateAccessConsentAt: expect.any(Date) });
    expect(order.lines.map((l) => [l.feeCents, l.netCents, l.instructorShareCents])).toEqual(expected.map((e) => [e.feeCents, e.netCents, e.instructorShareCents]));

    // Refund policy: eligible now; watching 25% or more of a course makes it ineligible.
    const lc50 = order.lines.find((l) => l.courseId === c50.course.id)!;
    await prisma.lectureProgress.create({ data: { userId: buyer.user.id, lectureId: c50.lecture.id, positionSec: 20, completed: true } });
    const el = await buyer.agent.get(`/api/orders/${order.id}/refund`).expect(200);
    expect(el.body.lines.find((l: any) => l.lineId === lc50.id)).toMatchObject({ eligible: false, reason: 'watched_too_much', watchedPercent: 100 });
    const l100 = el.body.lines.find((l: any) => l.courseId === c100.course.id);
    expect(l100).toMatchObject({ eligible: true, reason: null });
    expect(el.body).toMatchObject({ policy: { windowDays: 14, maxWatchedPercent: 25, selfServicePerYear: 3 }, selfServiceLeft: 3 });
    const denied = await buyer.send('post', `/api/orders/${order.id}/refund`, { lineIds: [lc50.id] }).expect(400);
    expect(denied.body.error.code).toBe('watched_too_much');
    await request(app.getHttpServer()).get(`/api/orders/${order.id}/refund`).expect(401);
    const other = await userAgent('m-other@e2e.example', ['student']);
    await other.agent.get(`/api/orders/${order.id}/refund`).expect(404);
    const done = await buyer.send('post', `/api/orders/${order.id}/refund`, { lineIds: [l100.lineId], reason: 'Not what I needed' }).expect(200);
    expect(done.body).toEqual({ status: 'refunded' });
    expect(await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: buyer.user.id, courseId: c100.course.id } } })).toMatchObject({ revokedAt: expect.any(Date) });
    expect(await prisma.orderLine.findUniqueOrThrow({ where: { id: l100.lineId } })).toMatchObject({ transferStatus: 'none', refundedAt: expect.any(Date) });

    // Hold + release with a fake Stripe: nothing before the due date; the transfer after it, idempotent.
    await prisma.instructorProfile.update({ where: { userId: teacher.user.id }, data: { stripeAccountId: 'acct_m', payoutsEnabled: true } });
    await prisma.order.update({ where: { id: order.id }, data: { stripeChargeId: 'ch_m' } });
    const calls: any[] = [];
    let reverseFails = false;
    const fakeStripe: any = {
      configured: true,
      client: {
        transfers: {
          create: async (p: any, o: any) => (calls.push({ p, o }), { id: `tr_${p.metadata.orderLineId}` }),
          createReversal: async () => { if (reverseFails) throw new Error('insufficient funds'); return { id: 'trr_1' }; },
        },
      },
    };
    const payouts = new PayoutsService(prisma, app.get(AuditService), fakeStripe);
    expect(await payouts.releaseDue(new Date())).toEqual({ transferred: 0, netted: 0 });
    const later = new Date(Date.now() + 17 * 86400000);
    expect(await payouts.releaseDue(later)).toEqual({ transferred: 1, netted: 0 });
    expect(await payouts.releaseDue(later)).toEqual({ transferred: 0, netted: 0 });
    expect(calls[0].p).toMatchObject({ amount: lc50.instructorShareCents, destination: 'acct_m', source_transaction: 'ch_m', transfer_group: order.id });
    expect(calls[0].o).toEqual({ idempotencyKey: `transfer:${lc50.id}` });

    // Admin exception refund after the transfer; Stripe cannot reverse → the instructor owes it, netted from the next sale.
    reverseFails = true;
    const refundsSvc = app.get(RefundsService);
    (refundsSvc as any).payouts = payouts;
    await refundsSvc.refund(order.id, [lc50.id], 'exception: duplicate purchase', { id: admin.user.id, ip: null });
    expect(await payouts.owedBy(teacher.user.id)).toBe(lc50.instructorShareCents);
    await buyer.send('post', '/api/cart', { courseId: c100.course.id }).expect(201);
    const co2 = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true }).expect(200);
    await buyer.send('post', `/api/dev/test-payments/${co2.body.orderId}/complete`).expect(200);
    await prisma.order.update({ where: { id: co2.body.orderId }, data: { stripeChargeId: 'ch_m2' } });
    const line2 = await prisma.orderLine.findFirstOrThrow({ where: { orderId: co2.body.orderId } });
    expect(await payouts.releaseDue(later)).toEqual({ transferred: 1, netted: 1 });
    expect(calls[1].p.amount).toBe(line2.instructorShareCents - lc50.instructorShareCents);
    expect(await payouts.owedBy(teacher.user.id)).toBe(0);

    // Finance overview: every reconciliation check holds.
    const fin = await admin.agent.get('/api/admin/finance').expect(200);
    expect(fin.body.checks.problems).toEqual([]);
    const sales = await teacher.agent.get('/api/instructor/sales').expect(200);
    expect(sales.body.totals.feesCents).toBeGreaterThan(0);
  });

  it('DEL Studio: a super admin works in the studio as DEL; the audit log names the real person', async () => {
    if (!available) return;
    const delAcct = await prisma.instructorProfile.findFirst({ where: { isPlatform: true } });
    const del = delAcct ? { user: { id: delAcct.userId } } : await userAgent('s-del@e2e.example', ['student', 'instructor'], { isPlatform: true });
    const delCourse = await publishedCourse(del.user.id, 's-del-course', 1999);
    const boss = await userAgent('s-super@e2e.example', ['student', 'admin', 'super_admin']);
    const admin = await userAgent('s-admin@e2e.example', ['student', 'admin']);

    await admin.send('post', '/api/auth/act-as', { mode: 'del' }).expect(403);
    await boss.agent.get('/api/instructor/courses').expect(403); // not an instructor themselves
    const on = await boss.send('post', '/api/auth/act-as', { mode: 'del' }).expect(200);
    expect(on.body.actingAs.id).toBe(del.user.id);
    const me = await boss.agent.get('/api/auth/me').expect(200);
    expect(me.body.user).toMatchObject({ id: boss.user.id, actingAs: { id: del.user.id } });

    const list = await boss.agent.get('/api/instructor/courses').expect(200);
    expect(list.body.items.map((c: any) => c.id)).toContain(delCourse.course.id);
    // Only studio routes are swapped: admin routes still see the super admin.
    await boss.agent.get('/api/admin/stats').expect(200);

    await boss.send('patch', `/api/instructor/courses/${delCourse.course.id}`, { subtitle: 'Edited from DEL Studio' }).expect(200);
    await boss.send('post', `/api/instructor/courses/${delCourse.course.id}/submit`).expect(200);
    const entry = await prisma.auditLog.findFirst({ where: { targetId: delCourse.course.id, action: 'course.revision_submitted' } });
    expect(entry).toMatchObject({ actorId: boss.user.id, meta: expect.objectContaining({ actingAs: del.user.id }) });
    expect(await prisma.auditLog.count({ where: { action: 'auth.act_as_started', actorId: boss.user.id } })).toBe(1);

    await boss.send('post', '/api/auth/act-as', { mode: 'self' }).expect(200);
    await boss.agent.get('/api/instructor/courses').expect(403);
  });

  it('sales and promotions: instructor sales, marketplace promotions, checkout at the sale price, expiry', async () => {
    if (!available) return;
    const teacher = await userAgent('sp-teacher@e2e.example', ['student', 'instructor'], {});
    const rival = await userAgent('sp-rival@e2e.example', ['student', 'instructor'], {});
    const del = await userAgent('sp-del@e2e.example', ['student', 'instructor'], { isPlatform: true });
    const admin = await userAgent('sp-admin@e2e.example', ['student', 'admin']);
    const boss = await userAgent('sp-super@e2e.example', ['student', 'admin', 'super_admin']);
    const buyer = await userAgent('sp-buyer@e2e.example', ['student']);
    const c = (await publishedCourse(teacher.user.id, 'sp-fifty', 5000)).course;
    const r = (await publishedCourse(rival.user.id, 'sp-forty', 4000)).course;
    const d = (await publishedCourse(del.user.id, 'sp-del', 6000)).course;
    const http = request(app.getHttpServer());
    const day = 86400000;
    const inDays = (n: number) => new Date(Date.now() + n * day).toISOString();
    const priceOf = async (slug: string) => (await http.get(`/api/courses/${slug}`).expect(200)).body;

    // Rules and ownership: at least 10% off, not below $4.99, up to 31 days, own courses only, instructors only.
    const code = async (res: any) => (await res).body.error?.code;
    expect(await code(teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 4600, endsAt: inDays(2) }).expect(400))).toBe('sale_price');
    expect(await code(teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 400, endsAt: inDays(2) }).expect(400))).toBe('sale_price');
    expect(await code(teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 2999, endsAt: inDays(40) }).expect(400))).toBe('sale_length');
    expect(await code(teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 2999, startsAt: inDays(-2), endsAt: inDays(2) }).expect(400))).toBe('sale_start');
    await rival.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 2999, endsAt: inDays(2) }).expect(404);
    await admin.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 2999, endsAt: inDays(2) }).expect(403);

    // A sale that starts now: the storefront shows both prices; a second overlapping sale is refused.
    const sale = await teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 2999, endsAt: inDays(2) }).expect(201);
    expect(sale.body).toMatchObject({ status: 'active', salePriceCents: 2999, listPriceCents: 5000, percentOff: 40 });
    expect(await code(teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 3999, startsAt: inDays(1), endsAt: inDays(3) }).expect(409))).toBe('sale_overlap');
    expect(await priceOf('sp-fifty')).toMatchObject({ priceCents: 2999, listPriceCents: 5000, sale: { kind: 'course_sale', percentOff: 40 } });
    const onSale = await http.get('/api/courses?onSale=1&pageSize=48').expect(200);
    expect(onSale.body.items.map((i: any) => i.slug)).toContain('sp-fifty');
    expect(onSale.body.items.map((i: any) => i.slug)).not.toContain('sp-forty');
    expect(onSale.body.facets.onSale).toBe(onSale.body.total);
    expect((await http.get('/api/deals').expect(200)).body.onSaleCount).toBeGreaterThanOrEqual(1);

    // Checkout charges the sale price; the split is 80% of the sale price's net; the line keeps the regular price.
    await buyer.send('post', '/api/cart', { courseId: c.id }).expect(201);
    expect((await buyer.agent.get('/api/cart').expect(200)).body).toMatchObject({ totalCents: 2999, items: [{ priceCents: 2999, listPriceCents: 5000 }] });
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true }).expect(200);
    await buyer.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: co.body.orderId }, include: { lines: true } });
    const [expected] = splitOrder(simulatedStripeFee(2999), [{ baseCents: 2999, platformBps: 2000 }]);
    expect(order.totalCents).toBe(2999);
    expect(order.lines[0]).toMatchObject({ priceCents: 2999, listPriceCents: 5000, saleKind: 'course_sale', saleId: sale.body.id, netCents: expected.netCents, instructorShareCents: expected.instructorShareCents });
    expect((await buyer.agent.get(`/api/orders/${order.id}`).expect(200)).body.lines[0]).toMatchObject({ priceCents: 2999, listPriceCents: 5000 });

    // When the sale ends, the regular price is back with nothing else to do.
    await prisma.courseSale.update({ where: { id: sale.body.id }, data: { startsAt: new Date(Date.now() - 3 * day), endsAt: new Date(Date.now() - 1000) } });
    expect(await priceOf('sp-fifty')).toMatchObject({ priceCents: 5000, sale: null });
    expect((await http.get('/api/courses?onSale=1&pageSize=48').expect(200)).body.items.map((i: any) => i.slug)).not.toContain('sp-fifty');
    expect(await code(teacher.send('post', `/api/instructor/courses/${c.id}/sales/${sale.body.id}/cancel`).expect(409))).toBe('sale_closed');

    // Scheduled sale: no effect yet; edit, then cancel.
    const later = await teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 3999, startsAt: inDays(1), endsAt: inDays(3) }).expect(201);
    expect(later.body.status).toBe('scheduled');
    expect((await priceOf('sp-fifty')).priceCents).toBe(5000);
    const edited = await teacher.send('patch', `/api/instructor/courses/${c.id}/sales/${later.body.id}`, { salePriceCents: 3499, startsAt: inDays(1), endsAt: inDays(4) }).expect(200);
    expect(edited.body).toMatchObject({ salePriceCents: 3499, status: 'scheduled' });
    expect((await teacher.send('post', `/api/instructor/courses/${c.id}/sales/${later.body.id}/cancel`).expect(200)).body.status).toBe('canceled');

    // Marketplace promotion: super admin only; 50% off everything in scope.
    const promoBody = { name: 'E2E half price', percentOff: 50, endsAt: inDays(3), scope: 'all' };
    await admin.send('post', '/api/admin/promotions', promoBody).expect(403);
    expect(await code(boss.send('post', '/api/admin/promotions', { ...promoBody, percentOff: 95 }).expect(400))).toBe('promo_percent');
    const promo = await boss.send('post', '/api/admin/promotions', promoBody).expect(201);
    expect(promo.body).toMatchObject({ status: 'active', percentOff: 50 });
    expect(await priceOf('sp-forty')).toMatchObject({ priceCents: 2000, listPriceCents: 4000, sale: { kind: 'promotion', name: 'E2E half price' } });
    expect((await priceOf('sp-fifty')).priceCents).toBe(2500);

    // Opt-out: an instructor can leave a course out; DEL's own courses are always included.
    await teacher.send('put', `/api/instructor/courses/${c.id}/promotions`, { promoOptOut: true }).expect(200);
    expect(await priceOf('sp-fifty')).toMatchObject({ priceCents: 5000, sale: null });
    expect(await code(del.send('put', `/api/instructor/courses/${d.id}/promotions`, { promoOptOut: true }).expect(400))).toBe('platform_course');
    expect((await priceOf('sp-del')).priceCents).toBe(3000);

    // Lowest price wins, never stacked: own sale $39.99 vs 50% off ($25.00).
    await teacher.send('post', `/api/instructor/courses/${c.id}/sales`, { salePriceCents: 3999, endsAt: inDays(2) }).expect(201);
    expect(await priceOf('sp-fifty')).toMatchObject({ priceCents: 3999, sale: { kind: 'course_sale' } });
    await teacher.send('put', `/api/instructor/courses/${c.id}/promotions`, { promoOptOut: false }).expect(200);
    expect(await priceOf('sp-fifty')).toMatchObject({ priceCents: 2500, sale: { kind: 'promotion' } });

    // Overview for the studio; admin oversight; super admin cancels; audit trail.
    const ov = await teacher.agent.get('/api/instructor/promotions').expect(200);
    expect(ov.body.courses.find((x: any) => x.id === c.id)).toMatchObject({ priceCents: 5000, maxSalePriceCents: 4500, inPromotions: [promo.body.id] });
    const open = await admin.agent.get('/api/admin/course-sales').expect(200);
    const running = open.body.items.find((s: any) => s.course.id === c.id && s.status === 'active');
    expect(running).toBeTruthy();
    await admin.send('post', `/api/admin/course-sales/${running.id}/cancel`, { note: 'Price typo, please fix' }).expect(403);
    await boss.send('post', `/api/admin/course-sales/${running.id}/cancel`, { note: 'Price typo, please fix' }).expect(200);
    await boss.send('post', `/api/admin/promotions/${promo.body.id}/cancel`).expect(200);
    expect(await priceOf('sp-fifty')).toMatchObject({ priceCents: 5000, sale: null });
    expect(await priceOf('sp-forty')).toMatchObject({ priceCents: 4000, sale: null });
    const actions = (await prisma.auditLog.findMany({ where: { action: { in: ['course_sale.created', 'course_sale.updated', 'course_sale.canceled', 'promotion.created', 'promotion.canceled', 'course.promo_opt_out'] } }, select: { action: true } })).map((x) => x.action);
    for (const a of ['course_sale.created', 'course_sale.updated', 'course_sale.canceled', 'promotion.created', 'promotion.canceled', 'course.promo_opt_out']) expect(actions).toContain(a);
  });

  it('standard covers: generated on create, picker and preview, change any time, admin templates', async () => {
    if (!available) return;
    const teacher = await userAgent('cv-teacher@e2e.example', ['student', 'instructor'], {});
    const rival = await userAgent('cv-rival@e2e.example', ['student', 'instructor'], {});
    const admin = await userAgent('cv-admin@e2e.example', ['student', 'admin']);
    const boss = await userAgent('cv-super@e2e.example', ['student', 'admin', 'super_admin']);
    const created = await teacher.send('post', '/api/instructor/courses', { title: 'Cover test course', priceCents: 1999 }).expect(201);
    const id = created.body.id;
    const row = async () => prisma.course.findUniqueOrThrow({ where: { id }, select: { coverKey: true, coverTemplateId: true } });
    const first = await row();
    expect(first.coverKey).toMatch(new RegExp(`^images/covers/${id}-[0-9a-f]{12}\\.png$`));
    expect(first.coverTemplateId).toBeTruthy();
    expect(created.body.thumbnailUrl).toContain('/api/media/images/covers/');
    const img = await request(app.getHttpServer()).get(`/api/media/${first.coverKey}`).expect(200);
    expect(img.headers['content-type']).toBe('image/png');

    // Picker: every active template, the course's own title; previews are real images; other instructors get 404.
    const pick = await teacher.agent.get(`/api/instructor/courses/${id}/cover`).expect(200);
    expect(pick.body.templates.length).toBeGreaterThanOrEqual(52);
    expect(pick.body.course).toMatchObject({ title: 'Cover test course', coverTemplateId: first.coverTemplateId });
    const other = pick.body.templates.find((t: any) => t.id !== first.coverTemplateId);
    const pv = await teacher.agent.get(`/api/instructor/courses/${id}/cover-preview/${other.id}?w=320`).expect(200);
    expect(pv.headers['content-type']).toBe('image/png');
    await rival.agent.get(`/api/instructor/courses/${id}/cover`).expect(404);
    await rival.send('put', `/api/instructor/courses/${id}/cover`, { templateId: other.id }).expect(404);

    // Change the template: new image at once; the title change regenerates it too.
    const set = await teacher.send('put', `/api/instructor/courses/${id}/cover`, { templateId: other.id }).expect(200);
    const second = await row();
    expect(second).toMatchObject({ coverTemplateId: other.id });
    expect(second.coverKey).not.toBe(first.coverKey);
    expect(set.body.coverUrl).toContain(second.coverKey);
    await teacher.send('patch', `/api/instructor/courses/${id}`, { title: 'Cover test course, renamed' }).expect(200);
    expect((await row()).coverKey).not.toBe(second.coverKey);

    // Admin templates: admins read; only a super admin changes; bad colours refused.
    const list = await admin.agent.get('/api/admin/cover-templates').expect(200);
    expect(list.body.items.find((t: any) => t.id === other.id).courseCount).toBeGreaterThanOrEqual(1);
    await admin.send('patch', `/api/admin/cover-templates/${other.id}`, { active: false }).expect(403);
    const bad = { name: 'Bad', layout: 'split', motif: 'loop', palette: { bg: ['#000000', 'red'], ink: '#ffffff', a: '#9d8fff', b: '#58c3f2', tone: 'dark' } };
    await boss.send('post', '/api/admin/cover-templates', bad).expect(400);
    const made = await boss.send('post', '/api/admin/cover-templates', { ...bad, palette: { ...bad.palette, bg: ['#000000', '#111111'] }, topics: ['general'] }).expect(201);
    expect(made.body).toMatchObject({ name: 'Bad', active: true, builtIn: false });
    // An inactive template can't be chosen; deactivating one moves its courses to another template.
    await boss.send('patch', `/api/admin/cover-templates/${made.body.id}`, { active: false }).expect(200);
    expect((await teacher.send('put', `/api/instructor/courses/${id}/cover`, { templateId: made.body.id }).expect(400)).body.error.code).toBe('cover_template');
    const off = await boss.send('patch', `/api/admin/cover-templates/${other.id}`, { active: false }).expect(200);
    expect(off.body.coursesMoved).toBeGreaterThanOrEqual(1);
    expect((await row()).coverTemplateId).not.toBe(other.id);
    await boss.send('patch', `/api/admin/cover-templates/${other.id}`, { active: true }).expect(200);
    const actions = (await prisma.auditLog.findMany({ where: { action: { in: ['course.cover_changed', 'cover_template.created', 'cover_template.updated'] } }, select: { action: true } })).map((x) => x.action);
    for (const a of ['course.cover_changed', 'cover_template.created', 'cover_template.updated']) expect(actions).toContain(a);
  });
});
