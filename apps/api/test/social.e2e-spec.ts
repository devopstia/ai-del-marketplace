/**
 * e2e (owner 2026-11-28, docs/SOCIAL_SHARING.md): sharing banners and link-preview defaults. Published courses get a
 * stored, hashed banner; drafts never do; a change gives a new address; only super admins change the settings; only a
 * course's instructor (or a super admin) changes its banner; uploads are validated and stripped. Real Postgres and
 * S3/MinIO like the other e2e suites (E2E_DATABASE_URL, E2E_S3_ENDPOINT, E2E_REDIS_URL).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as argon2 from 'argon2';
import { Client } from 'pg';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ARGON2_OPTS } from '../src/auth/auth.service';
import { codeAt, newSecret, stepAt } from '../src/auth/totp';
import { configureApp } from '../src/bootstrap';
import { JobsService } from '../src/common/jobs';
import { ALL_ADMIN_PERMISSIONS } from '../src/common/permissions';
import { PrismaService } from '../src/common/prisma.service';
import { seal } from '../src/common/seal';
import { resetEnvCache } from '../src/config/env';
import { SocialService } from '../src/social/social.service';

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

describe('e2e: sharing banners', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  const PW = 'Long-enough-pw1';
  const MFA = newSecret();

  beforeAll(async () => {
    const url = await prepareDatabase();
    if (!url) { console.warn('\n[e2e social] SKIPPED: Postgres not reachable.\n'); return; }
    const env = rootEnv();
    Object.assign(process.env, {
      NODE_ENV: 'test', DATABASE_URL: url, REDIS_URL: process.env.E2E_REDIS_URL ?? 'redis://127.0.0.1:6380', MFA_REQUIRED: 'true',
      STRIPE_SECRET_KEY: '', S3_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000', S3_PUBLIC_ENDPOINT: process.env.E2E_S3_ENDPOINT ?? 'http://127.0.0.1:9000',
      S3_ACCESS_KEY: env.S3_ACCESS_KEY ?? 'test', S3_SECRET_KEY: env.S3_SECRET_KEY ?? 'test-secret', WEB_URL: 'http://127.0.0.1:3000', ANTHROPIC_API_KEY: '',
    });
    resetEnvCache();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(JobsService).useValue({ processVideo: jest.fn(), packageHls: jest.fn(), sendEmail: jest.fn(), settleFee: jest.fn(), scheduleRecurring: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: ['error'] });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    available = true;
  });
  afterAll(async () => { await app?.close(); });

  async function as(email: string, roles: string[]) {
    const user = await prisma.user.create({ data: { email, name: email.split('@')[0]!, passwordHash: await argon2.hash(PW, ARGON2_OPTS), roles: roles as never, adminPermissions: roles.includes('admin') ? ALL_ADMIN_PERMISSIONS : [], mfaSecret: seal('mfa', MFA), mfaEnabledAt: new Date(), emailVerifiedAt: new Date() } });
    const agent = request.agent(app.getHttpServer());
    const csrf: string = (await agent.get('/api/auth/me')).body.csrf;
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: PW }).expect(200);
    await prisma.user.update({ where: { id: user.id }, data: { mfaLastStep: null } });
    await agent.post('/api/auth/mfa/complete').set('X-CSRF-Token', csrf).send({ code: codeAt(MFA, stepAt()) }).expect(200);
    const send = (m: 'post' | 'put' | 'delete', url: string) => agent[m](url).set('X-CSRF-Token', csrf);
    return { user, agent, send };
  }

  let seq = 0;
  async function course(instructorId: string, o: { status?: 'published' | 'draft'; priceCents?: number; title?: string } = {}) {
    const n = ++seq;
    const cat = await prisma.category.upsert({ where: { slug: 'ai-cloud-aws' }, create: { slug: 'ai-cloud-aws', name: 'AI on AWS' }, update: {} });
    const c = await prisma.course.create({ data: { title: o.title ?? `AI for DevOps on AWS ${n}: From Fundamentals to Production`, subtitle: 'Bedrock, RAG and agents with labs.', slug: `share-course-${n}`, instructorId, categoryId: cat.id, status: o.status ?? 'published', priceCents: o.priceCents ?? 2999, publishedAt: o.status === 'draft' ? null : new Date() } });
    const s = await prisma.section.create({ data: { courseId: c.id, title: 'Getting started', position: 0 } });
    await prisma.lecture.create({ data: { sectionId: s.id, title: 'Welcome', position: 0, type: 'article', articleMd: 'Hi', durationSec: 600 } });
    return c;
  }
  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#4f3fb0' } }).withExif({ IFD0: { Copyright: 'private-camera-data' } }).png().toBuffer();

  it('a published course has a hashed public banner with long cache headers; the address changes when the course does', async () => {
    if (!available) return;
    const t = await as('share-teacher@e2e.example', ['student', 'instructor']);
    const c = await course(t.user.id);
    const d1 = (await request(app.getHttpServer()).get(`/api/courses/${c.slug}`).expect(200)).body;
    expect(d1.share.path).toMatch(new RegExp(`^/media/images/social/${c.id}-[0-9a-f]{12}\\.(jpg|png)$`));
    expect(d1.share).toMatchObject({ width: 1200, height: 630 });
    const img = await request(app.getHttpServer()).get(`/api${d1.share.path}`).buffer(true).parse((res, cb) => { const b: Buffer[] = []; res.on('data', (x: Buffer) => b.push(x)); res.on('end', () => cb(null, Buffer.concat(b))); }).expect(200);
    expect(img.headers['content-type']).toMatch(/^image\/(jpeg|png)$/);
    expect(img.headers['cache-control']).toContain('immutable');
    // (The API sets its CSRF cookie on every response; the public address on the site, the web proxy, never passes it on.)
    expect((img.body as Buffer).length).toBeLessThanOrEqual(300 * 1024);
    expect(await sharp(img.body as Buffer).metadata()).toMatchObject({ width: 1200, height: 630 });

    await prisma.course.update({ where: { id: c.id }, data: { title: 'A new title for sharing' } });
    const svc = app.get(SocialService);
    const after = await svc.ensureCourse(c.id);
    expect(after!.path).not.toBe(d1.share.path);
    await prisma.course.update({ where: { id: c.id }, data: { priceCents: 0 } });
    const free = await svc.ensureCourse(c.id);
    expect(free!.path).not.toBe(after!.path);
    // nothing changed: same address, nothing redrawn
    expect((await svc.ensureCourse(c.id))!.path).toBe(free!.path);
  });

  it('a draft course never gets a stored banner and is not visible to visitors', async () => {
    if (!available) return;
    const t = await as('share-draft@e2e.example', ['student', 'instructor']);
    const c = await course(t.user.id, { status: 'draft' });
    await request(app.getHttpServer()).get(`/api/courses/${c.slug}`).expect(404);
    const own = (await t.agent.get(`/api/courses/${c.slug}`).expect(200)).body;
    expect(own.share).toBeNull();
    const view = (await t.agent.get(`/api/instructor/courses/${c.id}/share`).expect(200)).body;
    expect(view.imageUrl).toBeNull();
    expect(view.course.published).toBe(false);
    // previews are private to the owner and drawn on request (never stored)
    const pv = await t.agent.get(`/api/instructor/courses/${c.id}/share-preview?family=marketplace`).expect(200);
    expect(pv.headers['cache-control']).toContain('no-store');
    expect((await prisma.course.findUnique({ where: { id: c.id } }))!.shareKey).toBeNull();
    const svc = app.get(SocialService);
    expect(await svc.ensureCourse(c.id)).toBeNull();
    await svc.refreshAll();
    expect((await prisma.course.findUnique({ where: { id: c.id } }))!.shareKey).toBeNull();
    // the marketplace cards of other banners never name a draft
    const pub = await course(t.user.id);
    const input = await svc.courseInput(pub.id, await svc.settings(), { family: 'marketplace' });
    expect(JSON.stringify(input)).not.toContain(c.title.split(':')[0]);
  });

  it('instructors change only their own courses\' banners; disabled templates are refused; changes are audited', async () => {
    if (!available) return;
    const t = await as('share-owner@e2e.example', ['student', 'instructor']);
    const other = await as('share-other@e2e.example', ['student', 'instructor']);
    const stu = await as('share-student@e2e.example', ['student']);
    const c = await course(t.user.id);
    await other.agent.get(`/api/instructor/courses/${c.id}/share`).expect(404);
    await other.send('put', `/api/instructor/courses/${c.id}/share`).send({ family: 'enterprise' }).expect(404);
    await stu.agent.get(`/api/instructor/courses/${c.id}/share`).expect(403);
    const before = (await t.agent.get(`/api/instructor/courses/${c.id}/share`).expect(200)).body;
    expect(before.effective).toEqual({ family: 'pro', template: 'aws' });
    const r = (await t.send('put', `/api/instructor/courses/${c.id}/share`).send({ family: 'enterprise', template: 'kubernetes', headline: 'Kubernetes for AI: Run it well' }).expect(200)).body;
    expect(r.effective).toEqual({ family: 'enterprise', template: 'kubernetes' });
    expect(r.imageUrl).not.toBe(before.imageUrl);
    expect(await prisma.auditLog.count({ where: { action: 'course.share_banner_changed', actorId: t.user.id, targetId: c.id } })).toBe(1);
    await t.send('put', `/api/instructor/courses/${c.id}/share`).send({ template: 'no-such' }).expect(400);
    await t.send('put', `/api/instructor/courses/${c.id}/share`).send({ family: 'pro', extra: 1 }).expect(400);

    // uploads: wrong size refused; a good one is re-encoded without its metadata
    await t.send('post', `/api/instructor/courses/${c.id}/share-upload`).attach('image', await png(800, 600), 'x.png').expect(400);
    const up = (await t.send('post', `/api/instructor/courses/${c.id}/share-upload`).attach('image', await png(1200, 630), 'x.png').expect(200)).body;
    expect(up.choice.uploadUrl).toMatch(new RegExp(`^/media/images/social/upload-${c.id}-[0-9a-f]{12}\\.(jpg|png)$`));
    const stored = await request(app.getHttpServer()).get(`/api${up.choice.uploadUrl}`).buffer(true).parse((res, cb) => { const b: Buffer[] = []; res.on('data', (x: Buffer) => b.push(x)); res.on('end', () => cb(null, Buffer.concat(b))); }).expect(200);
    expect((stored.body as Buffer).includes(Buffer.from('private-camera-data'))).toBe(false);
    expect((await request(app.getHttpServer()).get(`/api/courses/${c.slug}`)).body.share.path).toBe(up.choice.uploadUrl);
    const rm = (await t.send('delete', `/api/instructor/courses/${c.id}/share-upload`).expect(200)).body;
    expect(rm.choice.uploadUrl).toBeNull();
    expect(rm.imageUrl).toMatch(new RegExp(`^/media/images/social/${c.id}-`));
  });

  it('only a super admin reads or changes the sharing settings; saving redraws the site banner and is audited', async () => {
    if (!available) return;
    const sup = await as('share-super@e2e.example', ['student', 'admin', 'super_admin']);
    const adm = await as('share-admin@e2e.example', ['student', 'admin']);
    const t = await as('share-inst@e2e.example', ['student', 'instructor']);
    await adm.agent.get('/api/admin/social').expect(403);
    await adm.send('put', '/api/admin/social').send({ family: 'enterprise' }).expect(403);
    await t.agent.get('/api/admin/social').expect(403);
    await request(app.getHttpServer()).get('/api/admin/social').expect(401);

    const site1 = (await request(app.getHttpServer()).get('/api/social/site').expect(200)).body;
    expect(site1.image.path).toMatch(/^\/media\/images\/social\/site-[0-9a-f]{12}\.jpg$/);
    expect(site1.image.type).toBe('image/jpeg');
    const v = (await sup.agent.get('/api/admin/social').expect(200)).body;
    expect(v.templates.length).toBeGreaterThanOrEqual(10);
    expect(v.families.map((f: { key: string }) => f.key)).toEqual(['pro', 'marketplace', 'enterprise']);

    for (const fam of ['pro', 'marketplace', 'enterprise']) {
      const p = await sup.agent.get(`/api/admin/social/preview?family=${fam}&draft=${encodeURIComponent(JSON.stringify({ title: 'Preview title here' }))}`).expect(200);
      expect(p.headers['content-type']).toBe('image/jpeg');
    }
    await sup.agent.get(`/api/admin/social/preview?family=pro&draft=${encodeURIComponent('{"title":1}')}`).expect(400);

    const saved = (await sup.send('put', '/api/admin/social').send({ family: 'marketplace', title: 'Learn AI and DevOps', disabledTemplates: ['aws'] }).expect(200)).body;
    expect(saved.settings.family).toBe('marketplace');
    const site2 = (await request(app.getHttpServer()).get('/api/social/site').expect(200)).body;
    expect(site2.title).toBe('Learn AI and DevOps');
    expect(site2.image.path).not.toBe(site1.image.path);
    expect(await prisma.auditLog.count({ where: { action: 'social.settings_updated', actorId: sup.user.id } })).toBe(1);
    // a disabled template is no longer offered and its courses fall back
    const c = await course(t.user.id);
    expect((await t.agent.get(`/api/instructor/courses/${c.id}/share`).expect(200)).body.effective.template).toBe('general');
    await t.send('put', `/api/instructor/courses/${c.id}/share`).send({ template: 'aws' }).expect(400);
    await sup.send('put', '/api/admin/social').send({ family: 'nope' }).expect(400);

    // site upload: validated, then restore defaults removes it
    await sup.send('post', '/api/admin/social/site-upload').attach('image', await png(1200, 1200), 'sq.png').expect(400);
    const up = (await sup.send('post', '/api/admin/social/site-upload').attach('image', await png(2400, 1260), 'big.png').expect(200)).body;
    expect(up.siteUploadUrl).toMatch(/^\/media\/images\/social\/upload-site-[0-9a-f]{12}\.(jpg|png)$/);
    expect((await request(app.getHttpServer()).get('/api/social/site')).body.image.path).toBe(up.siteUploadUrl);
    const img = await request(app.getHttpServer()).get('/api/social/site-image').expect(200);
    expect(img.headers['content-type']).toMatch(/^image\//);
    const restored = (await sup.send('post', '/api/admin/social/restore-defaults').expect(200)).body;
    expect(restored.settings.family).toBe('pro');
    expect(restored.siteUploadUrl).toBeNull();
    expect(await prisma.auditLog.count({ where: { action: { in: ['social.site_banner_uploaded', 'social.settings_restored'] }, actorId: sup.user.id } })).toBe(2);

    // super admins may set any course's banner; plain admins may not
    await adm.agent.get(`/api/admin/courses/${c.id}/share`).expect(403);
    const set = (await sup.send('put', `/api/admin/courses/${c.id}/share`).send({ family: 'marketplace' }).expect(200)).body;
    expect(set.effective.family).toBe('marketplace');
  });
});
