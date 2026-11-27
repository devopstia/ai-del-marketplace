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
import { OAuthConfigService } from '../src/auth/oauth-config.service';
import { AppModule } from '../src/app.module';
import { ARGON2_OPTS } from '../src/auth/auth.service';
import { configureApp } from '../src/bootstrap';
import { JobsService } from '../src/common/jobs';
import { seal } from '../src/common/seal';
import { ALL_ADMIN_PERMISSIONS } from '../src/common/permissions';
import { sendAccessReminders } from '../src/access/reminders';
import { codeAt, newSecret, stepAt } from '../src/auth/totp';
import { PrismaService } from '../src/common/prisma.service';
import { resetEnvCache } from '../src/config/env';
import { PayoutsService } from '../src/commerce/payouts.service';
import { RefundsService } from '../src/commerce/refunds.service';
import { simulatedStripeFee, splitLine, splitOrder } from '../src/commerce/money';
import { TERMS_VERSION } from '../src/commerce/terms';
import { AuditService } from '../src/common/audit.service';
import { StorageService } from '../src/common/storage.service';
import { packageHls } from '../src/protection/hls-packager';
import { createDecipheriv } from 'node:crypto';
import { tmpdir } from 'node:os';

/** What the checkout page sends when the learner ticks the terms box (owner 2026-11-26). */
const TERMS = { acceptTerms: true, termsVersion: TERMS_VERSION };
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
      OAUTH_TEST_PROVIDER: 'true',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      STRIPE_SECRET_KEY: '',
      S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000',
      S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: env.S3_ACCESS_KEY ?? process.env.S3_ACCESS_KEY ?? 'test',
      S3_SECRET_KEY: env.S3_SECRET_KEY ?? process.env.S3_SECRET_KEY ?? 'test-secret',
      WEB_URL: 'http://127.0.0.1:3000',
      // Tests never call the real Claude API: the AI learning features must be hidden (404) here.
      ANTHROPIC_API_KEY: '',
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

    // Sign-up earns no session yet: Google Authenticator is set up first (owner 2026-11-25).
    const reg = await agent.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: 'buyer@e2e.example', password: 'Long-enough-pw1', name: 'Buyer' }).expect(201);
    expect(reg.body).toEqual({ mfa: 'enroll' });
    expect(([] as string[]).concat(reg.headers['set-cookie'] ?? []).some((c) => c.startsWith('sid='))).toBe(false);
    expect((await agent.get('/api/auth/me').expect(200)).body.user).toBeNull();
    const setup = await agent.post('/api/auth/mfa/enroll').set('X-CSRF-Token', csrf).expect(200);
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/DevOps%20Easy%20Learning');
    const done = await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: codeAt(setup.body.secret, stepAt()) }).expect(200);
    expect(done.body.user.roles).toEqual(['student']);
    expect(done.body.recoveryCodes).toHaveLength(10);
    const setCookie = ([] as string[]).concat(done.headers['set-cookie'] ?? []);
    expect(setCookie.find((c) => c.startsWith('sid='))).toMatch(/HttpOnly/i);

    const list = await agent.get('/api/courses').expect(200);
    expect(list.body.items.map((c: any) => c.slug)).toContain('e2e-course');
    expect(list.body.items[0].totalDurationSec).toBe(15);

    await agent.post(`/api/lectures/${ids.lecture}/playback`).set('X-CSRF-Token', csrf).expect(403);

    const cart = await agent.post('/api/cart').set('X-CSRF-Token', csrf).send({ courseId: ids.course }).expect(201);
    expect(cart.body).toMatchObject({ count: 1, totalCents: 2500 });

    const noConsent = await agent.post('/api/checkout').set('X-CSRF-Token', csrf).send(TERMS).expect(400);
    expect(noConsent.body.error.code).toBe('consent_required');
    const checkout = await agent.post('/api/checkout').set('X-CSRF-Token', csrf).send({ immediateAccessConsent: true, ...TERMS }).expect(200);
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
    expect(pb.body.url).toContain(`${process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000'}/del-media/videos/e2e/source.mp4`);
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
  const MFA_SEED = newSecret();
  async function userAgent(email: string, roles: any[], profile?: { isPlatform?: boolean }, adminPermissions: string[] = ALL_ADMIN_PERMISSIONS) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0], passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles, adminPermissions: roles.includes('admin') ? adminPermissions : [], mfaSecret: seal('mfa', MFA_SEED), mfaEnabledAt: new Date() } });
    if (profile) await prisma.instructorProfile.create({ data: { userId: user.id, status: 'approved', isPlatform: !!profile.isPlatform } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200, { mfa: 'verify' });
    await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: codeAt(MFA_SEED, stepAt()) }).expect(200);
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

  it('terms acceptance at purchase: refused without the current version, recorded on the order, shown on receipt and admin detail', async () => {
    if (!available) return;
    const teacher = await userAgent('terms-teacher@e2e.example', ['student', 'instructor'], {});
    const buyer = await userAgent('terms-buyer@e2e.example', ['student']);
    const admin = await userAgent('terms-admin@e2e.example', ['student', 'admin']);
    const paid = await publishedCourse(teacher.user.id, 'terms-paid', 1500);
    const free = await publishedCourse(teacher.user.id, 'terms-free', 0);
    await buyer.send('post', '/api/cart', { courseId: paid.course.id }).expect(201);

    const none = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true }).expect(400);
    expect(none.body.error).toMatchObject({ code: 'terms_required', details: { currentVersion: TERMS_VERSION } });
    const declined = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, acceptTerms: false, termsVersion: TERMS_VERSION }).expect(400);
    expect(declined.body.error.code).toBe('terms_required');
    const old = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, acceptTerms: true, termsVersion: '2020-01-01' }).expect(400);
    expect(old.body.error.code).toBe('terms_outdated');
    expect(await prisma.order.count({ where: { userId: buyer.user.id } })).toBe(0);

    const before = Date.now();
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: co.body.orderId } });
    expect(order).toMatchObject({ termsVersion: TERMS_VERSION, termsAcceptedAt: expect.any(Date), termsAcceptedIp: expect.any(String) });
    expect(order.termsAcceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    await buyer.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);

    const receipt = await buyer.agent.get(`/api/orders/${co.body.orderId}`).expect(200);
    expect(receipt.body.terms).toEqual({ version: TERMS_VERSION, acceptedAt: order.termsAcceptedAt!.toISOString() });
    expect(receipt.body.terms.ip).toBeUndefined();
    const detail = await admin.agent.get(`/api/admin/orders/${co.body.orderId}`).expect(200);
    expect(detail.body.terms).toEqual({ version: TERMS_VERSION, acceptedAt: order.termsAcceptedAt!.toISOString(), ip: order.termsAcceptedIp });

    // A free enrolment goes through checkout too and records the acceptance (no immediate-access consent needed).
    await buyer.send('post', '/api/cart', { courseId: free.course.id }).expect(201);
    await buyer.send('post', '/api/checkout', {}).expect(400);
    const fco = await buyer.send('post', '/api/checkout', TERMS).expect(200);
    expect(fco.body.mode).toBe('free');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: fco.body.orderId } })).toMatchObject({ termsVersion: TERMS_VERSION, termsAcceptedAt: expect.any(Date), status: 'paid' });
  });

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
    const checkout = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
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

  it('Official DEL Instructors: DEL brand on their courses, own rate and own Stripe payouts (owner 2026-11-26)', async () => {
    if (!available) return;
    const teacher = await userAgent('o-teacher@e2e.example', ['student', 'instructor'], {});
    const indie = await userAgent('o-indie@e2e.example', ['student', 'instructor'], {});
    const admin = await userAgent('o-admin@e2e.example', ['student', 'admin']);
    const boss = await userAgent('o-super@e2e.example', ['student', 'admin', 'super_admin']);
    const buyer = await userAgent('o-buyer@e2e.example', ['student']);
    const course = await publishedCourse(teacher.user.id, 'o-official', 10000);
    const other = await publishedCourse(indie.user.id, 'o-indie', 10000);

    // Only a super admin designates; recorded in the audit log.
    await admin.send('put', `/api/admin/instructors/${teacher.user.id}/terms`, { official: true, commissionBps: 4000, note: 'Official DEL instructor, 60/40' }).expect(403);
    const t = await boss.send('put', `/api/admin/instructors/${teacher.user.id}/terms`, { official: true, commissionBps: 4000, note: 'Official DEL instructor, 60/40' }).expect(200);
    expect(t.body).toMatchObject({ official: true, instructorSharePercent: 60, source: 'agreement', payToPlatform: false });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'commission.terms_changed', targetId: teacher.user.id } });
    expect(audit.meta).toMatchObject({ before: { official: false }, after: { official: true } });
    expect(await teacher.agent.get('/api/instructor/terms').expect(200).then((r) => r.body.official)).toBe(true);

    // Branding: DEL on the card and the course page, the instructor still credited; independents keep their own name.
    const list = await request(app.getHttpServer()).get('/api/courses?q=o-&pageSize=48').expect(200);
    const card = (slug: string) => list.body.items.find((c: any) => c.slug === slug);
    expect(card(course.course.slug).instructor).toMatchObject({ name: teacher.user.name, brand: 'DevOps Easy Learning' });
    expect(card(other.course.slug).instructor.brand).toBeNull();
    const page = await request(app.getHttpServer()).get(`/api/courses/${course.course.slug}`).expect(200);
    expect(page.body.instructor).toMatchObject({ name: teacher.user.name, brand: 'DevOps Easy Learning', official: true });
    const prof = await request(app.getHttpServer()).get(`/api/instructors/${teacher.user.id}`).expect(200);
    expect(prof.body).toMatchObject({ official: true, brand: 'DevOps Easy Learning' });

    // Admin: filter by kind.
    const official = await boss.agent.get('/api/admin/instructors?kind=official').expect(200);
    expect(official.body.items.map((i: any) => i.userId)).toEqual([teacher.user.id]);
    const independent = await boss.agent.get('/api/admin/instructors?kind=independent').expect(200);
    expect(independent.body.items.some((i: any) => i.userId === teacher.user.id)).toBe(false);

    // Money is unchanged by branding: paid to the instructor (Stripe transfer after the hold) at their own rate.
    await buyer.send('post', '/api/cart', { courseId: course.course.id }).expect(201);
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
    await buyer.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);
    const line = await prisma.orderLine.findFirstOrThrow({ where: { orderId: co.body.orderId } });
    const [split] = splitOrder(simulatedStripeFee(10000), [{ baseCents: 10000, platformBps: 4000 }]);
    expect(line).toMatchObject({ payee: 'instructor', commissionBps: 4000, transferStatus: 'pending', instructorShareCents: split!.instructorShareCents });

    // Turning it off brings back the instructor's own name.
    await boss.send('put', `/api/admin/instructors/${teacher.user.id}/terms`, { official: false, note: 'Now independent' }).expect(200);
    const again = await request(app.getHttpServer()).get(`/api/courses/${course.course.slug}`).expect(200);
    expect(again.body.instructor).toMatchObject({ brand: null, official: false });
  });

  it('DEL courses can name the instructor who teaches them; other instructors cannot (owner 2026-11-26)', async () => {
    if (!available) return;
    const del = await userAgent('t-del@e2e.example', ['student', 'instructor'], {});
    await prisma.instructorProfile.update({ where: { userId: del.user.id }, data: { isPlatform: true } });
    const indie = await userAgent('t-indie@e2e.example', ['student', 'instructor'], {});
    const c = await publishedCourse(del.user.id, 't-del-course', 1500);
    const mine = await publishedCourse(indie.user.id, 't-indie-course', 1500);
    // Published course: the change goes to the draft revision, applied on approval; drafts change directly.
    const draft = await prisma.course.create({ data: { title: 'DEL draft', slug: 't-del-draft', instructorId: del.user.id } });
    await del.send('patch', `/api/instructor/courses/${draft.id}`, { taughtBy: '  Tia ' }).expect(200);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: draft.id } })).taughtBy).toBe('Tia');
    await prisma.course.update({ where: { id: c.course.id }, data: { taughtBy: 'Tia' } });
    const page = await request(app.getHttpServer()).get(`/api/courses/${c.course.slug}`).expect(200);
    expect(page.body.instructor).toMatchObject({ brand: 'DevOps Easy Learning', taughtBy: 'Tia' });
    const err = await indie.send('patch', `/api/instructor/courses/${mine.course.id}`, { taughtBy: 'Someone else' }).expect(400);
    expect(err.body.error.code).toBe('taught_by_platform_only');
    await del.send('patch', `/api/instructor/courses/${draft.id}`, { taughtBy: null }).expect(200);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: draft.id } })).taughtBy).toBeNull();
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
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
    await buyer.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: co.body.orderId }, include: { lines: { orderBy: { priceCents: 'desc' } } } });
    const expected = splitOrder(simulatedStripeFee(15000), [{ baseCents: 10000, platformBps: 2000 }, { baseCents: 5000, platformBps: 2000 }]);
    expect(order).toMatchObject({ stripeFeeCents: simulatedStripeFee(15000), feeSource: 'simulated', immediateAccessConsentAt: expect.any(Date) });
    expect(order.lines.map((l) => [l.feeCents, l.netCents, l.instructorShareCents])).toEqual(expected.map((e) => [e.feeCents, e.netCents, e.instructorShareCents]));

    // Refund policy: eligible now; watching 25% or more of a course makes it ineligible.
    const lc50 = order.lines.find((l) => l.courseId === c50.course.id)!;
    await prisma.lectureProgress.create({ data: { userId: buyer.user.id, lectureId: c50.lecture.id, positionSec: 20, completed: true, watchedSec: 20, watchedRanges: [[0, 20]] } });
    const el = await buyer.agent.get(`/api/orders/${order.id}/refund`).expect(200);
    expect(el.body.lines.find((l: any) => l.lineId === lc50.id)).toMatchObject({ eligible: false, reason: 'watched_too_much', watchedPercent: 100 });
    const l100 = el.body.lines.find((l: any) => l.courseId === c100.course.id);
    expect(l100).toMatchObject({ eligible: true, reason: null });
    expect(el.body).toMatchObject({ policy: { windowDays: 14, maxWatchedPercent: 25, selfServicePerYear: 3 }, selfServiceLeft: 3 });
    // Not eligible: recorded and declined at once (with the reason), never silently refused.
    const denied = await buyer.send('post', `/api/orders/${order.id}/refund`, { lineIds: [lc50.id] }).expect(200);
    expect(denied.body.status).toBe('declined');
    expect((await prisma.refundRequest.findFirstOrThrow({ where: { id: denied.body.requestId } })).status).toBe('auto_declined');
    await request(app.getHttpServer()).get(`/api/orders/${order.id}/refund`).expect(401);
    const other = await userAgent('m-other@e2e.example', ['student']);
    await other.agent.get(`/api/orders/${order.id}/refund`).expect(404);
    const done = await buyer.send('post', `/api/orders/${order.id}/refund`, { lineIds: [l100.lineId], reason: 'Not what I needed' }).expect(200);
    expect(done.body).toMatchObject({ status: 'refunded', requests: [{ status: 'refunded' }] });
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
    const co2 = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
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

  it('dashboard: DEL net revenue for DEL courses, instructor earnings for revenue share, ranges, ownership checks', async () => {
    if (!available) return;
    const delAcct = await prisma.instructorProfile.findFirst({ where: { isPlatform: true } });
    const del = delAcct ? { user: { id: delAcct.userId } } : await userAgent('d-del@e2e.example', ['student', 'instructor'], { isPlatform: true });
    const teacher = await userAgent('d-teacher@e2e.example', ['student', 'instructor'], {});
    const other = await userAgent('d-other@e2e.example', ['student', 'instructor'], {});
    const buyer = await userAgent('d-buyer@e2e.example', ['student']);
    const boss = await userAgent('d-super@e2e.example', ['student', 'admin', 'super_admin']);
    const delCourse = await publishedCourse(del.user.id, 'd-del-course', 499);
    const tCourse = await publishedCourse(teacher.user.id, 'd-teacher-course', 1999);
    for (const courseId of [delCourse.course.id, tCourse.course.id]) await buyer.send('post', '/api/cart', { courseId }).expect(201);
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
    await buyer.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);
    const lines = await prisma.orderLine.findMany({ where: { orderId: co.body.orderId } });
    const tLine = lines.find((l) => l.courseId === tCourse.course.id)!;
    const dLine = lines.find((l) => l.courseId === delCourse.course.id)!;

    // Independent instructor: their share, payouts, their courses only.
    const t = (await teacher.agent.get('/api/instructor/dashboard?range=30d').expect(200)).body;
    expect(t.ownership).toBe('revenue_share');
    expect(t.current).toMatchObject({ grossCents: 1999, feesCents: tLine.feeCents, refundsCents: 0, instructorShareCents: tLine.instructorShareCents, sales: 1, enrolments: 1 });
    expect(t.current.netCents).toBe(1999 - tLine.feeCents);
    expect(t.payouts).toEqual({ pendingCents: expect.any(Number), paidCents: 0 });
    expect(t.courses.map((c: any) => c.id)).toEqual([tCourse.course.id]);
    expect(t.courses[0]).toMatchObject({ students: 1, grossCents: 1999, sales: 1 });
    expect(t.series).toHaveLength(30);
    expect(t.series.at(-1).grossCents).toBe(1999);
    expect(t.activity.some((a: any) => a.kind === 'purchase')).toBe(true);
    expect(JSON.stringify(t)).not.toContain('d-buyer@e2e.example'); // first names only, never emails

    // DEL Studio: gross, Stripe fee and DEL net, never "$0 earnings" (owner 2026-11-27).
    await boss.send('post', '/api/auth/act-as', { mode: 'del' }).expect(200);
    const d = (await boss.agent.get('/api/instructor/dashboard?range=7d').expect(200)).body;
    expect(d.ownership).toBe('platform');
    expect(d.payouts).toBeNull();
    expect(d.current.grossCents).toBeGreaterThanOrEqual(499);
    expect(d.current.netCents).toBe(d.current.grossCents - d.current.feesCents - d.current.refundsCents);
    expect(d.current.instructorShareCents).toBe(0);
    expect(d.courses.find((c: any) => c.id === delCourse.course.id)).toMatchObject({ grossCents: 499, netCents: 499 - dLine.feeCents });
    expect(d.courses.some((c: any) => c.id === tCourse.course.id)).toBe(false);
    await boss.send('post', '/api/auth/act-as', { mode: 'self' }).expect(200);

    // Ranges: a custom range in the past has no sales; the previous period is reported; bad input is refused.
    const past = (await teacher.agent.get('/api/instructor/dashboard?range=custom&from=2020-01-01&to=2020-01-31').expect(200)).body;
    expect(past.range.days).toBe(31);
    expect(past.current.grossCents).toBe(0);
    expect(past.series).toHaveLength(31);
    await teacher.agent.get('/api/instructor/dashboard?range=forever').expect(400);
    // Someone else's dashboard never includes this instructor's courses; students have none.
    const o = (await other.agent.get('/api/instructor/dashboard').expect(200)).body;
    expect(o.courses).toEqual([]);
    expect(o.current.grossCents).toBe(0);
    await buyer.agent.get('/api/instructor/dashboard').expect(403);
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
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
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

  it('support center: open a ticket, staff reply, statuses, internal notes, confirm, reopen, rules', async () => {
    if (!available) return;
    const sam = await userAgent('sp2-student@e2e.example', ['student']);
    const other = await userAgent('sp2-other@e2e.example', ['student']);
    const admin = await userAgent('sp2-admin@e2e.example', ['student', 'admin']);
    const boss = await userAgent('sp2-super@e2e.example', ['student', 'admin', 'super_admin']);
    const jobs = app.get(JobsService) as unknown as { sendEmail: jest.Mock };
    jobs.sendEmail.mockClear();

    // Validation and attachments: types, sizes and keys tied to the uploader.
    expect((await sam.send('post', '/api/support/tickets', { subject: 'Hi', category: 'technical', description: 'short' }).expect(400)).body.error.code).toBe('subject');
    expect((await sam.send('post', '/api/support/uploads', { name: 'x.exe', contentType: 'application/x-msdownload', sizeBytes: 10 }).expect(400)).body.error.code).toBe('attachment_type');
    const up = await sam.send('post', '/api/support/uploads', { name: 'shot.png', contentType: 'image/png', sizeBytes: 1200 }).expect(200);
    expect(up.body.key).toMatch(new RegExp(`^support/${sam.user.id}/`));
    const stolen = { key: `support/${other.user.id}/x.png`, name: 'x.png', mime: 'image/png', sizeBytes: 10 };
    expect((await sam.send('post', '/api/support/tickets', { subject: 'Video stops at 2:10', category: 'video_playback', description: 'The lecture stops playing after two minutes.', attachments: [stolen] }).expect(400)).body.error.code).toBe('attachment_key');

    // Open: number SUP-xxxxxx, status new, the requester sees it, nobody else does.
    const created = await sam.send('post', '/api/support/tickets', { subject: 'Video stops at 2:10', category: 'video_playback', description: 'The lecture stops playing <b>after</b> two minutes.', context: { browser: 'Chrome', os: 'Windows', page: '/learn/x' } }).expect(201);
    const no = created.body.number;
    expect(no).toMatch(/^SUP-\d{6}$/);
    const t0 = (await sam.agent.get(`/api/support/tickets/${no}`).expect(200)).body;
    expect(t0).toMatchObject({ status: 'new', awaiting: 'staff', subject: 'Video stops at 2:10' });
    expect(t0.messages[0].body).toBe('The lecture stops playing <b>after</b> two minutes.'); // stored as plain text
    expect(t0.context).toBeUndefined(); // browser details are for staff
    await other.agent.get(`/api/support/tickets/${no}`).expect(404);
    await other.agent.get('/api/admin/support/tickets').expect(403);
    expect((await sam.agent.get('/api/support/tickets').expect(200)).body.items.map((x: any) => x.number)).toContain(no);

    // Staff: queue, an internal note the requester never sees, a reply (open + email), a request for information.
    const q = await admin.agent.get(`/api/admin/support/tickets?q=${no}`).expect(200);
    expect(q.body.items[0]).toMatchObject({ number: no, status: 'new' });
    expect((await admin.agent.get('/api/admin/support/summary').expect(200)).body.awaitingStaff).toBeGreaterThanOrEqual(1);
    await admin.send('post', `/api/admin/support/tickets/${no}/messages`, { kind: 'note', body: 'Probably the CDN; check logs.' }).expect(201);
    const r1 = await admin.send('post', `/api/admin/support/tickets/${no}/messages`, { kind: 'reply', body: 'Thanks, we are looking into it.' }).expect(201);
    expect(r1.body).toMatchObject({ status: 'open', assignedTo: { id: admin.user.id } });
    const seen = (await sam.agent.get(`/api/support/tickets/${no}`).expect(200)).body;
    expect(seen.messages.map((m: any) => m.body)).not.toContain('Probably the CDN; check logs.');
    expect(seen.messages.find((m: any) => m.staff).author.name).toBe('DEL Support');
    await admin.send('post', `/api/admin/support/tickets/${no}/messages`, { kind: 'request_info', body: 'Which browser version?' }).expect(201);
    expect((await sam.agent.get(`/api/support/tickets/${no}`).expect(200)).body).toMatchObject({ status: 'waiting_user', awaiting: 'requester' });
    await sam.send('post', `/api/support/tickets/${no}/messages`, { body: 'Chrome 131.' }).expect(201);
    expect((await sam.agent.get(`/api/support/tickets/${no}`).expect(200)).body.status).toBe('open');

    // Resolve → still need help → resolve → confirm (closed). Only a super admin may close directly.
    await admin.send('post', `/api/admin/support/tickets/${no}/messages`, { kind: 'resolve', body: 'Fixed on our side.' }).expect(201);
    expect((await sam.send('post', `/api/support/tickets/${no}/still-need-help`).expect(200)).body.status).toBe('open');
    await admin.send('post', `/api/admin/support/tickets/${no}/messages`, { kind: 'resolve', body: 'Fixed again.' }).expect(201);
    expect((await sam.send('post', `/api/support/tickets/${no}/resolved`).expect(200)).body.status).toBe('closed');
    expect((await sam.send('post', `/api/support/tickets/${no}/messages`, { body: 'One more thing' }).expect(409)).body.error.code).toBe('ticket_closed');
    const re = await sam.send('post', `/api/support/tickets/${no}/reopen`, { note: 'It happens again on Firefox.' }).expect(200);
    expect(re.body.status).toBe('open');
    expect((await admin.send('patch', `/api/admin/support/tickets/${no}`, { status: 'closed' }).expect(409)).body.error.code).toBe('close_not_allowed');
    await admin.send('patch', `/api/admin/support/tickets/${no}`, { priority: 'urgent', assignedToId: sam.user.id }).expect(400);
    expect((await boss.send('patch', `/api/admin/support/tickets/${no}`, { status: 'closed' }).expect(200)).body.status).toBe('closed');

    // Emails went to the requester for reply, request for information and both resolves; resolved tickets auto-close.
    const templates = jobs.sendEmail.mock.calls.map((c: any[]) => c[0].template);
    expect(templates).toEqual(expect.arrayContaining(['support-reply', 'support-info-requested', 'support-resolved']));
    // Opening a ticket: a confirmation to the requester and a notification to the support inbox (owner 2026-11-25).
    const calls = jobs.sendEmail.mock.calls.map((c: any[]) => c[0]);
    expect(calls).toContainEqual(expect.objectContaining({ to: 'sp2-student@e2e.example', template: 'support-ticket-received', data: expect.objectContaining({ ticket: no, subject: 'Video stops at 2:10' }) }));
    const staff = calls.find((j: any) => j.template === 'support-ticket-new' && j.data.ticket === no);
    expect(staff).toMatchObject({ to: 'support@devopseasylearning.com', replyTo: 'sp2-student@e2e.example', data: { email: 'sp2-student@e2e.example', body: expect.stringContaining('two minutes') } });
    expect(calls.filter((j: any) => j.template !== 'support-ticket-new').every((j: any) => j.to === 'sp2-student@e2e.example')).toBe(true);
    const old = await sam.send('post', '/api/support/tickets', { subject: 'Certificate name is wrong', category: 'certificates', description: 'My certificate shows an old name.' }).expect(201);
    await admin.send('post', `/api/admin/support/tickets/${old.body.number}/messages`, { kind: 'resolve', body: 'Updated.' }).expect(201);
    await prisma.supportTicket.update({ where: { number: Number(old.body.number.slice(4)) }, data: { resolvedAt: new Date(Date.now() - 8 * 86400000) } });
    expect((await sam.agent.get(`/api/support/tickets/${old.body.number}`).expect(200)).body.status).toBe('closed');

    // Rate limit: at most five new tickets an hour.
    for (let i = 0; i < 3; i++) await sam.send('post', '/api/support/tickets', { subject: `Question number ${i}`, category: 'other', description: 'A question about the platform.' }).expect(201);
    expect((await sam.send('post', '/api/support/tickets', { subject: 'One too many', category: 'other', description: 'A question about the platform.' }).expect(429)).body.error.code).toBe('too_many_tickets');
    expect(await prisma.auditLog.count({ where: { action: { in: ['support.ticket_opened', 'support.reply', 'support.resolve', 'support.ticket_updated'] } } })).toBeGreaterThan(4);
  });

  it('content protection: encrypted HLS through a session bound to the learner, key and playlist refused to others', async () => {
    if (!available) return;
    let ffmpeg = true;
    try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { ffmpeg = false; }
    if (!ffmpeg) return console.warn('[e2e] content protection skipped: ffmpeg not installed');
    const teacher = await userAgent('cp-teacher@e2e.example', ['student', 'instructor'], {});
    const buyer = await userAgent('cp-buyer@e2e.example', ['student']);
    const other = await userAgent('cp-other@e2e.example', ['student']);
    const { course, lecture } = await publishedCourse(teacher.user.id, 'cp-course', 1999);
    await prisma.enrollment.create({ data: { userId: buyer.user.id, courseId: course.id, source: 'free' } });

    // A real 6-second H.264/AAC video, packaged exactly as the worker does it.
    const file = join(tmpdir(), `cp-${Date.now()}.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=25', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '6', '-c:v', 'libx264', '-g', '50', '-c:a', 'aac', '-shortest', '-y', file]);
    const storage = app.get(StorageService);
    const assetRow = await prisma.lecture.findUniqueOrThrow({ where: { id: lecture.id }, select: { videoAssetId: true } });
    const key = `videos/cp-${Date.now()}/source.mp4`;
    await storage.put(key, readFileSync(file), 'video/mp4');
    await prisma.videoAsset.update({ where: { id: assetRow.videoAssetId! }, data: { storageKey: key, durationSec: 6 } });
    const p = await packageHls(await storage.presignInternalGet(key, 600), (k, body) => storage.put(k, body, 'video/mp2t'));
    expect(p.segments).toBeGreaterThanOrEqual(2);
    await prisma.videoAsset.update({ where: { id: assetRow.videoAssetId! }, data: { hlsStatus: 'ready', hlsPrefix: p.prefix, hlsPlaylist: p.playlist, hlsKey: p.keyWrapped, hlsIv: p.ivHex } });
    expect(p.playlist).not.toContain(p.prefix); // the storage prefix never reaches the browser

    // The enrolled learner gets a session, not a file link.
    const pb = await buyer.send('post', `/api/lectures/${lecture.id}/playback`).expect(200);
    expect(pb.body).toMatchObject({ format: 'hls', protected: true });
    expect(pb.body.watermark).toBeUndefined();
    expect(pb.body.url).toMatch(/\/api\/playback\/[0-9a-f-]{36}\/index\.m3u8$/);
    const path = new URL(pb.body.url).pathname;
    const sid = path.split('/')[3];

    // Playlist: only for its owner; key URI on the API; segments are signed links that never expose the original.
    await request(app.getHttpServer()).get(path).expect(401);
    await other.agent.get(path).expect(404);
    const m = await buyer.agent.get(path).expect(200);
    expect(m.headers['content-type']).toContain('application/vnd.apple.mpegurl');
    expect(m.headers['cache-control']).toContain('no-store');
    expect(m.text).toContain(`#EXT-X-KEY:METHOD=AES-128,URI="http://127.0.0.1:4000/api/playback/${sid}/key",IV=0x${p.ivHex}`);
    const seg = m.text.split('\n').find((l) => l.startsWith('http'))!;
    expect(seg).toContain('X-Amz-Signature=');
    expect(seg).not.toContain('source.mp4');

    // Key: 16 bytes for the owner only; it decrypts a real MPEG-TS segment (sync byte 0x47), which is unreadable without it.
    await other.agent.get(`/api/playback/${sid}/key`).expect(404);
    const k = await buyer.agent.get(`/api/playback/${sid}/key`).buffer(true).parse((res, cb) => { const chunks: Buffer[] = []; res.on('data', (c: Buffer) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); }).expect(200);
    expect((k.body as Buffer).length).toBe(16);
    const enc = Buffer.from(await (await fetch(seg)).arrayBuffer());
    expect(enc[0]).not.toBe(0x47);
    const d = createDecipheriv('aes-128-cbc', k.body as Buffer, Buffer.from(p.ivHex, 'hex'));
    expect(Buffer.concat([d.update(enc), d.final()])[0]).toBe(0x47);

    // An expired session stops working; previews and not-yet-packaged videos keep the signed MP4.
    await prisma.playbackSession.update({ where: { id: sid }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await buyer.agent.get(path).expect(404);
    await buyer.agent.get(`/api/playback/${sid}/key`).expect(404);
  });

  it('help videos: admins upload and publish; everyone can watch published ones; others cannot manage', async () => {
    if (!available) return;
    const admin = await userAgent('help-admin@e2e.example', ['student', 'admin']);
    const student = await userAgent('help-student@e2e.example', ['student']);
    const anon = request(app.getHttpServer());
    const body = { title: 'Find a course', summary: 'Browse, filter and preview courses.', audience: 'students', category: 'getting-started', sort: 1 };

    await student.send('put', '/api/admin/help/videos/find-a-course').send(body).expect(403);
    await admin.send('put', '/api/admin/help/videos/Bad Slug').send(body).expect(400);

    // Upload through the studio pipeline, owned by the admin; another admin's asset or cover is refused.
    const up = await admin.send('post', '/api/admin/help/uploads/video').send({ filename: 'find.mp4', contentType: 'video/mp4' }).expect(201);
    const assetId = up.body.assetId as string;
    const other = await prisma.videoAsset.create({ data: { ownerId: student.user.id, provider: 'local', status: 'ready', storageKey: 'videos/x/source.mp4', durationSec: 10 } });
    await admin.send('put', '/api/admin/help/videos/find-a-course').send({ ...body, videoAssetId: other.id }).expect(400);
    await admin.send('put', '/api/admin/help/videos/find-a-course').send({ ...body, coverKey: `images/${student.user.id}/x.png` }).expect(400);

    const saved = await admin.send('put', '/api/admin/help/videos/find-a-course').send({ ...body, videoAssetId: assetId, chapters: [{ t: 0, title: 'Introduction' }, { t: 12.5, title: 'Step by step' }] }).expect(200);
    expect(saved.body).toMatchObject({ slug: 'find-a-course', published: false });
    // Not ready yet: can't publish, not public.
    await admin.send('post', '/api/admin/help/videos/find-a-course/publish').send({ published: true }).expect(400);
    await prisma.videoAsset.update({ where: { id: assetId }, data: { status: 'ready', storageKey: `videos/${assetId}/source.mp4`, durationSec: 95, captionsKey: `videos/${assetId}/captions.vtt` } });
    expect((await anon.get('/api/help/videos').expect(200)).body.total).toBe(0);
    await anon.get('/api/help/videos/find-a-course').expect(404);
    const pv = await admin.agent.get('/api/admin/help/videos/find-a-course/preview').expect(200);
    expect(pv.body.url).toContain('X-Amz-Signature=');

    await admin.send('post', '/api/admin/help/videos/find-a-course/publish').send({ published: true }).expect(200);
    const list = await anon.get('/api/help/videos').expect(200);
    expect(list.body).toMatchObject({ total: 1, categories: [{ key: 'getting-started', items: [{ slug: 'find-a-course', durationSec: 95, hasCaptions: true }] }] });
    const one = await anon.get('/api/help/videos/find-a-course').expect(200);
    expect(one.body).toMatchObject({ title: 'Find a course', categoryName: 'Getting started', chapters: [{ t: 0, title: 'Introduction' }, { t: 12.5, title: 'Step by step' }], playback: { format: 'mp4' } });
    expect(one.body.playback.url).toContain(`videos/${assetId}/source.mp4`);
    expect(one.body.playback.captionsUrl).toContain('captions.vtt');

    await admin.send('post', '/api/admin/help/videos/find-a-course/publish').send({ published: false }).expect(200);
    await anon.get('/api/help/videos/find-a-course').expect(404);
    await admin.send('delete', '/api/admin/help/videos/find-a-course').expect(200);
    expect(await prisma.auditLog.count({ where: { action: { startsWith: 'help.' } } })).toBeGreaterThanOrEqual(4);
  });

  describe('sign-in security (owner 2026-11-25)', () => {
    const jobs = () => app.get(JobsService) as unknown as { sendEmail: jest.Mock };
    const cookieOf = (res: request.Response, name: string) => ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));
    async function fresh() {
      const agent = request.agent(app.getHttpServer());
      const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
      const send = (method: 'post' | 'delete' | 'patch', url: string, body?: object) => agent[method](url).set('X-CSRF-Token', csrf).send(body ?? {});
      return { agent, csrf, send };
    }
    /** A code for a step that hasn't been used yet (codes are single use). */
    const nextCode = (seed: string, offset = 0) => codeAt(seed, stepAt() + offset);

    it('password policy: every problem at once, the email or name, and breached passwords', async () => {
      const a = await fresh();
      const weak = await a.send('post', '/api/auth/register', { email: 'policy@e2e.example', password: 'short', name: 'Pat Policy' }).expect(400);
      expect(weak.body.error.code).toBe('weak_password');
      expect(weak.body.error.message).toBe('Password must be at least 12 characters and mix letters and numbers.');
      const mine = await a.send('post', '/api/auth/register', { email: 'policy@e2e.example', password: 'policy-2026-secure', name: 'Pat Policy' }).expect(400);
      expect(mine.body.error.message).toContain('not contain your email address or name');
      const common = await a.send('post', '/api/auth/register', { email: 'policy@e2e.example', password: 'Password12345', name: 'Pat' }).expect(400);
      expect(common.body.error.code).toBe('password_breached');
      expect((await a.agent.get('/api/auth/providers').expect(200)).body.passwordPolicy.minLength).toBe(12);
    });

    it('two-step sign-in: single-use codes, five tries, recovery codes, trusted devices, lockout', async () => {
      const seed = newSecret();
      const email = 'mfa-user@e2e.example';
      await prisma.user.create({ data: { email, name: 'Mia', passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles: ['student'], mfaSecret: seal('mfa', seed), mfaEnabledAt: new Date() } });

      // The password alone gives no session.
      const a = await fresh();
      const first = await a.send('post', '/api/auth/login', { email, password: PW }).expect(200);
      expect(first.body).toEqual({ mfa: 'verify' });
      expect(cookieOf(first, 'sid')).toBeUndefined();
      expect(cookieOf(first, 'del_mfa')).toMatch(/HttpOnly/i);
      expect((await a.agent.get('/api/auth/mfa/pending').expect(200)).body).toMatchObject({ stage: 'verify', method: 'password', email: 'mf••••@e2e.example' });
      expect((await a.send('post', '/api/auth/mfa/complete', { code: '000000' }).expect(401)).body.error.code).toBe('invalid_code');
      const code = nextCode(seed);
      const ok = await a.send('post', '/api/auth/mfa/complete', { code, trustDevice: true }).expect(200);
      expect(ok.body.user.email).toBe(email);
      expect(cookieOf(ok, 'del_trust')).toMatch(/HttpOnly/i);
      await a.send('post', '/api/auth/mfa/complete', { code }).expect(401); // the ticket is used

      // The same code never works twice, even in a new sign-in.
      const b = await fresh();
      await b.send('post', '/api/auth/login', { email, password: PW }).expect(200);
      expect((await b.send('post', '/api/auth/mfa/complete', { code }).expect(401)).body.error.code).toBe('invalid_code');
      // Five wrong codes burn the ticket.
      for (let i = 0; i < 3; i++) await b.send('post', '/api/auth/mfa/complete', { code: '111111' }).expect(401);
      expect((await b.send('post', '/api/auth/mfa/complete', { code: '111111' }).expect(401)).body.error.code).toBe('no_pending_signin');
      await prisma.user.update({ where: { email }, data: { failedLogins: 0, lockedUntil: null } });

      // Recovery codes: once each.
      const c = await fresh();
      await c.send('post', '/api/auth/login', { email, password: PW }).expect(200);
      const codes = (await a.send('post', '/api/auth/mfa/recovery-codes', { code: nextCode(seed, 1) }).expect(200)).body.recoveryCodes as string[];
      expect(codes).toHaveLength(10);
      expect(codes[0]).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{2}$/);
      const viaRecovery = await c.send('post', '/api/auth/mfa/complete', { recoveryCode: codes[0].toLowerCase() }).expect(200);
      expect(viaRecovery.body.recoveryCodesLeft).toBe(9);
      const d = await fresh();
      await d.send('post', '/api/auth/login', { email, password: PW }).expect(200);
      await d.send('post', '/api/auth/mfa/complete', { recoveryCode: codes[0] }).expect(401);

      // The trusted browser skips the code; forgetting devices ends that.
      const trusted = await a.send('post', '/api/auth/login', { email, password: PW }).expect(200);
      expect(trusted.body.user.email).toBe(email);
      expect((await a.agent.get('/api/auth/security').expect(200)).body).toMatchObject({ hasPassword: true, trustedDevices: 1, mfa: { recoveryCodesLeft: 9 } });
      await a.send('delete', '/api/auth/trusted-devices').expect(200, { forgotten: 1 });
      expect((await a.send('post', '/api/auth/login', { email, password: PW }).expect(200)).body).toEqual({ mfa: 'verify' });

      // Lockout: five wrong passwords lock the account; the right one is refused while locked.
      await prisma.user.update({ where: { email }, data: { failedLogins: 0 } });
      const e = await fresh();
      for (let i = 0; i < 5; i++) await e.send('post', '/api/auth/login', { email, password: 'wrong-password-1' }).expect(401);
      const locked = await e.send('post', '/api/auth/login', { email, password: PW }).expect(423);
      expect(locked.body.error.code).toBe('account_locked');
      expect(await prisma.auditLog.count({ where: { action: 'auth.account_locked', targetId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id } })).toBe(2); // the wrong codes above locked it once too
    });

    it('forgotten password: same answer for everyone, one-hour single-use link, ends sessions and trusted devices, code still asked', async () => {
      const seed = newSecret();
      const email = 'reset-user@e2e.example';
      await prisma.user.create({ data: { email, name: 'Rae', passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles: ['student'], mfaSecret: seal('mfa', seed), mfaEnabledAt: new Date(), failedLogins: 0, lockedUntil: new Date(Date.now() + 600_000) } });
      const signedIn = await fresh();
      await prisma.user.update({ where: { email }, data: { lockedUntil: null } });
      await signedIn.send('post', '/api/auth/login', { email, password: PW }).expect(200);
      await signedIn.send('post', '/api/auth/mfa/complete', { code: nextCode(seed) }).expect(200);
      await prisma.user.update({ where: { email }, data: { lockedUntil: new Date(Date.now() + 600_000) } });

      jobs().sendEmail.mockClear();
      const a = await fresh();
      const unknown = await a.send('post', '/api/auth/password/forgot', { email: 'nobody@e2e.example' }).expect(200);
      const known = await a.send('post', '/api/auth/password/forgot', { email }).expect(200);
      expect(known.body).toEqual(unknown.body);
      expect(jobs().sendEmail).toHaveBeenCalledTimes(1);
      const link: string = jobs().sendEmail.mock.calls[0][0].data.link;
      expect(link).toMatch(/^http:\/\/127\.0\.0\.1:3000\/reset-password\?token=/);
      const token = new URL(link).searchParams.get('token')!;
      expect((await a.send('post', '/api/auth/password/reset', { token, password: 'short' }).expect(400)).body.error.code).toBe('weak_password');
      await a.send('post', '/api/auth/password/reset', { token, password: 'New-garden-hose-77' }).expect(200);
      expect((await a.send('post', '/api/auth/password/reset', { token, password: 'New-garden-hose-78' }).expect(400)).body.error.code).toBe('reset_link_invalid');
      await signedIn.agent.get('/api/auth/security').expect(401); // every session ended
      const again = await a.send('post', '/api/auth/login', { email, password: 'New-garden-hose-77' }).expect(200); // lockout cleared
      expect(again.body).toEqual({ mfa: 'verify' });
      expect(jobs().sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: email, template: 'security-password-changed' }));
    });

    it('social sign-in (test provider): new account, no merge by email, link, in-use, unlink rules, setting a password', async () => {
      const providers = (await request(app.getHttpServer()).get('/api/auth/providers').expect(200)).body.items;
      expect(providers).toEqual([{ key: 'test', label: 'Test provider' }]);
      await request(app.getHttpServer()).get('/api/auth/oauth/google/start').expect(404); // no keys, no button, no route

      /** Runs the provider round trip and returns where the browser lands. */
      async function social(a: Awaited<ReturnType<typeof fresh>>, who: { email: string; sub: string; name?: string }, mode = 'login') {
        const start = await a.agent.get(`/api/auth/oauth/test/start?mode=${mode}&next=/courses`).expect(302);
        const auth = new URL(start.headers.location);
        expect(auth.pathname).toBe('/api/auth/oauth/test/authorize');
        expect(cookieOf(start, 'del_oauth')).toMatch(/HttpOnly/i);
        const page = await a.agent.get(`${auth.pathname}${auth.search}`).expect(200);
        expect(page.text).toContain('Development only');
        const approve = await a.agent.get(`/api/auth/oauth/test/approve?state=${auth.searchParams.get('state')}&email=${encodeURIComponent(who.email)}&sub=${who.sub}&name=${who.name ?? 'Social'}`).expect(302);
        const cb = new URL(approve.headers.location);
        const back = await a.agent.get(`${cb.pathname}${cb.search}`).expect(302);
        return back.headers.location as string;
      }

      // A new person: account created, Google Authenticator set up before any session.
      const a = await fresh();
      expect(await social(a, { email: 'sofia@e2e.example', sub: 'g-1', name: 'Sofia' })).toBe('http://127.0.0.1:3000/login/verify?next=%2Fcourses');
      expect((await a.agent.get('/api/auth/mfa/pending').expect(200)).body).toMatchObject({ stage: 'enroll', method: 'test' });
      const setup = await a.send('post', '/api/auth/mfa/enroll').expect(200);
      const done = await a.send('post', '/api/auth/mfa/complete', { code: codeAt(setup.body.secret, stepAt()) }).expect(200);
      expect(done.body).toMatchObject({ user: { email: 'sofia@e2e.example', name: 'Sofia', roles: ['student'] }, next: '/courses' });
      const sofia = await prisma.user.findUniqueOrThrow({ where: { email: 'sofia@e2e.example' }, include: { identities: true } });
      expect(sofia.passwordHash).toBeNull();
      expect(sofia.identities).toMatchObject([{ provider: 'test', subject: 'g-1' }]);
      // Signing in again with the same provider account reaches the same account (no duplicate).
      const again = await fresh();
      expect(await social(again, { email: 'sofia@e2e.example', sub: 'g-1' })).toContain('/login/verify');
      expect(await prisma.user.count({ where: { email: 'sofia@e2e.example' } })).toBe(1);
      // No password yet: password sign-in fails like any wrong password.
      await again.send('post', '/api/auth/login', { email: 'sofia@e2e.example', password: PW }).expect(401);

      // Someone else's provider account using an existing DEL email is NOT merged.
      const owner = await userAgent('owner@e2e.example', ['student']);
      const intruder = await fresh();
      expect(await social(intruder, { email: 'owner@e2e.example', sub: 'gh-evil' })).toBe('http://127.0.0.1:3000/login?error=email_exists&provider=test');
      expect(await prisma.authIdentity.count({ where: { subject: 'gh-evil' } })).toBe(0);

      // The real owner links a provider from their signed-in account (the provider proves the second account).
      const ownerSession = { agent: owner.agent, csrf: '', send: owner.send };
      expect(await social(ownerSession, { email: 'owner-alt@e2e.example', sub: 'gh-owner' }, 'link')).toBe('http://127.0.0.1:3000/account?linked=test#security');
      const sec = (await owner.agent.get('/api/auth/security').expect(200)).body;
      expect(sec.identities).toMatchObject([{ provider: 'test', email: 'owner-alt@e2e.example' }]);
      // That provider account can't be linked to anybody else.
      expect(await social(again, { email: 'x@e2e.example', sub: 'gh-owner' })).toContain('/login/verify'); // it signs in the owner instead
      // Unlinking needs a code; Sofia can't remove her only way in.
      const owned = sec.identities[0].id as string;
      expect((await owner.send('post', `/api/auth/identities/${owned}/unlink`, { code: '000000' }).expect(401)).body.error.code).toBe('invalid_code');
      await owner.send('post', `/api/auth/identities/${owned}/unlink`, { code: codeAt(MFA_SEED, stepAt() + 1) }).expect(200);
      expect(jobs().sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@e2e.example', template: 'security-identity-unlinked' }));
    });

    it('a Super Admin resets someone else’s authenticator, never their own', async () => {
      const boss = await userAgent('auth-boss@e2e.example', ['student', 'admin', 'super_admin']);
      const admin = await userAgent('auth-admin@e2e.example', ['student', 'admin']);
      const target = await userAgent('auth-target@e2e.example', ['student']);
      await admin.send('post', `/api/admin/users/${target.user.id}/mfa/reset`).expect(403);
      expect((await boss.send('post', `/api/admin/users/${boss.user.id}/mfa/reset`).expect(403)).body.error.code).toBe('own_account');
      await boss.send('post', `/api/admin/users/${target.user.id}/mfa/reset`).expect(200);
      await target.agent.get('/api/auth/security').expect(401); // sessions ended
      const t = await prisma.user.findUniqueOrThrow({ where: { id: target.user.id } });
      expect(t.mfaEnabledAt).toBeNull();
      const a = await fresh();
      expect((await a.send('post', '/api/auth/login', { email: 'auth-target@e2e.example', password: PW }).expect(200)).body).toEqual({ mfa: 'enroll' });
    });
  });

  it('reviews from the learning view: rating and count, one review per student, moderation kept, same numbers as the public page', async () => {
    if (!available) return;
    const teacher = await userAgent('rv-teacher@e2e.example', ['student', 'instructor'], {});
    const ann = await userAgent('rv-ann@e2e.example', ['student']);
    const bob = await userAgent('rv-bob@e2e.example', ['student']);
    const stranger = await userAgent('rv-stranger@e2e.example', ['student']);
    const admin = await userAgent('rv-admin@e2e.example', ['student', 'admin']);
    const { course } = await publishedCourse(teacher.user.id, 'rv-course', 1999);
    for (const u of [ann, bob]) await prisma.enrollment.create({ data: { userId: u.user.id, courseId: course.id, source: 'free' } });

    const fresh = (await ann.agent.get('/api/me/courses/rv-course').expect(200)).body;
    expect(fresh).toMatchObject({ rating: { average: 0, count: 0 }, canReview: true, myReview: null });
    expect((await teacher.agent.get('/api/me/courses/rv-course').expect(200)).body.canReview).toBe(false);

    await stranger.send('post', '/api/courses/rv-course/reviews', { rating: 5 }).expect(403);
    await ann.send('post', '/api/courses/rv-course/reviews', { rating: 6 }).expect(400);
    const a1 = await ann.send('post', '/api/courses/rv-course/reviews', { rating: 5, body: 'Great labs' }).expect(201);
    expect(a1.body.courseRating).toEqual({ average: 5, count: 1 });
    await bob.send('post', '/api/courses/rv-course/reviews', { rating: 2 }).expect(201);
    // Editing replaces the student's one review.
    const a2 = await ann.send('post', '/api/courses/rv-course/reviews', { rating: 4, body: 'Great labs, long intro' }).expect(201);
    expect(a2.body.courseRating).toEqual({ average: 3, count: 2 });
    expect(await prisma.review.count({ where: { courseId: course.id } })).toBe(2);
    const mine = (await ann.agent.get('/api/me/courses/rv-course').expect(200)).body;
    expect(mine).toMatchObject({ rating: { average: 3, count: 2 }, myReview: { rating: 4, body: 'Great labs, long intro', status: 'visible' } });
    // The public page shows the same numbers and the review.
    const pub = (await request(app.getHttpServer()).get('/api/courses/rv-course').expect(200)).body;
    expect([pub.ratingAvg ?? pub.rating?.average, pub.ratingCount ?? pub.rating?.count]).toEqual([3, 2]);

    // Each review shows what its author really watched (unique seconds, same measure as refunds); no user ids leak.
    const videos = await prisma.lecture.findMany({ where: { section: { courseId: course.id }, type: 'video' }, orderBy: { position: 'asc' } });
    const totalSec = videos.reduce((n, l) => n + l.durationSec, 0);
    if (videos.length && totalSec) {
      await prisma.lectureProgress.create({ data: { userId: ann.user.id, lectureId: videos[0].id, watchedSec: videos[0].durationSec, watchedRanges: [[0, videos[0].durationSec]] } });
      const list = (await request(app.getHttpServer()).get('/api/courses/rv-course/reviews').expect(200)).body.items;
      const byBody = (b: string) => list.find((x: any) => x.body === b);
      expect(byBody('Great labs, long intro')).toMatchObject({ watchedPercent: Math.round((videos[0].durationSec / totalSec) * 1000) / 10, completed: false });
      expect(list.find((x: any) => x.rating === 2)).toMatchObject({ watchedPercent: 0, completed: false });
      expect(list.every((x: any) => x.userId === undefined)).toBe(true);
      expect((await ann.agent.get('/api/me/reviews').expect(200)).body.items[0].watchedPercent).toBeGreaterThan(0);
    }

    // A hidden review stays hidden when its author edits it, and leaves the average.
    const bobReview = await prisma.review.findFirstOrThrow({ where: { userId: bob.user.id } });
    await admin.send('patch', `/api/admin/reviews/${bobReview.id}`, { status: 'hidden' }).expect(200);
    const b2 = await bob.send('post', '/api/courses/rv-course/reviews', { rating: 1, body: 'edited' }).expect(201);
    expect(b2.body.status).toBe('hidden');
    expect(b2.body.courseRating).toEqual({ average: 4, count: 1 });
    expect((await bob.agent.get('/api/me/courses/rv-course').expect(200)).body.myReview.status).toBe('hidden');
  });

  describe('one-year access and the 25% refund rule (owner 2026-11-25)', () => {
    const jobs = () => app.get(JobsService) as unknown as { sendEmail: jest.Mock };
    const DAY = 86_400_000;
    async function buy(u: Awaited<ReturnType<typeof userAgent>>, courseId: string) {
      await u.send('post', '/api/cart', { courseId }).expect(201);
      const co = await u.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
      await u.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);
      return co.body.orderId as string;
    }
    async function course100(teacherId: string, slug: string) {
      const c = await publishedCourse(teacherId, slug, 2000);
      await prisma.lecture.update({ where: { id: c.lecture.id }, data: { durationSec: 100 } });
      await prisma.videoAsset.updateMany({ where: { lectures: { some: { id: c.lecture.id } } }, data: { durationSec: 100 } });
      return c;
    }

    it('a purchase gives exactly 12 months; expiry locks the course (backend), keeps progress, and renewal extends it', async () => {
      const teacher = await userAgent('acc-teacher@e2e.example', ['student', 'instructor'], {});
      const stu = await userAgent('acc-stu@e2e.example', ['student']);
      const { course, lecture } = await course100(teacher.user.id, 'acc-course');
      const orderId = await buy(stu, course.id);
      const paidAt = (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).paidAt!;
      const enr = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: stu.user.id, courseId: course.id } } });
      const oneYear = new Date(paidAt); oneYear.setUTCMonth(oneYear.getUTCMonth() + 12);
      expect(enr.accessExpiresAt?.toISOString()).toBe(oneYear.toISOString());
      const ml = (await stu.agent.get('/api/me/learning').expect(200)).body;
      expect(ml.items.find((i: any) => i.course.slug === 'acc-course').access).toMatchObject({ state: 'active', canRenew: false, daysLeft: expect.any(Number) });
      expect((await stu.agent.get('/api/courses/acc-course').expect(200)).body.viewer.access).toMatchObject({ state: 'active', canRenew: false });
      // Can't buy again while more than 30 days are left.
      expect((await stu.send('post', '/api/cart', { courseId: course.id }).expect(409)).body.error.code).toBe('already_enrolled');
      await stu.send('put', `/api/lectures/${lecture.id}/progress`, { positionSec: 40, played: [[0, 40]] }).expect(200);

      // Expired: locked everywhere on the server, listed under Expired, progress kept, renewal offered.
      await prisma.enrollment.update({ where: { userId_courseId: { userId: stu.user.id, courseId: course.id } }, data: { accessExpiresAt: new Date(Date.now() - DAY) } });
      await stu.send('post', `/api/lectures/${lecture.id}/playback`).expect(403);
      await stu.agent.get('/api/me/courses/acc-course').expect(403);
      await stu.send('put', `/api/lectures/${lecture.id}/progress`, { positionSec: 50 }).expect(403);
      const after = (await stu.agent.get('/api/me/learning').expect(200)).body;
      expect(after.items.some((i: any) => i.course.slug === 'acc-course')).toBe(false);
      expect(after.expired[0]).toMatchObject({ course: { slug: 'acc-course' }, access: { state: 'expired', canRenew: true } });
      expect((await prisma.lectureProgress.findFirstOrThrow({ where: { userId: stu.user.id } })).watchedSec).toBe(40);

      // Renewal = buying again: a fresh year from today, progress where it was.
      const renewal = await buy(stu, course.id);
      const r2 = (await prisma.order.findUniqueOrThrow({ where: { id: renewal } })).paidAt!;
      const e2 = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: stu.user.id, courseId: course.id } } });
      const y2 = new Date(r2); y2.setUTCMonth(y2.getUTCMonth() + 12);
      expect(e2.accessExpiresAt?.toISOString()).toBe(y2.toISOString());
      await stu.send('post', `/api/lectures/${lecture.id}/playback`).expect(200);
      expect((await stu.agent.get('/api/me/courses/acc-course').expect(200)).body.sections[0].lectures[0].progress.positionSec).toBe(40);

      // Early renewal (last 30 days) adds a year after the current end; refunding it gives the earlier end back.
      const end = new Date(Date.now() + 10 * DAY);
      await prisma.enrollment.update({ where: { userId_courseId: { userId: stu.user.id, courseId: course.id } }, data: { accessExpiresAt: end } });
      await prisma.accessPeriod.updateMany({ where: { userId: stu.user.id, courseId: course.id, revokedAt: null }, data: { endsAt: end } });
      const early = await buy(stu, course.id);
      const ext = new Date(end); ext.setUTCMonth(ext.getUTCMonth() + 12);
      expect((await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: stu.user.id, courseId: course.id } } })).accessExpiresAt?.toISOString()).toBe(ext.toISOString());
      // (The student watched 40% earlier, so their own request would be declined: consumption is per course.)
      expect((await stu.send('post', `/api/orders/${early}/refund`, {}).expect(200)).body.status).toBe('declined');
      const boss = await userAgent('acc-boss@e2e.example', ['student', 'admin', 'super_admin']);
      await boss.send('post', `/api/admin/orders/${early}/refund`, { reason: 'test: renewal refund' }).expect(200);
      const back = await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: stu.user.id, courseId: course.id } } });
      expect(back.revokedAt).toBeNull();
      expect(back.accessExpiresAt?.toISOString()).toBe(end.toISOString());
    });

    it('consumption counts unique seconds: replays and skips do not add', async () => {
      const teacher = await userAgent('cons-teacher@e2e.example', ['student', 'instructor'], {});
      const stu = await userAgent('cons-stu@e2e.example', ['student']);
      const { course, lecture } = await course100(teacher.user.id, 'cons-course');
      await prisma.enrollment.create({ data: { userId: stu.user.id, courseId: course.id, source: 'free' } });
      const save = (played: [number, number][], positionSec: number) => stu.send('put', `/api/lectures/${lecture.id}/progress`, { positionSec, played }).expect(200);
      await save([[0, 10]], 10);
      await save([[0, 10]], 10); // replay
      await save([[9.5, 20]], 20); // continuous with a tiny overlap
      await save([[80, 90]], 90); // skipped 20→80, watched 10 s
      const row = await prisma.lectureProgress.findFirstOrThrow({ where: { userId: stu.user.id, lectureId: lecture.id } });
      expect(row.watchedSec).toBe(30);
      expect(row.watchedRanges).toEqual([[0, 20], [80, 90]]);
      await save([[0, 500]], 100); // clamped to the lesson length
      expect((await prisma.lectureProgress.findFirstOrThrow({ where: { userId: stu.user.id, lectureId: lecture.id } })).watchedSec).toBe(100);
    });

    it('refunds: 20% and 25% refunded automatically, 30% declined with the email, 14-day window, review, Super Admin exception', async () => {
      const teacher = await userAgent('rf-teacher@e2e.example', ['student', 'instructor'], {});
      const admin = await userAgent('rf-admin@e2e.example', ['student', 'admin']);
      const boss = await userAgent('rf-boss@e2e.example', ['student', 'admin', 'super_admin']);
      const results: Record<string, any> = {};
      for (const pct of [20, 25, 30]) {
        const stu = await userAgent(`rf-${pct}@e2e.example`, ['student']);
        const { course, lecture } = await course100(teacher.user.id, `rf-course-${pct}`);
        const orderId = await buy(stu, course.id);
        await stu.send('put', `/api/lectures/${lecture.id}/progress`, { positionSec: pct, played: [[0, pct]] }).expect(200);
        jobs().sendEmail.mockClear();
        const r = await stu.send('post', `/api/orders/${orderId}/refund`, {}).expect(200);
        results[pct] = { stu, orderId, body: r.body, emails: jobs().sendEmail.mock.calls.map((c) => c[0]) };
      }
      expect(results[20].body.status).toBe('refunded');
      expect(results[25].body.status).toBe('refunded'); // exactly 25% still qualifies
      expect(results[30].body.status).toBe('declined');
      expect(results[30].emails).toContainEqual(expect.objectContaining({ template: 'refund-declined', data: expect.objectContaining({ watchedPercent: 30, thresholdPercent: 25 }) }));
      expect(results[20].emails).toContainEqual(expect.objectContaining({ template: 'refund-approved' }));
      const declined = await prisma.refundRequest.findFirstOrThrow({ where: { orderId: results[30].orderId } });
      expect(declined).toMatchObject({ status: 'auto_declined' });
      expect((declined.analysis as any).lines[0]).toMatchObject({ totalSec: 100, watchedSec: 30, watchedPercent: 30, thresholdPercent: 25, eligible: false, reason: 'watched_too_much', withinWindow: true });

      // Outside the 14-day window: declined even at 0% watched.
      const late = await userAgent('rf-late@e2e.example', ['student']);
      const lc = await course100(teacher.user.id, 'rf-course-late');
      const lateOrder = await buy(late, lc.course.id);
      await prisma.order.update({ where: { id: lateOrder }, data: { refundEligibleUntil: new Date(Date.now() - DAY) } });
      const lr = await late.send('post', `/api/orders/${lateOrder}/refund`, {}).expect(200);
      expect(lr.body.status).toBe('declined');
      expect(((await prisma.refundRequest.findFirstOrThrow({ where: { orderId: lateOrder } })).analysis as any).lines[0].reason).toBe('window_closed');

      // The student asks for a review; it waits for a person; only a Super Admin can overturn it.
      const stu30 = results[30].stu;
      await stu30.send('post', `/api/refund-requests/${declined.id}/review`, { note: 'short' }).expect(400);
      await stu30.send('post', `/api/refund-requests/${declined.id}/review`, { note: 'The video froze and replayed by itself; I watched about 10 minutes.' }).expect(200);
      const queue = (await admin.agent.get('/api/admin/refund-requests?status=needs_action').expect(200)).body;
      expect(queue.items.map((i: any) => i.id)).toContain(declined.id);
      expect(queue.items.find((i: any) => i.id === declined.id)).toMatchObject({ needsAction: true, reviewNote: expect.stringContaining('froze'), history: expect.arrayContaining([expect.objectContaining({ action: 'refund.auto_declined' }), expect.objectContaining({ action: 'refund.review_requested' })]) });
      expect((await admin.send('post', `/api/admin/refund-requests/${declined.id}/approve`, { note: 'ok' }).expect(403)).body.error.code).toBe('super_admin_only');
      await boss.send('post', `/api/admin/refund-requests/${declined.id}/approve`, {}).expect(400); // a note is required
      await boss.send('post', `/api/admin/refund-requests/${declined.id}/approve`, { note: 'Player fault confirmed in support ticket.' }).expect(200);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: results[30].orderId } })).status).toBe('refunded');
      expect(await prisma.auditLog.count({ where: { action: 'refund.exception_approved' } })).toBe(1);
    });

    it('expiry reminders: 30, 7 and 1 days before and on expiry, each once', async () => {
      const stu = await userAgent('rem-stu@e2e.example', ['student']);
      const teacher = await userAgent('rem-teacher@e2e.example', ['student', 'instructor'], {});
      const { course } = await publishedCourse(teacher.user.id, 'rem-course', 1000);
      const now = new Date();
      await prisma.enrollment.create({ data: { userId: stu.user.id, courseId: course.id, source: 'purchase', accessExpiresAt: new Date(now.getTime() + 20 * DAY) } });
      jobs().sendEmail.mockClear();
      const svc = app.get(JobsService);
      const mine = () => jobs().sendEmail.mock.calls.map((c) => c[0]).filter((m: any) => m.to === 'rem-stu@e2e.example');
      await sendAccessReminders(prisma as any, svc, now);
      await sendAccessReminders(prisma as any, svc, now); // same hour again: nothing new
      expect(mine()).toEqual([expect.objectContaining({ template: 'access-expiring', data: expect.objectContaining({ daysLeft: 20, course: 'rem-course' }) })]);
      await sendAccessReminders(prisma as any, svc, new Date(now.getTime() + 14 * DAY)); // 6 days left → the 7-day reminder
      await sendAccessReminders(prisma as any, svc, new Date(now.getTime() + 21 * DAY)); // ended
      await sendAccessReminders(prisma as any, svc, new Date(now.getTime() + 22 * DAY)); // never twice
      expect(mine().map((m: any) => [m.template, m.data.daysLeft])).toEqual([['access-expiring', 20], ['access-expiring', 6], ['access-expired', 0]]);
    });
  });

  describe('four roles and instructor applications (owner 2026-11-25)', () => {
    const app_ = () => request.agent(app.getHttpServer());
    const apply = {
      headline: 'Terraform trainer', bio: 'I have taught Terraform to platform teams for years.', expertise: ['Terraform', 'AWS'],
      experience: 'Five years of workshops for platform teams.', plannedCourses: 'Terraform modules in practice',
    };

    it('every public sign-up is a student; a sign-up that sends roles is refused', async () => {
      if (!available) return;
      const a = app_();
      const csrf: string = (await a.get('/api/auth/me')).body.csrf;
      const bad = await a.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: 'sneaky@e2e.example', password: 'Quiet-river-stone-58', name: 'Sneaky', roles: ['admin'] }).expect(400);
      expect(bad.body.error.code).toBe('validation_failed');
      expect(await prisma.user.findUnique({ where: { email: 'sneaky@e2e.example' } })).toBeNull();
      await a.post('/api/auth/register').set('X-CSRF-Token', csrf).send({ email: 'plain@e2e.example', password: 'Quiet-river-stone-58', name: 'Plain' }).expect(201);
      const u = await prisma.user.findUniqueOrThrow({ where: { email: 'plain@e2e.example' } });
      expect(u).toMatchObject({ roles: ['student'], signupMethod: 'email', emailVerifiedAt: null, adminPermissions: [] });
      // the verification link proves ownership once
      const jobs = app.get(JobsService) as unknown as { sendEmail: jest.Mock };
      const call = jobs.sendEmail.mock.calls.map((c) => c[0]).reverse().find((j) => j.template === 'verify-email' && j.to === 'plain@e2e.example');
      const token = new URL(call.data.link).searchParams.get('token');
      await a.post('/api/auth/verify-email').set('X-CSRF-Token', csrf).send({ token }).expect(200);
      expect((await a.post('/api/auth/verify-email').set('X-CSRF-Token', csrf).send({ token }).expect(400)).body.error.code).toBe('verify_link_invalid');
      const verified = await prisma.user.findUniqueOrThrow({ where: { email: 'plain@e2e.example' } });
      expect(verified.emailVerifiedAt).not.toBeNull();
    });

    it('apply → under review → needs info → resubmit → approved keeps student; rejected stays student; no duplicates', async () => {
      if (!available) return;
      const boss = await userAgent('rbac-boss@e2e.example', ['student', 'admin', 'super_admin']);
      const stu = await userAgent('rbac-applicant@e2e.example', ['student']);
      await stu.agent.get('/api/instructor/courses').expect(403);
      await stu.send('post', '/api/instructor/apply', { headline: 'x', bio: 'too short' }).expect(400);
      await stu.send('post', '/api/instructor/apply', apply).expect(201);
      expect((await stu.send('post', '/api/instructor/apply', apply).expect(409)).body.error.code).toBe('already_applied');
      const list = (await boss.agent.get('/api/admin/people/applications?status=open').expect(200)).body;
      expect(list.items.find((x: any) => x.email === 'rbac-applicant@e2e.example')).toMatchObject({ status: 'pending', expertise: ['Terraform', 'AWS'] });
      await boss.send('post', `/api/admin/people/applications/${stu.user.id}/decision`, { decision: 'under_review' }).expect(200);
      await boss.send('post', `/api/admin/people/applications/${stu.user.id}/decision`, { decision: 'needs_info' }).expect(400);
      await boss.send('post', `/api/admin/people/applications/${stu.user.id}/decision`, { decision: 'needs_info', note: 'Please add a sample lesson link.' }).expect(200);
      await stu.send('post', '/api/instructor/apply', { ...apply, extraInfo: 'Sample: https://example.com/lesson' }).expect(201);
      await boss.send('post', `/api/admin/people/applications/${stu.user.id}/decision`, { decision: 'approved' }).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: stu.user.id } })).roles.sort()).toEqual(['instructor', 'student']);
      await stu.agent.get('/api/instructor/courses').expect(200); // role applies to the open session at once
      await stu.agent.get('/api/me/learning').expect(200); // and student access stays

      const other = await userAgent('rbac-rejected@e2e.example', ['student']);
      await other.send('post', '/api/instructor/apply', apply).expect(201);
      await boss.send('post', `/api/admin/people/applications/${other.user.id}/decision`, { decision: 'rejected', note: 'Not a fit right now.' }).expect(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: other.user.id } })).roles).toEqual(['student']);
    });

    it('admin permissions, step-up for privileged roles, no self-promotion, last super admin, revocation applies at once', async () => {
      if (!available) return;
      const boss = await userAgent('rbac-super@e2e.example', ['student', 'admin', 'super_admin']);
      const helper = await userAgent('rbac-admin@e2e.example', ['student', 'admin'], undefined, ['users.view', 'support.manage']);
      const target = await userAgent('rbac-target@e2e.example', ['student']);
      // explicit permissions: users.view yes, courses.review / finance / audit no
      await helper.agent.get('/api/admin/people/users').expect(200);
      expect((await helper.agent.get('/api/admin/review-queue').expect(403)).body.error.code).toBe('permission_required');
      await helper.agent.get('/api/admin/finance').expect(403);
      await helper.agent.get('/api/admin/audit').expect(403);
      // an admin can't change roles at all, nor promote themselves (old and new endpoints)
      await helper.send('put', `/api/admin/people/users/${helper.user.id}/access`, { roles: ['admin', 'super_admin'] }).expect(403);
      await helper.send('patch', `/api/admin/users/${helper.user.id}`, { roles: ['admin', 'super_admin'] }).expect(403);
      // a super admin can't change their own roles
      expect((await boss.send('put', `/api/admin/people/users/${boss.user.id}/access`, { roles: ['student'] }).expect(403)).body.error.code).toBe('self_change');
      // granting admin needs a fresh authenticator code
      expect((await boss.send('put', `/api/admin/people/users/${target.user.id}/access`, { roles: ['admin'], adminPermissions: ['users.view'] }).expect(400)).body.error.code).toBe('step_up_required');
      await boss.send('put', `/api/admin/people/users/${target.user.id}/access`, { roles: ['admin'], adminPermissions: ['users.view', 'not.a.permission'], code: '000000' }).expect(401);
      const ok = await boss.send('put', `/api/admin/people/users/${target.user.id}/access`, { roles: ['admin'], adminPermissions: ['users.view', 'not.a.permission'], code: codeAt(MFA_SEED, stepAt() + 1) }).expect(200);
      expect(ok.body).toMatchObject({ roles: ['student', 'admin'], adminPermissions: ['users.view'] });
      await target.agent.get('/api/admin/people/users').expect(200); // a new role applies to the open session at once
      await target.agent.get('/api/admin/orders').expect(403);
      // instructor without an application needs a reason (DEL verified them another way)
      const plain = await userAgent('rbac-plain@e2e.example', ['student']);
      expect((await boss.send('put', `/api/admin/people/users/${plain.user.id}/access`, { roles: ['instructor'] }).expect(400)).body.error.code).toBe('reason_required');
      await boss.send('put', `/api/admin/people/users/${plain.user.id}/access`, { roles: ['instructor'], reason: 'Contacted DEL, portfolio checked' }).expect(200);
      await plain.agent.get('/api/instructor/courses').expect(200);
      // revocation applies to open sessions at once
      await boss.send('put', `/api/admin/people/users/${plain.user.id}/access`, { roles: [] }).expect(200);
      await plain.agent.get('/api/instructor/courses').expect(403);
      // another super admin removes one; nobody suspends themselves; an admin can't suspend a super admin
      const second = await userAgent('rbac-super2@e2e.example', ['student', 'admin', 'super_admin']);
      await second.send('put', `/api/admin/people/users/${boss.user.id}/access`, { roles: ['student'], code: codeAt(MFA_SEED, stepAt() + 1) }).expect(200);
      expect((await boss.agent.get('/api/admin/people/users')).status).toBe(401); // removed privileged role ended the session
      const lone = await second.send('post', `/api/admin/people/users/${second.user.id}/status`, { status: 'suspended', reason: 'test' }).expect(403);
      expect(lone.body.error.code).toBe('self_change');
      const third = await userAgent('rbac-admin3@e2e.example', ['student', 'admin'], undefined, ['users.manage', 'users.view']);
      expect((await third.send('post', `/api/admin/people/users/${second.user.id}/status`, { status: 'suspended', reason: 'x' }).expect(403)).body.error.code).toBe('super_admin_required');
      await third.send('post', `/api/admin/people/users/${target.user.id}/status`, { status: 'suspended' }).expect(403); // target is an admin now
      await third.send('post', `/api/admin/people/users/${plain.user.id}/status`, { status: 'suspended' }).expect(400); // reason required
      await third.send('post', `/api/admin/people/users/${plain.user.id}/status`, { status: 'suspended', reason: 'Chargeback fraud' }).expect(200);
      await plain.agent.get('/api/me/learning').expect(401);
      const hist = (await second.agent.get(`/api/admin/people/users/${target.user.id}`).expect(200)).body.history;
      expect(hist[0]).toMatchObject({ action: 'user.access_changed', actor: { id: boss.user.id } });
    });
  });

  it('sign-in methods: super admin only, keys checked before saving, secrets never returned, button follows the keys', async () => {
    if (!available) return;
    const admin = await userAgent('sim-admin@e2e.example', ['student', 'admin']);
    const boss = await userAgent('sim-super@e2e.example', ['student', 'admin', 'super_admin']);
    await admin.agent.get('/api/admin/sign-in-methods').expect(403);
    const st = (await boss.agent.get('/api/admin/sign-in-methods').expect(200)).body;
    expect(st.items.map((i: any) => i.key)).toEqual(['google', 'github', 'facebook', 'linkedin']);
    expect(st.items[0].redirectUri).toMatch(/\/api\/auth\/oauth\/google\/callback$/);
    // a malformed client ID is refused before anything is stored or sent to the provider
    const bad = await boss.send('put', '/api/admin/sign-in-methods/google', { clientId: 'not-a-google-id', clientSecret: 'GOCSPX-abcdefgh' }).expect(400);
    expect(['clientId', 'step_up_required']).toContain(bad.body.error.code);
    await boss.send('put', '/api/admin/sign-in-methods/myspace', { clientId: 'x1234567', clientSecret: 'abcdefgh' }).expect(400);
    // keys accepted by the provider (provider check stubbed): saved sealed, the button appears, the secret never comes back
    const cfg = app.get(OAuthConfigService);
    const probe = jest.spyOn(cfg, 'probe').mockResolvedValue(null);
    const stepUp = jest.spyOn(cfg as any, 'stepUp').mockResolvedValue(undefined);
    try {
      const saved = (await boss.send('put', '/api/admin/sign-in-methods/github', { clientId: 'Ov23liE2Etest00001', clientSecret: 'e2e-github-secret-value' }).expect(200)).body;
      expect(saved.items.find((i: any) => i.key === 'github')).toMatchObject({ enabled: true, source: 'settings' });
      expect(JSON.stringify(saved)).not.toContain('e2e-github-secret-value');
      const row = await prisma.platformSetting.findUnique({ where: { key: 'oauth_config' } });
      expect(JSON.stringify(row?.value)).not.toContain('e2e-github-secret-value');
      expect((await request(app.getHttpServer()).get('/api/auth/providers').expect(200)).body.items.map((i: any) => i.key)).toContain('github');
      await boss.send('delete', '/api/admin/sign-in-methods/github', {}).expect(200);
      expect((await request(app.getHttpServer()).get('/api/auth/providers').expect(200)).body.items.map((i: any) => i.key)).not.toContain('github');
      expect(await prisma.auditLog.count({ where: { action: { in: ['auth.provider_keys_saved', 'auth.provider_keys_removed'] }, actorId: boss.user.id } })).toBe(2);
    } finally { probe.mockRestore(); stepUp.mockRestore(); }
  });

  it('contact page: message with screenshots reaches DEL support by email; only images, honeypot, staff only', async () => {
    if (!available) return;
    const a = request.agent(app.getHttpServer());
    const csrf: string = (await a.get('/api/auth/me')).body.csrf;
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c50000000049454e44ae426082', 'hex');
    const post = () => a.post('/api/contact').set('X-CSRF-Token', csrf).field('name', 'Ama Mensah').field('email', 'ama@e2e.example').field('topic', 'payment').field('subject', 'Card declined').field('body', 'My card from Ghana was declined at checkout.');
    const ok = await post().attach('images', png, { filename: 'screen.png', contentType: 'image/png' }).expect(200);
    expect(ok.body.ref).toMatch(/^C-\d+$/);
    const jobs = app.get(JobsService) as unknown as { sendEmail: jest.Mock };
    const mail = jobs.sendEmail.mock.calls.map((c) => c[0]).reverse().find((j) => j.template === 'contact-message');
    expect(mail).toMatchObject({ to: 'support@devopseasylearning.com', replyTo: 'ama@e2e.example', attachments: [{ name: 'screen.png', mime: 'image/png' }] });
    expect(jobs.sendEmail.mock.calls.map((c) => c[0]).some((j) => j.template === 'contact-received' && j.to === 'ama@e2e.example' && j.data.ref === mail.data.ref)).toBe(true);
    expect(mail).toMatchObject({ data: expect.objectContaining({ name: expect.any(String), email: 'ama@e2e.example', subject: expect.any(String), body: expect.any(String) }) });
    // a renamed non-image is refused; the honeypot is refused
    expect((await post().attach('images', Buffer.from('<?php echo 1;'), { filename: 'x.png', contentType: 'image/png' }).expect(400)).body.error.code).toBe('attachment_type');
    await post().field('website', 'http://spam.example').expect(400);
    // staff with support.manage only
    const stu = await userAgent('contact-stu@e2e.example', ['student']);
    await stu.agent.get('/api/admin/contact').expect(403);
    const staff = await userAgent('contact-staff@e2e.example', ['student', 'admin'], undefined, ['support.manage']);
    const list = (await staff.agent.get('/api/admin/contact?status=new').expect(200)).body;
    const m = list.items.find((x: any) => x.ref === ok.body.ref);
    expect(m.attachments).toHaveLength(1);
    const img = await staff.agent.get(`/api${m.attachments[0].url}`).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    await staff.send('patch', `/api/admin/contact/${m.id}`, { status: 'handled' }).expect(200);
  });

  it('curriculum editor: drag-and-drop arrange across sections (draft and published), course package for enrolled learners only', async () => {
    if (!available) return;
    const teacher = await userAgent('arr-teacher@e2e.example', ['student', 'instructor'], {});
    const draft = (await teacher.send('post', '/api/instructor/courses', { title: 'Arrange me' }).expect(201)).body;
    const s1 = (await teacher.send('post', `/api/instructor/courses/${draft.id}/sections`, { title: 'Intro' }).expect(201)).body;
    const s2 = (await teacher.send('post', `/api/instructor/courses/${draft.id}/sections`, { title: 'Deploy' }).expect(201)).body;
    const l1 = (await teacher.send('post', `/api/instructor/courses/${draft.id}/sections/${s1.id}/lectures`, { title: 'A' }).expect(201)).body;
    const l2 = (await teacher.send('post', `/api/instructor/courses/${draft.id}/sections/${s1.id}/lectures`, { title: 'B' }).expect(201)).body;
    const l3 = (await teacher.send('post', `/api/instructor/courses/${draft.id}/sections/${s2.id}/lectures`, { title: 'C' }).expect(201)).body;
    const id = (x: any) => x.id ?? x.lecture?.id;
    // move B to the second section, first place; swap sections
    const r = await teacher.send('put', `/api/instructor/courses/${draft.id}/curriculum`, { sections: [{ id: s2.id, lectureIds: [id(l2), id(l3)] }, { id: s1.id, lectureIds: [id(l1)] }] }).expect(200);
    expect(r.body.sections.map((s: any) => [s.title, s.lectures.map((l: any) => l.title)])).toEqual([['Deploy', ['B', 'C']], ['Intro', ['A']]]);
    // nothing may be dropped or duplicated
    await teacher.send('put', `/api/instructor/courses/${draft.id}/curriculum`, { sections: [{ id: s2.id, lectureIds: [id(l2)] }, { id: s1.id, lectureIds: [id(l1)] }] }).expect(400);
    // someone else's course
    const other = await userAgent('arr-other@e2e.example', ['student', 'instructor'], {});
    await other.send('put', `/api/instructor/courses/${draft.id}/curriculum`, { sections: [] }).expect(404);

    // published course: the arrangement goes into the draft revision; live order unchanged until approved
    const { course, section, lecture } = await publishedCourse(teacher.user.id, 'arr-live', 1500);
    const sec2 = await prisma.section.create({ data: { courseId: course.id, title: 'Extra', position: 1 } });
    const live = await teacher.send('put', `/api/instructor/courses/${course.id}/curriculum`, { sections: [{ id: sec2.id, lectureIds: [lecture.id] }, { id: section.id, lectureIds: [] }] }).expect(200);
    expect(live.body.version).toBe('draft');
    expect((await prisma.lecture.findUniqueOrThrow({ where: { id: lecture.id } })).sectionId).toBe(section.id);

    // course package: upload, list, learner download only with access
    const storage = app.get(StorageService);
    const key = `resources/${teacher.user.id}/pkg/complete-labs.zip`;
    await storage.put(key, Buffer.from('PK zip'), 'application/zip');
    await teacher.send('post', `/api/instructor/courses/${course.id}/package`, { title: 'All lab files', storageKey: key }).expect(201);
    await teacher.send('post', `/api/instructor/courses/${course.id}/package`, { title: 'x', storageKey: `resources/${other.user.id}/x.zip` }).expect(400);
    const files = (await teacher.agent.get(`/api/instructor/courses/${course.id}/package`).expect(200)).body.items;
    expect(files).toHaveLength(1);
    const stranger = await userAgent('arr-stranger@e2e.example', ['student']);
    await stranger.send('post', `/api/course-files/${files[0].id}/download`).expect(403);
    await prisma.enrollment.create({ data: { userId: stranger.user.id, courseId: course.id, source: 'admin' } });
    expect((await stranger.agent.get('/api/me/courses/arr-live').expect(200)).body.packageFiles).toHaveLength(1);
    expect((await stranger.send('post', `/api/course-files/${files[0].id}/download`).expect(200)).body.url).toContain('complete-labs.zip');
    await teacher.send('delete', `/api/instructor/courses/${course.id}/package/${files[0].id}`).expect(200);
  });

  it('draft preview: the course owner (and course reviewers) preview draft-revision lessons; learners and other instructors cannot', async () => {
    if (!available) return;
    const teacher = await userAgent('dp-teacher@e2e.example', ['student', 'instructor'], {});
    const other = await userAgent('dp-other@e2e.example', ['student', 'instructor'], {});
    const learner = await userAgent('dp-learner@e2e.example', ['student']);
    const reviewer = await userAgent('dp-admin@e2e.example', ['student', 'admin'], undefined, ['courses.review']);
    const support = await userAgent('dp-support@e2e.example', ['student', 'admin'], undefined, ['support.manage']);
    const { course, section, lecture } = await publishedCourse(teacher.user.id, 'dp-live', 1500);
    await prisma.enrollment.create({ data: { userId: learner.user.id, courseId: course.id, source: 'admin' } });
    const newVideo = await prisma.videoAsset.create({ data: { ownerId: teacher.user.id, provider: 'local', status: 'ready', storageKey: `videos/dp-new/source.mp4`, durationSec: 33 } });

    // Draft changes: a new video lesson, a new article, a quiz, and an edited live lesson.
    const vid = (await teacher.send('post', `/api/instructor/courses/${course.id}/sections/${section.id}/lectures`, { title: 'Draft video', videoAssetId: newVideo.id }).expect(201)).body;
    const art = (await teacher.send('post', `/api/instructor/courses/${course.id}/sections/${section.id}/lectures`, { title: 'Draft article', type: 'article', articleMd: '# Secret draft notes' }).expect(201)).body;
    const quiz = (await teacher.send('post', `/api/instructor/courses/${course.id}/sections/${section.id}/lectures`, { title: 'Draft quiz', type: 'quiz' }).expect(201)).body;
    await teacher.send('put', `/api/instructor/courses/${course.id}/lectures/${quiz.id}/quiz`, { questions: [{ q: 'Which port?', options: ['22', '80', '443'], correct: 2, why: 'TLS' }] }).expect(200);
    await teacher.send('patch', `/api/instructor/courses/${course.id}/lectures/${lecture.id}`, { title: 'L1 renamed in draft' }).expect(200);
    expect(await prisma.lecture.count({ where: { section: { courseId: course.id } } })).toBe(1); // live unchanged

    const url = (id: string) => `/api/instructor/courses/${course.id}/lectures/${id}/preview`;
    const v = (await teacher.agent.get(url(vid.id)).expect(200)).body;
    expect(v).toMatchObject({ version: 'draft', lecture: { title: 'Draft video', type: 'video' }, video: { status: 'ready', playback: { url: expect.any(String), expiresAt: expect.any(String) } } });
    expect(new Date(v.video.playback.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000); // short-lived signed URL
    expect((await teacher.agent.get(url(art.id)).expect(200)).body.lecture.articleMd).toBe('# Secret draft notes');
    expect((await teacher.agent.get(url(quiz.id)).expect(200)).body.quiz).toEqual([{ q: 'Which port?', options: ['22', '80', '443'], correct: 2, why: 'TLS' }]);
    expect((await teacher.agent.get(url(lecture.id)).expect(200)).body.lecture.title).toBe('L1 renamed in draft');
    await teacher.agent.get(url('00000000-0000-0000-0000-000000000000')).expect(404);
    // An admin who reviews courses may preview too; an admin without that permission may not.
    expect((await reviewer.agent.get(url(art.id)).expect(200)).body.lecture.articleMd).toBe('# Secret draft notes');
    await support.agent.get(url(art.id)).expect(404);
    expect(await prisma.auditLog.count({ where: { action: 'course.draft_preview', actorId: reviewer.user.id, targetId: course.id } })).toBe(1);

    // Nobody else: not another instructor, not an enrolled learner (403 at the role guard), and the learner routes
    // don't know the draft lessons.
    await other.agent.get(url(art.id)).expect(404);
    await other.agent.get(url(vid.id)).expect(404);
    await learner.agent.get(url(art.id)).expect(403);
    await learner.send('post', `/api/lectures/${vid.id}/playback`).expect(404);
    await learner.agent.get(`/api/lectures/${quiz.id}/quiz`).expect(404);
    const learnerView = (await learner.agent.get('/api/me/courses/dp-live').expect(200)).body;
    expect(JSON.stringify(learnerView)).not.toContain('Secret draft notes');
    expect(JSON.stringify(learnerView)).not.toContain(vid.id);
  });

  it('list filters: manual enrollments by instructor, course and created date; review moderation by course and instructor', async () => {
    if (!available) return;
    const boss = await userAgent('flt-boss@e2e.example', ['student', 'admin', 'super_admin']);
    const t1 = await userAgent('flt-t1@e2e.example', ['student', 'instructor'], {});
    const t2 = await userAgent('flt-t2@e2e.example', ['student', 'instructor'], {});
    const a = await publishedCourse(t1.user.id, 'flt-a', 3000);
    const b = await publishedCourse(t1.user.id, 'flt-b', 3000);
    const c = await publishedCourse(t2.user.id, 'flt-c', 3000);
    const r1 = (await t1.send('post', '/api/enrollments/manual', { studentEmail: 'flt-s1@e2e.example', studentName: 'Kofi One', items: [{ courseId: a.course.id }] }).expect(201)).body;
    const r2 = (await t1.send('post', '/api/enrollments/manual', { studentEmail: 'flt-s2@e2e.example', studentName: 'Kofi Two', items: [{ courseId: b.course.id }] }).expect(201)).body;
    const r3 = (await t2.send('post', '/api/enrollments/manual', { studentEmail: 'flt-s3@e2e.example', studentName: 'Kofi Three', items: [{ courseId: c.course.id }] }).expect(201)).body;
    await prisma.manualEnrollment.update({ where: { id: r1.id }, data: { createdAt: new Date('2026-01-10T12:00:00Z') } });
    const ids = async (agent: typeof boss.agent, query: string) => (await agent.get(`/api/enrollments/manual?status=open&q=Kofi&${query}`).expect(200)).body.items.map((x: any) => x.id).sort();

    expect(await ids(boss.agent, `instructorId=${t1.user.id}`)).toEqual([r1.id, r2.id].sort());
    expect(await ids(boss.agent, `instructorId=${t1.user.id}&courseId=${c.course.id}`)).toEqual([]); // both must match one line
    expect(await ids(boss.agent, `courseId=${b.course.id}`)).toEqual([r2.id]);
    expect(await ids(boss.agent, 'from=2026-01-10&to=2026-01-10')).toEqual([r1.id]); // whole days, both included
    expect(await ids(boss.agent, 'to=2026-01-09')).toEqual([]);
    await boss.agent.get('/api/enrollments/manual?from=yesterday').expect(400);
    await boss.agent.get('/api/enrollments/manual?courseId=nope').expect(400);
    // instructors: own requests only; the instructor filter can't reach other people's requests
    expect(await ids(t1.agent, `instructorId=${t2.user.id}`)).toEqual([r1.id, r2.id].sort());
    expect(await ids(t2.agent, `courseId=${a.course.id}`)).toEqual([]);
    const own = (await t1.agent.get('/api/enrollments/manual/filters').expect(200)).body;
    expect(own.courses.map((x: any) => x.id).sort()).toEqual([a.course.id, b.course.id].sort());
    expect(own.instructors).toEqual([]);
    const all = (await boss.agent.get('/api/enrollments/manual/filters').expect(200)).body;
    expect(all.instructors.map((x: any) => x.id)).toEqual(expect.arrayContaining([t1.user.id, t2.user.id]));
    expect(all.courses.map((x: any) => x.id)).toEqual(expect.arrayContaining([a.course.id, b.course.id, c.course.id]));
    expect(r3.id).toBeTruthy();

    // reviews
    const stu = await userAgent('flt-stu@e2e.example', ['student']);
    for (const x of [a, c]) {
      await prisma.enrollment.create({ data: { userId: stu.user.id, courseId: x.course.id, source: 'admin' } });
      await stu.send('post', `/api/courses/${x.course.slug}/reviews`, { rating: 4, body: 'Clear labs and good pacing.' }).expect(201);
    }
    const rev = async (query: string) => (await boss.agent.get(`/api/admin/reviews?${query}`).expect(200)).body.items.map((x: any) => x.course.id);
    expect(await rev(`courseId=${a.course.id}`)).toEqual([a.course.id]);
    expect(await rev(`instructorId=${t2.user.id}`)).toEqual([c.course.id]);
    expect(await rev(`instructorId=${t2.user.id}&courseId=${a.course.id}`)).toEqual([]);
    await boss.agent.get('/api/admin/reviews?instructorId=x').expect(400);
    const rf = (await boss.agent.get('/api/admin/reviews/filters').expect(200)).body;
    expect(rf.courses).toEqual(expect.arrayContaining([{ id: a.course.id, title: 'flt-a', instructorId: t1.user.id }]));
    expect(rf.courses.map((x: any) => x.id)).not.toContain(b.course.id); // no reviews, not offered
    expect(rf.instructors.map((x: any) => x.id)).toEqual(expect.arrayContaining([t1.user.id, t2.user.id]));
    await t1.agent.get('/api/admin/reviews/filters').expect(403);
  });

  describe('manual enrollment and invitations (owner 2026-11-25)', () => {
    const jobsMock = () => app.get(JobsService) as unknown as { sendEmail: jest.Mock };
    const lastMail = (template: string, to?: string) => jobsMock().sendEmail.mock.calls.map((c) => c[0]).reverse().find((j) => j.template === template && (!to || j.to === to));
    const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

    it('instructor requests several own courses; foreign courses and activation are blocked; super admin verifies payment, commissions per instructor, approves; invitation → code → account → courses', async () => {
      if (!available) return;
      const boss = await userAgent('me-boss@e2e.example', ['student', 'admin', 'super_admin']);
      const t1 = await userAgent('me-t1@e2e.example', ['student', 'instructor'], {});
      const t2 = await userAgent('me-t2@e2e.example', ['student', 'instructor'], {});
      const a = await publishedCourse(t1.user.id, 'me-a', 4000);
      const b = await publishedCourse(t1.user.id, 'me-b', 6000);
      const foreign = await publishedCourse(t2.user.id, 'me-c', 5000);
      const email = 'ama.new@e2e.example';
      // instructor can't include another instructor's course, or activate anything
      expect((await t1.send('post', '/api/enrollments/manual', { studentEmail: email, studentName: 'Ama Mensah', items: [{ courseId: a.course.id }, { courseId: foreign.course.id }] }).expect(403)).body.error.code).toBe('not_your_course');
      await t1.send('post', '/api/enrollments/manual', { studentEmail: email, studentName: 'Ama', items: [{ courseId: a.course.id, expiresAt: inDays(800) }] }).expect(400);
      const req = (await t1.send('post', '/api/enrollments/manual', { studentEmail: email, studentName: 'Ama Mensah', items: [{ courseId: a.course.id, expiresAt: inDays(200) }, { courseId: b.course.id }], note: 'Paid by mobile money' }).expect(201)).body;
      expect(req).toMatchObject({ status: 'pending', student: { hasAccount: false }, paymentStatus: 'payment_pending' });
      expect(lastMail('manual-enrollment-submitted', 'me-boss@e2e.example')).toBeTruthy();
      await t1.send('post', `/api/enrollments/manual/${req.id}/approve`, {}).expect(403);
      await t1.send('post', `/api/enrollments/manual/${req.id}/invitation/link`).expect(403);
      await t2.agent.get(`/api/enrollments/manual/${req.id}`).expect(404);
      // duplicate open request for the same course
      expect((await t1.send('post', '/api/enrollments/manual', { studentEmail: email, studentName: 'Ama', items: [{ courseId: a.course.id }] }).expect(409)).body.error.code).toBe('duplicate_request');
      // approval needs a verified payment (or a complimentary reason)
      expect((await boss.send('post', `/api/enrollments/manual/${req.id}/approve`, {}).expect(409)).body.error.code).toBe('payment_not_verified');
      // 65,000 XAF at 0.00165 USD = 107.25 USD, fee 2.25 USD, allocation must add up
      // items come back in id order: pick them by course
      const ia = req.items.find((i: any) => i.courseId === a.course.id);
      const ib = req.items.find((i: any) => i.courseId === b.course.id);
      await boss.send('post', `/api/enrollments/manual/${req.id}/payments`, { method: 'mobile_money', reference: 'MM-7781', currency: 'XAF', amount: '65000', usdRate: '0.00165', feeUsdCents: 225, allocations: [{ itemId: ia.id, grossUsdCents: 4000 }, { itemId: ib.id, grossUsdCents: 6000 }] }).expect(400);
      const paid = (await boss.send('post', `/api/enrollments/manual/${req.id}/payments`, { method: 'mobile_money', reference: 'MM-7781', currency: 'XAF', amount: '65000', usdRate: '0.00165', feeUsdCents: 225, allocations: [{ itemId: ia.id, grossUsdCents: 4290 }, { itemId: ib.id, grossUsdCents: 6435 }] }).expect(201)).body;
      expect(paid.payments[0]).toMatchObject({ grossUsdCents: 10725, feeUsdCents: 225, netUsdCents: 10500, status: 'pending' });
      await boss.send('post', `/api/enrollments/manual/${req.id}/payments`, { method: 'mobile_money', reference: 'MM-7781', currency: 'XAF', amount: '1', usdRate: '1', feeUsdCents: 0, allocations: [{ itemId: ia.id, grossUsdCents: 0 }] }).expect(409);
      expect((await boss.send('post', `/api/enrollments/manual/${req.id}/approve`, {}).expect(409)).body.error.code).toBe('payment_not_verified');
      await boss.send('post', `/api/enrollments/payments/${paid.payments[0].id}/verify`).expect(200);
      const ok = (await boss.send('post', `/api/enrollments/manual/${req.id}/approve`, {}).expect(200)).body;
      expect(ok).toMatchObject({ status: 'approved', paymentStatus: 'payment_verified', invitation: { status: 'pending' } });
      // 80/20 of the net per course: fee 225 split 90/135 → nets 4200 and 6300 → instructor 3360 + 5040
      const al = ok.earnings.sort((x: any, y: any) => x.netUsdCents - y.netUsdCents);
      expect(al.map((x: any) => [x.netUsdCents, x.instructorCents, x.platformCents, x.payoutStatus])).toEqual([[4200, 3360, 840, 'earnings_recorded'], [6300, 5040, 1260, 'earnings_recorded']]);
      // the instructor now sees and can resend/copy the invitation; previous link stops working
      const inviteMail = lastMail('student-invitation', email);
      const firstToken = inviteMail.data.link.split('/invite/')[1];
      const copied = (await t1.send('post', `/api/enrollments/manual/${req.id}/invitation/link`).expect(200)).body.link as string;
      const token = copied.split('/invite/')[1];
      expect((await request(app.getHttpServer()).get(`/api/invitations/${firstToken}`).expect(410)).body.error.code).toBe('invitation_revoked');
      const info = (await request(app.getHttpServer()).get(`/api/invitations/${token}`).expect(200)).body;
      expect(info.courses).toHaveLength(2);
      expect(info.email).not.toContain('ama.new@');
      // opening the link is not enough: the email code is required
      const guest = request.agent(app.getHttpServer());
      const csrf: string = (await guest.get('/api/auth/me')).body.csrf;
      await guest.post(`/api/invitations/${token}/accept`).set('X-CSRF-Token', csrf).send({ code: '000000', name: 'Ama Mensah', password: 'Quiet-river-stone-58' }).expect(400);
      await guest.post(`/api/invitations/${token}/code`).set('X-CSRF-Token', csrf).expect(200);
      const code = lastMail('invitation-code', email).data.code;
      await guest.post(`/api/invitations/${token}/accept`).set('X-CSRF-Token', csrf).send({ code: code === '000000' ? '111111' : '000000', name: 'Ama Mensah', password: 'Quiet-river-stone-58' }).expect(400);
      await guest.post(`/api/invitations/${token}/accept`).set('X-CSRF-Token', csrf).send({ code, name: 'Ama Mensah', password: 'short' }).expect(400);
      const acc = await guest.post(`/api/invitations/${token}/accept`).set('X-CSRF-Token', csrf).send({ code, name: 'Ama Mensah', password: 'Quiet-river-stone-58' }).expect(200);
      expect(acc.body).toEqual({ mfa: 'enroll' }); // Google Authenticator next, like every sign-up
      const student = await prisma.user.findUniqueOrThrow({ where: { email }, include: { enrollments: true } });
      expect(student).toMatchObject({ roles: ['student'], signupMethod: 'invitation' });
      expect(student.emailVerifiedAt).not.toBeNull();
      expect(student.enrollments.map((e) => e.source)).toEqual(['manual', 'manual']);
      const ea = student.enrollments.find((e) => e.courseId === a.course.id)!;
      expect(Math.abs(+ea.accessExpiresAt! - +new Date(inDays(200)))).toBeLessThan(5000); // each course keeps its own date
      await guest.post(`/api/invitations/${token}/accept`).set('X-CSRF-Token', csrf).send({ code, name: 'Ama M', password: 'Quiet-river-stone-58' }).expect(409);
      // payout only by a super admin, completed needs a reference
      await t1.send('post', `/api/enrollments/allocations/${al[0].id}/payout`, { status: 'payout_completed', reference: 'x' }).expect(403);
      await boss.send('post', `/api/enrollments/allocations/${al[0].id}/payout`, { status: 'payout_completed' }).expect(400);
      await boss.send('post', `/api/enrollments/allocations/${al[0].id}/payout`, { status: 'payout_completed', reference: 'WIRE-55' }).expect(200);
      const earn = (await t1.agent.get('/api/enrollments/earnings').expect(200)).body;
      expect(earn.totals).toMatchObject({ instructorCents: 8400, paidOutCents: 3360 });
      // expiry change and revocation are enforced by the backend
      await boss.send('put', `/api/enrollments/items/${ia.id}/expiry`, { expiresAt: inDays(400), reason: 'Paid for a longer plan' }).expect(200);
      expect(lastMail('course-access-extended', email)).toBeTruthy();
      await boss.send('post', `/api/enrollments/items/${ib.id}/revoke`, { reason: 'Payment reversed' }).expect(200);
      expect((await prisma.enrollment.findUniqueOrThrow({ where: { userId_courseId: { userId: student.id, courseId: b.course.id } } })).revokedAt).not.toBeNull();
    });

    it('super admin: direct multi-instructor complimentary enrollment for an existing student, no duplicates, progress kept; reject and needs-info for instructors', async () => {
      if (!available) return;
      const boss = await userAgent('me2-boss@e2e.example', ['student', 'admin', 'super_admin']);
      const t1 = await userAgent('me2-t1@e2e.example', ['student', 'instructor'], {});
      const t2 = await userAgent('me2-t2@e2e.example', ['student', 'instructor'], {});
      const x = await publishedCourse(t1.user.id, 'me2-x', 3000);
      const y = await publishedCourse(t2.user.id, 'me2-y', 3000);
      const stu = await userAgent('me2-stu@e2e.example', ['student']);
      await prisma.enrollment.create({ data: { userId: stu.user.id, courseId: x.course.id, source: 'purchase', accessExpiresAt: new Date(Date.now() - 86_400_000) } });
      await prisma.lectureProgress.create({ data: { userId: stu.user.id, lectureId: x.lecture.id, positionSec: 12, completed: true } });
      await boss.send('post', '/api/enrollments/manual', { studentEmail: 'me2-stu@e2e.example', studentName: 'Sam Stu', items: [{ courseId: x.course.id }, { courseId: y.course.id }], complimentary: true }).expect(400); // reason required
      const direct = (await boss.send('post', '/api/enrollments/manual', { studentEmail: 'me2-stu@e2e.example', studentName: 'Sam Stu', items: [{ courseId: x.course.id, expiresAt: inDays(90) }, { courseId: y.course.id, expiresAt: inDays(365) }], complimentary: true, complimentaryReason: 'Scholarship for the Douala cohort' }).expect(201)).body;
      expect(direct).toMatchObject({ status: 'approved', complimentary: true, student: { hasAccount: true }, invitation: { status: 'not_needed' } });
      expect(lastMail('courses-assigned', 'me2-stu@e2e.example')).toBeTruthy();
      const ens = await prisma.enrollment.findMany({ where: { userId: stu.user.id }, orderBy: { accessExpiresAt: 'asc' } });
      expect(ens.map((e) => e.courseId)).toEqual([x.course.id, y.course.id]);
      expect(await prisma.lectureProgress.count({ where: { userId: stu.user.id, completed: true } })).toBe(1);
      await stu.agent.get('/api/me/courses/me2-y').expect(200);
      // now enrolled: a second request is refused
      expect((await boss.send('post', '/api/enrollments/manual', { studentEmail: 'me2-stu@e2e.example', studentName: 'Sam Stu', items: [{ courseId: y.course.id }], complimentary: true, complimentaryReason: 'again' }).expect(409)).body.error.code).toBe('already_enrolled');
      // expired access is enforced by the API
      await prisma.enrollment.update({ where: { userId_courseId: { userId: stu.user.id, courseId: y.course.id } }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
      await stu.agent.get('/api/me/courses/me2-y').expect(403);
      // reject and needs-info → resubmit
      const r1 = (await t1.send('post', '/api/enrollments/manual', { studentEmail: 'someone@e2e.example', studentName: 'Some One', items: [{ courseId: x.course.id }] }).expect(201)).body;
      await boss.send('post', `/api/enrollments/manual/${r1.id}/decision`, { decision: 'needs_info', note: 'Which payment reference?' }).expect(200);
      expect(lastMail('manual-enrollment-needs-info', 'me2-t1@e2e.example')).toBeTruthy();
      await t1.send('post', `/api/enrollments/manual/${r1.id}/resubmit`, { note: 'Reference MM-1' }).expect(200);
      await boss.send('post', `/api/enrollments/manual/${r1.id}/decision`, { decision: 'rejected', note: 'Payment not received' }).expect(200);
      await boss.send('post', `/api/enrollments/manual/${r1.id}/approve`, { complimentary: true, complimentaryReason: 'nope' }).expect(409);
      expect(await prisma.user.findUnique({ where: { email: 'someone@e2e.example' } })).toBeNull();
      const lst = (await t1.agent.get('/api/enrollments/manual').expect(200)).body;
      expect(lst.items.every((i: any) => i.requestedBy.id === t1.user.id)).toBe(true);
    });
  });

  it('review moderation: instructors report, admins hide/restore with a reason, only super admins delete; ratings recalculated', async () => {
    if (!available) return;
    const teacher = await userAgent('mod-teacher@e2e.example', ['student', 'instructor'], {});
    const other = await userAgent('mod-other@e2e.example', ['student', 'instructor'], {});
    const stu = await userAgent('mod-stu@e2e.example', ['student']);
    const stu2 = await userAgent('mod-stu2@e2e.example', ['student']);
    const helper = await userAgent('mod-admin@e2e.example', ['student', 'admin'], undefined, ['reviews.moderate']);
    const boss = await userAgent('mod-boss@e2e.example', ['student', 'admin', 'super_admin']);
    const { course } = await publishedCourse(teacher.user.id, 'mod-course', 1500);
    for (const s of [stu, stu2]) await prisma.enrollment.create({ data: { userId: s.user.id, courseId: course.id, source: 'admin' } });
    await stu.send('post', '/api/courses/mod-course/reviews', { rating: 1, body: 'BUY CHEAP FOLLOWERS at spam.example' }).expect(201);
    await stu2.send('post', '/api/courses/mod-course/reviews', { rating: 2, body: 'Too fast for beginners, the labs need more explanation.' }).expect(201);
    const reviews = await prisma.review.findMany({ where: { courseId: course.id } });
    const spam = reviews.find((r) => r.rating === 1)!;
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.id } })).ratingCount).toBe(2);
    // reports: own course only, a reason with details, once
    await other.send('post', `/api/instructor/reviews/${spam.id}/report`, { reason: 'spam', details: 'This is an advert for followers.' }).expect(404);
    await teacher.send('post', `/api/instructor/reviews/${spam.id}/report`, { reason: 'spam', details: 'short' }).expect(400);
    await teacher.send('post', `/api/instructor/reviews/${spam.id}/report`, { reason: 'spam', details: 'This is an advert for buying followers, not a review.' }).expect(201);
    await teacher.send('post', `/api/instructor/reviews/${spam.id}/report`, { reason: 'spam', details: 'This is an advert for buying followers, not a review.' }).expect(409);
    await teacher.send('delete', `/api/admin/reviews/${spam.id}`, { reason: 'trying to delete' }).expect(403); // instructors never delete
    // admin with reviews.moderate sees reported ones, hides with a reason → rating recalculated, report actioned
    const listed = (await helper.agent.get('/api/admin/reviews?reported=true').expect(200)).body;
    expect(listed.items.map((r: any) => r.id)).toEqual([spam.id]);
    expect(listed.items[0].reports[0]).toMatchObject({ reason: 'spam', status: 'open', reporter: 'mod-teacher' });
    await helper.send('post', `/api/admin/reviews/${spam.id}/status`, { status: 'hidden' }).expect(400);
    await helper.send('post', `/api/admin/reviews/${spam.id}/status`, { status: 'hidden', reason: 'Advertising, not a course review' }).expect(200);
    expect(await prisma.course.findUniqueOrThrow({ where: { id: course.id } })).toMatchObject({ ratingCount: 1, ratingAvg: 2 });
    expect((await prisma.reviewReport.findFirstOrThrow({ where: { reviewId: spam.id } })).status).toBe('actioned');
    // the genuine low rating stays; an admin can't delete, a super admin can (with a reason)
    await helper.send('delete', `/api/admin/reviews/${spam.id}`, { reason: 'Advertising spam' }).expect(403);
    await boss.send('delete', `/api/admin/reviews/${spam.id}`, { reason: 'Advertising spam' }).expect(200);
    expect(await prisma.review.findUnique({ where: { id: spam.id } })).toBeNull();
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'review.deleted', targetId: spam.id } });
    expect(log.meta).toMatchObject({ reason: 'Advertising spam', snapshot: { rating: 1 } });
    // a report can be dismissed when nothing breaks the policy
    const genuine = reviews.find((r) => r.rating === 2)!;
    const rep = (await teacher.send('post', `/api/instructor/reviews/${genuine.id}/report`, { reason: 'other', details: 'I disagree with this rating of my course.' }).expect(201)).body;
    await helper.send('post', `/api/admin/review-reports/${rep.id}/dismiss`, { note: 'Honest feedback, no policy violation' }).expect(200);
    expect((await prisma.review.findUniqueOrThrow({ where: { id: genuine.id } })).status).toBe('visible');
  });

  it('storage layout: new uploads live under instructors/<id>/courses/<id>/…, never under another instructor', async () => {
    if (!available) return;
    const t = await userAgent('keys-teacher@e2e.example', ['student', 'instructor'], {});
    const o = await userAgent('keys-other@e2e.example', ['student', 'instructor'], {});
    const { course } = await publishedCourse(t.user.id, 'keys-course', 1000);
    const v = (await t.send('post', '/api/instructor/uploads/video', { filename: 'a.mp4', contentType: 'video/mp4', courseId: course.id }).expect(201)).body;
    expect((await prisma.videoAsset.findUniqueOrThrow({ where: { id: v.assetId } })).storageKey).toBe(`instructors/${t.user.id}/courses/${course.id}/videos/${v.assetId}/source.mp4`);
    const r = (await t.send('post', '/api/instructor/uploads/resource', { filename: 'lab files.zip', contentType: 'application/zip', sizeBytes: 10, courseId: course.id }).expect(201)).body;
    expect(r.storageKey).toMatch(new RegExp(`^instructors/${t.user.id}/courses/${course.id}/resources/[0-9a-f-]+/lab_files\\.zip$`));
    // another instructor can't file things under this course
    await o.send('post', '/api/instructor/uploads/video', { filename: 'a.mp4', contentType: 'video/mp4', courseId: course.id }).expect(400);
    await o.send('post', `/api/instructor/courses/${course.id}/package`, { title: 'x', storageKey: r.storageKey }).expect(404);
  });

  it('search inside videos: spoken words to the exact moment for people with access; AI assistant and notes hidden without a key', async () => {
    if (!available) return;
    const teacher = await userAgent('study-teacher@e2e.example', ['student', 'instructor'], {});
    const learner = await userAgent('study-learner@e2e.example', ['student']);
    const outsider = await userAgent('study-outsider@e2e.example', ['student']);
    const lapsed = await userAgent('study-lapsed@e2e.example', ['student']);
    const { course, lecture } = await publishedCourse(teacher.user.id, 'study-course', 1500);
    await prisma.enrollment.create({ data: { userId: learner.user.id, courseId: course.id, source: 'free' } });
    await prisma.enrollment.create({ data: { userId: lapsed.user.id, courseId: course.id, source: 'purchase', accessExpiresAt: new Date(Date.now() - 86_400_000) } });
    const storage = app.get(StorageService);
    const key = `videos/study-${Date.now()}/captions.vtt`;
    await storage.put(key, 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nWelcome to the lab.\n\n00:00:20.000 --> 00:00:24.000\nNow run helm rollback to restore the previous release.\n\n00:00:40.000 --> 00:00:44.000\nKubernetes keeps the old ReplicaSet around.\n', 'text/vtt');
    const assetId = (await prisma.lecture.findUniqueOrThrow({ where: { id: lecture.id } })).videoAssetId!;
    await prisma.videoAsset.update({ where: { id: assetId }, data: { captionsKey: key } });
    const url = (q: string) => `/api/me/courses/study-course/search?q=${encodeURIComponent(q)}`;

    // Access: enrolled with active access, the owner and admins only (checked in the service, every request).
    await request(app.getHttpServer()).get(url('rollback')).expect(401);
    await outsider.agent.get(url('rollback')).expect(403);
    await lapsed.agent.get(url('rollback')).expect(403);
    const r = (await learner.agent.get(url('rollback')).expect(200)).body;
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ lectureId: lecture.id, startSec: 20, endSec: 24 });
    expect(r.items[0].parts).toContainEqual({ text: 'rollback', match: true });
    // stemming and prefix while typing (real Postgres full-text search); the owner can search too
    expect((await learner.agent.get(url('restoring releases')).expect(200)).body.items[0].startSec).toBe(20);
    expect((await teacher.agent.get(url('kube')).expect(200)).body.items[0].startSec).toBe(40);
    expect((await learner.agent.get(url('terraform')).expect(200)).body.items).toEqual([]);
    expect(await prisma.captionSegment.count({ where: { videoAssetId: assetId } })).toBe(3);

    // New captions replace the old index.
    await storage.put(key, 'WEBVTT\n\n00:01:05.000 --> 00:01:09.000\nArgo CD syncs the cluster.\n', 'text/vtt');
    await prisma.captionIndex.update({ where: { videoAssetId: assetId }, data: { captionsKey: 'stale' } }); // as if the key changed
    expect((await learner.agent.get(url('argo')).expect(200)).body.items[0].startSec).toBe(65);
    expect((await learner.agent.get(url('rollback')).expect(200)).body.items).toEqual([]);

    // Without ANTHROPIC_API_KEY the AI features don't exist: flags off, endpoints 404, nothing recorded.
    const view = (await learner.agent.get('/api/me/courses/study-course').expect(200)).body;
    expect(view.study).toEqual({ search: true, assistant: false, notes: false });
    await learner.send('post', '/api/me/courses/study-course/ask', { question: 'How do I roll back?' }).expect(404);
    await learner.agent.get(`/api/lectures/${lecture.id}/study-notes`).expect(404);
    await teacher.agent.get(`/api/instructor/lectures/${lecture.id}/study-notes`).expect(404);
    await teacher.send('post', `/api/instructor/lectures/${lecture.id}/study-notes/regenerate`).expect(404);
    expect(await prisma.aiUsage.count()).toBe(0);
  });
});
