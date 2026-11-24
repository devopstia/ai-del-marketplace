/**
 * Import the real DevOps Easy Learning catalogue (PHASE1 A10). Idempotent: run it again after new videos are
 * finished and only what changed is uploaded/updated; learners keep their progress (stable ids).
 *
 *   ./scripts/import-del.sh            (mounts the source READ-ONLY into a one-off api container)
 *   npm run import:del                 (inside a container where DEL_SOURCE_DIR is mounted)
 *
 * Source (never written): $DEL_SOURCE_DIR = ai-videos/projects/ai-devops
 *   output/<NN-category>/<NN>-<id>.mp4, -thumbnail.png, -lab.zip, captions/<NN>-<id>.en.srt (→ WebVTT; the player
 *   shows captions off by default, learners can turn them on)
 *   branding/plan.mjs (PLAN: titles, order, audience) · tutorials/<id>.mjs (subtitle, quizSet([...]))
 * The .mjs files are READ as text and only their literals are parsed (js-literal.ts); nothing is executed.
 *
 * Also: replaces the seed's demo DEL courses, removes the seed's invented reviews (no fake ratings), and keeps
 * the demo student enrolled in the free course. Needs the seed to have run (accounts + categories).
 */
import 'reflect-metadata';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { StorageService } from '../common/storage.service';
import { env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';
import type { CourseLevel } from '../generated/prisma/enums';
import type { CourseTree, TreeLecture, TreeQuestion, TreeSection } from '../instructor/course-tree';
import { applyTree } from '../instructor/revisions.service';
import { CATALOGUE, DEMO_DEL_SLUGS, FAKE_REVIEWER_EMAILS, priceForDuration } from './del-catalogue';
import { srtToVtt } from './srt';
import { defaultExportString, firstArgOfCall, isCall, LiteralReader, ParseError } from './js-literal';

const log = (m: string) => console.log(`[import] ${m}`);
const warn = (m: string) => console.warn(`[import] WARN ${m}`);

/** Deterministic UUID (v5-style, SHA-1) so re-imports update the same rows. */
export function stableId(name: string): string {
  const h = createHash('sha1').update(`del-import:${name}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export interface PlanEntry {
  category: string;
  order: number;
  id: string;
  title: string;
  short: string;
  audience: string;
}

/** Reads PLAN from plan.mjs: `export const PLAN = [ E(...), ... ]` with literal arguments only. */
export function parsePlan(src: string): PlanEntry[] {
  const start = src.search(/export\s+const\s+PLAN\s*=\s*\[/);
  if (start < 0) throw new ParseError('PLAN not found');
  const r = new LiteralReader(src, src.indexOf('[', start), new Set(['E']));
  const list = r.value();
  if (!Array.isArray(list)) throw new ParseError('PLAN is not an array');
  return list.flatMap((item) => {
    if (!isCall(item) || item.call !== 'E') return [];
    const [category, order, id, title, short, audience] = item.args;
    if (typeof category !== 'string' || typeof order !== 'number' || typeof id !== 'string' || typeof title !== 'string') return [];
    return [{ category, order, id, title, short: typeof short === 'string' ? short : title, audience: typeof audience === 'string' ? audience : '' }];
  });
}

/** quizSet([...]) items → our quiz questions (3–5 options, valid answer index). Invalid items are dropped. */
export function parseQuiz(src: string): TreeQuestion[] | null {
  const raw = firstArgOfCall(src, 'quizSet');
  if (raw === null) return null;
  if (!Array.isArray(raw)) throw new ParseError('quizSet argument is not an array');
  const out: TreeQuestion[] = [];
  for (const it of raw as Record<string, unknown>[]) {
    const { q, options, correct, why } = it ?? {};
    if (typeof q !== 'string' || !Array.isArray(options) || !options.every((o) => typeof o === 'string')) continue;
    if (options.length < 3 || options.length > 5 || typeof correct !== 'number' || correct < 0 || correct >= options.length) continue;
    out.push({ q: q.slice(0, 500), options: options.map((o: string) => o.slice(0, 300)), correct, why: typeof why === 'string' && why.trim() ? why.slice(0, 1000) : 'See the lesson.' });
  }
  return out.length ? out : null;
}

export function levelOf(audiences: string[]): CourseLevel {
  const n = { beginner: 0, intermediate: 0, advanced: 0 };
  for (const a of audiences) {
    if (/advanced/i.test(a)) n.advanced++;
    else if (/intermediate/i.test(a)) n.intermediate++;
    else n.beginner++;
  }
  // majority; a tie goes to the harder level
  if (n.advanced >= n.intermediate && n.advanced >= n.beginner && n.advanced > 0) return 'advanced';
  if (n.intermediate >= n.beginner && n.intermediate > 0) return 'intermediate';
  return 'beginner';
}

/** "AI terminology: the big words (…)" → "The big words (…)": the course title already says it is terminology. */
export function lectureTitle(title: string): string {
  const t = title.replace(/^AI terminology:\s*/i, '');
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 200);
}

function probe(file: string): number {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString();
  const d = Math.round(Number.parseFloat(out));
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe: no duration for ${file}`);
  return d;
}

interface Video {
  nn: string;
  id: string;
  mp4: string;
  plan: PlanEntry | undefined;
}

async function main() {
  const e = env();
  if (e.NODE_ENV === 'production') throw new Error('Refusing to run the demo import in production');
  const root = process.env.DEL_SOURCE_DIR ?? '/import/ai-devops';
  const outDir = join(root, 'output');
  if (!existsSync(outDir)) throw new Error(`Source not found: ${outDir} (mount it read-only and set DEL_SOURCE_DIR)`);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: e.DATABASE_URL }) });
  const storage = new StorageService();
  const totals = { courses: 0, lectures: 0, quizzes: 0, questions: 0, resources: 0, captions: 0, durationSec: 0, uploadedBytes: 0, skippedUploads: 0 };

  try {
    const del = await prisma.user.findUnique({ where: { email: 'courses@del.example' }, include: { instructorProfile: true } });
    if (!del?.instructorProfile?.isPlatform) throw new Error('Run the seed first: the DevOps Easy Learning platform instructor is missing');
    const categories = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));

    const planFile = join(root, 'branding', 'plan.mjs');
    const plan = existsSync(planFile) ? parsePlan(readFileSync(planFile, 'utf8')) : [];
    if (!plan.length) warn('plan.mjs not found or empty: titles fall back to file names');
    const planById = new Map(plan.map((p) => [p.id, p]));
    log(`plan: ${plan.length} entries`);

    /** Upload unless the object is already there with the same size. */
    const upload = async (key: string, file: string, contentType: string) => {
      const size = statSync(file).size;
      const head = await storage.head(key);
      if (head && head.size === size) {
        totals.skippedUploads++;
        return size;
      }
      await storage.putFile(key, file, contentType);
      totals.uploadedBytes += size;
      return size;
    };

    const importedSlugs: string[] = [];
    let freeCourseId: string | null = null;
    const folders = readdirSync(outDir, { withFileTypes: true }).filter((d) => d.isDirectory() && /^\d+-/.test(d.name)).map((d) => d.name).sort();
    for (const folder of folders) {
      const dir = join(outDir, folder);
      const category = folder.replace(/^\d+-/, '');
      const videos: Video[] = readdirSync(dir)
        .map((f) => /^(\d+)-(.+)\.mp4$/.exec(f))
        .filter((m): m is RegExpExecArray => !!m)
        .map((m) => ({ nn: m[1], id: m[2], mp4: join(dir, m[0]), plan: planById.get(m[2]) }))
        .sort((a, b) => (a.plan?.order ?? Number(a.nn)) - (b.plan?.order ?? Number(b.nn)) || a.nn.localeCompare(b.nn));
      if (!videos.length) continue;
      const def = CATALOGUE[category];
      if (!def) {
        warn(`no course definition for ${folder} (${videos.length} videos): skipped; add it to del-catalogue.ts`);
        continue;
      }
      const categoryId = categories.get(def.category);
      if (!categoryId) throw new Error(`Category ${def.category} is missing: run the seed first`);
      log(`${folder}: ${videos.length} videos → ${def.title}`);

      const previews = videos.length >= 3 ? 2 : videos.length - 1; // never the whole course
      const lectures = new Map<string, TreeLecture>();
      let lastVerified = 0;
      let thumbnailKey: string | null = null;
      for (const [i, v] of videos.entries()) {
        if (!v.plan) warn(`${v.id}: not in plan.mjs (title from the file name)`);
        const assetId = stableId(`video:${v.id}`);
        const videoKey = `videos/del-${v.id}/source.mp4`;
        await upload(videoKey, v.mp4, 'video/mp4');
        lastVerified = Math.max(lastVerified, statSync(v.mp4).mtimeMs);
        const durationSec = probe(v.mp4);
        totals.durationSec += durationSec;

        let captionsKey: string | null = null;
        const srt = join(dir, 'captions', `${v.nn}-${v.id}.en.srt`);
        if (existsSync(srt)) {
          captionsKey = `videos/del-${v.id}/captions.en.vtt`;
          await storage.put(captionsKey, srtToVtt(readFileSync(srt, 'utf8')), 'text/vtt');
          totals.captions++;
        } else warn(`${v.id}: no captions`);

        await prisma.videoAsset.upsert({
          where: { id: assetId },
          create: { id: assetId, ownerId: del.id, provider: 'local', status: 'ready', storageKey: videoKey, durationSec, captionsKey },
          update: { ownerId: del.id, provider: 'local', status: 'ready', storageKey: videoKey, durationSec, captionsKey, error: null },
        });

        const thumb = join(dir, `${v.nn}-${v.id}-thumbnail.png`);
        if (i === 0 && existsSync(thumb)) {
          thumbnailKey = `images/${del.id}/del-${v.id}.png`;
          await upload(thumbnailKey, thumb, 'image/png');
        }

        const resources = [];
        const zip = join(dir, `${v.nn}-${v.id}-lab.zip`);
        if (existsSync(zip)) {
          const key = `resources/${del.id}/del-${v.id}/${v.nn}-${v.id}-lab.zip`;
          const sizeBytes = await upload(key, zip, 'application/zip');
          resources.push({ id: stableId(`resource:${v.id}:lab`), title: 'Lab files (ZIP)', storageKey: key, sizeBytes, mime: 'application/zip' });
          totals.resources++;
        }

        let quiz: TreeQuestion[] | null = null;
        let summary = '';
        const tutorial = join(root, 'tutorials', `${v.id}.mjs`);
        if (existsSync(tutorial)) {
          const src = readFileSync(tutorial, 'utf8');
          try {
            quiz = parseQuiz(src);
          } catch (err) {
            warn(`${v.id}: quiz not imported (${(err as Error).message})`);
          }
          summary = (defaultExportString(src, 'subtitle') ?? '').slice(0, 300);
        } else warn(`${v.id}: no tutorial source (no quiz, no summary)`);
        if (quiz) {
          totals.quizzes++;
          totals.questions += quiz.length;
        }

        lectures.set(v.id, {
          id: stableId(`lecture:${v.id}`),
          title: lectureTitle(v.plan?.title ?? v.id.replace(/-/g, ' ')),
          type: 'video',
          isPreview: i < previews,
          articleMd: null,
          summary,
          videoAssetId: assetId,
          durationSec,
          resources,
          quiz,
        });
      }

      // Sections from the catalogue, in plan order inside each; unlisted videos go to the last section.
      const listed = new Set(def.sections.flatMap((s) => s.ids));
      const sections: TreeSection[] = def.sections
        .map((s) => ({ id: stableId(`section:${def.slug}:${s.title}`), title: s.title, lectures: videos.filter((v) => s.ids.includes(v.id)).map((v) => lectures.get(v.id)!) }))
        .filter((s) => s.lectures.length);
      const extra = videos.filter((v) => !listed.has(v.id));
      if (extra.length) {
        warn(`${folder}: ${extra.map((v) => v.id).join(', ')} not in a section: added to "More lessons"`);
        sections.push({ id: stableId(`section:${def.slug}:more`), title: 'More lessons', lectures: extra.map((v) => lectures.get(v.id)!) });
      }
      for (const s of def.sections) for (const id of s.ids) if (!lectures.has(id)) warn(`${def.slug}: "${id}" has no finished video yet`);
      // Preview flags follow the final order (first two lectures of the course).
      sections.flatMap((s) => s.lectures).forEach((l, i) => (l.isPreview = i < previews));

      const courseDuration = sections.flatMap((s) => s.lectures).reduce((n, l) => n + l.durationSec, 0);
      const audiences = videos.map((v) => v.plan?.audience ?? '');
      const tree: CourseTree = {
        version: 1,
        course: {
          title: def.title,
          subtitle: def.subtitle,
          description: def.description,
          language: 'en',
          level: levelOf(audiences),
          objectives: def.objectives,
          requirements: def.requirements,
          priceCents: def.free ? 0 : priceForDuration(courseDuration),
          categoryId,
          thumbnailKey,
          promoVideoAssetId: null,
        },
        sections,
      };

      const existing = await prisma.course.findUnique({ where: { slug: def.slug } });
      if (existing && existing.instructorId !== del.id) throw new Error(`Slug ${def.slug} belongs to another instructor`);
      const courseId = existing?.id ?? stableId(`course:${def.slug}`);
      await prisma.$transaction(
        async (tx) => {
          if (!existing) {
            await tx.course.create({ data: { id: courseId, slug: def.slug, instructorId: del.id, title: def.title, status: 'published', publishedAt: new Date() } });
          }
          await applyTree(tx, courseId, tree, { ownerId: del.id, requireReady: true });
          await tx.course.update({
            where: { id: courseId },
            data: { status: 'published', publishedAt: existing?.publishedAt ?? new Date(), lastVerifiedAt: new Date(lastVerified), reviewNote: null },
          });
          // An import is the source of truth for DEL's catalogue: an open studio revision would be stale.
          await tx.courseRevision.updateMany({ where: { courseId, status: { in: ['draft', 'in_review', 'changes_requested'] } }, data: { status: 'rejected', reviewNote: 'Replaced by a catalogue import' } });
        },
        { timeout: 120_000, maxWait: 10_000 },
      );
      if (def.free) freeCourseId = courseId;
      importedSlugs.push(def.slug);
      totals.courses++;
      totals.lectures += videos.length;
      log(`  ${existing ? 'updated' : 'created'}: ${def.slug} · ${videos.length} lectures · ${Math.round(courseDuration / 60)} min · ${tree.course.priceCents ? `$${(tree.course.priceCents / 100).toFixed(2)}` : 'free'} · ${tree.course.level}`);
    }

    // The seed's demo DEL courses are replaced by the real ones.
    for (const slug of DEMO_DEL_SLUGS) {
      const c = await prisma.course.findFirst({ where: { slug, instructorId: del.id } });
      if (!c) continue;
      if (await prisma.orderLine.count({ where: { courseId: c.id } })) {
        await prisma.course.update({ where: { id: c.id }, data: { status: 'unpublished', reviewNote: 'Replaced by the real DevOps Easy Learning catalogue' } });
        await prisma.cartItem.deleteMany({ where: { courseId: c.id } });
        log(`demo course unpublished (it has orders): ${slug}`);
      } else {
        await prisma.course.delete({ where: { id: c.id } });
        log(`demo course removed: ${slug}`);
      }
    }

    // No fake ratings: the seed's invented reviews and the enrolments made only for them go away.
    const fakes = await prisma.user.findMany({ where: { email: { in: FAKE_REVIEWER_EMAILS } }, select: { id: true } });
    const fakeIds = fakes.map((f) => f.id);
    const touched = new Set((await prisma.review.findMany({ where: { userId: { in: fakeIds } }, select: { courseId: true } })).map((r) => r.courseId));
    const removedReviews = await prisma.review.deleteMany({ where: { userId: { in: fakeIds } } });
    for (const en of await prisma.enrollment.findMany({ where: { userId: { in: fakeIds }, source: 'admin' }, select: { courseId: true } })) touched.add(en.courseId);
    await prisma.enrollment.deleteMany({ where: { userId: { in: fakeIds }, source: 'admin' } });
    log(`invented reviews removed: ${removedReviews.count}`);

    // The demo student keeps a course in My learning: the free AI Foundations course.
    const student = await prisma.user.findUnique({ where: { email: 'student@del.example' }, select: { id: true } });
    if (student && freeCourseId) {
      const key = { userId_courseId: { userId: student.id, courseId: freeCourseId } };
      if (!(await prisma.enrollment.findUnique({ where: key }))) await prisma.enrollment.create({ data: { userId: student.id, courseId: freeCourseId, source: 'free' } });
      touched.add(freeCourseId);
    }

    // Ratings and learner counts come only from real rows.
    const recount = await prisma.course.findMany({ where: { OR: [{ id: { in: [...touched] } }, { instructorId: del.id }] }, select: { id: true } });
    for (const { id } of recount) {
      const [agg, students] = await Promise.all([
        prisma.review.aggregate({ where: { courseId: id, status: 'visible' }, _avg: { rating: true }, _count: { _all: true } }),
        prisma.enrollment.count({ where: { courseId: id, revokedAt: null } }),
      ]);
      await prisma.course.update({ where: { id }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all, studentCount: students } });
    }

    await prisma.auditLog.create({ data: { actorId: null, action: 'catalogue.imported', targetType: 'system', meta: { source: 'ai-devops/output', slugs: importedSlugs, ...totals } } });
    log(
      `done: ${totals.courses} courses, ${totals.lectures} lectures (${Math.round(totals.durationSec / 60)} min), ${totals.quizzes} quizzes / ${totals.questions} questions, ` +
        `${totals.resources} lab ZIPs, ${totals.captions} caption files; uploaded ${(totals.uploadedBytes / 1e6).toFixed(0)} MB, ${totals.skippedUploads} files already present`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
