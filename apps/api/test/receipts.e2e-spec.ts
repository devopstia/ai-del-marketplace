/**
 * End to end: receipts (owner 2026-11-27, "Corporate Professional"; docs/RECEIPTS.md). Receipt numbers assigned once at
 * payment, private access (buyer and admins with orders.view only), the PDF, refunds on the receipt, admin search by
 * receipt number and order reference, company details, resend. Same database setup as refunds.e2e-spec.ts.
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
import { TERMS_VERSION } from '../src/commerce/terms';
import { JobsService } from '../src/common/jobs';
import { ALL_ADMIN_PERMISSIONS } from '../src/common/permissions';
import { PrismaService } from '../src/common/prisma.service';
import { seal } from '../src/common/seal';
import { resetEnvCache } from '../src/config/env';

const API_DIR = join(__dirname, '..');
const ROOT_ENV = join(API_DIR, '..', '..', '.env');
const TERMS = { acceptTerms: true, termsVersion: TERMS_VERSION };

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

describe('e2e: receipts', () => {
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
      console.warn('\n[e2e receipts] SKIPPED: Postgres not reachable. Run `docker compose up -d postgres redis` first.\n');
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

  async function course(teacherId: string, slug: string, priceCents: number, title?: string) {
    const cat = (await prisma.category.findFirst()) ?? (await prisma.category.create({ data: { slug: 'receipts-e2e', name: 'Receipts' } }));
    const c = await prisma.course.create({ data: { slug, title: title ?? `Course ${slug}`, instructorId: teacherId, categoryId: cat.id, priceCents, status: 'published', publishedAt: new Date(), description: 'd' } });
    const section = await prisma.section.create({ data: { courseId: c.id, title: 'S1', position: 0 } });
    await prisma.lecture.create({ data: { sectionId: section.id, title: 'L1', position: 0, type: 'video', durationSec: 600 } });
    return c;
  }

  it('numbers, privacy, PDF, refunds, search, company details and resend', async () => {
    if (!available) return;
    const teacherRow = await prisma.user.create({ data: { email: 'rc-teacher@e2e.example', name: 'Teacher', passwordHash: 'x', roles: ['student', 'instructor'] } });
    await prisma.instructorProfile.create({ data: { userId: teacherRow.id, status: 'approved' } });
    const boss = await userAgent('rc-boss@e2e.example', ['student', 'admin', 'super_admin']);
    const admin = await userAgent('rc-admin@e2e.example', ['student', 'admin']);
    const buyer = await userAgent('rc-buyer@e2e.example', ['student']);
    const other = await userAgent('rc-other@e2e.example', ['student']);
    const a = await course(teacherRow.id, 'rc-a', 1500, 'AI-Powered DevOps Automation with n8n');
    const b = await course(teacherRow.id, 'rc-b', 1999, 'AI for DevOps: from the vocabulary of AI to agents in production on AWS and Azure');

    // A pending order has no receipt.
    await buyer.send('post', '/api/cart', { courseId: a.id }).expect(201);
    await buyer.send('post', '/api/cart', { courseId: b.id }).expect(201);
    const co = await buyer.send('post', '/api/checkout', { immediateAccessConsent: true, ...TERMS }).expect(200);
    const orderId: string = co.body.orderId;
    await buyer.agent.get(`/api/orders/${orderId}/receipt`).expect(404);

    // Paid: one receipt number, kept on a duplicate confirmation.
    sendEmail.mockClear();
    await buyer.send('post', `/api/dev/test-payments/${orderId}/complete`).expect(200);
    await buyer.send('post', `/api/dev/test-payments/${orderId}/complete`).expect(200);
    const r = (await buyer.agent.get(`/api/orders/${orderId}/receipt`).expect(200)).body;
    expect(r.receiptNumber).toMatch(/^DEL-RCP-\d{4}-\d{6}$/);
    expect(r.orderRef).toMatch(/^ORD-[0-9A-Z]{8}$/);
    expect(r).toMatchObject({ status: 'paid', statusLabel: 'Paid', paymentMethod: 'Test payment', currency: 'USD', subtotalCents: 3499, discountCents: 0, totalCents: 3499, netCents: 3499 });
    expect(r.customer).toEqual({ name: 'rc-buyer', email: 'rc-buyer@e2e.example' });
    expect(r.lines.map((l: any) => l.amountCents).sort()).toEqual([1500, 1999]);
    const again = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(again.receiptNumber).toBe(r.receiptNumber);
    // The confirmation email carries the receipt number and the (sign-in) link.
    const mail = sendEmail.mock.calls.map((c) => c[0]).find((j: any) => j.template === 'order-receipt');
    expect(mail?.data).toMatchObject({ orderId, receiptNumber: r.receiptNumber });
    expect(sendEmail.mock.calls.filter((c) => c[0].template === 'order-receipt')).toHaveLength(1);

    // Prices changing later never change the receipt.
    await prisma.course.update({ where: { id: a.id }, data: { priceCents: 9999 } });
    expect((await buyer.agent.get(`/api/orders/${orderId}/receipt`).expect(200)).body.totalCents).toBe(3499);

    // PDF: the buyer's, Letter and A4.
    const pdf = await buyer.agent.get(`/api/orders/${orderId}/receipt.pdf`).buffer(true).parse((res, cb) => { const d: Buffer[] = []; res.on('data', (x: Buffer) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); }).expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain(`${r.receiptNumber}.pdf`);
    expect(pdf.headers['cache-control']).toContain('no-store');
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    await buyer.agent.get(`/api/orders/${orderId}/receipt.pdf?paper=a4`).expect(200);
    await buyer.agent.get(`/api/orders/${orderId}/receipt.pdf?paper=legal`).expect(400);

    // Private: another learner and signed-out visitors get nothing; admins only through the admin route.
    await other.agent.get(`/api/orders/${orderId}/receipt`).expect(404);
    await other.agent.get(`/api/orders/${orderId}/receipt.pdf`).expect(404);
    await request(app.getHttpServer()).get(`/api/orders/${orderId}/receipt`).expect(401);
    await request(app.getHttpServer()).get(`/api/orders/${orderId}/receipt.pdf`).expect(401);
    await buyer.agent.get(`/api/admin/orders/${orderId}/receipt`).expect(403);
    expect((await admin.agent.get(`/api/admin/orders/${orderId}/receipt`).expect(200)).body.receiptNumber).toBe(r.receiptNumber);
    await admin.agent.get(`/api/admin/orders/${orderId}/receipt.pdf`).expect(200);

    // Admin search by receipt number and by order reference.
    for (const term of [r.receiptNumber, r.orderRef, r.orderRef.toLowerCase()]) {
      const found = (await admin.agent.get(`/api/admin/orders?q=${encodeURIComponent(term)}`).expect(200)).body;
      expect(found.items.map((o: any) => o.id)).toContain(orderId);
    }

    // A refund shows on the receipt; the original lines stay.
    const lines = await prisma.orderLine.findMany({ where: { orderId } });
    const bLine = lines.find((l) => l.courseId === b.id)!;
    await admin.send('post', `/api/admin/orders/${orderId}/refund`, { lineIds: [bLine.id] }).expect(200);
    const after = (await buyer.agent.get(`/api/orders/${orderId}/receipt`).expect(200)).body;
    expect(after).toMatchObject({ status: 'partially_refunded', statusLabel: 'Paid · partly refunded', totalCents: 3499, refundedCents: 1999, netCents: 1500 });
    expect(after.refunds).toHaveLength(1);
    expect(after.receiptNumber).toBe(r.receiptNumber);

    // Company details: only a super admin sets them; empty address stays off the receipt.
    expect(r.company).toMatchObject({ legalName: 'DevOps Easy Learning', address: [] });
    await admin.send('put', '/api/admin/settings/company', { address: 'x' }).expect(403);
    await boss.send('put', '/api/admin/settings/company', { legalName: 'DevOps Easy Learning LLC', address: '1 Sample Street\nSample City', taxId: 'TAX-123' }).expect(200);
    expect((await buyer.agent.get(`/api/orders/${orderId}/receipt`).expect(200)).body.company).toMatchObject({ legalName: 'DevOps Easy Learning LLC', address: ['1 Sample Street', 'Sample City'], taxId: 'TAX-123' });
    await boss.send('put', '/api/admin/settings/company', { supportEmail: 'not-an-email' }).expect(400);
    expect(await prisma.auditLog.count({ where: { action: 'settings.company_updated' } })).toBe(1);

    // Resend: audited, a new email each time.
    sendEmail.mockClear();
    expect((await admin.send('post', `/api/admin/orders/${orderId}/receipt/resend`).expect(200)).body).toEqual({ sent: true, to: 'rc-buyer@e2e.example' });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'rc-buyer@e2e.example', template: 'order-receipt' }));
    expect(await prisma.auditLog.count({ where: { action: 'order.receipt_resent', targetId: orderId } })).toBe(1);
    await buyer.send('post', `/api/admin/orders/${orderId}/receipt/resend`).expect(403);
  });
});
