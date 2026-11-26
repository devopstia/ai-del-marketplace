#!/usr/bin/env node
/**
 * del-publish-course: sync a course plan to the marketplace through the agent API (owner 2026-11-26, Course Upload and
 * Publishing Agent; .claude/skills/del-course-publisher/SKILL.md).
 *
 *   DEL_AGENT_TOKEN=del_agent_… node dist/publish.js courses/<course>/plan.json [--dry-run] [--wait 45]
 *
 * Idempotent: the course, its sections and lessons are matched (state file, then title) and never duplicated; files are
 * de-duplicated by checksum on the server; a lesson's file is attached once per title. Re-running after new videos are
 * added to the plan uploads only what is new and re-arranges the curriculum in plan order. Never publishes.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { ApiError, DelClient } from './client.js';

// ---------- plan ----------
export interface LessonPlan { folder: string; title: string; summary?: string; preview?: boolean }
export interface SectionPlan { title: string; lessons: LessonPlan[] }
export interface CoursePlan {
  environment: 'staging' | 'production';
  apiUrl: string;
  provider: string;
  /** Name of the account the agent token belongs to (checked with whoami before anything is written). */
  instructorName: string;
  sourceDir: string;
  course: {
    title: string; subtitle?: string; description?: string; level?: 'beginner' | 'intermediate' | 'advanced'; language?: string;
    objectives?: string[]; requirements?: string[]; categorySlug?: string; priceCents?: number;
    /** DEL courses only: the instructor name shown ("Taught by Tia"). */
    taughtBy?: string;
    /** "suggested" (the template the platform suggests for the category) or a template id. */
    cover?: string;
  };
  sections: SectionPlan[];
}

// ---------- upload rules (skill: del-course-publisher) ----------
const VIDEO = new Set(['.mp4', '.m4v', '.mov', '.webm']);
const NEVER = [/^\.env$/i, /\.pem$/i, /\.key$/i, /^id_(rsa|ed25519|ecdsa)/i, /credential/i, /secret.*\.(json|txt|ya?ml)$/i];
const SKIP_EXT = new Set(['.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.psd', '.aep', '.prproj', '.tmp', '.log', '.md']);

export interface LessonFiles { video?: string; captions?: string; slides?: string; lab?: string; skipped: { file: string; why: string }[]; problems: string[] }

/** What a lesson folder holds, by the upload rules: one video, captions, the PDF slides, the lab ZIP; never PowerPoint or secrets. */
export async function discover(folder: string): Promise<LessonFiles> {
  const out: LessonFiles = { skipped: [], problems: [] };
  if (!existsSync(folder)) return { ...out, problems: [`folder not found: ${folder}`] };
  const names = (await readdir(folder, { withFileTypes: true })).filter((e) => e.isFile()).map((e) => e.name).sort();
  const videos = names.filter((n) => VIDEO.has(extname(n).toLowerCase()));
  if (videos.length === 1) out.video = join(folder, videos[0]!);
  else if (!videos.length) out.problems.push('no video');
  else out.problems.push(`several videos: ${videos.join(', ')}`);
  const pdfs = names.filter((n) => extname(n).toLowerCase() === '.pdf');
  out.slides = pdfs.find((n) => /presentation|slides/i.test(n)) ? join(folder, pdfs.find((n) => /presentation|slides/i.test(n))!) : pdfs[0] ? join(folder, pdfs[0]) : undefined;
  if (!out.slides && names.some((n) => /\.pptx?$/i.test(n))) out.problems.push('PowerPoint without a PDF: convert it to PDF and check it first');
  const zips = names.filter((n) => extname(n).toLowerCase() === '.zip');
  out.lab = zips.find((n) => /lab|exercise/i.test(n)) ? join(folder, zips.find((n) => /lab|exercise/i.test(n))!) : zips[0] ? join(folder, zips[0]) : undefined;
  for (const n of names) {
    const p = join(folder, n);
    if ([out.video, out.slides, out.lab].includes(p)) continue;
    if (NEVER.some((r) => r.test(n))) out.skipped.push({ file: n, why: 'looks like a secret: never uploaded' });
    else if (SKIP_EXT.has(extname(n).toLowerCase())) out.skipped.push({ file: n, why: /\.pptx?$/i.test(n) ? 'PowerPoint: the PDF is uploaded instead' : 'production file, not for learners' });
    else out.skipped.push({ file: n, why: 'not part of the upload rules' });
  }
  const capDir = join(folder, 'captions');
  if (existsSync(capDir)) {
    const caps = (await readdir(capDir)).filter((n) => /\.(srt|vtt)$/i.test(n)).sort((a, b) => Number(/\.en\./.test(b)) - Number(/\.en\./.test(a)));
    if (caps[0]) out.captions = join(capDir, caps[0]);
  }
  return out;
}

