/**
 * e2e (owner 2026-11-28, improvements #4 and #8): the checkout return-page safety net, and the free-course learning
 * emails, completion email and opt-out. Runs against a real Postgres like the other e2e suites (E2E_DATABASE_URL);
 * Stripe is a fake client on the real StripeService, so no network call is made.
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
import { StripeService } from '../src/commerce/stripe.service';
import { WebhooksService } from '../src/commerce/webhooks.service';
import { JobsService } from '../src/common/jobs';
import { PrismaService } from '../src/common/prisma.service';
import { seal } from '../src/common/seal';
import { resetEnvCache } from '../src/config/env';
import { optOutToken, sendLearningNudges } from '../src/learning/nudges';

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

describe('e2e: checkout safety net and free-course growth', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  const PW = 'Long-enough-pw1';
  const MFA = newSecret();
  const sendEmail = jest.fn();
  // Fake Stripe: one session per test, controlled by `session`.
  let session: Record<string, any> = {};
  const stripeClient = {
    checkout: { sessions: { retrieve: jest.fn(async () => session) } },
    paymentIntents: { retrieve: jest.fn(async () => ({ latest_charge: 'ch_e2e' })) },
    charges: { retrieve: jest.fn(async () => { throw new Error('fee later'); }) },
  };

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) { console.warn('\n[e2e growth] SKIPPED: Postgres not reachable.\n'); return; }
    const env = rootEnv();
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', DEV_TEST_PAYMENTS: 'true', MFA_REQUIRED: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: env.S3_ACCESS_KEY ?? 'test', S3_SECRET_KEY: env.S3_SECRET_KEY ?? 'test-secret', WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JobsService).useValue({ processVideo: jest.fn(), packageHls: jest.fn(), sendEmail, settleFee: jest.fn(), scheduleRecurring: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const stripe = app.get(StripeService);
    Object.defineProperty(stripe, 'configured', { get: () => true });
    Object.defineProperty(stripe, 'client', { get: () => stripeClient });
    available = true;
  });
  afterAll(async () => { await app?.close(); });

  async function student(email: string) {
    const user = await prisma.user.create({ data: { email, name: 'Grace Hopper', passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles: ['student'], mfaSecret: seal('mfa', MFA), mfaEnabledAt: new Date() } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200);
    await prisma.user.update({ where: { id: user.id }, data: { mfaLastStep: null } });
    await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: codeAt(MFA, stepAt()) }).expect(200);
    const send = (m: 'post' | 'put', url: string, body?: object) => agent[m](url).set('X-CSRF-Token', csrf).send(body ?? {});
    return { user, agent, send };
  }

  let seq = 0;
  async function course(priceCents: number, extra: { articleMd?: string; slug?: string } = {}) {
    const n = ++seq;
    const teacher = await prisma.user.create({ data: { email: `t${n}@growth.e2e`, name: `Teacher ${n}`, roles: ['student', 'instructor'] } });
    const c = await prisma.course.create({ data: { title: `Growth course ${n}`, slug: extra.slug ?? `growth-course-${n}`, instructorId: teacher.id, status: 'published', priceCents, publishedAt: new Date() } });
    const s = await prisma.section.create({ data: { courseId: c.id, title: 'One', position: 0 } });
    const l1 = await prisma.lecture.create({ data: { sectionId: s.id, title: 'First lesson', position: 0, type: 'article', articleMd: 'Hello' } });
    if (extra.articleMd) await prisma.lecture.create({ data: { sectionId: s.id, title: 'Next steps', position: 1, type: 'article', articleMd: extra.articleMd } });
    return { course: c, lecture: l1 };
  }

  async function pendingOrder(userId: string, c: { id: string; instructorId: string }, total = 2999, sessionId = `cs_e2e_${++seq}`) {
    return prisma.order.create({ data: { userId, status: 'pending', provider: 'stripe', totalCents: total, currency: 'usd', stripeCheckoutSessionId: sessionId, lines: { create: [{ courseId: c.id, instructorId: c.instructorId, priceCents: total, commissionBps: 10000, instructorShareCents: 0 }] } } });
  }
  const paidSession = (o: { id: string; stripeCheckoutSessionId: string | null; totalCents: number }, over: Record<string, any> = {}) => ({ id: o.stripeCheckoutSessionId, payment_status: 'paid', amount_total: o.totalCents, currency: 'usd', metadata: { orderId: o.id }, payment_intent: `pi_${o.id.slice(0, 8)}`, ...over });

  it('#4 confirm first: fulfils once, the later webhook changes nothing', async () => {
    if (!available) return;
    const s = await student('confirm-first@growth.e2e');
    const { course: c } = await course(2999);
    const o = await pendingOrder(s.user.id, c);
    session = paidSession(o);
    const r = await s.send('post', `/api/orders/${o.id}/confirm`, { sessionId: o.stripeCheckoutSessionId }).expect(200);
    expect(r.body).toEqual({ orderId: o.id, status: 'paid', confirmed: true });
    await app.get(WebhooksService).handle({ id: `evt_${o.id}`, type: 'checkout.session.completed', data: { object: session } });
    expect(await prisma.enrollment.count({ where: { userId: s.user.id, courseId: c.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'order.paid', targetId: o.id } })).toBe(1);
    const paid = await prisma.auditLog.findFirst({ where: { action: 'order.paid', targetId: o.id } });
    expect((paid!.meta as any).via).toBe('checkout_confirm');
    expect(sendEmail.mock.calls.filter(([j]) => j.template === 'order-receipt' && j.dedupeKey === `receipt:${o.id}`)).toHaveLength(1);
  });

  it('#4 webhook first: confirm is a no-op and does not ask Stripe', async () => {
    if (!available) return;
    const s = await student('webhook-first@growth.e2e');
    const { course: c } = await course(2999);
    const o = await pendingOrder(s.user.id, c);
    session = paidSession(o);
    await app.get(WebhooksService).handle({ id: `evt_${o.id}`, type: 'checkout.session.completed', data: { object: session } });
    stripeClient.checkout.sessions.retrieve.mockClear();
    expect((await s.send('post', `/api/orders/${o.id}/confirm`, {}).expect(200)).body).toEqual({ orderId: o.id, status: 'paid', confirmed: false });
    expect(stripeClient.checkout.sessions.retrieve).not.toHaveBeenCalled();
    expect(await prisma.auditLog.count({ where: { action: 'order.paid', targetId: o.id } })).toBe(1);
  });

  it('#4 unpaid stays pending; mismatches are refused and logged; another user gets 404', async () => {
    if (!available) return;
    const s = await student('mismatch@growth.e2e');
    const other = await student('stranger@growth.e2e');
    const { course: c } = await course(2999);
    const o = await pendingOrder(s.user.id, c);
    session = paidSession(o, { payment_status: 'unpaid' });
    expect((await s.send('post', `/api/orders/${o.id}/confirm`, {}).expect(200)).body.status).toBe('pending');
    session = paidSession(o, { amount_total: 100 });
    expect((await s.send('post', `/api/orders/${o.id}/confirm`, {}).expect(409)).body.error.code).toBe('amount_mismatch');
    expect((await s.send('post', `/api/orders/${o.id}/confirm`, { sessionId: 'cs_forged' }).expect(409)).body.error.code).toBe('session_mismatch');
    expect(await prisma.auditLog.count({ where: { action: 'order.confirm_refused', targetId: o.id } })).toBe(2);
    await other.send('post', `/api/orders/${o.id}/confirm`, {}).expect(404);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe('pending');
    await request(app.getHttpServer()).post(`/api/orders/${o.id}/confirm`).send({}).expect((res) => expect([401, 403]).toContain(res.status));
  });

  it('#8 free enrolment: welcome email, opt-out link stops the series, completion email with certificate and rating ask', async () => {
    if (!available) return;
    const paid = await course(4999, { slug: 'growth-paid-next' });
    const { course: free, lecture } = await course(0, { articleMd: 'Next: [the paid course](https://example.test/courses/growth-paid-next)' });
    const s = await student('free-learner@growth.e2e');
    // A free enrolment (the checkout path is covered by the app suite; the emails are what this test checks).
    await prisma.enrollment.create({ data: { userId: s.user.id, courseId: free.id, source: 'free' } });

    const jobs = { sendEmail: jest.fn() } as any;
    await sendLearningNudges(prisma, jobs, new Date());
    expect(jobs.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'free-learner@growth.e2e', template: 'learn-welcome', dedupeKey: `nudge:welcome:${s.user.id}:${free.id}` }));
    await sendLearningNudges(prisma, jobs, new Date());
    expect(jobs.sendEmail).toHaveBeenCalledTimes(1); // once

    // Day 7: the paid course the free course links to.
    const day7 = new Date(Date.now() + 7.5 * 86_400_000);
    await sendLearningNudges(prisma, jobs, day7);
    expect(jobs.sendEmail).toHaveBeenLastCalledWith(expect.objectContaining({ template: 'learn-next-courses', data: expect.objectContaining({ courses: [expect.objectContaining({ slug: paid.course.slug })] }) }));

    // One-click opt-out (signed link, no sign-in) stops the series; a bad token is refused.
    await request(app.getHttpServer()).post('/api/email/learning-emails/link').send({ u: s.user.id, t: 'x'.repeat(32), on: false }).expect(403);
    await request(app.getHttpServer()).post('/api/email/learning-emails/link').send({ u: s.user.id, t: optOutToken(s.user.id), on: false }).expect(200, { enabled: false });
    expect((await s.agent.get('/api/email/learning-emails').expect(200)).body).toEqual({ enabled: false });
    await prisma.enrollment.update({ where: { userId_courseId: { userId: s.user.id, courseId: free.id } }, data: { nudgesSent: [] } });
    jobs.sendEmail.mockClear();
    await sendLearningNudges(prisma, jobs, new Date());
    expect(jobs.sendEmail).not.toHaveBeenCalled();

    // Completing every lesson issues the certificate and sends one completion email with the rating ask.
    sendEmail.mockClear();
    const lectures = await prisma.lecture.findMany({ where: { section: { courseId: free.id } } });
    for (const l of lectures) await s.send('put', `/api/lectures/${l.id}/progress`, { positionSec: 0, completed: true }).expect(200);
    const done = sendEmail.mock.calls.map(([j]) => j).filter((j) => j.template === 'course-completed');
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ to: 'free-learner@growth.e2e', data: expect.objectContaining({ reviewed: false, code: expect.stringMatching(/^DEL-/), linkedInUrl: expect.stringContaining('linkedin.com') }) });
    // Asking for the certificate again doesn't send another email.
    await s.send('post', `/api/courses/${free.slug}/certificate`).expect((res) => expect([200, 201]).toContain(res.status));
    expect(sendEmail.mock.calls.filter(([j]) => j.template === 'course-completed')).toHaveLength(1);
    void lecture;
  });
});
