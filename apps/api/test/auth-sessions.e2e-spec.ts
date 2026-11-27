/**
 * End to end: email sign-in codes and session security (owner 2026-11-26, prompts.md; docs/AUTH.md §7). Same database
 * setup as app.e2e-spec.ts (a separate database `marketplace_e2e` on the Docker Compose Postgres, truncated first);
 * skipped when unreachable. The test env relaxes the default session limits (AUTH_SESSION_LIMITS=off); every test here
 * saves the settings it needs, as a Super Admin would.
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
import { type AuthSettings, DEFAULT_AUTH_SETTINGS } from '../src/auth/security-settings';
import { codeAt, newSecret, stepAt } from '../src/auth/totp';
import { configureApp } from '../src/bootstrap';
import { JobsService } from '../src/common/jobs';
import { PrismaService } from '../src/common/prisma.service';
import { seal } from '../src/common/seal';
import { REPLACED_MESSAGE, SessionPolicyService } from '../src/common/session-policy.service';
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

const UA_A = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const UA_B = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('e2e: email sign-in codes and session security', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let policy: SessionPolicyService;
  let available = false;
  const sendEmail = jest.fn();
  const PW = 'Long-enough-pw1';
  const step: Record<string, number> = {};

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) {
      console.warn('\n[e2e auth-sessions] SKIPPED: Postgres not reachable. Run `docker compose up -d postgres redis` first.\n');
      return;
    }
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', DEV_TEST_PAYMENTS: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '', MFA_REQUIRED: 'true',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(JobsService).useValue({ processVideo: jest.fn(), packageHls: jest.fn(), sendEmail }).compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    policy = app.get(SessionPolicyService);
    available = true;
  });

  afterAll(async () => { if (available) await policy.reset(); await app?.close(); });
  beforeEach(async () => { sendEmail.mockClear(); if (available) await policy.save(DEFAULT_AUTH_SETTINGS); });

  const withSession = (patch: Partial<AuthSettings['session']>) => policy.save({ ...DEFAULT_AUTH_SETTINGS, session: { ...DEFAULT_AUTH_SETTINGS.session, ...patch } });

  async function makeUser(email: string, roles: any[], withApp: boolean) {
    const seed = newSecret();
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0], passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles, ...(withApp ? { mfaSecret: seal('mfa', seed), mfaEnabledAt: new Date() } : {}) } });
    step[user.id] = stepAt() - 1;
    return { user, seed };
  }
  /** A fresh browser: its own cookies and user agent. */
  async function browser(ua = UA_A) {
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me').set('User-Agent', ua)).body.csrf;
    const send = (method: 'get' | 'post' | 'put' | 'delete', url: string, body?: object) => agent[method](url).set('X-CSRF-Token', csrf).set('User-Agent', ua).send(body ?? {});
    return { agent, csrf, send };
  }
  /** The next unused authenticator code for this user (codes are single use per 30 s step; ±1 step accepted). */
  // A code is accepted once per account and only one step either side of now: instead of running ahead of the clock,
  // forget the account's last used step and use the current one (as admin-portal.e2e-spec.ts does).
  const nextCode = async (u: { user: { id: string }; seed: string }) => {
    await prisma.user.update({ where: { id: u.user.id }, data: { mfaLastStep: null } });
    step[u.user.id] = stepAt();
    return codeAt(u.seed, step[u.user.id]);
  };
  async function signInWithApp(u: { user: { id: string; email: string }; seed: string }, ua = UA_A) {
    const b = await browser(ua);
    await b.send('post', '/api/auth/login', { email: u.user.email, password: PW }).expect(200, { mfa: 'verify' });
    await b.send('post', '/api/auth/mfa/complete', { code: await nextCode(u) }).expect(200);
    return b;
  }
  const lastCode = (template = 'auth-email-code') => String([...sendEmail.mock.calls].reverse().find((c) => c[0]?.template === template)?.[0]?.data?.code ?? '');

  it('a student without an authenticator signs in with an email code (single use, cooldown, wrong-code limit)', async () => {
    if (!available) return;
    const s = await makeUser('otp-student@e2e.example', ['student'], false);
    const b = await browser();
    await b.send('post', '/api/auth/login', { email: s.user.email, password: PW }).expect(200, { mfa: 'enroll' });
    const pending = (await b.agent.get('/api/auth/mfa/pending').expect(200)).body;
    expect(pending.methods).toEqual({ authenticator: false, email: true, recovery: false });
    expect(pending.email).toBe('ot••••@e2e.example');
    const sent = (await b.send('post', '/api/auth/mfa/email/send').expect(200)).body;
    expect(sent.sentTo).toBe('ot••••@e2e.example');
    const code = lastCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: s.user.email, template: 'auth-email-code' }));
    // The code is never stored in clear.
    const t = await prisma.authTicket.findFirstOrThrow({ where: { userId: s.user.id, usedAt: null } });
    expect(JSON.stringify(t.data)).not.toContain(code);
    // Resend cooldown.
    expect((await b.send('post', '/api/auth/mfa/email/send').expect(429)).body.error.code).toBe('email_code_cooldown');
    // Wrong code, then the right one.
    const wrong = code === '000000' ? '111111' : '000000';
    expect((await b.send('post', '/api/auth/mfa/complete', { emailCode: wrong }).expect(401)).body.error.code).toBe('invalid_code');
    const ok = (await b.send('post', '/api/auth/mfa/complete', { emailCode: code }).expect(200)).body;
    expect(ok.user.email).toBe(s.user.email);
    expect(ok.recoveryCodes).toBeUndefined();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })).emailVerifiedAt).toBeInstanceOf(Date);
    const login = await prisma.auditLog.findFirstOrThrow({ where: { action: 'auth.login', targetId: s.user.id }, orderBy: { at: 'desc' } });
    expect((login.meta as any).mfa).toBe('email_code');
    // Next time the screen starts on the email code.
    const b2 = await browser(UA_B);
    await b2.send('post', '/api/auth/login', { email: s.user.email, password: PW }).expect(200);
    expect((await b2.agent.get('/api/auth/mfa/pending').expect(200)).body.prefers).toBe('email');
  });

  it('an email code expires after the configured attempts', async () => {
    if (!available) return;
    await policy.save({ ...DEFAULT_AUTH_SETTINGS, emailOtp: { ...DEFAULT_AUTH_SETTINGS.emailOtp, maxAttempts: 3 } });
    const s = await makeUser('otp-tries@e2e.example', ['student'], false);
    const b = await browser();
    await b.send('post', '/api/auth/login', { email: s.user.email, password: PW }).expect(200);
    await b.send('post', '/api/auth/mfa/email/send').expect(200);
    const code = lastCode();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) await b.send('post', '/api/auth/mfa/complete', { emailCode: wrong }).expect(401);
    // Even the right code is refused now: send a new one.
    expect((await b.send('post', '/api/auth/mfa/complete', { emailCode: code }).expect(401)).body.error.code).toBe('email_code_expired');
  });

  it('Admin and Super Admin can never use an email code, and the settings refuse to allow it', async () => {
    if (!available) return;
    const a = await makeUser('otp-admin@e2e.example', ['student', 'admin'], true);
    const b = await browser();
    await b.send('post', '/api/auth/login', { email: a.user.email, password: PW }).expect(200, { mfa: 'verify' });
    expect((await b.agent.get('/api/auth/mfa/pending').expect(200)).body.methods.email).toBe(false);
    expect((await b.send('post', '/api/auth/mfa/email/send').expect(403)).body.error.code).toBe('email_code_not_allowed');
    expect((await b.send('post', '/api/auth/mfa/complete', { emailCode: '123456' }).expect(403)).body.error.code).toBe('email_code_not_allowed');

    const boss = await makeUser('otp-boss@e2e.example', ['student', 'admin', 'super_admin'], true);
    const sb = await signInWithApp(boss);
    const bad = { ...DEFAULT_AUTH_SETTINGS, emailOtp: { ...DEFAULT_AUTH_SETTINGS.emailOtp, roles: ['student', 'admin'] } };
    await sb.send('put', '/api/admin/auth-settings', { settings: bad, code: '000000' }).expect(401); // step-up first
    expect((await sb.send('put', '/api/admin/auth-settings', { settings: bad, code: await nextCode(boss) }).expect(400)).body.error.code).toBe('invalid_settings');
    // A valid change is saved, applied and audited.
    const good = { ...DEFAULT_AUTH_SETTINGS, session: { ...DEFAULT_AUTH_SETTINGS.session, inactivityMinutes: 45 } };
    const saved = (await sb.send('put', '/api/admin/auth-settings', { settings: good, code: await nextCode(boss) }).expect(200)).body;
    expect(saved.settings.session.inactivityMinutes).toBe(45);
    expect((await policy.settings()).session.inactivityMinutes).toBe(45);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'auth.security_settings_changed' }, orderBy: { at: 'desc' } });
    expect((audit.meta as any).changes).toEqual(['session.inactivityMinutes: 30 → 45']);
    // Plain admins can't read or change them.
    const plain = await signInWithApp(a);
    await plain.agent.get('/api/admin/auth-settings').expect(403);
  });

  it('one signed-in browser: a failed code never disconnects; a completed sign-in ends the older session with the owner’s message', async () => {
    if (!available) return;
    await withSession({ singleSession: true, terminatePrevious: true });
    const u = await makeUser('single@e2e.example', ['student'], true);
    const a = await signInWithApp(u, UA_A);
    // Video playback of browser A.
    const asset = await prisma.videoAsset.create({ data: { ownerId: u.user.id, provider: 'local', status: 'ready', storageKey: 'x/y.mp4' } });
    const pb = await prisma.playbackSession.create({ data: { ref: `r-${Date.now()}`, userId: u.user.id, assetId: asset.id, expiresAt: new Date(Date.now() + 3600_000) } });

    const b = await browser(UA_B);
    await b.send('post', '/api/auth/login', { email: u.user.email, password: PW }).expect(200, { mfa: 'verify' });
    await b.send('post', '/api/auth/mfa/complete', { code: '000000' }).expect(401);
    expect((await a.agent.get('/api/auth/me').expect(200)).body.user?.email).toBe(u.user.email); // A untouched

    await b.send('post', '/api/auth/mfa/complete', { code: await nextCode(u) }).expect(200);
    const res = await a.agent.get('/api/auth/sessions').expect(401);
    expect(res.body.error.code).toBe('session_replaced');
    expect(res.body.error.message).toBe(REPLACED_MESSAGE);
    // /auth/me reports it once and clears the dead cookie.
    const me = (await a.agent.get('/api/auth/me').expect(200)).body;
    expect(me).toMatchObject({ user: null, sessionEnded: 'replaced', sessionEndedMessage: REPLACED_MESSAGE });
    expect((await a.agent.get('/api/auth/me').expect(200)).body.sessionEnded).toBeUndefined();
    // A's video stops: its playback session ended.
    expect((await prisma.playbackSession.findUniqueOrThrow({ where: { id: pb.id } })).expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
    // B works, and only one ordinary session is live.
    expect((await b.agent.get('/api/auth/me').expect(200)).body.user?.email).toBe(u.user.email);
    expect(await prisma.session.count({ where: { userId: u.user.id, kind: 'user', revokedAt: null } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'auth.session_replaced', meta: { path: ['userId'], equals: u.user.id } } })).toBe(1);
  });

  it('a support session is not counted and never ended by the person signing in', async () => {
    if (!available) return;
    await withSession({ singleSession: true });
    const u = await makeUser('support-kind@e2e.example', ['student'], true);
    const support = await prisma.session.create({ data: { id: `support-${Date.now()}`, userId: u.user.id, kind: 'support', expiresAt: new Date(Date.now() + 3600_000) } });
    await signInWithApp(u);
    await signInWithApp(u, UA_B);
    expect((await prisma.session.findUniqueOrThrow({ where: { id: support.id } })).revokedAt).toBeNull();
  });

  it('"refuse the new sign-in" keeps the first browser and answers 409', async () => {
    if (!available) return;
    await withSession({ singleSession: true, terminatePrevious: false });
    const u = await makeUser('refuse@e2e.example', ['student'], true);
    const a = await signInWithApp(u);
    const b = await browser(UA_B);
    await b.send('post', '/api/auth/login', { email: u.user.email, password: PW }).expect(200);
    expect((await b.send('post', '/api/auth/mfa/complete', { code: await nextCode(u) }).expect(409)).body.error.code).toBe('session_limit');
    expect((await a.agent.get('/api/auth/me').expect(200)).body.user?.email).toBe(u.user.email);
  });

  it('several browsers when single-session is off, up to the maximum', async () => {
    if (!available) return;
    await withSession({ singleSession: false, maxConcurrent: 2, terminatePrevious: true });
    const u = await makeUser('two@e2e.example', ['student'], true);
    const a = await signInWithApp(u);
    const b = await signInWithApp(u, UA_B);
    expect((await a.agent.get('/api/auth/me')).body.user).not.toBeNull();
    expect((await b.agent.get('/api/auth/me')).body.user).not.toBeNull();
    await signInWithApp(u);
    expect((await a.agent.get('/api/auth/sessions').expect(401)).body.error.code).toBe('session_replaced'); // the oldest
  });

  it('inactivity and maximum lifetime end the session on the server; the heartbeat and video progress count as activity', async () => {
    if (!available) return;
    await withSession({ inactivityMinutes: 30, lifetimeHours: 24 });
    const u = await makeUser('idle@e2e.example', ['student'], true);
    const a = await signInWithApp(u);
    const sess = await prisma.session.findFirstOrThrow({ where: { userId: u.user.id, revokedAt: null } });
    // Heartbeat moves lastActiveAt (at most once a minute).
    await prisma.session.update({ where: { id: sess.id }, data: { lastActiveAt: new Date(Date.now() - 20 * 60_000) } });
    const st = (await a.send('post', '/api/auth/session/heartbeat').expect(200)).body;
    expect(st).toMatchObject({ kind: 'user', inactivityMinutes: 30, warningMinutes: 2 });
    expect(new Date(st.idleAt).getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);
    // 31 minutes without activity → signed out.
    await prisma.session.update({ where: { id: sess.id }, data: { lastActiveAt: new Date(Date.now() - 31 * 60_000) } });
    expect((await a.agent.get('/api/auth/sessions').expect(401)).body.error.code).toBe('session_idle');
    expect((await prisma.session.findUniqueOrThrow({ where: { id: sess.id } })).endedReason).toBe('idle');

    const b = await signInWithApp(u, UA_B);
    const s2 = await prisma.session.findFirstOrThrow({ where: { userId: u.user.id, revokedAt: null } });
    await prisma.session.update({ where: { id: s2.id }, data: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
    expect((await b.agent.get('/api/auth/sessions').expect(401)).body.error.code).toBe('session_lifetime');
  });

  it('Super Admin sees a person’s sessions and history, signs one out, and it is audited', async () => {
    if (!available) return;
    await withSession({ singleSession: false, maxConcurrent: 5 });
    const u = await makeUser('watched@e2e.example', ['student'], true);
    const ua = await signInWithApp(u, UA_A);
    await signInWithApp(u, UA_B);
    const boss = await makeUser('sess-boss@e2e.example', ['student', 'admin', 'super_admin'], true);
    const sb = await signInWithApp(boss);
    const view = (await sb.agent.get(`/api/admin/users/${u.user.id}/sessions`).expect(200)).body;
    expect(view.sessions).toHaveLength(2);
    expect(view.sessions.map((s: any) => s.device).sort()).toEqual(['Chrome on Windows', 'Safari on iPhone']);
    expect(view.logins.some((l: any) => l.action === 'auth.login' && l.mfa === 'code')).toBe(true);
    const chrome = view.sessions.find((s: any) => s.device === 'Chrome on Windows');
    await sb.send('delete', `/api/admin/users/${u.user.id}/sessions/${chrome.id}`, { reason: 'test' }).expect(200);
    const r = await ua.agent.get('/api/auth/sessions').expect(401);
    expect(r.body.error.code).toBe('session_admin');
    await sb.send('post', `/api/admin/users/${u.user.id}/sessions/end-all`).expect(200);
    expect(await prisma.session.count({ where: { userId: u.user.id, revokedAt: null } })).toBe(0);
    const ends = (await sb.agent.get(`/api/admin/users/${u.user.id}/sessions`).expect(200)).body.ends;
    expect(ends.filter((e: any) => e.reason === 'admin').length).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: 'admin.user_sessions_viewed', targetId: u.user.id } })).toBe(2);
    // Plain admins can't.
    const a = await makeUser('sess-admin@e2e.example', ['student', 'admin'], true);
    await (await signInWithApp(a)).agent.get(`/api/admin/users/${u.user.id}/sessions`).expect(403);
  });

  it('security emails: a new device (not the very first sign-in), and an account locked after wrong attempts', async () => {
    if (!available) return;
    await withSession({ singleSession: false, maxConcurrent: 5 });
    const u = await makeUser('alerts@e2e.example', ['student'], true);
    const a = await signInWithApp(u, UA_A);
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ template: 'security-new-device' })); // first ever
    // Same browser again (keeps its del_dev cookie): no email.
    await a.send('post', '/api/auth/login', { email: u.user.email, password: PW }).expect(200);
    await a.send('post', '/api/auth/mfa/complete', { code: await nextCode(u) }).expect(200);
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ template: 'security-new-device' }));
    // A new browser: one email with the device.
    await signInWithApp(u, UA_B);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: u.user.email, template: 'security-new-device', data: expect.objectContaining({ device: 'Safari on iPhone' }) }));

    const v = await makeUser('locked@e2e.example', ['student'], true);
    const b = await browser();
    for (let i = 0; i < 5; i++) await b.send('post', '/api/auth/login', { email: v.user.email, password: 'Wrong-password-9' }).expect(401);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: v.user.email, template: 'security-account-locked' }));
  });

  it('a student with email codes confirms a sensitive change by email (step-up) and can then set up an authenticator', async () => {
    if (!available) return;
    const s = await makeUser('stepup@e2e.example', ['student'], false);
    const b = await browser();
    await b.send('post', '/api/auth/login', { email: s.user.email, password: PW }).expect(200);
    await b.send('post', '/api/auth/mfa/email/send').expect(200);
    await b.send('post', '/api/auth/mfa/complete', { emailCode: lastCode() }).expect(200);
    expect((await b.agent.get('/api/auth/security').expect(200)).body).toMatchObject({ emailCodes: true, emailCodeLength: 6 });
    await b.send('post', '/api/auth/mfa/replace/start', { code: '000000' }).expect(401);
    await b.send('post', '/api/auth/step-up/email').expect(200);
    const start = (await b.send('post', '/api/auth/mfa/replace/start', { code: lastCode() }).expect(200)).body;
    await b.send('post', '/api/auth/mfa/replace/confirm', { pending: start.pending, code: codeAt(start.secret, stepAt()) }).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })).mfaEnabledAt).toBeInstanceOf(Date);
  });
});
