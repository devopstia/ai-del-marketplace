#!/usr/bin/env node
/**
 * del-publish-course: sync a course plan to the marketplace through the agent API (owner 2026-11-26, Course Upload and
 * Publishing Agent; .claude/skills/del-course-publisher/SKILL.md).
 *
 *   DEL_AGENT_TOKEN=del_agent_… node dist/publish.js courses/<course>/plan.json [--env staging|production] [--dry-run] [--wait 45]
 *   DEL_SESSION_JAR=<jar> node dist/publish.js courses/<course>/plan.json --auth session …   (owner's session as DEL Studio;
 *     sign in with `! scripts/del-signin.sh <site> <jar>`; no agent token)
 *
 * Idempotent: the course, its sections and lessons are matched (state file, then title) and never duplicated; files are
 * de-duplicated by checksum on the server; a lesson's file is attached once per title. Re-running after new videos are
 * added to the plan uploads only what is new and re-arranges the curriculum in plan order. Never publishes.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { ApiError, DelClient, isVideo, SessionClient, type FileRecord, type FileStore, type PublisherClient, type UploadResult } from './client.js';
import { assessmentFiles, probeSeconds, readQuizFile, sha256Text, type BankSettings } from './quizfile.js';

// ---------- plan ----------
export type LessonRole = 'intro' | 'lesson' | 'vocabulary' | 'project' | 'conclusion';
export interface LessonPlan { folder: string; title: string; summary?: string; preview?: boolean; role?: LessonRole; /** Short name for its quiz row ("Quiz: <short>"); default: the title up to its first colon. */ short?: string }
/**
 * A text lesson written in the plan (owner 2026-11-27: the free gateway course ends with a "your next step" lesson).
 * Kept in `state.articles[key]`; `{{course:<plan-slug>}}` in `articleMd` becomes that course's public URL.
 */
export interface ArticlePlan { type: 'article'; key: string; title: string; summary?: string; articleMd: string }
export type PlanItem = LessonPlan | ArticlePlan;
export const isArticle = (x: unknown): x is ArticlePlan => !!x && typeof x === 'object' && (x as { type?: string }).type === 'article';
/** After `normalizePlan`: `lessons` holds the video lessons, `articles` the text lessons, `order` both in plan order. */
export interface SectionPlan { title: string; lessons: LessonPlan[]; articles?: ArticlePlan[]; order?: ({ folder: string } | { article: string })[] }
export type Env = 'staging' | 'production';
/** Per-environment settings; the chosen one overrides `apiUrl` and `course.priceCents`. */
export interface EnvProfile { apiUrl: string; priceCents?: number }
export interface CoursePlan {
  /** Catalogue courses: extra source groups to watch for new lessons (folders `<group>/<lesson>` under sourceDir). */
  watchGroups?: string[];
  /** Default environment when `--env` isn't given. */
  environment: Env;
  apiUrl: string;
  environments?: Partial<Record<Env, EnvProfile>>;
  /** The course introduction video: a folder matching `folderPattern` (or role "intro") goes first in `sections[section]`;
   *  `promo` also makes it the course page's promo video. No empty placeholder lesson is ever created. */
  intro?: { folderPattern?: string; section?: number; promo?: boolean };
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
    /** "from-captions": import the in-video multiple-choice questions as a quiz lesson after each video. A lesson's
     *  `quiz.json` (owner 2026-11-28, courses/quiz.schema.json) is always preferred when the folder has one. */
    quizzes?: 'from-captions';
    /** Sharing banner (docs/SOCIAL_SHARING.md): topic design (ai, aws, azure, terraform, kubernetes, devops, automation,
     *  software-dev, cybersecurity, general), optional style (pro | marketplace | enterprise) and a shorter headline.
     *  Omitted values keep the platform defaults (topic design from the category, style from Super Admin). */
    share?: SharePlan;
    /** Folder with the course's assessments, relative to `sourceDir` unless absolute (same as the top-level `assessments`). */
    assessmentsDir?: string;
  };
  sections: SectionPlan[];
  /** Folder with the course's assessments (module-<n>-assessment.json, final-assessment.json, scenario-<name>.json),
   *  relative to `sourceDir` unless absolute (owner 2026-11-28). */
  assessments?: string;
  /** "Continue your learning journey" (owner 2026-11-28): recommended next courses, in order. `course` is another plan's
   *  folder name under courses/ (resolved through its state.<env>.json); set directly, no revision review. */
  related?: RelatedPlan[];
}
export interface RelatedPlan { course: string; reason?: string }
/** The sharing-banner topic designs (apps/api/src/social/share-templates.ts). */
export const SHARE_TEMPLATES = ['ai', 'aws', 'azure', 'terraform', 'kubernetes', 'devops', 'automation', 'software-dev', 'cybersecurity', 'general'];
export interface SharePlan { template?: string; family?: 'pro' | 'marketplace' | 'enterprise'; headline?: string }

/** What to send to PUT /courses/:id/share so the course matches the plan; null when it already does. */
export function shareChange(want: SharePlan, have: { family: string | null; template: string | null; headline: string | null }): Record<string, string | null> | null {
  const next: Record<string, string | null> = {};
  if (want.template !== undefined && want.template !== have.template) next.template = want.template;
  if (want.family !== undefined && want.family !== have.family) next.family = want.family;
  if (want.headline !== undefined && (want.headline.trim() || null) !== have.headline) next.headline = want.headline.trim() || null;
  return Object.keys(next).length ? next : null;
}

/** Related plan slugs → course ids (from the other plans' state files). Unknown ones are reported, never guessed. */
export function resolveRelated(related: RelatedPlan[], ids: Record<string, string | undefined>): { items: { courseId: string; reason?: string }[]; missing: string[] } {
  const items: { courseId: string; reason?: string }[] = [];
  const missing: string[] = [];
  for (const r of related) {
    const id = ids[r.course];
    if (id) items.push({ courseId: id, ...(r.reason ? { reason: r.reason } : {}) });
    else missing.push(r.course);
  }
  return { items, missing };
}

// ---------- upload rules (skill: del-course-publisher) ----------
const VIDEO = new Set(['.mp4', '.m4v', '.mov', '.webm']);
const NEVER = [/^\.env$/i, /\.pem$/i, /\.key$/i, /^id_(rsa|ed25519|ecdsa)/i, /credential/i, /secret.*\.(json|txt|ya?ml)$/i];
const SKIP_EXT = new Set(['.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.psd', '.aep', '.prproj', '.tmp', '.log', '.md']);

