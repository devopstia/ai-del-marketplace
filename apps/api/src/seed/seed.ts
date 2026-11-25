/**
 * Local seed (idempotent): `npm run seed -w apps/api` or, in Docker, `docker compose exec api npm run seed`.
 * Accounts use SEED_PASSWORD from .env. Generates short sample videos (ffmpeg test pattern + tone), a WebVTT file,
 * a lab ZIP and thumbnails, and uploads them to the private bucket. Re-running updates accounts and skips courses
 * that already exist. Creates no reviews or ratings. Then run `npm run import:del` for the real DEL catalogue.
 */
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ARGON2_OPTS } from '../auth/auth.service';
import { seal } from '../common/seal';
import { DEFAULT_COMMISSION_BPS } from '../common/pricing';
import { StorageService } from '../common/storage.service';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';
import type { Role } from '../generated/prisma/enums';
import { CATEGORIES, COURSES, SeedCourse } from './content';
import { makeZip } from './zip';
import { databaseSsl } from '../common/prisma.service';

const e = env();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: e.DATABASE_URL, ssl: databaseSsl() }) });
const storage = new StorageService();
const work = mkdtempSync(join(tmpdir(), 'del-seed-'));
const log = (m: string) => console.log(`[seed] ${m}`);

function ffmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

const videoCache = new Map<string, string>();
function sampleVideo(durationSec: number, tone: number): string {
  const key = `${durationSec}-${tone}`;
  const hit = videoCache.get(key);
  if (hit) return hit;
  const out = join(work, `v-${key}.mp4`);
  ffmpeg([
    '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=25:duration=${durationSec}`,
    '-f', 'lavfi', '-i', `sine=frequency=${tone}:duration=${durationSec}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-b:v', '250k',
    '-c:a', 'aac', '-b:a', '64k', '-shortest', '-movflags', '+faststart', out,
  ]);
  videoCache.set(key, out);
  return out;
}

function probe(file: string): number {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString();
  return Math.round(Number.parseFloat(out));
}

function thumbnail(colors: [string, string]): Buffer {
  const out = join(work, `t-${colors.join('-')}.png`);
  ffmpeg(['-f', 'lavfi', '-i', `gradients=s=640x360:c0=${colors[0]}:c1=${colors[1]}:x0=0:y0=0:x1=640:y1=360:n=2`, '-frames:v', '1', out]);
  return readFileSync(out);
}

function vtt(durationSec: number): string {
  const ts = (s: number) => `00:00:${String(s).padStart(2, '0')}.000`;
  const lines = ['Welcome to the course.', 'This sample video is a test pattern with a tone.', 'Captions like these come from a WebVTT file.'];
  const step = Math.max(1, Math.floor(durationSec / lines.length));
  return 'WEBVTT\n\n' + lines.map((l, i) => `${i + 1}\n${ts(i * step)} --> ${ts(Math.min(durationSec, (i + 1) * step))}\n${l}\n`).join('\n');
}

/** Local demo accounts get the authenticator seed from SEED_MFA_SECRET, so tests and demos can sign in (docs/AUTH.md). */
function demoMfa() {
  const secret = env().SEED_MFA_SECRET.trim().toUpperCase();
  if (!secret || env().NODE_ENV === 'production') return {};
  if (!/^[A-Z2-7]{16,64}$/.test(secret)) throw new Error('SEED_MFA_SECRET must be base32 (A-Z, 2-7), 16+ characters');
  return { mfaSecret: seal('mfa', secret), mfaEnabledAt: new Date(), mfaLastStep: null };
}

async function upsertUser(email: string, name: string, roles: Role[], passwordHash: string) {
  const mfa = demoMfa();
  return prisma.user.upsert({
    where: { email },
    create: { email, name, roles, passwordHash, passwordChangedAt: new Date(), signupMethod: 'seed', emailVerifiedAt: new Date(), ...mfa },
    update: { name, roles, passwordHash, status: 'active', failedLogins: 0, lockedUntil: null, signupMethod: 'seed', emailVerifiedAt: new Date(), ...mfa },
  });
}

async function seedCourse(c: SeedCourse, idx: number, ownerId: string, categoryId: string) {
  const existing = await prisma.course.findUnique({ where: { slug: c.slug } });
  if (existing) {
    log(`course exists, skipping: ${c.slug}`);
    return existing;
  }
  const course = await prisma.course.create({
    data: {
      slug: c.slug,
      instructorId: ownerId,
      categoryId,
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      level: c.level,
      priceCents: c.priceCents,
      objectives: c.objectives,
      requirements: c.requirements,
      status: 'published',
      publishedAt: new Date(Date.now() - (COURSES.length - idx) * 86400_000),
    },
  });
  const thumbKey = `images/${ownerId}/${course.id}.png`;
  await storage.put(thumbKey, thumbnail(c.colors), 'image/png');
  // Generated gradient thumbnails look generic; the web app draws a titled cover when none is set. Opt in with SEED_THUMBNAILS=true.
  if (process.env.SEED_THUMBNAILS === 'true') await prisma.course.update({ where: { id: course.id }, data: { thumbnailKey: thumbKey } });

  let n = 0;
  for (const [si, s] of c.sections.entries()) {
    const section = await prisma.section.create({ data: { courseId: course.id, title: s.title, position: si } });
    for (const [li, l] of s.lectures.entries()) {
      const type = l.type ?? 'video';
      const lecture = await prisma.lecture.create({
        data: { sectionId: section.id, title: l.title, position: li, type, isPreview: !!l.preview, articleMd: l.article ?? null, durationSec: type === 'article' ? 120 : type === 'quiz' ? 180 : 0 },
      });
      if (type === 'video') {
        const duration = 10 + ((idx * 3 + n * 4) % 11); // 10–20 s
        const file = sampleVideo(duration, c.tone);
        const asset = await prisma.videoAsset.create({ data: { ownerId, provider: 'local', status: 'uploading' } });
        const key = `videos/${asset.id}/source.mp4`;
        await storage.put(key, readFileSync(file), 'video/mp4');
        const durationSec = probe(file);
        // Captions are available (the player shows them off by default).
        let captionsKey: string | null = null;
        if (l.captions) {
          captionsKey = `videos/${asset.id}/captions.vtt`;
          await storage.put(captionsKey, vtt(durationSec), 'text/vtt');
        }
        await prisma.videoAsset.update({ where: { id: asset.id }, data: { storageKey: key, status: 'ready', durationSec, captionsKey } });
        await prisma.lecture.update({ where: { id: lecture.id }, data: { videoAssetId: asset.id, durationSec } });
        if (idx === 0 && n === 0) await prisma.course.update({ where: { id: course.id }, data: { promoVideoAssetId: asset.id } });
        n++;
      }
      if (l.quiz) await prisma.quiz.create({ data: { lectureId: lecture.id, questions: l.quiz } });
      if (l.resourceZip) {
        const zip = makeZip([
          { name: 'lab/README.md', content: '# Lab: advisory AI review step\n\n1. Copy `.github/workflows/ai-review.yml` into your repository.\n2. Add the secret `AI_API_KEY` (never commit it).\n3. Open a pull request and read the advisory comment.\n' },
          { name: 'lab/.github/workflows/ai-review.yml', content: 'name: ai-review\non: [pull_request]\npermissions:\n  contents: read\n  pull-requests: write\njobs:\n  review:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo "advisory review would run here"\n' },
          { name: 'lab/.env.example', content: 'AI_API_KEY=\n' },
        ]);
        const key = `resources/${ownerId}/${lecture.id}/ai-review-lab.zip`;
        await storage.put(key, zip, 'application/zip');
        await prisma.resource.create({ data: { lectureId: lecture.id, title: 'Lab files (ZIP)', storageKey: key, sizeBytes: zip.length, mime: 'application/zip' } });
      }
    }
  }
  log(`course created: ${c.slug}`);
  return course;
}

async function main() {
  if (!e.SEED_PASSWORD || e.SEED_PASSWORD.length < 8) throw new Error('Set SEED_PASSWORD (8+ chars) in .env before seeding');
  // Demo data only locally and on the staging copy; never on the real marketplace (owner 2026-11-25).
  if (e.NODE_ENV === 'production' && e.DEPLOY_ENV !== 'staging') throw new Error('Refusing to seed demo data in production');
  const hash = await argon2.hash(e.SEED_PASSWORD, ARGON2_OPTS);

  const admin = await upsertUser('admin@del.example', 'Platform Admin', ['student', 'admin', 'super_admin'], hash);
  const del = await upsertUser('courses@del.example', 'DevOps Easy Learning', ['student', 'instructor'], hash);
  const nadia = await upsertUser('nadia@instructor.example', 'Nadia Rahman', ['student', 'instructor'], hash);
  const student = await upsertUser('student@del.example', 'Sam Student', ['student'], hash);
  await prisma.instructorProfile.upsert({
    where: { userId: del.id },
    create: { userId: del.id, status: 'approved', isPlatform: true, payoutsEnabled: false, headline: 'Practical AI and DevOps courses', bio: 'DevOps Easy Learning teaches AI for DevOps with hands-on labs and everyday scenarios.', website: 'https://example.com' },
    update: { status: 'approved', isPlatform: true },
  });
  await prisma.instructorProfile.upsert({
    where: { userId: nadia.id },
    create: { userId: nadia.id, status: 'approved', headline: 'SRE and automation engineer', bio: 'Nadia has run on-call rotations for ten years and now automates the boring parts with n8n and language models.' },
    update: { status: 'approved' },
  });
  log('users ready: admin@del.example, courses@del.example, nadia@instructor.example, student@del.example');

  const cats = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({ where: { slug: c.slug }, create: { ...c, sort: i }, update: { name: c.name, icon: c.icon, sort: i } });
    cats.set(c.slug, row.id);
  }
  await prisma.platformSetting.upsert({ where: { key: 'commission_bps' }, create: { key: 'commission_bps', value: DEFAULT_COMMISSION_BPS }, update: {} });

  // Once the real DEL catalogue is imported (npm run import:del), the demo DEL courses are not recreated.
  const imported = await prisma.course.count({ where: { instructorId: del.id, slug: { notIn: COURSES.map((c) => c.slug) } } });
  if (imported) log('real DEL catalogue present: demo DEL courses skipped');
  const courses = [];
  for (const [i, c] of COURSES.entries()) {
    if (imported && c.owner === 'del') continue;
    courses.push(await seedCourse(c, i, c.owner === 'del' ? del.id : nadia.id, cats.get(c.category)!));
  }

  // No invented reviews or ratings (owner rule: reviews only from real enrolled learners). Learner counts are real rows.
  for (const course of courses) {
    const students = await prisma.enrollment.count({ where: { courseId: course.id, revokedAt: null } });
    await prisma.course.update({ where: { id: course.id }, data: { studentCount: students } });
  }

  // The demo student owns the free course, so My Learning isn't empty; paid courses are left to buy.
  const free = courses.find((c) => c.priceCents === 0);
  if (free) {
    const key = { userId_courseId: { userId: student.id, courseId: free.id } };
    if (!(await prisma.enrollment.findUnique({ where: key }))) {
      await prisma.enrollment.create({ data: { userId: student.id, courseId: free.id, source: 'free' } });
      await prisma.course.update({ where: { id: free.id }, data: { studentCount: { increment: 1 } } });
    }
  }
  await prisma.auditLog.create({ data: { actorId: admin.id, action: 'seed.run', targetType: 'system', meta: { courses: courses.length } } });
  log(`done: ${courses.length} courses, ${CATEGORIES.length} categories`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rmSync(work, { recursive: true, force: true });
    await prisma.$disconnect();
  });
