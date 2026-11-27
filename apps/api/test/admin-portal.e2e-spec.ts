/**
 * End to end: Super Admin portal (owner 2026-11-26; docs/SUPER_ADMIN.md): role management, account help and account
 * states, course archive and 30-day soft deletion. Same database setup as app.e2e-spec.ts (a separate database
 * `marketplace_e2e` on the Docker Compose Postgres, truncated first); skipped when unreachable.
 *
 * Step-up codes: every demo account shares one authenticator seed and a code is accepted once per account, so before a
 * second step-up in the same 30 seconds the test clears that account's last-used step (the code is still checked).
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
import { AuditService } from '../src/common/audit.service';
import { ALL_ADMIN_PERMISSIONS } from '../src/common/permissions';
import { PrismaService } from '../src/common/prisma.service';
import { StorageService } from '../src/common/storage.service';
import { seal } from '../src/common/seal';
import { resetEnvCache } from '../src/config/env';
import { purgeDueCourses } from '../src/admin/course-lifecycle';

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

describe('e2e: super admin portal', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  const PW = 'Long-enough-pw1';
  const MFA_SEED = newSecret();
  const sentEmails: { to: string; template: string }[] = [];

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) {
      console.warn('\n[e2e admin portal] SKIPPED: Postgres not reachable. Run `docker compose up -d postgres redis` first.\n');
      return;
    }
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', DEV_TEST_PAYMENTS: 'true', MFA_REQUIRED: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JobsService).useValue({ processVideo: jest.fn(), packageHls: jest.fn(), sendEmail: jest.fn(async (j: { to: string; template: string }) => { sentEmails.push(j); }) })
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    available = true;
  });

  afterAll(async () => { await app?.close(); });

  const code = () => codeAt(MFA_SEED, stepAt());
  /** Allow one more step-up from this account in the same 30 seconds (the code itself is still verified). */
  const freshStep = (userId: string) => prisma.user.update({ where: { id: userId }, data: { mfaLastStep: null } });

  async function signIn(email: string, password = PW) {
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    const login = await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password });
    if (login.status === 200 && login.body.mfa === 'verify') {
      const u = await prisma.user.findUniqueOrThrow({ where: { email } });
      await freshStep(u.id);
      await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: code() }).expect(200);
    }
    const send = (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: object) => agent[method](url).set('X-CSRF-Token', csrf).send(body ?? {});
    return { agent, send, login };
  }

  async function userAgent(email: string, roles: any[], adminPermissions: string[] = ALL_ADMIN_PERMISSIONS) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0], passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles, adminPermissions: roles.includes('admin') ? adminPermissions : [], mfaSecret: seal('mfa', MFA_SEED), mfaEnabledAt: new Date(), emailVerifiedAt: new Date() } });
    return { user, ...(await signIn(email)) };
  }

  async function course(instructorId: string, slug: string, priceCents = 2000, status: 'published' | 'draft' = 'published') {
    const c = await prisma.course.create({ data: { slug, title: `Course ${slug}`, instructorId, priceCents, status, publishedAt: status === 'published' ? new Date() : null, description: 'd' } });
    const section = await prisma.section.create({ data: { courseId: c.id, title: 'S1', position: 0 } });
    await prisma.lecture.create({ data: { sectionId: section.id, title: `${slug} L1`, position: 0, type: 'video', durationSec: 600 } });
    return c;
  }

  async function paidEnrollment(userId: string, c: { id: string; instructorId: string; priceCents: number }, expiresAt: Date) {
    const order = await prisma.order.create({ data: { userId, status: 'paid', totalCents: c.priceCents, provider: 'test', paidAt: new Date() } });
    const line = await prisma.orderLine.create({ data: { orderId: order.id, courseId: c.id, instructorId: c.instructorId, priceCents: c.priceCents, commissionBps: 2000, instructorShareCents: Math.round(c.priceCents * 0.8) } });
    await prisma.enrollment.create({ data: { userId, courseId: c.id, source: 'purchase', orderLineId: line.id, accessExpiresAt: expiresAt } });
    return { order, line };
  }

  it('role management: Super Admin locked; capabilities and the admin ceiling are enforced on the next request', async () => {
    if (!available) return;
    const sup = await userAgent('roles-super@e2e.example', ['student', 'admin', 'super_admin']);
    const admin = await userAgent('roles-admin@e2e.example', ['student', 'admin'], ['users.view', 'orders.view']);
    const student = await userAgent('roles-student@e2e.example', ['student']);
    const teacher = await prisma.user.create({ data: { email: 'roles-teacher@e2e.example', name: 'T', passwordHash: 'x', roles: ['student', 'instructor'] } });
    const c = await course(teacher.id, 'roles-course', 0);
    await prisma.enrollment.create({ data: { userId: student.user.id, courseId: c.id, source: 'free' } });

    const roles = (await admin.agent.get('/api/admin/people/roles').expect(200)).body.roles;
    expect(roles.map((r: any) => r.key)).toEqual(['super_admin', 'admin', 'instructor', 'student']);
    expect(roles[0]).toMatchObject({ system: true });
    expect(roles[0].permissions).toBeUndefined();

    const body = { adminAllowed: ALL_ADMIN_PERMISSIONS.filter((p) => p !== 'orders.view'), adminDefaults: ['users.view'], disabled: ['student.reviews.write'] };
    await admin.send('put', '/api/admin/people/roles', body).expect(403);
    await student.send('put', '/api/admin/people/roles', body).expect(403);
    expect((await sup.send('put', '/api/admin/people/roles', body).expect(400)).body.error.code).toBe('step_up_required');
    await freshStep(sup.user.id);
    await sup.send('put', '/api/admin/people/roles', { ...body, code: code() }).expect(200);

    // Withheld from the Admin role: refused although this admin was granted it; the menu data follows.
    await admin.agent.get('/api/admin/orders').expect(403);
    expect((await admin.agent.get('/api/auth/me').expect(200)).body.user.adminPermissions).toEqual(['users.view']);
    // Students can't write reviews while it's off.
    expect((await student.send('post', `/api/courses/${c.slug}/reviews`, { rating: 5, body: 'Great course, thanks a lot!' }).expect(403)).body.error.code).toBe('capability_disabled');

    await freshStep(sup.user.id);
    await sup.send('put', '/api/admin/people/roles', { adminAllowed: ALL_ADMIN_PERMISSIONS, adminDefaults: ['users.view'], disabled: [], code: code() }).expect(200);
    await admin.agent.get('/api/admin/orders').expect(200);
    const rev = await student.send('post', `/api/courses/${c.slug}/reviews`, { rating: 5, body: 'Great course, thanks a lot!' });
    expect(rev.status).toBeLessThan(300);
    expect(await prisma.auditLog.count({ where: { action: 'roles.permissions_changed', actorId: sup.user.id } })).toBe(2);
  });

  it('account help: profile, email change, timed suspension, temporary password, recovery link, sessions, delete', async () => {
    if (!available) return;
    const sup = await userAgent('acct-super@e2e.example', ['student', 'admin', 'super_admin']);
    const helper = await userAgent('acct-helper@e2e.example', ['student', 'admin'], ['users.view', 'users.manage']);
    const target = await userAgent('acct-target@e2e.example', ['student']);
    const id = target.user.id;

    // Name: users.manage is enough; email: super admin + code; a taken address is refused.
    await helper.send('patch', `/api/admin/people/users/${id}/profile`, { name: 'Target Person' }).expect(200);
    await helper.send('put', `/api/admin/people/users/${id}/email`, { email: 'new-target@e2e.example' }).expect(403);
    await freshStep(sup.user.id);
    await sup.send('put', `/api/admin/people/users/${id}/email`, { email: 'acct-helper@e2e.example', code: code() }).expect(409);
    await freshStep(sup.user.id);
    const changed = (await sup.send('put', `/api/admin/people/users/${id}/email`, { email: 'new-target@e2e.example', code: code() }).expect(200)).body;
    expect(changed).toMatchObject({ email: 'new-target@e2e.example', emailVerifiedAt: null });
    expect(sentEmails.some((e) => e.to === 'acct-target@e2e.example' && e.template === 'security-email-changed')).toBe(true);
    expect(sentEmails.some((e) => e.to === 'new-target@e2e.example' && e.template === 'verify-email')).toBe(true);

    // Timed suspension: signed out at once, sign-in refused, and it ends by itself.
    await helper.send('post', `/api/admin/people/users/${id}/status`, { status: 'suspended' }).expect(400);
    const until = new Date(Date.now() + 3600_000);
    const sus = (await helper.send('post', `/api/admin/people/users/${id}/status`, { status: 'suspended', reason: 'Shared their account', until: until.toISOString() }).expect(200)).body;
    expect(sus).toMatchObject({ status: 'suspended', statusReason: 'Shared their account' });
    await target.agent.get('/api/me/learning').expect(401);
    expect((await signIn('new-target@e2e.example')).login.status).toBe(403);
    await prisma.user.update({ where: { id }, data: { suspendedUntil: new Date(Date.now() - 1000) } });
    const back = await signIn('new-target@e2e.example');
    expect(back.login.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).status).toBe('active');

    // Disabled: no end date; only a super admin may disable an admin; the last super admin is protected.
    await helper.send('post', `/api/admin/people/users/${id}/status`, { status: 'disabled', reason: 'Asked to pause' }).expect(200);
    await helper.send('post', `/api/admin/people/users/${id}/status`, { status: 'active' }).expect(200);
    await helper.send('post', `/api/admin/people/users/${sup.user.id}/status`, { status: 'disabled', reason: 'x x x' }).expect(403);

    // Reset email and verification email on their behalf.
    await helper.send('post', `/api/admin/people/users/${id}/password-reset`).expect(200);
    expect(sentEmails.filter((e) => e.to === 'new-target@e2e.example' && e.template === 'password-reset').length).toBe(1);
    await helper.send('post', `/api/admin/people/users/${id}/verification`).expect(200);

    // Recovery link: super admin, code, reason; single use; shown once.
    await helper.send('post', `/api/admin/people/users/${id}/recovery-link`, { reason: 'Video call' }).expect(403);
    await freshStep(sup.user.id);
    const link = (await sup.send('post', `/api/admin/people/users/${id}/recovery-link`, { reason: 'Video call', code: code() }).expect(200)).body;
    const token = new URL(link.link).searchParams.get('token')!;
    const http = request(app.getHttpServer());
    const csrf = (await http.get('/api/auth/me')).body.csrf;
    const anon = request.agent(app.getHttpServer());
    const anonCsrf = (await anon.get('/api/auth/me')).body.csrf;
    await anon.post('/api/auth/password/reset').set('X-CSRF-Token', anonCsrf).send({ token, password: 'Recovered-pass-42' }).expect(200);
    await anon.post('/api/auth/password/reset').set('X-CSRF-Token', anonCsrf).send({ token, password: 'Recovered-pass-43' }).expect(400);
    expect(csrf).toBeTruthy();

    // Temporary password: shown once, every route but the password change refused until they pick their own.
    await freshStep(sup.user.id);
    const temp = (await sup.send('post', `/api/admin/people/users/${id}/temporary-password`, { reason: 'Lost email access', code: code() }).expect(200)).body;
    expect(temp.password).toMatch(/^[A-Za-z0-9-]{19}$/);
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: 'user.temporary_password_set', targetId: id } })).meta).not.toHaveProperty('password');
    const withTemp = await signIn('new-target@e2e.example', temp.password);
    expect((await withTemp.agent.get('/api/me/learning').expect(403)).body.error.code).toBe('password_change_required');
    expect((await withTemp.agent.get('/api/auth/me').expect(200)).body.user.mustChangePassword).toBe(true);
    await withTemp.send('post', '/api/auth/password', { currentPassword: temp.password, newPassword: 'My-own-pass-2026' }).expect(200);
    await withTemp.agent.get('/api/me/learning').expect(200);

    // Sign out everywhere.
    const revoked = (await helper.send('post', `/api/admin/people/users/${id}/sessions/revoke`).expect(200)).body;
    expect(revoked.revoked).toBeGreaterThanOrEqual(1);
    await withTemp.agent.get('/api/me/learning').expect(401);

    // Delete: super admin, email typed back, code; personal data gone, orders kept, can't sign in.
    const teacher = await prisma.user.create({ data: { email: 'acct-teacher@e2e.example', name: 'Teacher', passwordHash: 'x', roles: ['student', 'instructor'] } });
    const c = await course(teacher.id, 'acct-course');
    const { order } = await paidEnrollment(id, c, new Date(Date.now() + 300 * 86_400_000));
    await sup.send('post', `/api/admin/people/users/${id}/delete`, { reason: 'Their request', confirmEmail: 'wrong@e2e.example' }).expect(400);
    await freshStep(sup.user.id);
    await sup.send('post', `/api/admin/people/users/${teacher.id}/delete`, { reason: 'Their request', confirmEmail: 'acct-teacher@e2e.example', code: code() }).expect(409);
    await freshStep(sup.user.id);
    await sup.send('post', `/api/admin/people/users/${id}/delete`, { reason: 'Their request', confirmEmail: 'new-target@e2e.example', code: code() }).expect(200);
    const gone = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(gone).toMatchObject({ status: 'deleted', name: 'Deleted user', passwordHash: null, mfaSecret: null });
    expect(gone.email).toBe(`deleted-${id}@deleted.invalid`);
    expect(await prisma.order.count({ where: { id: order.id } })).toBe(1);
    expect((await signIn('new-target@e2e.example', 'My-own-pass-2026')).login.status).toBeGreaterThanOrEqual(400);
    // Hidden from the default user list, found under Deleted.
    expect((await helper.agent.get('/api/admin/people/users?q=deleted-').expect(200)).body.items).toHaveLength(0);
    expect((await helper.agent.get('/api/admin/people/users?status=deleted').expect(200)).body.items.map((u: any) => u.id)).toContain(id);
    expect(await prisma.auditLog.count({ where: { targetId: id, action: { in: ['user.email_changed', 'user.suspended', 'user.disabled', 'user.recovery_link_created', 'user.temporary_password_set', 'user.sessions_revoked', 'user.deleted'] } } })).toBe(7);
  });

  it('courses: edit, feature, archive and restore, 30-day deletion that waits for paid access, purge keeps records', async () => {
    if (!available) return;
    const sup = await userAgent('course-super@e2e.example', ['student', 'admin', 'super_admin']);
    const reviewer = await userAgent('course-reviewer@e2e.example', ['student', 'admin'], ['courses.review']);
    const teacher = await userAgent('course-teacher@e2e.example', ['student', 'instructor']);
    await prisma.instructorProfile.create({ data: { userId: teacher.user.id, status: 'approved' } });
    const learner = await userAgent('course-learner@e2e.example', ['student']);
    const http = request(app.getHttpServer());
    const a = await course(teacher.user.id, 'admin-course-a', 4900);
    const b = await course(teacher.user.id, 'admin-course-b', 1900);
    const { line } = await paidEnrollment(learner.user.id, a, new Date(Date.now() + 200 * 86_400_000));

    // Edit (super admin only), instructor stays the owner.
    await reviewer.send('patch', `/api/admin/courses/${a.id}`, { title: 'Nope' }).expect(403);
    await sup.send('patch', `/api/admin/courses/${a.id}`, { title: 'Course A, renamed by DEL', priceCents: 5900, reason: 'Typo' }).expect(200);
    const edited = await prisma.course.findUniqueOrThrow({ where: { id: a.id } });
    expect(edited).toMatchObject({ title: 'Course A, renamed by DEL', priceCents: 5900, instructorId: teacher.user.id });

    // Feature: leads the popular order.
    await sup.send('post', `/api/admin/courses/${b.id}/feature`, { on: true }).expect(200);
    expect((await http.get('/api/courses?sort=popular').expect(200)).body.items[0].slug).toBe('admin-course-b');

    // Archive: off the catalogue and out of carts; the learner keeps access; the instructor can't resubmit it.
    await sup.send('post', `/api/admin/courses/${a.id}/archive`, { reason: '' }).expect(400);
    const archived = (await sup.send('post', `/api/admin/courses/${a.id}/archive`, { reason: 'Outdated, will refresh' }).expect(200)).body;
    expect(archived).toMatchObject({ lifecycle: 'archived', status: 'unpublished' });
    await http.get('/api/courses/admin-course-a').expect(404);
    await learner.agent.get('/api/me/courses/admin-course-a').expect(200);
    expect((await teacher.send('post', `/api/instructor/courses/${a.id}/submit`).expect(409)).body.error.code).toBe('course_archived');
    expect((await reviewer.agent.get('/api/admin/courses?view=archived').expect(200)).body.items.map((c: any) => c.id)).toEqual([a.id]);
    expect((await reviewer.agent.get('/api/admin/courses').expect(200)).body.items.map((c: any) => c.id)).not.toContain(a.id);

    // Restore: back to published.
    expect((await sup.send('post', `/api/admin/courses/${a.id}/restore`).expect(200)).body).toMatchObject({ lifecycle: 'active', status: 'published' });

    // Deletion: title typed back + code; archived now, 30 days left; learners counted.
    await sup.send('post', `/api/admin/courses/${a.id}/delete`, { reason: 'Retired', confirmTitle: 'wrong' }).expect(400);
    await freshStep(sup.user.id);
    const del = (await sup.send('post', `/api/admin/courses/${a.id}/delete`, { reason: 'Retired', confirmTitle: 'Course A, renamed by DEL', code: code() }).expect(200)).body;
    expect(del).toMatchObject({ lifecycle: 'deleting', daysLeft: 30, learners: { paidAccessRunning: 1 } });
    await sup.send('post', `/api/admin/courses/${a.id}/cancel-deletion`).expect(200);
    await freshStep(sup.user.id);
    await sup.send('post', `/api/admin/courses/${a.id}/delete`, { reason: 'Retired', confirmTitle: 'Course A, renamed by DEL', code: code() }).expect(200);

    // Date passed but a paid year is still running: the purge waits.
    await prisma.course.update({ where: { id: a.id }, data: { deleteAfter: new Date(Date.now() - 1000) } });
    const purge = () => purgeDueCourses(prisma, app.get(StorageService), app.get(AuditService));
    expect(await purge()).toMatchObject({ purged: 0, waiting: 1 });
    // Once it has ended, the content goes; the order line, enrolment row and audit stay; restore is refused.
    await prisma.enrollment.updateMany({ where: { courseId: a.id }, data: { accessExpiresAt: new Date(Date.now() - 1000) } });
    expect(await purge()).toMatchObject({ purged: 1, waiting: 0 });
    expect(await prisma.section.count({ where: { courseId: a.id } })).toBe(0);
    expect(await prisma.orderLine.count({ where: { id: line.id } })).toBe(1);
    expect(await prisma.enrollment.count({ where: { courseId: a.id } })).toBe(1);
    expect((await sup.send('post', `/api/admin/courses/${a.id}/restore`).expect(409)).body.error.code).toBe('course_purged');
    expect((await reviewer.agent.get('/api/admin/courses?view=purged').expect(200)).body.items.map((c: any) => c.id)).toEqual([a.id]);
    const actions = (await prisma.auditLog.findMany({ where: { targetId: a.id }, select: { action: true } })).map((x) => x.action);
    expect(actions).toEqual(expect.arrayContaining(['course.admin_edited', 'course.archived', 'course.restored', 'course.deletion_requested', 'course.deletion_cancelled', 'course.purged']));
  });

  it('purge keeps videos and files that another course of the same account still uses (shared media)', async () => {
    if (!available) return;
    const teacher = await userAgent('shared-media-teacher@e2e.example', ['student', 'instructor']);
    await prisma.instructorProfile.create({ data: { userId: teacher.user.id, status: 'approved' } });
    const a = await course(teacher.user.id, 'shared-media-a', 0);
    const b = await course(teacher.user.id, 'shared-media-b', 9999);
    const shared = await prisma.videoAsset.create({ data: { ownerId: teacher.user.id, status: 'ready', storageKey: `videos/${teacher.user.id}/shared.mp4`, durationSec: 60 } });
    const onlyA = await prisma.videoAsset.create({ data: { ownerId: teacher.user.id, status: 'ready', storageKey: `videos/${teacher.user.id}/only-a.mp4`, durationSec: 60 } });
    const la = await prisma.lecture.findFirstOrThrow({ where: { section: { courseId: a.id } } });
    const lb = await prisma.lecture.findFirstOrThrow({ where: { section: { courseId: b.id } } });
    await prisma.lecture.update({ where: { id: la.id }, data: { videoAssetId: shared.id } });
    await prisma.lecture.update({ where: { id: lb.id }, data: { videoAssetId: shared.id } });
    const sa = await prisma.section.findFirstOrThrow({ where: { courseId: a.id } });
    await prisma.lecture.create({ data: { sectionId: sa.id, title: 'only in A', position: 1, type: 'video', durationSec: 60, videoAssetId: onlyA.id } });
    const key = `instructors/${teacher.user.id}/courses/${a.id}/resources/x/shared-lab.zip`;
    await prisma.resource.create({ data: { lectureId: la.id, title: 'Hands-on lab (ZIP)', storageKey: key, sizeBytes: 10, mime: 'application/zip' } });
    await prisma.resource.create({ data: { lectureId: lb.id, title: 'Hands-on lab (ZIP)', storageKey: key, sizeBytes: 10, mime: 'application/zip' } });
    await prisma.course.update({ where: { id: a.id }, data: { deleteRequestedAt: new Date(), deleteAfter: new Date(Date.now() - 1000) } });

    expect(await purgeDueCourses(prisma, app.get(StorageService), app.get(AuditService))).toMatchObject({ purged: 1 });
    // Course B still plays the shared video and offers the shared lab; the video only A used is gone.
    expect(await prisma.videoAsset.count({ where: { id: shared.id } })).toBe(1);
    expect(await prisma.videoAsset.count({ where: { id: onlyA.id } })).toBe(0);
    expect((await prisma.lecture.findUniqueOrThrow({ where: { id: lb.id } })).videoAssetId).toBe(shared.id);
    expect(await prisma.resource.count({ where: { lectureId: lb.id, storageKey: key } })).toBe(1);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { targetId: a.id, action: 'course.purged' } });
    expect((log.meta as { keptShared?: number }).keptShared).toBe(2);
  });
});
