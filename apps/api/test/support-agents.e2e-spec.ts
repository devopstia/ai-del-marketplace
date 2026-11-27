/**
 * End to end: super admin support sessions and AI agent access (owner 2026-11-26; docs/SUPPORT_SESSIONS_AND_AGENTS.md).
 * Same database setup as app.e2e-spec.ts (database `marketplace_e2e` on the Docker Compose Postgres, truncated first);
 * skipped when unreachable. The upload scenario needs the local MinIO (:9000) and is skipped without it.
 * Numbers refer to the owner's test list (prompts.md, section 11).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { StorageService } from '../src/common/storage.service';
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

describe('e2e: support sessions and AI agents', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let available = false;
  let storageOk = false;
  const PW = 'Long-enough-pw1';
  const MFA_SEED = newSecret();
  /**
   * A valid authenticator code for `userId` right now. Each 30-second step is accepted once per account, so the
   * account's last used step is cleared first (tests make several step-up confirmations within one step).
   */
  const code = () => codeAt(MFA_SEED, stepAt());
  const fresh = async (userId: string) => {
    await prisma.user.update({ where: { id: userId }, data: { mfaLastStep: null } });
    return codeAt(MFA_SEED, stepAt());
  };
  const sendEmail = jest.fn();

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) {
      console.warn('\n[e2e support/agents] SKIPPED: Postgres not reachable. Run `docker compose up -d postgres redis` first.\n');
      return;
    }
    const env = rootEnv();
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', DEV_TEST_PAYMENTS: 'true', MFA_REQUIRED: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: env.S3_ACCESS_KEY ?? process.env.S3_ACCESS_KEY ?? 'test', S3_SECRET_KEY: env.S3_SECRET_KEY ?? process.env.S3_SECRET_KEY ?? 'test-secret',
      WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(JobsService).useValue({ processVideo: jest.fn(), packageHls: jest.fn(), sendEmail }).compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    available = true;
    try {
      const id = await storage.createMultipart('probe/e2e-support-agents', 'text/plain');
      await storage.abortMultipart('probe/e2e-support-agents', id);
      storageOk = true;
    } catch { console.warn('[e2e support/agents] MinIO not reachable: the upload scenario is skipped.'); }
  });

  afterAll(async () => { await app?.close(); });

  async function person(email: string, roles: any[], extra: { adminPermissions?: string[]; instructor?: boolean } = {}) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0]!.replace(/-/g, ' '), passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles, adminPermissions: roles.includes('admin') ? (extra.adminPermissions ?? ALL_ADMIN_PERMISSIONS) : [], mfaSecret: seal('mfa', MFA_SEED), mfaEnabledAt: new Date() } });
    if (extra.instructor) await prisma.instructorProfile.create({ data: { userId: user.id, status: 'approved' } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200, { mfa: 'verify' });
    await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: code() }).expect(200);
    const send = (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: object) => agent[method](url).set('X-CSRF-Token', csrf).send(body ?? {});
    return { user, agent, send };
  }

  it('1, 2, 11, 13: a super admin opens a student’s and an instructor’s dashboard, with limits, and returns', async () => {
    if (!available) return;
    const sup = await person('support-super@e2e.example', ['student', 'admin', 'super_admin']);
    const sup2 = await person('support-super2@e2e.example', ['student', 'admin', 'super_admin']);
    const admin = await person('support-admin@e2e.example', ['student', 'admin']);
    const student = await person('support-student@e2e.example', ['student']);
    const teacher = await person('support-teacher@e2e.example', ['student', 'instructor'], { instructor: true });

    // Only super admins; a reason and the authenticator code are required; never into another super admin.
    await admin.send('post', '/api/support-session/start', { userId: student.user.id, reason: 'Cannot find course' }).expect(403);
    await student.send('post', '/api/support-session/start', { userId: teacher.user.id, reason: 'Cannot find course' }).expect(403);
    expect((await sup.send('post', '/api/support-session/start', { userId: student.user.id, reason: 'help' }).expect(400)).body.error.code).toBe('reason_required');
    expect((await sup.send('post', '/api/support-session/start', { userId: student.user.id, reason: 'Cannot find course' }).expect(400)).body.error.code).toBe('step_up_required');
    expect((await sup.send('post', '/api/support-session/start', { userId: sup2.user.id, reason: 'Checking settings', code: await fresh(sup.user.id) }).expect(403)).body.error.code).toBe('support_target_super_admin');
    await sup.send('post', '/api/support-session/start', { userId: sup.user.id, reason: 'Checking settings', code: await fresh(sup.user.id) }).expect(400);

    // 1. Into the student's dashboard.
    const started = await sup.send('post', '/api/support-session/start', { userId: student.user.id, reason: 'Cannot find the course they bought', code: await fresh(sup.user.id) }).expect(200);
    expect(started.body).toMatchObject({ active: true, landing: '/student', subject: { email: 'support-student@e2e.example' } });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'support-student@e2e.example', template: 'security-support-session' }));
    expect((await sup.agent.get('/api/auth/me').expect(200)).body.user.email).toBe('support-student@e2e.example');
    const banner = (await sup.agent.get('/api/support-session').expect(200)).body;
    expect(banner).toMatchObject({ active: true, reason: 'Cannot find the course they bought', subject: { email: 'support-student@e2e.example' }, actor: { name: expect.any(String) } });
    await sup.agent.get('/api/me/learning').expect(200);
    // What stays the owner's: account security, purchases, learning records, admin work.
    expect((await sup.send('post', '/api/auth/password', { current: PW, password: 'Another-long-pw2' }).expect(403)).body.error.code).toBe('support_restricted');
    await sup.agent.get('/api/auth/sessions').expect(403);
    await sup.send('post', '/api/checkout', {}).expect(403);
    await sup.send('put', '/api/lectures/00000000-0000-0000-0000-000000000000/progress', { positionSec: 5 }).expect(403);
    await sup.send('post', '/api/admin/people/users/' + student.user.id + '/status', { status: 'suspended', reason: 'x' }).expect(403);
    await sup.send('post', '/api/auth/logout').expect(403);
    // The student's own session is untouched, and they are not signed out.
    expect((await student.agent.get('/api/auth/me').expect(200)).body.user.email).toBe('support-student@e2e.example');
    expect(await prisma.session.count({ where: { userId: student.user.id, revokedAt: null } })).toBe(1);
    // Admin pages read as the student: no admin powers leak through.
    await sup.agent.get('/api/admin/people/users').expect(403);

    // 11. Return: no new sign-in.
    const back = await sup.send('post', '/api/support-session/end').expect(200);
    expect(back.body).toMatchObject({ ended: true, returnTo: expect.stringContaining(student.user.id) });
    expect((await sup.agent.get('/api/auth/me').expect(200)).body.user.email).toBe('support-super@e2e.example');
    expect((await sup.agent.get('/api/support-session').expect(200)).body).toEqual({ active: false });

    // 2. Into the instructor's dashboard; 13. an expired or revoked session stops at once.
    await sup.send('post', '/api/support-session/start', { userId: teacher.user.id, reason: 'Help organise the recordings', code: await fresh(sup.user.id), minutes: 30 }).expect(200);
    expect((await sup.agent.get('/api/auth/me').expect(200)).body.user.email).toBe('support-teacher@e2e.example');
    await sup.agent.get('/api/instructor/courses').expect(200);
    await prisma.supportSession.updateMany({ where: { subjectId: teacher.user.id, endedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await sup.agent.get('/api/auth/me').expect(200)).body.user.email).toBe('support-super@e2e.example');
    await sup.agent.get('/api/instructor/courses').expect(403);

    await sup.send('post', '/api/support-session/start', { userId: teacher.user.id, reason: 'Second try at the curriculum', code: await fresh(sup.user.id) }).expect(200);
    const open = await prisma.supportSession.findFirstOrThrow({ where: { subjectId: teacher.user.id, endedAt: null, expiresAt: { gt: new Date() } } });
    await sup2.send('post', `/api/support-session/${open.id}/revoke`).expect(200);
    expect((await sup.agent.get('/api/auth/me').expect(200)).body.user.email).toBe('support-super@e2e.example');
    const hist = (await sup.agent.get(`/api/support-session/history?userId=${teacher.user.id}`).expect(200)).body.items;
    expect(hist.map((h: any) => h.status).sort()).toEqual(['expired', 'revoked']);
  });

  it('3, 10, 12: a course created in a support session belongs to the instructor; audit names the super admin', async () => {
    if (!available) return;
    const sup = await person('support-super3@e2e.example', ['student', 'admin', 'super_admin']);
    const teacher = await person('support-teacher3@e2e.example', ['student', 'instructor'], { instructor: true });
    await sup.send('post', '/api/support-session/start', { userId: teacher.user.id, reason: 'Build the course from 30 recordings', code: await fresh(sup.user.id) }).expect(200);
    const session = await prisma.supportSession.findFirstOrThrow({ where: { subjectId: teacher.user.id } });
    const c = (await sup.send('post', '/api/instructor/courses', { title: 'Kubernetes from the recordings' }).expect(201)).body;
    await sup.send('post', `/api/instructor/courses/${c.id}/sections`, { title: 'Getting started' }).expect(201);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: c.id } })).instructorId).toBe(teacher.user.id);
    // 12. Never attributed to the instructor: the real person, on whose behalf, which session, why, and the outcome.
    const rows = await prisma.auditLog.findMany({ where: { supportSessionId: session.id } });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.actorId === sup.user.id)).toBe(true);
    const created = rows.find((r) => r.action === 'course.created');
    expect(created).toMatchObject({ actorId: sup.user.id, onBehalfOfId: teacher.user.id, status: 'ok' });
    expect(created!.meta).toMatchObject({ reason: 'Build the course from 30 recordings' });
    expect(rows.filter((r) => r.action === 'support.request').length).toBeGreaterThanOrEqual(2);
    await sup.send('post', '/api/instructor/courses', { title: 'x' }).expect(400);
    const failed = await prisma.auditLog.findFirst({ where: { supportSessionId: session.id, action: 'support.request', status: 'failed' } });
    expect(failed).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { actorId: teacher.user.id, action: 'course.created' } })).toBe(0);
    await sup.send('post', '/api/support-session/end').expect(200);
  });

  it('5–10, 12–14: an AI agent builds a course for one instructor; a super admin approves; scopes hold', async () => {
    if (!available) return;
    const http = () => request(app.getHttpServer());
    const sup = await person('agents-super@e2e.example', ['student', 'admin', 'super_admin']);
    const admin = await person('agents-admin@e2e.example', ['student', 'admin']);
    const nadia = await person('agents-nadia@e2e.example', ['student', 'instructor'], { instructor: true });
    const other = await person('agents-other@e2e.example', ['student', 'instructor'], { instructor: true });
    const cat = await prisma.category.create({ data: { slug: 'agents-e2e', name: 'Agents' } });
    const otherCourse = (await other.send('post', '/api/instructor/courses', { title: 'Someone else’s course' }).expect(201)).body;
    const template = await prisma.coverTemplate.findFirst({ where: { active: true } });

    // Issuing: super admin only, code + reason, instructor accounts only.
    const issue = { instructorId: nadia.user.id, name: 'Claude course assistant', scopes: ['courses:read', 'courses:write', 'uploads', 'submit'], days: 3, reason: 'Build Kubernetes basics from the recordings' };
    await admin.send('post', '/api/admin/agents/tokens', { ...issue, code: await fresh(admin.user.id) }).expect(403);
    expect((await sup.send('post', '/api/admin/agents/tokens', issue).expect(400)).body.error.code).toBe('step_up_required');
    await sup.send('post', '/api/admin/agents/tokens', { ...issue, instructorId: admin.user.id, code: await fresh(sup.user.id) }).expect(400);
    const issued = (await sup.send('post', '/api/admin/agents/tokens', { ...issue, code: await fresh(sup.user.id) }).expect(201)).body;
    expect(issued.token).toMatch(/^del_agent_/);
    expect(await prisma.agentToken.count({ where: { tokenHash: issued.token } })).toBe(0); // stored hashed only
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'agents-nadia@e2e.example', template: 'security-agent-access' }));
    const readOnly = (await sup.send('post', '/api/admin/agents/tokens', { ...issue, scopes: ['courses:read'], code: await fresh(sup.user.id) }).expect(201)).body.token;
    const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
    const as = (t: string) => ({
      get: (u: string) => http().get(u).set(bearer(t)),
      post: (u: string, b?: object) => http().post(u).set(bearer(t)).send(b ?? {}),
      patch: (u: string, b: object) => http().patch(u).set(bearer(t)).send(b),
      put: (u: string, b: object) => http().put(u).set(bearer(t)).send(b),
    });
    const ai = as(issued.token);

    // 14. Only /api/agent, only Nadia's courses, only the scopes given; no cookies or CSRF involved.
    expect((await ai.get('/api/agent/whoami').expect(200)).body.instructor.id).toBe(nadia.user.id);
    expect((await ai.get('/api/me/learning').expect(403)).body.error.code).toBe('agent_scope');
    await ai.get('/api/admin/people/users').expect(403);
    await ai.get(`/api/agent/courses/${otherCourse.id}`).expect(404);
    await ai.patch(`/api/agent/courses/${otherCourse.id}`, { title: 'Taken over' }).expect(404);
    expect((await as(readOnly).post('/api/agent/courses', { title: 'Nope' }).expect(403)).body.error.code).toBe('agent_scope');
    await as(readOnly).get('/api/agent/courses').expect(200);
    await http().get('/api/agent/whoami').expect(401);

    // 5. Create and structure the course.
    const c = (await ai.post('/api/agent/courses', { title: 'Kubernetes basics', subtitle: 'Pods to deployments', description: 'From the recordings.', level: 'beginner', categoryId: cat.id, objectives: ['Run pods'], priceCents: 1999 }).expect(201)).body;
    expect((await prisma.course.findUniqueOrThrow({ where: { id: c.id } })).instructorId).toBe(nadia.user.id);
    const s1 = (await ai.post(`/api/agent/courses/${c.id}/sections`, { title: 'Pods' }).expect(201)).body;
    const l1 = (await ai.post(`/api/agent/courses/${c.id}/sections/${s1.id}/lectures`, { title: '01 What is a pod', type: 'video' }).expect(201)).body;
    const l2 = (await ai.post(`/api/agent/courses/${c.id}/sections/${s1.id}/lectures`, { title: 'Check', type: 'quiz' }).expect(201)).body;
    await ai.put(`/api/agent/courses/${c.id}/lectures/${l2.id}/quiz`, { questions: [{ q: 'What runs containers?', options: ['A pod', 'A node pool', 'A service'], correct: 0, why: 'Pods hold containers.' }] }).expect(200);
    if (template) await ai.put(`/api/agent/courses/${c.id}/cover`, { templateId: template.id }).expect(200);

    // 8. Not ready while the video is missing: validation says why and submit refuses.
    let v = (await ai.get(`/api/agent/courses/${c.id}/validation`).expect(200)).body;
    expect(v.ready).toBe(false);
    expect(v.stats.videosMissing).toBe(1);
    expect((await ai.post(`/api/agent/courses/${c.id}/submit`).expect(400)).body.error.code).toBe('not_ready');

    if (storageOk) {
      // 6 + 7. Resumable upload of a video and a study file, then attach them.
      const bytes = Buffer.from('fake mp4 bytes for the e2e test');
      const start = (await ai.post('/api/agent/uploads', { kind: 'video', filename: '01-what-is-a-pod.mp4', contentType: 'video/mp4', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), courseId: c.id }).expect(201)).body;
      expect(start).toMatchObject({ partCount: 1, status: 'uploading' });
      // Completing before the bytes arrive is refused (never a false success).
      expect((await ai.post(`/api/agent/uploads/${start.id}/complete`).expect(400)).body.error.code).toBe('upload_incomplete');
      const parts = (await ai.get(`/api/agent/uploads/${start.id}/parts?from=1&count=5`).expect(200)).body;
      expect(parts.urls).toHaveLength(1);
      expect((await fetch(parts.urls[0].url, { method: 'PUT', body: bytes })).ok).toBe(true);
      const done = (await ai.post(`/api/agent/uploads/${start.id}/complete`).expect(200)).body;
      expect(done).toMatchObject({ status: 'completed', assetId: start.assetId });
      // The same file again is recognised, not uploaded twice.
      const again = (await ai.post('/api/agent/uploads', { kind: 'video', filename: 'copy.mp4', contentType: 'video/mp4', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }).expect(201)).body;
      expect(again).toMatchObject({ duplicate: true, assetId: start.assetId });
      await ai.patch(`/api/agent/courses/${c.id}/lectures/${l1.id}`, { videoAssetId: start.assetId }).expect(200);
      v = (await ai.get(`/api/agent/courses/${c.id}/validation`).expect(200)).body;
      expect(v).toMatchObject({ ready: false, stats: { videosProcessing: 1 } });
      // The worker (mocked here) finishes processing.
      await prisma.videoAsset.update({ where: { id: start.assetId }, data: { status: 'ready', durationSec: 42 } });
      // Captions for the agent's own video (course publisher, 2026-11-26): a signed PUT for WebVTT; never another owner's video.
      const cap = (await ai.post(`/api/agent/videos/${start.assetId}/captions`).expect(200)).body;
      expect(cap).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'text/vtt' } });
      expect(cap.uploadUrl).toMatch(/^https?:\/\//);

      const pdf = Buffer.from('%PDF-1.4 slides');
      const f = (await ai.post('/api/agent/uploads', { kind: 'resource', filename: 'pods slides.pdf', contentType: 'application/pdf', sizeBytes: pdf.length, courseId: c.id }).expect(201)).body;
      const fp = (await ai.get(`/api/agent/uploads/${f.id}/parts`).expect(200)).body;
      expect((await fetch(fp.urls[0].url, { method: 'PUT', body: pdf })).ok).toBe(true);
      const fd = (await ai.post(`/api/agent/uploads/${f.id}/complete`).expect(200)).body;
      await ai.post(`/api/agent/courses/${c.id}/lectures/${l1.id}/resources`, { title: 'Slides', storageKey: fd.storageKey }).expect(201);

      v = (await ai.get(`/api/agent/courses/${c.id}/validation`).expect(200)).body;
      expect(v).toMatchObject({ ready: true, stats: { videosReady: 1, resources: 1 } });
      const preview = (await ai.get(`/api/agent/courses/${c.id}/preview`).expect(200)).body;
      expect(preview.outline[0].lessons[0]).toMatchObject({ title: '01 What is a pod', video: 'ready', files: ['Slides'] });

      // 8 + 9 + 10. Submit; the super admin approves; the course stays Nadia's.
      await ai.post(`/api/agent/courses/${c.id}/submit`).expect(200);
      expect((await prisma.course.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('in_review');
      expect((await sup.agent.get('/api/admin/agents/pending').expect(200)).body.items.map((x: any) => x.id)).toContain(c.id);
      await sup.send('post', `/api/admin/courses/${c.id}/approve`, {}).expect(200);
      const published = await prisma.course.findUniqueOrThrow({ where: { id: c.id } });
      expect(published).toMatchObject({ status: 'published', instructorId: nadia.user.id });
    }

    // 12. Agent actions are recorded against the issuing super admin, on Nadia's behalf, with the token.
    const tokenRow = await prisma.agentToken.findFirstOrThrow({ where: { name: 'Claude course assistant', scopes: { has: 'submit' } } });
    const rows = await prisma.auditLog.findMany({ where: { agentTokenId: tokenRow.id } });
    expect(rows.some((r) => r.action === 'course.created' && r.actorId === sup.user.id && r.onBehalfOfId === nadia.user.id)).toBe(true);
    expect(rows.some((r) => r.action === 'agent.request' && r.status === 'failed')).toBe(true);
    expect(await prisma.auditLog.count({ where: { actorId: nadia.user.id, agentTokenId: { not: null } } })).toBe(0);
    const activity = (await sup.agent.get(`/api/admin/agents/activity?tokenId=${tokenRow.id}`).expect(200)).body.items;
    expect(activity.length).toBeGreaterThan(3);

    // 13. Revoked or expired tokens stop working immediately.
    await sup.send('post', `/api/admin/agents/tokens/${tokenRow.id}/revoke`).expect(200);
    expect((await ai.get('/api/agent/whoami').expect(401)).body.error.code).toBe('agent_token_invalid');
    await prisma.agentToken.updateMany({ where: { scopes: { equals: ['courses:read'] } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await as(readOnly).get('/api/agent/courses').expect(401);
    const list = (await sup.agent.get('/api/admin/agents/tokens').expect(200)).body.items;
    expect(list.map((t: any) => t.status).sort()).toEqual(['expired', 'revoked']);
    expect(JSON.stringify(list)).not.toContain(issued.token);
  });
});