export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80);
export const SLIDES_TITLE = 'Slides (PDF)';
export const LAB_TITLE = 'Hands-on lab (ZIP)';

// ---------- API shapes (subset) ----------
interface Resource { id: string; title: string }
interface Lecture { id: string; sectionId: string; title: string; summary: string; isPreview: boolean; videoAssetId: string | null; video: { id: string; status: string; durationSec: number; hasCaptions: boolean } | null; resources: Resource[] }
interface Section { id: string; title: string; lectures: Lecture[] }
interface CourseDetail { id: string; title: string; status: string; coverTemplateId: string | null; sections: Section[] }
interface State { courseId?: string; sections: Record<string, string>; lessons: Record<string, string> }

type Log = (msg: string) => void;

export async function publish(planPath: string, opts: { dryRun?: boolean; waitMinutes?: number; token?: string; log?: Log; fetchImpl?: typeof fetch } = {}) {
  const log = opts.log ?? ((m: string) => console.log(m));
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as CoursePlan;
  const planDir = dirname(resolve(planPath));
  const statePath = join(planDir, `state.${plan.environment}.json`);
  const state: State = existsSync(statePath) ? JSON.parse(await readFile(statePath, 'utf8')) : { sections: {}, lessons: {} };
  const saveState = () => writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  const report: string[] = [];
  const issues: string[] = [];
  const counts = { lessons: 0, videos: 0, videoSec: 0, slides: 0, labs: 0, captions: 0, uploaded: 0, reused: 0, failed: 0 };

  // 1. Inventory (no network).
  const inventory = new Map<string, LessonFiles>();
  for (const s of plan.sections) for (const l of s.lessons) {
    const f = await discover(join(plan.sourceDir, l.folder));
    inventory.set(l.folder, f);
    f.problems.forEach((p) => issues.push(`${l.folder}: ${p}`));
  }
  const planned = new Set(plan.sections.flatMap((s) => s.lessons.map((l) => l.folder)));
  const unplanned = (await readdir(plan.sourceDir, { withFileTypes: true })).filter((e) => e.isDirectory() && !planned.has(e.name)).map((e) => e.name);
  unplanned.forEach((d) => issues.push(`folder not in the plan (not uploaded): ${d}`));
  log(`Inventory: ${planned.size} lessons in ${plan.sections.length} sections; ${issues.length} issue(s).`);
  for (const [k, f] of inventory) log(`  ${k}: video ${f.video ? 'yes' : 'NO'}, captions ${f.captions ? 'yes' : 'no'}, slides ${f.slides ? 'yes' : 'no'}, lab ${f.lab ? 'yes' : 'no'}${f.skipped.length ? `; skipped ${f.skipped.map((x) => x.file.replace(k, '…')).join(', ')}` : ''}`);
  if (opts.dryRun) return { dryRun: true, issues, inventory: Object.fromEntries(inventory) };
  if ([...inventory.values()].some((f) => f.problems.length)) throw new Error(`Fix these before uploading:\n${issues.join('\n')}`);

  const token = opts.token ?? process.env.DEL_AGENT_TOKEN ?? '';
  const del = new DelClient(plan.apiUrl, token, [plan.sourceDir], opts.fetchImpl);

  // 2. Right account?
  const me = await del.call<{ instructor: { id: string; name: string } }>('GET', '/whoami');
  if (me.instructor.name !== plan.instructorName) throw new Error(`The token works for "${me.instructor.name}", the plan says "${plan.instructorName}". Nothing was changed.`);
  log(`Working for ${me.instructor.name} on ${plan.apiUrl}`);

  // 3. Course: state → title → create. Then the details.
  const cats = (await del.call<{ items: { id: string; slug: string }[] }>('GET', '/categories')).items;
  const categoryId = plan.course.categorySlug ? cats.find((c) => c.slug === plan.course.categorySlug)?.id : undefined;
  if (plan.course.categorySlug && !categoryId) throw new Error(`Unknown category ${plan.course.categorySlug}`);
  const mine = await del.call<{ id: string; title: string }[] | { items: { id: string; title: string }[] }>('GET', '/courses');
  const list = Array.isArray(mine) ? mine : mine.items;
  let courseId = state.courseId && list.some((c) => c.id === state.courseId) ? state.courseId : list.find((c) => c.title === plan.course.title)?.id;
  if (!courseId) {
    courseId = (await del.call<{ id: string }>('POST', '/courses', { title: plan.course.title })).id;
    log(`Created draft course ${courseId}`);
  } else log(`Using existing course ${courseId}`);
  state.courseId = courseId;
  await saveState();
  const { cover: _cover, categorySlug: _slug, ...fields } = plan.course;
  await del.call('PATCH', `/courses/${courseId}`, { ...fields, ...(categoryId ? { categoryId } : {}) });

  const detail = () => del.call<CourseDetail>('GET', `/courses/${courseId}`);
  let c = await detail();

  // 4. Sections and lessons.
  for (const sp of plan.sections) {
    let sec = c.sections.find((s) => s.id === state.sections[sp.title]) ?? c.sections.find((s) => s.title === sp.title);
    if (!sec) {
      const made = await del.call<{ id: string }>('POST', `/courses/${courseId}/sections`, { title: sp.title });
      c = await detail();
      sec = c.sections.find((s) => s.id === made.id)!;
      log(`+ section ${sp.title}`);
    }
    state.sections[sp.title] = sec.id;
    for (const lp of sp.lessons) {
      const files = inventory.get(lp.folder)!;
      const all = c.sections.flatMap((s) => s.lectures);
      let lec = all.find((l) => l.id === state.lessons[lp.folder]) ?? all.find((l) => l.title === lp.title);
      if (!lec) {
        const made = await del.call<{ id: string }>('POST', `/courses/${courseId}/sections/${sec.id}/lectures`, { title: lp.title, type: 'video', summary: lp.summary ?? '', isPreview: !!lp.preview });
        c = await detail();
        lec = c.sections.flatMap((s) => s.lectures).find((l) => l.id === made.id)!;
        log(`+ lesson ${lp.title}`);
      }
      state.lessons[lp.folder] = lec.id;
      await saveState();
      counts.lessons++;
      const patch: Record<string, unknown> = {};
      if (lec.title !== lp.title) patch.title = lp.title;
      if ((lec.summary ?? '') !== (lp.summary ?? '')) patch.summary = lp.summary ?? '';
      if (lec.isPreview !== !!lp.preview) patch.isPreview = !!lp.preview;

      // Video (checksum de-duplication makes a re-run cheap).
      try {
        const v = await del.upload(files.video!, { courseId, name: `${slug(lp.title)}${extname(files.video!)}` });
        if (v.duplicate) counts.reused++; else counts.uploaded++;
        if (lec.videoAssetId !== v.assetId) patch.videoAssetId = v.assetId;
        counts.videos++;
        if (files.captions && !(lec.video?.id === v.assetId && lec.video?.hasCaptions)) {
          try { await del.uploadCaptions(v.assetId!, files.captions); counts.captions++; } catch (e) { issues.push(`${lp.folder}: captions not uploaded: ${(e as Error).message}`); }
        } else if (files.captions) counts.captions++;
      } catch (e) {
        counts.failed++;
        issues.push(`${lp.folder}: video upload failed: ${(e as Error).message}`);
      }
      if (Object.keys(patch).length) await del.call('PATCH', `/courses/${courseId}/lectures/${lec.id}`, patch);

      // Study materials, attached once per title, with names learners understand.
      for (const [path, title, suffix, kind] of [[files.slides, SLIDES_TITLE, 'slides', 'slides'], [files.lab, LAB_TITLE, 'lab', 'labs']] as const) {
        if (!path) continue;
        if (lec.resources.some((r) => r.title === title)) { counts[kind]++; continue; }
        try {
          const r = await del.upload(path, { courseId, name: `${slug(lp.title)}-${suffix}${extname(path)}` });
          if (r.duplicate) counts.reused++; else counts.uploaded++;
          await del.call('POST', `/courses/${courseId}/lectures/${lec.id}/resources`, { title, storageKey: r.storageKey });
          counts[kind]++;
        } catch (e) {
          counts.failed++;
          issues.push(`${lp.folder}: ${title} failed: ${(e as Error).message}`);
        }
      }
      log(`  ✓ ${lp.title}`);
    }
  }
  await saveState();

  // 5. Curriculum in plan order; lessons and sections that are not in the plan stay, at the end, and are reported.
  c = await detail();
  const used = new Set<string>();
  const arranged = plan.sections.map((sp) => {
    const sid = state.sections[sp.title]!;
    const ids = sp.lessons.map((l) => state.lessons[l.folder]!).filter(Boolean);
    ids.forEach((i) => used.add(i));
    return { id: sid, lectureIds: ids };
  });
  for (const s of c.sections) {
    const extra = s.lectures.filter((l) => !used.has(l.id));
    extra.forEach((l) => issues.push(`lesson on the site but not in the plan (kept): ${l.title}`));
    const target = arranged.find((a) => a.id === s.id);
    if (target) target.lectureIds.push(...extra.map((l) => l.id));
    else { arranged.push({ id: s.id, lectureIds: extra.map((l) => l.id) }); issues.push(`section on the site but not in the plan (kept at the end): ${s.title}`); }
  }
  await del.call('PUT', `/courses/${courseId}/curriculum`, { sections: arranged });

  // 6. Cover from the platform templates (never a video frame).
  if (plan.course.cover && (!c.coverTemplateId || (plan.course.cover !== 'suggested' && plan.course.cover !== c.coverTemplateId))) {
    const t = await del.call<{ templates: { id: string; name?: string; suggested?: boolean }[] }>('GET', `/courses/${courseId}/covers`);
    const items = t.templates ?? [];
    const pick = plan.course.cover === 'suggested' ? (items.find((x) => x.suggested) ?? items[0]) : items.find((x) => x.id === plan.course.cover);
    if (pick) { await del.call('PUT', `/courses/${courseId}/cover`, { templateId: pick.id }); log(`Cover template ${pick.name ?? pick.id}`); }
    else issues.push('no cover template found');
  }

  // 7. Wait for video processing, then validate.
  const deadline = Date.now() + (opts.waitMinutes ?? 45) * 60_000;
  for (;;) {
    c = await detail();
    const vids = c.sections.flatMap((s) => s.lectures).map((l) => l.video).filter((v): v is NonNullable<Lecture['video']> => !!v);
    const pending = vids.filter((v) => v.status !== 'ready' && v.status !== 'failed');
    if (!pending.length || Date.now() > deadline) {
      counts.videoSec = vids.filter((v) => v.status === 'ready').reduce((n, v) => n + (v.durationSec || 0), 0);
      vids.filter((v) => v.status === 'failed').forEach((v) => issues.push(`video ${v.id} failed processing`));
      if (pending.length) issues.push(`${pending.length} video(s) still processing after the wait`);
      break;
    }
    log(`  waiting for ${pending.length} video(s) to finish processing…`);
    await new Promise((ok) => setTimeout(ok, 30_000));
  }
  const validation = await del.call<{ ok?: boolean; errors?: unknown[]; warnings?: unknown[] }>('GET', `/courses/${courseId}/validation`);
  const preview = await del.call<{ studioUrl?: string }>('GET', `/courses/${courseId}/preview`);

  const hms = (s: number) => `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
  report.push(
    `# Course upload report: ${plan.course.title}`, '',
    `| | |`, `|---|---|`,
    `| Environment | ${plan.environment} (${plan.apiUrl}) |`, `| Source | \`${plan.sourceDir}\` |`, `| Provider / account | ${plan.provider} / ${me.instructor.name} |`,
    `| Course id | ${courseId} |`, `| Studio | ${preview.studioUrl ?? ''} |`, `| Status | ${c.status} |`,
    `| Sections / lessons | ${c.sections.length} / ${c.sections.reduce((n, s) => n + s.lectures.length, 0)} |`,
    `| Videos | ${counts.videos} (${hms(counts.videoSec)} processed) |`, `| Captions | ${counts.captions} |`,
    `| Slides (PDF) / labs (ZIP) | ${counts.slides} / ${counts.labs} |`, `| Files sent / reused / failed | ${counts.uploaded} / ${counts.reused} / ${counts.failed} |`, '',
    `## Validation`, '```json', JSON.stringify(validation, null, 2), '```', '',
    `## Issues and skipped items`, ...(issues.length ? issues.map((i) => `- ${i}`) : ['- none']), '',
    `## Skipped files (by the upload rules)`, ...[...inventory].flatMap(([k, f]) => f.skipped.map((x) => `- ${k}/${x.file}: ${x.why}`)),
  );
  const reportsDir = join(planDir, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `${plan.environment}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`);
  await writeFile(reportPath, report.join('\n') + '\n');
  log(`Report: ${reportPath}`);
  return { courseId, counts, issues, validation, studioUrl: preview.studioUrl, reportPath };
}

// CLI
if (process.argv[1] && ['publish.js', 'del-publish-course'].includes(basename(process.argv[1]))) {
  const args = process.argv.slice(2);
  const planPath = args.find((a) => !a.startsWith('--'));
  const wait = args.includes('--wait') ? Number(args[args.indexOf('--wait') + 1]) : undefined;
  if (!planPath) { console.error('Usage: DEL_AGENT_TOKEN=del_agent_… node dist/publish.js <plan.json> [--dry-run] [--wait minutes]'); process.exit(2); }
  publish(planPath, { dryRun: args.includes('--dry-run'), waitMinutes: wait })
    .then((r) => { if (!('dryRun' in r)) console.log(JSON.stringify({ courseId: r.courseId, counts: r.counts, issues: r.issues.length }, null, 2)); })
    .catch((e) => { console.error(e instanceof ApiError ? `${e.code} (${e.status}): ${e.message}` : (e as Error).message); process.exit(1); });
}