export interface LessonFiles { video?: string; captions?: string; slides?: string; lab?: string; /** The lesson's quiz bank (owner 2026-11-28). */ quiz?: string; skipped: { file: string; why: string }[]; problems: string[] }

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
  if (names.includes('quiz.json')) out.quiz = join(folder, 'quiz.json');
  for (const n of names) {
    const p = join(folder, n);
    if ([out.video, out.slides, out.lab, out.quiz].includes(p)) continue;
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
/** Quiz row in the curriculum, right after its lesson: short so the list stays scannable (owner review 2026-11-27). */
export const quizTitle = (lesson: { title: string; short?: string } | string) => {
  const l = typeof lesson === 'string' ? { title: lesson } : lesson;
  return `Quiz: ${(l.short?.trim() || l.title.split(':')[0]!.trim())}`.slice(0, 200);
};

/** A boolean switch from publisher.config.json (false when the file or the key is missing). */
export async function readConfigFlag(path: string, key: string): Promise<boolean> {
  try { return (JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>)[key] === true; } catch { return false; }
}

// ---------- quiz import (in-video questions read from the captions; never invented) ----------
export interface QuizQuestion { q: string; options: string[]; correct: number; why: string; id?: string; explanations?: string[]; takeaway?: string; difficulty?: string; type?: string; topic?: string; timestamp?: number; code?: string; fixedOrder?: boolean }
export interface ParsedQuiz { questions: QuizQuestion[]; skipped: string[]; /** From quiz.json: its settings and checksum (the quiz is replaced when the file changes). */ settings?: BankSettings; sha?: string; source?: 'file' | 'captions' }

/**
 * Read a lesson's quiz.json (GEN's bank, courses/quiz.schema.json) into the quiz format the platform accepts today
 * ({q, options 3–5, correct, why}). The explanation keeps why it is right, the takeaway and, when they fit, why each
 * other option is wrong. Questions the platform can't hold yet are skipped and reported, never changed.
 */
export async function quizFromFile(path: string): Promise<ParsedQuiz | null> {
  let raw: string;
  try { raw = await readFile(path, 'utf8'); } catch { return null; }
  const out: ParsedQuiz = { questions: [], skipped: [] };
  let data: { questions?: Array<{ id?: string; q?: string; code?: string; options?: string[]; correct?: number; why?: string; explanations?: string[]; takeaway?: string }> };
  try { data = JSON.parse(raw); } catch { out.skipped.push('quiz.json is not valid JSON: not used'); return out; }
  const seen = new Set<string>();
  for (const [i, x] of (data.questions ?? []).entries()) {
    const id = x.id ?? `#${i + 1}`;
    const opts = x.options ?? [];
    const q = [x.q?.trim(), x.code ? `\n${x.code.trim()}` : ''].join('').trim();
    if (!q || q.length > 500) { out.skipped.push(`${id}: question missing or longer than 500 characters`); continue; }
    if (opts.length < 3 || opts.length > 5 || opts.some((o) => !o?.trim() || o.length > 300)) { out.skipped.push(`${id}: needs 3–5 options of at most 300 characters`); continue; }
    if (!Number.isInteger(x.correct) || x.correct! < 0 || x.correct! >= opts.length) { out.skipped.push(`${id}: correct answer index invalid`); continue; }
    if (!x.why?.trim()) { out.skipped.push(`${id}: no explanation`); continue; }
    if (seen.has(q.toLowerCase())) { out.skipped.push(`${id}: duplicate question`); continue; }
    seen.add(q.toLowerCase());
    let why = x.why.trim();
    if (x.takeaway?.trim()) why += ` Takeaway: ${x.takeaway.trim()}`;
    const wrong = (x.explanations ?? []).map((e, j) => (j === x.correct || !e?.trim() ? '' : ` ${String.fromCharCode(65 + j)}: ${e.trim()}`)).join('');
    if (wrong && why.length + wrong.length + 18 <= 1000) why += ` Why not the others:${wrong}`;
    out.questions.push({ q, options: opts.map((o) => o.trim()), correct: x.correct!, why: why.slice(0, 1000) });
  }
  return out;
}

/** Caption text as one string: cue numbers and timings removed, lines joined (questions span cues). */
export function captionText(srtOrVtt: string): string {
  return srtOrVtt.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && l !== 'WEBVTT' && !/^\d+$/.test(l) && !l.includes('-->'))
    .join(' ').replace(/\s+/g, ' ');
}

const END = /\s(?:Let's recap|Let us recap|To remember|Recap:|Thanks for watching)\b/;

/**
 * The in-video quiz: "Question N of M. <question>? A: x; B: y; or C: z? … The answer is B: y. <why>". Questions read
 * aloud without their options ("Pause and think") are skipped and reported: the options are only on the slide images,
 * and options are never made up. A repeated question number keeps its first version.
 */
export function parseQuiz(text: string): ParsedQuiz {
  const out: ParsedQuiz = { questions: [], skipped: [] };
  const parts = text.split(/(?=Question \d+ of \d+\.\s)/).filter((p) => p.startsWith('Question '));
  const seen = new Set<number>();
  for (let raw of parts) {
    const end = raw.search(END);
    if (end > 0) raw = raw.slice(0, end);
    const m = /^Question (\d+) of (\d+)\.\s+(.*)$/s.exec(raw.trim());
    if (!m) continue;
    const n = Number(m[1]);
    if (seen.has(n)) continue;
    seen.add(n);
    const body = m[3]!;
    const ans = /The answer is ([A-E])\s*:\s*/.exec(body);
    // Options: the last "A: …; B: …; or C: …?" before the pause (a question can say them in words first, then in symbols).
    const stop = body.search(/\s(?:Pause|The answer)/);
    const region = stop > 0 ? body.slice(0, stop) : body;
    const firstA = region.search(/\sA:\s/);
    const lastA = region.lastIndexOf(' A: ');
    const opt = firstA < 0 ? null : /^\s*A:\s+(.+?);\s+B:\s+(.+?);\s+(?:or\s+)?C:\s+(.+?)(?:;\s+(?:or\s+)?D:\s+(.+?))?(?:;\s+(?:or\s+)?E:\s+(.+?))?\?\s*$/s.exec(region.slice(lastA));
    if (opt) opt.splice(1, 0, region.slice(0, firstA));
    if (!ans || !opt) { out.skipped.push(`question ${n}: ${ans ? 'its options are not read aloud (only on the slide)' : 'no answer found'}`); continue; }
    const options = opt.slice(2, 7).filter((x): x is string => !!x).map((x) => x.trim().replace(/\?$/, ''));
    const correct = ans[1]!.charCodeAt(0) - 65;
    if (correct >= options.length) { out.skipped.push(`question ${n}: answer ${ans[1]} is not one of the options`); continue; }
    // The answer repeats the option, then the explanation follows.
    let rest = body.slice(ans.index + ans[0].length).trim();
    const said = options[correct]!;
    if (rest.startsWith(said)) rest = rest.slice(said.length);
    else { const dot = rest.search(/[.?!]\s/); rest = dot >= 0 ? rest.slice(dot + 1) : ''; }
    const why = rest.replace(/^[.?!]\s*/, '').trim();
    const q = opt[1]!.trim();
    if (q.length < 3 || !why) { out.skipped.push(`question ${n}: ${why ? 'question text missing' : 'no explanation after the answer'}`); continue; }
    out.questions.push({ q: q.slice(0, 500), options: options.map((o) => o.slice(0, 300)), correct, why: why.slice(0, 1000) });
  }
  return out;
}

export async function quizFromCaptions(path: string): Promise<ParsedQuiz> {
  return parseQuiz(captionText(await readFile(path, 'utf8')));
}

/** Splits each section's list into video lessons, article lessons and their order (plans may mix both). */
export function normalizePlan(plan: CoursePlan): CoursePlan {
  return {
    ...plan,
    sections: plan.sections.map((s) => {
      const raw = s.lessons as PlanItem[];
      return { ...s, lessons: raw.filter((l): l is LessonPlan => !isArticle(l)), articles: raw.filter(isArticle), order: raw.map((l) => (isArticle(l) ? { article: l.key } : { folder: l.folder })) };
    }),
  };
}

/** `{{course:<plan-slug>}}` placeholders in an article (the other course's public page). */
export const COURSE_LINK = /\{\{course:([a-z0-9-]+)\}\}/g;
export function fillCourseLinks(md: string, urls: Record<string, string | undefined>): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = md.replace(COURSE_LINK, (all, key: string) => { const u = urls[key]; if (!u) { missing.push(key); return all; } return u; });
  return { text, missing: [...new Set(missing)] };
}

/** Plan with the chosen environment applied (`environments[env]` overrides apiUrl and the price). */
export function forEnv(plan: CoursePlan, env?: Env): CoursePlan {
  const e = env ?? plan.environment;
  const prof = plan.environments?.[e];
  if (env && env !== plan.environment && !prof) throw new Error(`The plan has no "${e}" profile (environments.${e}).`);
  return { ...plan, environment: e, apiUrl: prof?.apiUrl ?? plan.apiUrl, course: { ...plan.course, ...(prof?.priceCents !== undefined ? { priceCents: prof.priceCents } : {}) } };
}

/** Production only when courses/publisher.config.json says productionAllowed: true (the owner's decision). */
export async function assertEnvAllowed(env: Env, configPath: string) {
  if (env !== 'production') return;
  const cfg = existsSync(configPath) ? JSON.parse(await readFile(configPath, 'utf8')) : {};
  if (cfg.productionAllowed !== true) throw new Error(`Production is not allowed: ${configPath} has productionAllowed=${JSON.stringify(cfg.productionAllowed)}. Ask the owner.`);
}

// ---------- plan checks (the API's limits, the intro rule, previews) ----------
export const DEFAULT_INTRO = '^00-';
export const isIntro = (plan: Pick<CoursePlan, 'intro'>, l: Pick<LessonPlan, 'folder' | 'role'>) => l.role === 'intro' || new RegExp(plan.intro?.folderPattern ?? DEFAULT_INTRO).test(l.folder);

