/**
 * End to end: refund management (owner 2026-11-26, prompts.md "Automated Refund Management"; docs/ACCESS_AND_REFUNDS.md).
 * The 14 scenarios of the brief, against the real app and a separate database `marketplace_e2e` (truncated first, same
 * setup as app.e2e-spec.ts). Payments use the dev test provider; Stripe's confirm / fail paths go through the service
 * with a stubbed client. Skipped when Postgres is unreachable.
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
import { RefundsService } from '../src/commerce/refunds.service';
import { StripeService } from '../src/commerce/stripe.service';
import { TERMS_VERSION } from '../src/commerce/terms';
import { JobsService } from '../src/common/jobs';
import { ALL_ADMIN_PERMISSIONS } from '../src/common/permissions';
import { PrismaService } from '../src/common/prisma.service';
import { seal } from '../src/common/seal';
import { resetEnvCache } from '../src/config/env';

const API_DIR = join(__dirname, '..');
const ROOT_ENV = join(API_DIR, '..', '..', '.env');
const TERMS = { acceptTerms: true, termsVersion: TERMS_VERSION };
const DAY = 86_400_000;

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
  // Truncation removed the launch policy row from the migration: put version 1 back (14 days, 25 %).
  await db.query(`insert into refund_policies (id, version, "windowDays", "maxWatchedPercent", note, "effectiveFrom") values ('00000000-0000-4000-8000-000000000001', 1, 14, 25, 'Launch policy', '2020-01-01T00:00:00Z')`);
  await db.end();
  return url;
}

describe('e2e: refund management', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  const PW = 'Long-enough-pw1';
  const MFA_SEED = newSecret();
  const sendEmail = jest.fn();
  /** A code works once per account and 30-second step: the last step used per email. */
  const used: Record<string, number> = {};
  async function freshCode(email: string) {
    while (stepAt() <= (used[email] ?? 0)) await new Promise((r) => setTimeout(r, 1000));
    used[email] = stepAt();
    return codeAt(MFA_SEED, used[email]!);
  }

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) {
      console.warn('\n[e2e refunds] SKIPPED: Postgres not reachable. Run `docker compose up -d postgres redis` first.\n');
      return;
    }
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', DEV_TEST_PAYMENTS: 'true', MFA_REQUIRED: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(JobsService).useValue({ processVideo: jest.fn(), sendEmail, settleFee: jest.fn() }).compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    available = true;
  });

  afterAll(async () => { await app?.close(); });

  async function userAgent(email: string, roles: any[]) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0], passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles, adminPermissions: roles.includes('admin') ? ALL_ADMIN_PERMISSIONS : [], mfaSecret: seal('mfa', MFA_SEED), mfaEnabledAt: new Date() } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200, { mfa: 'verify' });
    await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: await freshCode(email) }).expect(200);
    const send = (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: object) => agent[method](url).set('X-CSRF-Token', csrf).send(body ?? {});
    return { user, agent, send };
  }

  /** A published paid course: `paidSecs` paid video lessons plus an optional free preview of `previewSec`. */
  async function course(teacherId: string, slug: string, paidSecs: number[], previewSec = 0) {
    const cat = (await prisma.category.findFirst()) ?? (await prisma.category.create({ data: { slug: 'refund-e2e', name: 'Refunds' } }));
    const c = await prisma.course.create({ data: { slug, title: `Course ${slug}`, instructorId: teacherId, categoryId: cat.id, priceCents: 2000, status: 'published', publishedAt: new Date(), description: 'd' } });
    const section = await prisma.section.create({ data: { courseId: c.id, title: 'S1', position: 0 } });
    const lectures = [];
    let pos = 0;
    if (previewSec) lectures.push(await prisma.lecture.create({ data: { sectionId: section.id, title: 'Preview', position: pos++, type: 'video', durationSec: previewSec, isPreview: true } }));
    for (const sec of paidSecs) lectures.push(await prisma.lecture.create({ data: { sectionId: section.id, title: `L${pos}`, position: pos++, type: 'video', durationSec: sec } }));
    return { course: c, lectures, paid: lectures.filter((l) => !l.isPreview), preview: lectures.find((l) => l.isPreview) };
  }

  async function buy(u: Awaited<ReturnType<typeof userAgent>>, courseId: string) {
    await u.send('post', '/api/cart', { courseId }).expect(201);
    const co = await u.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
    await u.send('post', `/api/dev/test-payments/${co.body.orderId}/complete`).expect(200);
    return co.body.orderId as string;
  }

  const watch = (u: Awaited<ReturnType<typeof userAgent>>, lectureId: string, played: [number, number][], positionSec: number) =>
    u.send('put', `/api/lectures/${lectureId}/progress`, { positionSec, played }).expect(200);

  it('the 14 scenarios of the brief', async () => {
    if (!available) return;
    const teacherRow = await prisma.user.create({ data: { email: 'rm-teacher@e2e.example', name: 'Teacher', passwordHash: 'x', roles: ['student', 'instructor'] } });
    await prisma.instructorProfile.create({ data: { userId: teacherRow.id, status: 'approved' } });
    const boss = await userAgent('rm-boss@e2e.example', ['student', 'admin', 'super_admin']);
    const admin = await userAgent('rm-admin@e2e.example', ['student', 'admin']);
    const http = request(app.getHttpServer());

    // Public numbers come from the policy in force.
    expect((await http.get('/api/refund-policy').expect(200)).body).toMatchObject({ version: 1, windowDays: 14, maxWatchedPercent: 25 });

    // 1. Within the period, under the limit (free preview watched fully: never counted) → refunded at once.
    const s1 = await userAgent('rm-1@e2e.example', ['student']);
    const c1 = await course(teacherRow.id, 'rm-c1', [100], 50);
    const o1 = await buy(s1, c1.course.id);
    await watch(s1, c1.preview!.id, [[0, 50]], 50);
    await watch(s1, c1.paid[0]!.id, [[0, 10]], 10);
    const status1 = (await s1.agent.get('/api/me/learning').expect(200)).body.items.find((i: any) => i.course.slug === 'rm-c1').refund;
    expect(status1).toMatchObject({ state: 'eligible', watchedPercent: 10, maxWatchedPercent: 25, windowDays: 14, daysLeft: 13 });
    const report1 = (await s1.agent.get('/api/me/courses/rm-c1/report').expect(200)).body;
    expect(report1).toMatchObject({ lessons: { total: 2 }, video: { totalSec: 150, uniqueWatchedSec: 60, paidSec: 100, paidWatchedSec: 10, paidPercent: 10 }, refund: { state: 'eligible' } });
    sendEmail.mockClear();
    const r1 = await s1.send('post', `/api/orders/${o1}/refund`, {}).expect(200);
    expect(r1.body).toMatchObject({ status: 'refunded' });
    const rq1 = await prisma.refundRequest.findFirstOrThrow({ where: { orderId: o1 } });
    expect(rq1).toMatchObject({ status: 'auto_approved', paymentStatus: 'succeeded', policyVersion: 1 });
    expect(sendEmail.mock.calls.map((c) => c[0].template)).toContain('refund-approved');
    expect((await s1.agent.get('/api/me/notifications').expect(200)).body).toMatchObject({ unread: 1, items: [{ kind: 'refund.processed' }] });

    // 2. After the deadline → declined with the exact scenario A text.
    const s2 = await userAgent('rm-2@e2e.example', ['student']);
    const c2 = await course(teacherRow.id, 'rm-c2', [100]);
    const o2 = await buy(s2, c2.course.id);
    const paid2 = (await prisma.order.findUniqueOrThrow({ where: { id: o2 } })).paidAt!;
    await prisma.order.update({ where: { id: o2 }, data: { paidAt: new Date(paid2.getTime() - 20 * DAY), refundEligibleUntil: new Date(paid2.getTime() - 6 * DAY) } });
    const r2 = await s2.send('post', `/api/orders/${o2}/refund`, {}).expect(200);
    expect(r2.body.status).toBe('declined');
    expect(r2.body.message).toContain('because the refund period has expired.');
    expect(r2.body.message).toContain('Applicable refund period: 14 days');

    // 3. Over the limit inside the period → scenario B.
    const s3 = await userAgent('rm-3@e2e.example', ['student']);
    const c3 = await course(teacherRow.id, 'rm-c3', [100]);
    const o3 = await buy(s3, c3.course.id);
    await watch(s3, c3.paid[0]!.id, [[0, 40]], 40);
    const r3 = await s3.send('post', `/api/orders/${o3}/refund`, {}).expect(200);
    expect(r3.body.message).toContain('Your course consumption: 40%');
    expect(r3.body.message).toContain('Maximum permitted consumption: 25%');

    // 4. Both rules broken → scenario C (both reasons).
    const s4 = await userAgent('rm-4@e2e.example', ['student']);
    const c4 = await course(teacherRow.id, 'rm-c4', [100]);
    const o4 = await buy(s4, c4.course.id);
    await watch(s4, c4.paid[0]!.id, [[0, 60]], 60);
    await prisma.order.update({ where: { id: o4 }, data: { refundEligibleUntil: new Date(Date.now() - DAY) } });
    const r4 = await s4.send('post', `/api/orders/${o4}/refund`, {}).expect(200);
    expect(r4.body.message).toContain('the refund period has expired and your course consumption has exceeded the permitted limit');

    // 5. Exactly the limit → still refunded.
    const s5 = await userAgent('rm-5@e2e.example', ['student']);
    const c5 = await course(teacherRow.id, 'rm-c5', [100]);
    const o5 = await buy(s5, c5.course.id);
    await watch(s5, c5.paid[0]!.id, [[0, 25]], 25);
    expect((await s5.send('post', `/api/orders/${o5}/refund`, {}).expect(200)).body.status).toBe('refunded');

    // 6. At the exact expiry time → in time (deadline inclusive); a moment after → declined. Checked with the engine's
    //    clock through the service (an HTTP round trip can't hit the same millisecond).
    const s6 = await userAgent('rm-6@e2e.example', ['student']);
    const c6 = await course(teacherRow.id, 'rm-c6', [100]);
    const o6 = await buy(s6, c6.course.id);
    const refunds = app.get(RefundsService);
    const order6 = await prisma.order.findUniqueOrThrow({ where: { id: o6 }, include: { lines: { include: { course: { select: { title: true } } } } } });
    const terms6 = await (refunds as any).policy.termsFor(order6.refundPolicyId);
    const atDeadline = await (refunds as any).lineFacts(s6.user.id, order6, order6.lines[0], terms6, order6.refundEligibleUntil);
    expect(atDeadline).toMatchObject({ eligible: true, outcome: 'approve' });
    const after = await (refunds as any).lineFacts(s6.user.id, order6, order6.lines[0], terms6, new Date(order6.refundEligibleUntil!.getTime() + 1000));
    expect(after).toMatchObject({ eligible: false, reasons: ['window_closed'] });

    // 7. The Super Admin changes the policy: step-up code, audit, a new version; admins without super admin can't.
    const newPolicy = { windowDays: 7, maxWatchedPercent: 10, autoCheck: true, autoReject: true, autoApprove: false, allowExceptions: true, selfServicePerYear: 3, messages: { declined: 'Questions? We reply within a day.' }, note: 'Stricter from today' };
    await admin.send('put', '/api/admin/refund-policy', newPolicy).expect(403);
    expect((await boss.send('put', '/api/admin/refund-policy', newPolicy).expect(400)).body.error.code).toBe('step_up_required');
    const saved = (await boss.send('put', '/api/admin/refund-policy', { ...newPolicy, code: await freshCode('rm-boss@e2e.example') }).expect(200)).body;
    expect(saved.current).toMatchObject({ version: 2, windowDays: 7, maxWatchedPercent: 10, autoApprove: false });
    expect(saved.items.map((v: any) => v.version)).toEqual([2, 1]);
    expect(await prisma.auditLog.count({ where: { action: 'refund.policy_changed' } })).toBe(1);
    expect((await http.get('/api/refund-policy').expect(200)).body).toMatchObject({ version: 2, windowDays: 7, maxWatchedPercent: 10 });

    // 8. Existing purchases keep their policy: s6 bought under v1, watched 20 % (over v2's 10 %, under v1's 25 %).
    await watch(s6, c6.paid[0]!.id, [[0, 20]], 20);
    const el6 = (await s6.agent.get(`/api/orders/${o6}/refund`).expect(200)).body;
    expect(el6.policy).toMatchObject({ version: 1, windowDays: 14, maxWatchedPercent: 25 });
    expect(el6.lines[0]).toMatchObject({ eligible: true, outcome: 'review' }); // v2 asks for manual approval
    const r6 = await s6.send('post', `/api/orders/${o6}/refund`, {}).expect(200);
    expect(r6.body.status).toBe('pending_review');
    // A new purchase gets v2.
    const s8 = await userAgent('rm-8@e2e.example', ['student']);
    const c8 = await course(teacherRow.id, 'rm-c8', [100]);
    const o8 = await buy(s8, c8.course.id);
    expect((await s8.agent.get(`/api/orders/${o8}/refund`).expect(200)).body.policy).toMatchObject({ version: 2, windowDays: 7, maxWatchedPercent: 10 });

    // 9. Several devices: ranges from two sessions merge into unique seconds, wherever they were played.
    const s9 = await userAgent('rm-9@e2e.example', ['student']);
    const c9 = await course(teacherRow.id, 'rm-c9', [100]);
    await buy(s9, c9.course.id);
    await watch(s9, c9.paid[0]!.id, [[0, 5]], 5); // laptop
    const phone = request.agent(app.getHttpServer());
    const csrf: string = (await phone.get('/api/auth/me')).body.csrf;
    await phone.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: 'rm-9@e2e.example', password: PW }).expect(200);
    await phone.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: await freshCode('rm-9@e2e.example') }).expect(200);
    await phone.put(`/api/lectures/${c9.paid[0]!.id}/progress`).set('X-CSRF-Token', csrf).send({ positionSec: 8, played: [[3, 8]] }).expect(200);
    expect((await prisma.lectureProgress.findFirstOrThrow({ where: { userId: s9.user.id } })).watchedSec).toBe(8);

    // 10. Rewatching and skipping don't add.
    await watch(s9, c9.paid[0]!.id, [[0, 8]], 8);
    await watch(s9, c9.paid[0]!.id, [[90, 92]], 92); // skipped 8 → 90
    expect((await prisma.lectureProgress.findFirstOrThrow({ where: { userId: s9.user.id } })).watchedSec).toBe(10);

    // 11. Incomplete tracking → a person decides (investigation), never an automatic decline.
    const s11 = await userAgent('rm-11@e2e.example', ['student']);
    const c11 = await course(teacherRow.id, 'rm-c11', [100]);
    const o11 = await buy(s11, c11.course.id);
    await prisma.lectureProgress.create({ data: { userId: s11.user.id, lectureId: c11.paid[0]!.id, positionSec: 90, watchedSec: 90, watchedRanges: [] } });
    const r11 = await s11.send('post', `/api/orders/${o11}/refund`, {}).expect(200);
    expect(r11.body.status).toBe('pending_review');
    expect(await prisma.refundRequest.findFirstOrThrow({ where: { orderId: o11 } })).toMatchObject({ status: 'pending', investigation: true });
    const inv = (await boss.agent.get('/api/admin/refund-requests?status=investigation').expect(200)).body;
    expect(inv.items.map((i: any) => i.orderId)).toContain(o11);

    // 12. The Super Admin approves an exception (an automatic decline), with a reason; a plain admin can't.
    const declined3 = await prisma.refundRequest.findFirstOrThrow({ where: { orderId: o3 } });
    expect((await admin.send('post', `/api/admin/refund-requests/${declined3.id}/approve`, { note: 'x' }).expect(403)).body.error.code).toBe('super_admin_only');
    await boss.send('post', `/api/admin/refund-requests/${declined3.id}/approve`, {}).expect(400);
    const ex = await boss.send('post', `/api/admin/refund-requests/${declined3.id}/approve`, { note: 'Duplicate payment confirmed with the bank.' }).expect(200);
    expect(ex.body).toMatchObject({ status: 'approved', paymentStatus: 'succeeded' });
    expect(await prisma.refundRequest.findUniqueOrThrow({ where: { id: declined3.id } })).toMatchObject({ override: true, paymentStatus: 'succeeded' });
    expect(await prisma.auditLog.count({ where: { action: 'refund.exception_approved' } })).toBe(1);

    // 13. The provider fails: nothing is refunded, the request says failed, an admin retries.
    const s13 = await userAgent('rm-13@e2e.example', ['student']);
    const c13 = await course(teacherRow.id, 'rm-c13', [100]);
    const o13 = await buy(s13, c13.course.id);
    await prisma.order.update({ where: { id: o13 }, data: { provider: 'stripe', stripePaymentIntentId: 'pi_e2e_13' } });
    const stripe = app.get(StripeService) as any;
    const realClient = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(stripe), 'client');
    let fail = true;
    Object.defineProperty(stripe, 'client', { configurable: true, get: () => ({ refunds: { create: async () => { if (fail) throw new Error('Your card was declined'); return { id: 're_e2e_13', status: 'succeeded' }; } } }) });
    try {
      const r13 = await s13.send('post', `/api/orders/${o13}/refund`, {}).expect(200);
      // v2 needs manual approval: approve, then the payment fails.
      expect(r13.body.status).toBe('pending_review');
      const rq13 = await prisma.refundRequest.findFirstOrThrow({ where: { orderId: o13 } });
      expect((await boss.send('post', `/api/admin/refund-requests/${rq13.id}/approve`, {}).expect(200)).body.paymentStatus).toBe('failed');
      expect((await prisma.orderLine.findFirstOrThrow({ where: { orderId: o13 } })).refundedAt).toBeNull();
      const failed = (await boss.agent.get('/api/admin/refund-requests?status=failed').expect(200)).body;
      expect(failed.items[0]).toMatchObject({ id: rq13.id, paymentStatus: 'failed', needsAction: true });
      fail = false;
      expect((await boss.send('post', `/api/admin/refund-requests/${rq13.id}/retry-payment`).expect(200)).body.paymentStatus).toBe('succeeded');
      expect((await prisma.orderLine.findFirstOrThrow({ where: { orderId: o13 } })).refundedAt).toBeInstanceOf(Date);
    } finally {
      delete stripe.client;
      if (realClient) Object.defineProperty(stripe, 'client', realClient);
    }

    // 14. Duplicate requests: one open request per order.
    await s6.send('post', `/api/orders/${o6}/refund`, {}).expect(409);
    await s1.send('post', `/api/orders/${o1}/refund`, {}).expect(400); // already refunded: nothing to refund

    // The dashboard shows the facts the owner listed.
    const all = (await boss.agent.get('/api/admin/refund-requests').expect(200)).body;
    const row = all.items.find((i: any) => i.orderId === o1);
    expect(row).toMatchObject({ user: { email: 'rm-1@e2e.example' }, amountCents: 2000, policyVersion: 1, paymentStatus: 'succeeded', lines: [{ instructor: 'Teacher' }], payment: { provider: 'test' } });
    expect(all.counts).toMatchObject({ all: expect.any(Number), refunded: expect.any(Number), failed: expect.any(Number), investigation: 1 });
  }, 240_000);
});