export function validatePlan(plan: CoursePlan): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const c = plan.course;
  const len = (v: string | undefined, max: number, what: string) => { if (v && v.length > max) errors.push(`${what} is ${v.length} characters (max ${max})`); };
  len(c.title, 120, 'course title'); len(c.subtitle, 200, 'subtitle'); len(c.description, 20000, 'description'); len(c.taughtBy, 80, 'taughtBy');
  if ((c.objectives?.length ?? 0) > 20) errors.push('more than 20 objectives');
  if ((c.requirements?.length ?? 0) > 20) errors.push('more than 20 requirements');
  c.objectives?.forEach((o, i) => len(o, 200, `objective ${i + 1}`));
  c.requirements?.forEach((o, i) => len(o, 200, `requirement ${i + 1}`));
  if (c.share) {
    if (c.share.template && !SHARE_TEMPLATES.includes(c.share.template)) errors.push(`share.template "${c.share.template}" is not one of ${SHARE_TEMPLATES.join(', ')}`);
    if (c.share.family && !['pro', 'marketplace', 'enterprise'].includes(c.share.family)) errors.push(`share.family "${c.share.family}" is not pro, marketplace or enterprise`);
    len(c.share.headline, 90, 'share.headline');
  }
  const folders = new Set<string>();
  const intros: string[] = [];
  const keys = new Set<string>();
  plan.sections.forEach((s, si) => {
    len(s.title, 200, `section ${si + 1} title`);
    (s.articles ?? []).forEach((a) => {
      if (!a.key || !/^[a-z0-9-]+$/.test(a.key)) errors.push(`article "${a.title}": key must be lowercase letters, digits and dashes`);
      if (keys.has(a.key)) errors.push(`article key ${a.key} is in the plan twice`);
      keys.add(a.key);
      len(a.title, 200, `article ${a.key} title`); len(a.summary, 300, `article ${a.key} summary`); len(a.articleMd, 100000, `article ${a.key} text`);
      if (!a.articleMd?.trim()) errors.push(`article ${a.key} has no text`);
    });
    s.lessons.forEach((l, li) => {
      if (folders.has(l.folder)) errors.push(`${l.folder} is in the plan twice`);
      folders.add(l.folder);
      len(l.title, 200, `${l.folder} title`); len(l.summary, 300, `${l.folder} summary`);
      if (isIntro(plan, l)) {
        intros.push(l.folder);
        if (si !== (plan.intro?.section ?? 0) || li !== 0) errors.push(`${l.folder} is the course introduction: put it first in section ${(plan.intro?.section ?? 0) + 1}`);
        if (!l.preview) warnings.push(`${l.folder}: the introduction should be a free preview`);
      }
    });
  });
  if (intros.length > 1) errors.push(`more than one introduction: ${intros.join(', ')}`);
  const previews = plan.sections.flatMap((s) => s.lessons).filter((l) => l.preview).length;
  const want = intros.length ? 3 : 2;
  if (previews !== 2 && previews !== want) warnings.push(`${previews} free previews (the standard: 2, plus the introduction when it exists)`);
  return { errors, warnings };
}

// ---------- manifest (hints from the generation agent; the plan stays the source of truth) ----------
export interface LessonHint { folder: string; title?: string; description?: string; objectives?: string[]; prerequisites?: string[]; role?: LessonRole; position?: { section?: string | number; after?: string; order?: number }; resources?: string[]; quiz?: QuizQuestion[] }
export interface CourseManifest { course?: { title?: string; subtitle?: string; description?: string; sections?: { title: string; lessons: string[] }[] }; lessons: LessonHint[] }

/** course.manifest.json in the course folder plus lesson.json in each lesson folder (lesson.json wins). Never throws: a
 *  broken manifest is reported, not trusted. */
export async function readManifest(sourceDir: string): Promise<{ manifest: CourseManifest; problems: string[] }> {
  const problems: string[] = [];
  const manifest: CourseManifest = { lessons: [] };
  const read = async (p: string) => { try { return JSON.parse(await readFile(p, 'utf8')); } catch (e) { problems.push(`${basename(dirname(p))}/${basename(p)}: ${(e as Error).message}`); return null; } };
  const top = join(sourceDir, 'course.manifest.json');
  if (existsSync(top)) {
    const m = await read(top);
    if (m) { manifest.course = m.course; for (const l of Array.isArray(m.lessons) ? m.lessons : []) if (l?.folder) manifest.lessons.push(l); }
  }
  if (existsSync(sourceDir)) for (const e of await readdir(sourceDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = join(sourceDir, e.name, 'lesson.json');
    if (!existsSync(p)) continue;
    const l = await read(p);
    if (!l) continue;
    const i = manifest.lessons.findIndex((x) => x.folder === e.name);
    const merged = { ...(i >= 0 ? manifest.lessons[i] : {}), ...l, folder: e.name };
    if (i >= 0) manifest.lessons[i] = merged; else manifest.lessons.push(merged);
  }
  return { manifest, problems };
}

/** Where the manifest and the plan disagree (for the agent to check against the captions; never applied blindly). */
export function manifestNotes(plan: CoursePlan, m: CourseManifest): string[] {
  const notes: string[] = [];
  const planned = new Map(plan.sections.flatMap((s) => s.lessons.map((l) => [l.folder, l] as const)));
  for (const h of m.lessons) {
    const l = planned.get(h.folder);
    if (!l) { notes.push(`manifest: ${h.folder} is not in the plan${h.role ? ` (role ${h.role})` : ''}`); continue; }
    if (h.title && h.title !== l.title) notes.push(`manifest: ${h.folder} suggests the title "${h.title}" (plan: "${l.title}")`);
    if (h.role === 'intro' && !isIntro(plan, l)) notes.push(`manifest: ${h.folder} is marked as the introduction; the plan doesn't treat it as one`);
  }
  return notes;
}

// ---------- curriculum (existing ids always reused: progress, completions and quiz results stay) ----------
export interface SiteSection { id: string; title: string; lectures: { id: string; title: string }[] }
export function arrangeCurriculum(plan: CoursePlan, state: Pick<State, 'sections' | 'lessons' | 'quizzes' | 'articles'>, withQuiz: Set<string>, site: SiteSection[], assessments: { section: number; id: string }[] = []) {
  const issues: string[] = [];
  const used = new Set<string>();
  const arranged = plan.sections.map((sp, si) => {
    const order = sp.order ?? sp.lessons.map((l) => ({ folder: l.folder }));
    const parts = order.map((it) => ({ article: 'article' in it, ids: ('article' in it ? [state.articles?.[it.article]] : [state.lessons[it.folder], withQuiz.has(it.folder) ? state.quizzes?.[it.folder] : undefined]).filter((x): x is string => !!x) }));
    // Assessments close their module (module, then scenarios, then the final assessment, in the order given), before
    // the articles that end it (the closing "continue your learning journey" article stays last).
    let cut = parts.length;
    while (cut > 0 && parts[cut - 1]!.article) cut--;
    const ids = parts.slice(0, cut).flatMap((x) => x.ids);
    const closing = parts.slice(cut).flatMap((x) => x.ids);
    ids.push(...assessments.filter((a) => a.section === si).map((a) => a.id).filter((id) => !ids.includes(id) && !closing.includes(id)), ...closing);
    ids.forEach((i) => used.add(i));
    return { id: state.sections[sp.title]!, lectureIds: ids };
  });
  for (const s of site) {
    const extra = s.lectures.filter((l) => !used.has(l.id));
    extra.forEach((l) => issues.push(`lesson on the site but not in the plan (kept): ${l.title}`));
    const target = arranged.find((a) => a.id === s.id);
    if (target) target.lectureIds.push(...extra.map((l) => l.id));
    else { arranged.push({ id: s.id, lectureIds: extra.map((l) => l.id) }); issues.push(`section on the site but not in the plan (kept at the end): ${s.title}`); }
  }
  return { arranged, issues };
}

/**
 * `--prune` (owner 2026-11-27): lessons on the site that the plan no longer has, with their quiz lessons, and sections
 * left empty that the plan doesn't name. Only for draft courses: on a published course students' progress would be
 * lost, so the change must go through a reviewed revision with the owner's OK. Media is never deleted (shared videos).
 */
export function pruneTargets(status: string, plan: CoursePlan, state: Pick<State, 'sections' | 'lessons' | 'quizzes' | 'articles' | 'assessments'>, withQuiz: Set<string>, site: SiteSection[], allowPublished = false): { lectures: { id: string; title: string }[]; sections: { id: string; title: string }[] } {
  if (status !== 'draft' && !allowPublished) throw new Error(`--prune refused: the course is ${status}. Removing lessons from a published course would delete students' progress; make that change through a reviewed revision with the owner's explicit OK.`);
  const keep = new Set<string>(Object.values(state.assessments ?? {}));
  for (const sp of plan.sections) {
    for (const l of sp.lessons) { const a = state.lessons[l.folder]; if (a) keep.add(a); const q = withQuiz.has(l.folder) ? state.quizzes?.[l.folder] : undefined; if (q) keep.add(q); }
    for (const a of sp.articles ?? []) { const id = state.articles?.[a.key]; if (id) keep.add(id); }
  }
  const plannedSections = new Set(plan.sections.map((sp) => state.sections[sp.title]).filter(Boolean));
  const lectures = site.flatMap((s) => s.lectures).filter((l) => !keep.has(l.id)).map((l) => ({ id: l.id, title: l.title }));
  const gone = new Set(lectures.map((l) => l.id));
  const sections = site.filter((s) => !plannedSections.has(s.id) && s.lectures.every((l) => gone.has(l.id))).map((s) => ({ id: s.id, title: s.title }));
  return { lectures, sections };
}

// ---------- API shapes (subset) ----------
interface Resource { id: string; title: string; sizeBytes?: number }
interface Lecture { id: string; sectionId: string; title: string; type?: string; summary: string; articleMd?: string | null; isPreview: boolean; quiz?: { questions: QuizQuestion[] } | null; videoAssetId: string | null; video: { id: string; status: string; durationSec: number; hasCaptions: boolean } | null; resources: Resource[] }
interface Section { id: string; title: string; lectures: Lecture[] }
interface CourseDetail { id: string; slug?: string; title: string; status: string; coverTemplateId: string | null; promoVideo?: { id: string } | null; sections: Section[] }
interface State { courseId?: string; sections: Record<string, string>; lessons: Record<string, string>; quizzes?: Record<string, string>; articles?: Record<string, string>; /** Assessment quiz lessons by key (module-<n>, final, scenario-<name>). */ assessments?: Record<string, string>; /** Checksums of quiz.json / assessment files, so a changed file replaces the quiz (same quiz lesson). */ quizFiles?: Record<string, string>; /** Caption file checksum per video asset, so corrected captions replace the old ones. */ captions?: Record<string, string>; /** Lesson file checksums (`<folder>#slides|labs`), so a changed slide deck or lab replaces the attached one. */ resources?: Record<string, string>; /** Session mode: files uploaded, by sha256 (the studio API has no server-side de-duplication). */ files?: Record<string, FileRecord> }

export type AuthMode = 'agent' | 'session';

/** Session-mode memory of uploaded files, kept in the state file. */
export function stateFileStore(state: { files?: Record<string, FileRecord> }, save: () => Promise<void>): FileStore {
  state.files ??= {};
  return {
    get: (sha) => state.files![sha],
    set: async (sha, r) => { state.files![sha] = r; await save(); },
    knowsAsset: (id) => Object.values(state.files!).some((f) => f.assetId === id),
  };
}

/**
 * Shared media map (owner 2026-11-27): one file per environment, `courses/media.<env>.json`, keyed by sha256. Every plan
 * consults it first, so a video or file that serves several courses of the account is uploaded once and attached to each
 * course's own lesson (each course keeps its own lessons, quizzes, progress and access).
 */
export interface MediaRecord extends FileRecord { status?: string; courses?: string[] }
export interface MediaMap { files: Record<string, MediaRecord> }
export async function loadMediaMap(path: string): Promise<{ map: MediaMap; save: () => Promise<void> }> {
  const map: MediaMap = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : { files: {} };
  map.files ??= {};
  return { map, save: () => writeFile(path, JSON.stringify(map, null, 2) + '\n') };
}

/** Session-mode store that also reads and writes the shared media map. */
export function layeredStore(course: FileStore, media: MediaMap, saveMedia: () => Promise<void>, courseSlug: string): FileStore {
  return {
    get: (sha) => course.get(sha) ?? media.files[sha],
    set: async (sha, r) => { await course.set(sha, r); media.files[sha] = { ...media.files[sha], ...r, courses: [...new Set([...(media.files[sha]?.courses ?? []), courseSlug])] }; await saveMedia(); },
    knowsAsset: (id) => course.knowsAsset(id) || Object.values(media.files).some((f) => f.assetId === id),
  };
}

/**
 * Upload through the shared media map: a checksum already in the map is reused (no upload); a new one is uploaded and
 * recorded. Works for both clients (agent and session).
 */
export async function uploadShared(del: Pick<PublisherClient, 'upload' | 'sha256'>, media: MediaMap, saveMedia: () => Promise<void>, courseSlug: string, path: string, opts: { courseId?: string; name?: string; existingAssetId?: string | null }): Promise<UploadResult> {
  const sha = await del.sha256(path);
  const known = media.files[sha];
  const kind = isVideo(path) ? 'video' : 'resource';
  if (known && known.kind === kind && (known.assetId || known.storageKey)) {
    if (!known.courses?.includes(courseSlug)) { known.courses = [...(known.courses ?? []), courseSlug]; await saveMedia(); }
    return { file: path, kind, duplicate: true, resumed: false, assetId: known.assetId, storageKey: known.storageKey, partsUploaded: 0 };
  }
  const r = await del.upload(path, opts);
  media.files[sha] = { ...(media.files[sha] ?? {}), kind, assetId: r.assetId, storageKey: r.storageKey, name: opts.name ?? basename(path), at: new Date().toISOString(), ...(r.status ? { status: r.status } : {}), courses: [...new Set([...(media.files[sha]?.courses ?? []), courseSlug])] };
  await saveMedia();
  return r;
}

/**
 * Lesson folders a plan can draw from, relative to `sourceDir`. One-folder courses (n8n) use the folder's own lesson
 * folders; catalogue courses (owner 2026-11-27) set `sourceDir` to the videos root and name lessons `<group>/<lesson>`,
 * so only the groups the plan uses (plus `watchGroups`) are listed, never the whole root.
 */
export async function lessonFolders(plan: Pick<CoursePlan, 'sourceDir' | 'sections'> & { watchGroups?: string[] }): Promise<string[]> {
  const planned = plan.sections.flatMap((s) => s.lessons.map((l) => l.folder));
  const nested = planned.some((f) => f.includes('/')) || !!plan.watchGroups?.length;
  const dirs = async (d: string) => existsSync(d) ? (await readdir(d, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
  if (!nested) return dirs(plan.sourceDir);
  const groups = [...new Set([...planned.filter((f) => f.includes('/')).map((f) => f.split('/')[0]!), ...(plan.watchGroups ?? [])])].sort();
  const out: string[] = [];
  for (const g of groups) for (const d of await dirs(join(plan.sourceDir, g))) out.push(`${g}/${d}`);
  return out;
}

type Log = (msg: string) => void;

export async function publish(planPath: string, opts: { /** Send full quiz banks and assessments (the quiz-bank API is live). Default: publisher.config.json `quizBanks`. */ quizBanks?: boolean; dryRun?: boolean; waitMinutes?: number; token?: string; log?: Log; fetchImpl?: typeof fetch; env?: Env; configPath?: string; /** 'session' = the owner's signed-in super admin session as DEL Studio (DEL_SESSION_JAR), no agent token. */ auth?: AuthMode; jarPath?: string; heartbeatMs?: number; /** Shared media map (default courses/media.<env>.json). */ mediaPath?: string; /** Remove lessons not in the plan (draft courses only; see pruneTargets). */ prune?: boolean; /** Owner-approved removal from a published course: the deletions go into its draft revision and take effect only when an admin approves it (owner 2026-11-28). */ prunePublished?: boolean } = {}) {
  const log = opts.log ?? ((m: string) => console.log(m));
  const plan = forEnv(normalizePlan(JSON.parse(await readFile(planPath, 'utf8')) as CoursePlan), opts.env);
  const planDir = dirname(resolve(planPath));
  if (!opts.dryRun) await assertEnvAllowed(plan.environment, opts.configPath ?? join(planDir, '..', 'publisher.config.json'));
  const statePath = join(planDir, `state.${plan.environment}.json`);
  const state: State = existsSync(statePath) ? JSON.parse(await readFile(statePath, 'utf8')) : { sections: {}, lessons: {} };
  state.quizzes ??= {};
  state.articles ??= {};
  const saveState = () => writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  const courseSlug = basename(planDir);
  const media = await loadMediaMap(opts.mediaPath ?? join(planDir, '..', `media.${plan.environment}.json`));
  const report: string[] = [];
  const issues: string[] = [];
  const counts = { lessons: 0, videos: 0, videoSec: 0, slides: 0, labs: 0, captions: 0, quizzes: 0, quizQuestions: 0, uploaded: 0, reused: 0, failed: 0 };
  const quizSkips: string[] = [];

  // 1. Inventory (no network).
  const inventory = new Map<string, LessonFiles>();
  for (const s of plan.sections) for (const l of s.lessons) {
    const f = await discover(join(plan.sourceDir, l.folder));
    inventory.set(l.folder, f);
    f.problems.forEach((p) => issues.push(`${l.folder}: ${p}`));
  }
  const checks = validatePlan(plan);
  checks.errors.forEach((e) => issues.push(`plan: ${e}`));
  const warnings = [...checks.warnings.map((w) => `plan: ${w}`)];
  const { manifest, problems: mprob } = await readManifest(plan.sourceDir);
  warnings.push(...mprob.map((p) => `manifest unreadable: ${p}`), ...manifestNotes(plan, manifest));
  const planned = new Set(plan.sections.flatMap((s) => s.lessons.map((l) => l.folder)));
  // Catalogue plans pick lessons from shared groups on purpose: only their `watchGroups` are reported as unplanned.
  const nestedPlan = [...planned].some((f) => f.includes('/'));
  const unplanned = (nestedPlan ? (plan.watchGroups?.length ? await lessonFolders({ sourceDir: plan.sourceDir, sections: [], watchGroups: plan.watchGroups }) : []) : await lessonFolders(plan)).filter((f) => !planned.has(f));
  unplanned.forEach((d) => issues.push(`folder not in the plan (not uploaded): ${d}`));
  const articleCount = plan.sections.reduce((n, s) => n + (s.articles?.length ?? 0), 0);
  log(`Inventory: ${planned.size} lessons${articleCount ? ` + ${articleCount} article(s)` : ''} in ${plan.sections.length} sections; ${issues.length} issue(s).`);
  for (const [k, f] of inventory) log(`  ${k}: video ${f.video ? 'yes' : 'NO'}, captions ${f.captions ? 'yes' : 'no'}, slides ${f.slides ? 'yes' : 'no'}, lab ${f.lab ? 'yes' : 'no'}${f.skipped.length ? `; skipped ${f.skipped.map((x) => x.file.replace(k, '…')).join(', ')}` : ''}`);
  const quizzes = new Map<string, ParsedQuiz>();
  // A lesson's quiz.json (owner 2026-11-28) wins over the questions read from the captions. The full bank (explanations
  // per option, takeaway, topic, timestamp, assessments) needs the quiz-bank API: switched on with "quizBanks": true in
  // publisher.config.json (or DEL_QUIZ_BANKS=1) once that release is live; until then the legacy mapping below is used.
  const banks = opts.quizBanks ?? (process.env.DEL_QUIZ_BANKS === '1' || (await readConfigFlag(opts.configPath ?? join(planDir, '..', 'publisher.config.json'), 'quizBanks')));
  for (const [k, f] of inventory) {
    if (!banks || !f.quiz) continue;
    const r = await readQuizFile(f.quiz, { durationSec: f.video ? probeSeconds(f.video) : null });
    r.errors.forEach((e) => issues.push(`${k}/quiz.json: ${e}`));
    r.warnings.forEach((w) => warnings.push(`${k}/quiz.json: ${w}`));
    if (r.errors.length) continue;
    quizzes.set(k, { questions: r.file.questions, skipped: [], settings: r.file.settings, sha: sha256Text(await readFile(f.quiz, 'utf8')), source: 'file' });
    log(`  ${k}: quiz ${r.file.questions.length} question(s) from quiz.json`);
  }
  // Assessments (module, final, scenario) from the plan's assessments folder.
  const assessRel = plan.assessments ?? plan.course.assessmentsDir;
  const assessDir = assessRel ? resolve(plan.sourceDir, assessRel) : null;
  // Assessment questions name the lesson folder they come from ("21-n21-…"); catalogue plans use "<group>/<folder>".
  const planFolders = plan.sections.flatMap((sp) => sp.lessons.map((l) => l.folder));
  const planFolder = (lesson: string) => planFolders.find((f) => f === lesson || f.endsWith(`/${lesson}`));
  const durations = new Map<string, number | null>();
  const lessonDuration = (lesson: string): number | null | undefined => {
    const f = planFolder(lesson);
    if (!f) return undefined;
    if (!durations.has(f)) { const v = inventory.get(f)?.video; durations.set(f, v ? probeSeconds(v) : null); }
    return durations.get(f)!;
  };
  const assessments: { a: Awaited<ReturnType<typeof assessmentFiles>>[number]; quiz: ParsedQuiz; section: number }[] = [];
  if (assessDir && !banks) warnings.push('assessments need the quiz-bank API ("quizBanks": true in publisher.config.json once it is live): not uploaded yet');
  if (assessDir && banks) {
    if (!existsSync(assessDir)) warnings.push(`assessments folder not found: ${assessDir}`);
    for (const a of await assessmentFiles(assessDir)) {
      const r = await readQuizFile(a.path, { assessment: true, lessonDuration });
      if (r.file.kind && r.file.kind !== a.kind) warnings.push(`assessments/${basename(a.path)}: the file says kind ${r.file.kind}, its name says ${a.kind} (the name is used)`);
      r.errors.forEach((e) => issues.push(`assessments/${basename(a.path)}: ${e}`));
      r.warnings.forEach((w) => warnings.push(`assessments/${basename(a.path)}: ${w}`));
      const last = plan.sections.length - 1;
      const section = a.kind === 'module' ? a.section! - 1 : a.kind === 'scenario' && r.file.section ? r.file.section - 1 : last;
      if (section < 0 || section > last) { issues.push(`assessments/${basename(a.path)}: module ${section + 1} is not in the plan`); continue; }
      if (r.errors.length) continue;
      const settings: BankSettings = { ...(r.file.settings ?? {}), kind: a.kind };
      const title = (r.file.title?.trim() || a.title).slice(0, 200);
      assessments.push({ a: { ...a, title }, quiz: { questions: r.file.questions, skipped: [], settings, sha: sha256Text(await readFile(a.path, 'utf8')), source: 'file' }, section });
      log(`  assessment "${title}": ${r.file.questions.length} question(s)${settings.sampleSize ? `, ${settings.sampleSize} per attempt` : ''}${settings.pool && settings.pool !== 'own' ? ` (+ the ${settings.pool}'s lesson quizzes)` : ''}`);
    }
  }
  if (plan.course.quizzes === 'from-captions') {
    for (const [k, f] of inventory) {
      if (quizzes.has(k)) continue;
      // Until the quiz-bank API is live (publisher.config.json "quizBanks": true), GEN's quiz.json is folded into
      // today's format (why + takeaway + why the others are wrong) and still wins over the spoken questions.
      const fromFile = !banks && f.video ? await quizFromFile(join(dirname(f.video), 'quiz.json')) : null;
      if (fromFile) {
        quizzes.set(k, fromFile);
        fromFile.skipped.forEach((x) => quizSkips.push(`${k}: ${x}`));
        log(`  ${k}: quiz ${fromFile.questions.length} question(s) from quiz.json (today's format)${fromFile.skipped.length ? `, ${fromFile.skipped.length} skipped` : ''}`);
        continue;
      }
      if (!f.captions) continue;
      let qz = await quizFromCaptions(f.captions);
      // Options only on the slides: the manifest's quiz is used when every answer is the one the video says.
      const hinted = manifest.lessons.find((h) => h.folder === k)?.quiz;
      if (hinted?.length && hinted.length > qz.questions.length) {
        const spoken = captionText(await readFile(f.captions, 'utf8')).toLowerCase();
        const ok = hinted.every((q) => q.options?.length >= 3 && q.options.length <= 5 && q.options[q.correct] && spoken.includes(`the answer is ${String.fromCharCode(65 + q.correct)}: ${q.options[q.correct]!}`.toLowerCase()));
        if (ok) qz = { questions: hinted.map((q) => ({ q: q.q, options: q.options, correct: q.correct, why: q.why })), skipped: [] };
        else qz.skipped.push('the manifest quiz does not match the answers said in the video: not used');
      }
      quizzes.set(k, qz);
      qz.skipped.forEach((x) => quizSkips.push(`${k}: ${x}`));
      log(`  ${k}: quiz ${qz.questions.length} question(s) from the captions${qz.skipped.length ? `, ${qz.skipped.length} skipped` : ''}`);
    }
  }
  warnings.forEach((w) => log(`  note: ${w}`));
  if (opts.dryRun) return { dryRun: true, environment: plan.environment, apiUrl: plan.apiUrl, priceCents: plan.course.priceCents, issues, warnings, quizSkips, inventory: Object.fromEntries(inventory), quizzes: Object.fromEntries([...quizzes].map(([k, v]) => [k, v.questions.length])), assessments: Object.fromEntries(assessments.map((x) => [x.a.title, x.quiz.questions.length])) };
  if (checks.errors.length || [...inventory.values()].some((f) => f.problems.length) || issues.some((i) => /quiz\.json: |^assessments\//.test(i))) throw new Error(`Fix these before uploading:\n${issues.join('\n')}`);

  const auth: AuthMode = opts.auth ?? (process.env.DEL_AUTH === 'session' ? 'session' : 'agent');
  let del: PublisherClient;
  if (auth === 'session') {
    const jarPath = opts.jarPath ?? process.env.DEL_SESSION_JAR ?? '';
    if (!jarPath || !existsSync(jarPath)) throw new Error('Session mode needs DEL_SESSION_JAR (the cookie jar from `! scripts/del-signin.sh`).');
    del = new SessionClient(plan.apiUrl, await readFile(jarPath, 'utf8'), [plan.sourceDir], layeredStore(stateFileStore(state, saveState), media.map, media.save, courseSlug), opts.fetchImpl, 1000, opts.heartbeatMs);
  } else {
    const token = opts.token ?? process.env.DEL_AGENT_TOKEN ?? '';
    del = new DelClient(plan.apiUrl, token, [plan.sourceDir], opts.fetchImpl);
  }
  try {
    return await run();
  } finally {
    del.close?.();
  }
  async function run() {

  /**
   * A bank as the API takes it: a question's `lesson` / `related` lesson folders become the lesson ids on the site
   * ("Watch this part" opens that video); a lesson not uploaded yet is left out and reported, never guessed.
   */
  const toApi = (questions: QuizQuestion[], where: string) => questions.map((q) => {
    const { lesson, related, ...rest } = q as QuizQuestion & { lesson?: string; related?: { lesson: string; timestamp: number }[] };
    const idOf = (folder: string) => { const f = planFolders.find((x) => x === folder || x.endsWith(`/${folder}`)); return f ? state.lessons[f] : undefined; };
    const out: Record<string, unknown> = { ...rest };
    if (lesson) { const id = idOf(lesson); if (id) out.lessonId = id; else { issues.push(`${where}: question ${q.id ?? q.q.slice(0, 40)}: lesson ${lesson} is not on the site yet ("Watch this part" left out)`); delete out.timestamp; } }
    const rel = (related ?? []).map((r) => ({ lessonId: idOf(r.lesson), timestamp: r.timestamp })).filter((r): r is { lessonId: string; timestamp: number } => !!r.lessonId);
    if (rel.length) out.related = rel;
    return out;
  });

  // 2. Right account?
  const me = await del.call<{ instructor: { id: string; name: string } }>('GET', '/whoami');
  if (me.instructor.name !== plan.instructorName) throw new Error(`${auth === 'session' ? 'The session works as' : 'The token works for'} "${me.instructor.name}", the plan says "${plan.instructorName}". Nothing was changed.`);
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
  const { cover: _cover, categorySlug: _slug, quizzes: _quizzes, share: _share, assessmentsDir: _assess, ...fields } = plan.course;
  issues.push(...warnings);
  await del.call('PATCH', `/courses/${courseId}`, { ...fields, ...(categoryId ? { categoryId } : {}) });

  const detail = () => del.call<CourseDetail>('GET', `/courses/${courseId}`);
  let c = await detail();
  if (opts.prune && c.status !== 'draft' && !opts.prunePublished) throw new Error(`--prune refused: the course is ${c.status}. Removing lessons from a published course would delete students' progress; make that change through a reviewed revision with the owner's explicit OK. Nothing was removed.`);
  if (opts.prune && auth !== 'session') throw new Error('--prune needs session mode (the agent API cannot delete lessons). Nothing was removed.');
  // Public URLs of the account's other planned courses, for `{{course:<plan-slug>}}` (their state file has the id).
  let links: Record<string, string | undefined> | undefined;
  const courseLinks = async () => {
    if (links) return links;
    links = {};
    const web = plan.apiUrl.replace(/\/api\/?$/, '');
    const keys = new Set(plan.sections.flatMap((s) => (s.articles ?? []).flatMap((a) => [...a.articleMd.matchAll(COURSE_LINK)].map((m) => m[1]!))));
    for (const k of keys) {
      const sp = join(planDir, '..', k, `state.${plan.environment}.json`);
      const id = existsSync(sp) ? (JSON.parse(await readFile(sp, 'utf8')) as State).courseId : undefined;
      if (!id) continue;
      try { const d = await del.call<CourseDetail>('GET', `/courses/${id}`); if (d.slug) links[k] = `${web}/courses/${d.slug}`; } catch (e) { if (e instanceof ApiError && e.code === 'session_ended') throw e; }
    }
    return links;
  };

  // 4. Sections and lessons.
  for (const sp of plan.sections) {
    let sec = c.sections.find((s) => s.id === state.sections[sp.title]) ?? c.sections.find((s) => s.title === sp.title);
    if (!sec) {
      const made = await del.call<{ id: string }>('POST', `/courses/${courseId}/sections`, { title: sp.title });
      c = await detail();
      sec = c.sections.find((s) => s.id === made.id)!;
      log(`+ section ${sp.title}`);
    }
    if (sec.title !== sp.title) { await del.call('PATCH', `/courses/${courseId}/sections/${sec.id}`, { title: sp.title }); log(`~ section renamed: ${sp.title}`); }
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
        const v = await uploadShared(del, media.map, media.save, courseSlug, files.video!, { courseId, name: `${slug(lp.title)}${extname(files.video!)}`, existingAssetId: lec.videoAssetId });
        if (v.duplicate) counts.reused++; else counts.uploaded++;
        if (lec.videoAssetId !== v.assetId) patch.videoAssetId = v.assetId;
        counts.videos++;
        // Captions: uploaded when missing, and again whenever the caption file changes (owner 2026-11-28: corrected
        // captions re-delivered without a new video). A video with captions but no recorded checksum is refreshed once.
        if (files.captions) {
          const csha = await del.sha256(files.captions);
          state.captions ??= {};
          const has = lec.video?.id === v.assetId && lec.video?.hasCaptions;
          if (has && state.captions[v.assetId!] === csha) counts.captions++;
          else {
            try {
              await del.uploadCaptions(v.assetId!, files.captions); counts.captions++;
              if (has) log(`  ~ captions refreshed: ${lp.title}`);
              state.captions[v.assetId!] = csha; await saveState();
            } catch (e) { if (e instanceof ApiError && e.code === 'session_ended') throw e; issues.push(`${lp.folder}: captions not uploaded: ${(e as Error).message}`); }
          }
        }
      } catch (e) { if (e instanceof ApiError && e.code === 'session_ended') throw e;
        counts.failed++;
        issues.push(`${lp.folder}: video upload failed: ${(e as Error).message}`);
      }
      if (Object.keys(patch).length) await del.call('PATCH', `/courses/${courseId}/lectures/${lec.id}`, patch);

      // Study materials, attached once per title, with names learners understand.
      for (const [path, title, suffix, kind] of [[files.slides, SLIDES_TITLE, 'slides', 'slides'], [files.lab, LAB_TITLE, 'lab', 'labs']] as const) {
        if (!path) continue;
        // A file already attached stays unless the source file changed (owner 2026-11-28: re-delivered labs replace the
        // old download). Change = a different checksum from the one recorded, or, before anything was recorded, a
        // different size from the attached file.
        const rkey = `${lp.folder}#${kind}`;
        const attached = lec.resources.find((r) => r.title === title);
        const sha = await del.sha256(path);
        state.resources ??= {};
        if (attached) {
          const known = state.resources[rkey];
          const same = known ? known === sha : attached.sizeBytes === undefined || attached.sizeBytes === (await stat(path)).size;
          if (same) { state.resources[rkey] = sha; counts[kind]++; continue; }
        }
        try {
          const r = await uploadShared(del, media.map, media.save, courseSlug, path, { courseId, name: `${slug(lp.title)}-${suffix}${extname(path)}` });
          if (r.duplicate) counts.reused++; else counts.uploaded++;
          await del.call('POST', `/courses/${courseId}/lectures/${lec.id}/resources`, { title, storageKey: r.storageKey });
          if (attached) { await del.call('DELETE', `/courses/${courseId}/resources/${attached.id}`); log(`  ~ ${title} replaced (source changed): ${lp.title}`); }
          state.resources[rkey] = sha;
          await saveState();
          counts[kind]++;
        } catch (e) { if (e instanceof ApiError && e.code === 'session_ended') throw e;
          counts.failed++;
          issues.push(`${lp.folder}: ${title} failed: ${(e as Error).message}`);
        }
      }
      // Quiz lesson right after the video (questions only from the captions).
      const qz = quizzes.get(lp.folder);
      if (qz?.questions.length) {
        const title = quizTitle(lp);
        const everything = c.sections.flatMap((s) => s.lectures);
        let ql = everything.find((l) => l.id === state.quizzes![lp.folder]) ?? everything.find((l) => l.title === title && (l.type ?? 'quiz') === 'quiz');
        try {
          if (!ql) {
            const made = await del.call<{ id: string }>('POST', `/courses/${courseId}/sections/${sec.id}/lectures`, { title, type: 'quiz', summary: `${qz.questions.length} questions ${qz.source === 'file' ? 'on this lesson' : 'from the video'}, with the answers explained.`.slice(0, 300) });
            c = await detail();
            ql = c.sections.flatMap((s) => s.lectures).find((l) => l.id === made.id)!;
            log(`+ quiz ${title}`);
          } else if (ql.title !== title) await del.call('PATCH', `/courses/${courseId}/lectures/${ql.id}`, { title });
          state.quizzes![lp.folder] = ql.id;
          await saveState();
          if (qz.source === 'file') {
            // A quiz.json bank: replaced when the file changes (checksum), keeping the quiz lesson and students' results.
            state.quizFiles ??= {};
            const fresh = state.quizFiles[lp.folder] === qz.sha && (ql.quiz?.questions?.length ?? 0) === qz.questions.length;
            if (!fresh) {
              await del.call('PUT', `/courses/${courseId}/lectures/${ql.id}/quiz`, { questions: toApi(qz.questions, lp.folder), ...(qz.settings ? { settings: qz.settings } : {}) });
              if (ql.quiz?.questions?.length) log(`  ~ quiz replaced (quiz.json changed): ${title}`);
              state.quizFiles[lp.folder] = qz.sha!;
              await saveState();
            }
          } else {
            const same = JSON.stringify((ql.quiz?.questions ?? []).map((q) => ({ q: q.q, options: q.options, correct: q.correct, why: q.why }))) === JSON.stringify(qz.questions);
            if (!same) await del.call('PUT', `/courses/${courseId}/lectures/${ql.id}/quiz`, { questions: qz.questions });
          }
          counts.quizzes++;
          counts.quizQuestions += qz.questions.length;
        } catch (e) { if (e instanceof ApiError && e.code === 'session_ended') throw e;
          counts.failed++;
          issues.push(`${lp.folder}: quiz failed: ${(e as Error).message}`);
        }
      }
      log(`  ✓ ${lp.title}`);
    }
    // Article lessons (text written in the plan), created or updated in place.
    for (const ap of sp.articles ?? []) {
      const { text, missing } = fillCourseLinks(ap.articleMd, await courseLinks());
      if (missing.length) { issues.push(`article ${ap.key}: no public link yet for ${missing.join(', ')} (upload that course first); article not written`); continue; }
      const everything = c.sections.flatMap((s) => s.lectures);
      let al = everything.find((l) => l.id === state.articles![ap.key]) ?? everything.find((l) => l.title === ap.title && l.type === 'article');
      if (!al) {
        const made = await del.call<{ id: string }>('POST', `/courses/${courseId}/sections/${sec.id}/lectures`, { title: ap.title, type: 'article', summary: ap.summary ?? '', articleMd: text, isPreview: false });
        c = await detail();
        al = c.sections.flatMap((s) => s.lectures).find((l) => l.id === made.id)!;
        log(`+ article ${ap.title}`);
      } else {
        const patch: Record<string, unknown> = {};
        if (al.title !== ap.title) patch.title = ap.title;
        if ((al.summary ?? '') !== (ap.summary ?? '')) patch.summary = ap.summary ?? '';
        if ((al.articleMd ?? '') !== text) patch.articleMd = text;
        if (Object.keys(patch).length) { await del.call('PATCH', `/courses/${courseId}/lectures/${al.id}`, patch); log(`~ article ${ap.title}`); }
      }
      state.articles![ap.key] = al.id;
      await saveState();
    }
  }
  await saveState();

  // 4b. Assessments: one quiz lesson each at the end of its module, replaced when its file changes (same lesson).
  state.assessments ??= {};
  state.quizFiles ??= {};
  const placed: { section: number; id: string }[] = [];
  for (const x of [...assessments].sort((p, q) => p.section - q.section || ['module', 'scenario', 'final'].indexOf(p.a.kind) - ['module', 'scenario', 'final'].indexOf(q.a.kind))) {
    const secId = state.sections[plan.sections[x.section]!.title];
    if (!secId) { issues.push(`${x.a.title}: its module was not created`); continue; }
    try {
      const everything = c.sections.flatMap((s) => s.lectures);
      let ql = everything.find((l) => l.id === state.assessments![x.a.key]) ?? everything.find((l) => l.title === x.a.title && (l.type ?? 'quiz') === 'quiz');
      if (!ql) {
        const summary = `${x.quiz.settings?.sampleSize ?? x.quiz.questions.length} questions${x.a.kind === 'final' ? ' across the whole course' : x.a.kind === 'module' ? ' across this module' : ' on a real-world scenario'}, with every answer explained.`;
        const made = await del.call<{ id: string }>('POST', `/courses/${courseId}/sections/${secId}/lectures`, { title: x.a.title, type: 'quiz', summary });
        c = await detail();
        ql = c.sections.flatMap((s) => s.lectures).find((l) => l.id === made.id)!;
        log(`+ ${x.a.title}`);
      } else if (ql.title !== x.a.title) await del.call('PATCH', `/courses/${courseId}/lectures/${ql.id}`, { title: x.a.title });
      state.assessments[x.a.key] = ql.id;
      const k = `assessment:${x.a.key}`;
      if (state.quizFiles[k] !== x.quiz.sha || (ql.quiz?.questions?.length ?? 0) !== x.quiz.questions.length) {
        await del.call('PUT', `/courses/${courseId}/lectures/${ql.id}/quiz`, { questions: toApi(x.quiz.questions, x.a.title), settings: x.quiz.settings });
        if (ql.quiz?.questions?.length) log(`  ~ ${x.a.title} replaced (file changed)`);
        state.quizFiles[k] = x.quiz.sha!;
      }
      await saveState();
      placed.push({ section: x.section, id: ql.id });
      counts.quizzes++;
      counts.quizQuestions += x.quiz.questions.length;
    } catch (e) { if (e instanceof ApiError && e.code === 'session_ended') throw e;
      counts.failed++;
      issues.push(`${x.a.title} failed: ${(e as Error).message}`);
    }
  }

  // 5. Curriculum in plan order (new lessons inserted where the plan puts them; ids never recreated). Lessons and
  // sections that are not in the plan stay, at the end, and are reported.
  c = await detail();
  const withQuiz = new Set([...quizzes].filter(([, q]) => q.questions.length).map(([k]) => k));
  const { arranged, issues: arrangeIssues } = arrangeCurriculum(plan, state, withQuiz, c.sections, placed);
  issues.push(...arrangeIssues);
  await del.call('PUT', `/courses/${courseId}/curriculum`, { sections: arranged });
  if (opts.prune) {
    c = await detail();
    const t = pruneTargets(c.status, plan, state, withQuiz, c.sections, !!opts.prunePublished);
    for (const l of t.lectures) { await del.call('DELETE', `/courses/${courseId}/lectures/${l.id}`); log(`- lesson removed: ${l.title}`); }
    for (const s of t.sections) { await del.call('DELETE', `/courses/${courseId}/sections/${s.id}`); log(`- section removed: ${s.title}`); }
    // Forget ids that no longer exist, so a later run can't match them.
    const gone = new Set([...t.lectures.map((l) => l.id), ...t.sections.map((s) => s.id)]);
    for (const m of [state.lessons, state.quizzes!, state.articles!, state.sections, state.assessments!]) for (const [k, v] of Object.entries(m)) if (gone.has(v)) delete m[k];
    await saveState();
    if (t.lectures.length || t.sections.length) issues.push(`pruned ${t.lectures.length} lesson(s) and ${t.sections.length} section(s) not in the plan (media kept)`);
    for (let i = issues.length - 1; i >= 0; i--) if (/^(lesson|section) on the site but not in the plan/.test(issues[i]!)) issues.splice(i, 1);
  }

  // Intro video as the course page's promo video (only when the plan asks for it and the video exists).
  const introLesson = plan.intro?.promo ? plan.sections.flatMap((x) => x.lessons).find((l) => isIntro(plan, l)) : undefined;
  if (introLesson) {
    const vid = c.sections.flatMap((x) => x.lectures).find((l) => l.id === state.lessons[introLesson.folder])?.videoAssetId;
    if (vid && c.promoVideo?.id !== vid) { await del.call('PATCH', `/courses/${courseId}`, { promoVideoAssetId: vid }); log('Promo video: the introduction'); }
  }

  // 6. Cover from the platform templates (never a video frame).
  // `cover` is "suggested", a template id, or a template key such as "blueprint-aws" (the catalog family, 2026-11-27).
  if (plan.course.cover && (!c.coverTemplateId || plan.course.cover !== 'suggested')) {
    const t = await del.call<{ templates: { id: string; key?: string; name?: string; suggested?: boolean }[] }>('GET', `/courses/${courseId}/covers`);
    const items = t.templates ?? [];
    const pick = plan.course.cover === 'suggested' ? (items.find((x) => x.suggested) ?? items[0]) : items.find((x) => x.id === plan.course.cover || x.key === plan.course.cover);
    if (!pick) issues.push(`no cover template found: ${plan.course.cover}`);
    else if (pick.id !== c.coverTemplateId) { await del.call('PUT', `/courses/${courseId}/cover`, { templateId: pick.id }); log(`Cover template ${pick.name ?? pick.id}`); }
  }

  // 6a. Sharing banner (the link-preview image): drawn by the platform from the title; the plan picks the topic design,
  // style or headline. Uploads are for people in the studio, never the agent.
  if (plan.course.share) {
    const cur = await del.call<{ choice: { family: string | null; template: string | null; headline: string | null } }>('GET', `/courses/${courseId}/share`);
    const change = shareChange(plan.course.share, cur.choice);
    if (change) {
      try { await del.call('PUT', `/courses/${courseId}/share`, change); log(`Sharing banner ${JSON.stringify(change)}`); }
      catch (e) { if (e instanceof ApiError && e.code === 'session_ended') throw e; issues.push(`sharing banner not set: ${(e as Error).message}`); }
    }
  }

  // 6b. Related courses ("Continue your learning journey"): only when the plan lists them; a course not uploaded yet in
  // this environment is skipped and reported, and the list is set again on the next run.
  if (plan.related) {
    const ids: Record<string, string | undefined> = {};
    for (const r of plan.related) {
      const sp = join(planDir, '..', r.course, `state.${plan.environment}.json`);
      ids[r.course] = existsSync(sp) ? (JSON.parse(await readFile(sp, 'utf8')) as State).courseId : undefined;
    }
    const { items, missing } = resolveRelated(plan.related, ids);
    missing.forEach((m) => issues.push(`related course not in ${plan.environment} yet (skipped): ${m}`));
    try {
      await del.call('PUT', `/courses/${courseId}/related`, { items });
      log(`Related courses: ${items.length}`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'session_ended') throw e;
      issues.push(`related courses not set: ${(e as Error).message}`);
    }
  }

  // 7. Wait for video processing, then validate.
  const deadline = Date.now() + (opts.waitMinutes ?? 45) * 60_000;
  for (;;) {
    c = await detail();
    const vids = c.sections.flatMap((s) => s.lectures).map((l) => l.video).filter((v): v is NonNullable<Lecture['video']> => !!v);
    const pending = vids.filter((v) => v.status !== 'ready' && v.status !== 'failed');
    // Keep the shared media map's processing status current, so other plans know a shared video is ready.
    let mediaChanged = false;
    for (const v of vids) for (const rec of Object.values(media.map.files)) if (rec.assetId === v.id && rec.status !== v.status) { rec.status = v.status; mediaChanged = true; }
    if (mediaChanged) await media.save();
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
    `| Slides (PDF) / labs (ZIP) | ${counts.slides} / ${counts.labs} |`, `| Quiz lessons / questions | ${counts.quizzes} / ${counts.quizQuestions} |`, `| Price | ${plan.course.priceCents !== undefined ? `$${(plan.course.priceCents / 100).toFixed(2)}` : 'unchanged'} |`, `| Files sent / reused / failed | ${counts.uploaded} / ${counts.reused} / ${counts.failed} |`, '',
    `## Validation`, '```json', JSON.stringify(validation, null, 2), '```', '',
    `## Issues and skipped items`, ...(issues.length ? issues.map((i) => `- ${i}`) : ['- none']), '',
    `## Quiz questions not imported`, ...(quizSkips.length ? quizSkips.map((i) => `- ${i}`) : ['- none']), '',
    `## Skipped files (by the upload rules)`, ...[...inventory].flatMap(([k, f]) => f.skipped.map((x) => `- ${k}/${x.file}: ${x.why}`)),
  );
  const reportsDir = join(planDir, 'reports');
  await mkdir(reportsDir, { recursive: true });
  const reportPath = join(reportsDir, `${plan.environment}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`);
  await writeFile(reportPath, report.join('\n') + '\n');
  log(`Report: ${reportPath}`);
  return { courseId, counts, issues, validation, studioUrl: preview.studioUrl, reportPath };
  }
}

// CLI
if (process.argv[1] && ['publish.js', 'del-publish-course'].includes(basename(process.argv[1]))) {
  const args = process.argv.slice(2);
  const val = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
  const wait = val('--wait') !== undefined ? Number(val('--wait')) : undefined;
  const env = val('--env') as Env | undefined;
  const auth = val('--auth') as AuthMode | undefined;
  const planPath = args.find((a, i) => !a.startsWith('--') && !['--wait', '--env', '--auth'].includes(args[i - 1] ?? ''));
  if (!planPath || (env && !['staging', 'production'].includes(env)) || (auth && !['agent', 'session'].includes(auth))) { console.error('Usage: DEL_AGENT_TOKEN=del_agent_… node dist/publish.js <plan.json> [--env staging|production] [--dry-run] [--wait minutes]\n       DEL_SESSION_JAR=<cookie jar from scripts/del-signin.sh> node dist/publish.js <plan.json> --auth session [...]'); process.exit(2); }
  publish(planPath, { dryRun: args.includes('--dry-run'), waitMinutes: wait, env, auth, prune: args.includes('--prune') || args.includes('--prune-published'), prunePublished: args.includes('--prune-published') })
    .then((r) => { if ('dryRun' in r) console.log(JSON.stringify({ environment: r.environment, apiUrl: r.apiUrl, priceCents: r.priceCents, quizzes: r.quizzes, issues: r.issues, quizSkips: r.quizSkips?.length }, null, 2)); else console.log(JSON.stringify({ courseId: r.courseId, counts: r.counts, issues: r.issues.length }, null, 2)); })
    .catch((e) => { console.error(e instanceof ApiError ? `${e.code} (${e.status}): ${e.message}` : (e as Error).message); process.exit(1); });
}
