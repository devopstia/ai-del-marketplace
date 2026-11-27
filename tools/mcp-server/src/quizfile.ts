/**
 * Quiz banks delivered as files (owner 2026-11-28; schema courses/quiz.schema.json):
 * - `quiz.json` in a lesson folder: that lesson's quiz (preferred over the questions read from the captions);
 * - `<assessments>/module-<n>-assessment.json`, `final-assessment.json`, `scenario-<name>.json`: assessments.
 * Validation here is what the publisher checks before uploading; the API checks the same shape again.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const QUESTION_TYPES = ['concept', 'technical', 'scenario', 'troubleshooting', 'architecture', 'code', 'command', 'security', 'critical-thinking'];
/** GEN's longer names for the same types (its quiz.json files, 2026-11-28), sent to the API as the short ones. */
export const TYPE_ALIASES: Record<string, string> = { 'code/config analysis': 'code', 'code analysis': 'code', 'config analysis': 'code', 'real-world scenario': 'scenario', 'scenario-based': 'scenario', 'best practice': 'security', 'critical thinking': 'critical-thinking' };
export const DIFFICULTIES = ['foundation', 'applied', 'advanced'];
export const KINDS = ['lesson', 'module', 'final', 'scenario'];
export const MAX_QUESTIONS = 60;
const QUESTION_KEYS = new Set(['id', 'q', 'options', 'correct', 'why', 'explanations', 'takeaway', 'difficulty', 'type', 'topic', 'timestamp', 'code', 'fixedOrder', 'lesson', 'related']);
/** GEN's assessment kinds (2026-11-28) → the platform's. */
export const KIND_ALIASES: Record<string, string> = { 'module-assessment': 'module', 'final-assessment': 'final', scenario: 'scenario', module: 'module', final: 'final' };
const SETTINGS_KEYS = new Set(['kind', 'scenario', 'scenarioCode', 'sampleSize', 'pool']);

export interface BankQuestion {
  id?: string; q: string; options: string[]; correct: number; why: string;
  explanations?: string[]; takeaway?: string; difficulty?: string; type?: string; topic?: string; timestamp?: number; code?: string; fixedOrder?: boolean;
  /** Assessments: the lesson folder the question comes from (its `timestamp` points into that video), and other places it is covered. */
  lesson?: string; related?: { lesson: string; timestamp: number }[];
}
export interface BankSettings { kind?: string; scenario?: string; scenarioCode?: string; sampleSize?: number; pool?: 'own' | 'module' | 'course' }
export interface QuizFile { title?: string; /** 1-based module (GEN: `module`; older drafts: `section`). */ section?: number; kind?: string; settings?: BankSettings; questions: BankQuestion[] }
export interface Checked { file: QuizFile; errors: string[]; warnings: string[] }

/** The owner's table (2026-11-28): recommended questions for a video length. */
export function recommendedRange(durationSec: number): [number, number] {
  const m = durationSec / 60;
  return m < 5 ? [3, 5] : m < 10 ? [5, 8] : m < 20 ? [8, 12] : m < 30 ? [10, 15] : m < 45 ? [15, 20] : m < 60 ? [20, 25] : [25, 30];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Checks a quiz file. Errors block the upload (bad shape, wrong answer index, an option without its explanation,
 * duplicates, a timestamp past the end of the video, an answer given away by the question); a count outside the
 * recommended range for the video's length is only a warning (the content decides, not a number).
 */
export interface CheckOpts {
  durationSec?: number | null;
  assessment?: boolean;
  /** Assessments: does this lesson folder exist in the plan, and how long is its video (timestamps are checked against it). */
  lessonDuration?: (folder: string) => number | null | undefined;
}
export function checkQuizFile(raw: unknown, opts: CheckOpts = {}): Checked {
  const errors: string[] = [];
  const warnings: string[] = [];
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const qs = Array.isArray(raw) ? raw : o.questions;
  if (!Array.isArray(qs) || !qs.length) return { file: { questions: [] }, errors: ['no questions'], warnings };
  if (qs.length > MAX_QUESTIONS) errors.push(`${qs.length} questions: at most ${MAX_QUESTIONS} per quiz (split the assessment)`);
  const texts = new Set<string>();
  const ids = new Set<string>();
  const questions: BankQuestion[] = [];
  for (const [i, x] of qs.entries()) {
    const n = `question ${i + 1}`;
    const q = { ...((x && typeof x === 'object' ? x : {}) as Record<string, unknown>) };
    for (const k of Object.keys(q)) if (!QUESTION_KEYS.has(k)) errors.push(`${n}: unknown field "${k}"`);
    const text = typeof q.q === 'string' ? q.q.trim() : '';
    const options = Array.isArray(q.options) ? q.options.map((v) => (typeof v === 'string' ? v.trim() : '')) : [];
    const correct = typeof q.correct === 'number' && Number.isInteger(q.correct) ? q.correct : -1;
    const why = typeof q.why === 'string' ? q.why.trim() : '';
    if (text.length < 3) errors.push(`${n}: question text missing`);
    if (options.length < 2 || options.length > 6 || options.some((v) => !v)) errors.push(`${n}: 2–6 non-empty options`);
    if (new Set(options.map(norm)).size !== options.length) errors.push(`${n}: the same option twice`);
    if (correct < 0 || correct >= options.length) errors.push(`${n}: "correct" must be the index of one of its ${options.length} options (0 = the first)`);
    if (!why) errors.push(`${n}: "why" (the explanation of the answer) is missing`);
    const ex = q.explanations;
    if (!Array.isArray(ex) || ex.length !== options.length || ex.some((v) => typeof v !== 'string' || !v.trim())) errors.push(`${n}: one explanation per option ("explanations", ${options.length})`);
    if (q.difficulty !== undefined && !DIFFICULTIES.includes(String(q.difficulty))) errors.push(`${n}: difficulty is one of ${DIFFICULTIES.join(', ')}`);
    if (typeof q.type === 'string' && TYPE_ALIASES[q.type.toLowerCase()]) q.type = TYPE_ALIASES[q.type.toLowerCase()];
    if (q.type !== undefined && !QUESTION_TYPES.includes(String(q.type))) errors.push(`${n}: type is one of ${QUESTION_TYPES.join(', ')}`);
    if (q.id !== undefined && (typeof q.id !== 'string' || !/^[\w-]{1,64}$/.test(q.id))) errors.push(`${n}: id uses letters, digits, - and _ (up to 64)`);
    // Which video the timestamp points into: the lesson's own, or (assessments) the lesson the question names.
    const lessonOk = (folder: unknown, where: string): number | null | undefined => {
      if (typeof folder !== 'string' || !folder.trim()) { errors.push(`${where}: "lesson" must be a lesson folder`); return null; }
      if (!opts.lessonDuration) return undefined;
      const d = opts.lessonDuration(folder);
      if (d === undefined) errors.push(`${where}: lesson "${folder}" is not in the course plan`);
      return d;
    };
    const dur = q.lesson !== undefined ? lessonOk(q.lesson, n) : opts.durationSec;
    const checkTs = (ts: unknown, d: number | null | undefined, where: string) => {
      if (typeof ts !== 'number' || !Number.isInteger(ts) || ts < 0) errors.push(`${where}: timestamp is whole seconds into the video`);
      else if (d && ts > d) errors.push(`${where}: timestamp ${ts}s is after the end of the video (${Math.round(d)}s)`);
    };
    if (q.timestamp !== undefined) checkTs(q.timestamp, dur, n);
    if (q.related !== undefined) {
      if (!Array.isArray(q.related) || q.related.length > 5) errors.push(`${n}: "related" is a list of up to 5 { lesson, timestamp }`);
      else for (const [j, r] of q.related.entries()) {
        const rr = (r ?? {}) as Record<string, unknown>;
        if (Object.keys(rr).some((k) => k !== 'lesson' && k !== 'timestamp')) errors.push(`${n}: related ${j + 1} has fields other than lesson and timestamp`);
        checkTs(rr.timestamp, lessonOk(rr.lesson, `${n} related ${j + 1}`), `${n} related ${j + 1}`);
      }
    }
    if (text && texts.has(norm(text))) errors.push(`${n}: repeats an earlier question`);
    texts.add(norm(text));
    if (typeof q.id === 'string') { if (ids.has(q.id)) errors.push(`${n}: id "${q.id}" used twice`); ids.add(q.id); }
    // The answer given away: the right option's words appear in the question and no other option's do.
    const right = options[correct];
    if (right && right.length >= 8 && norm(text).includes(norm(right)) && !options.some((v, j) => j !== correct && norm(text).includes(norm(v)))) errors.push(`${n}: the question gives the answer away ("${right}")`);
    questions.push(q as unknown as BankQuestion);
  }
  let settings: BankSettings | undefined;
  // GEN's assessment files: kind, module, scenario and code at the top level.
  const kind = o.kind === undefined ? undefined : KIND_ALIASES[String(o.kind)];
  if (o.kind !== undefined && !kind) errors.push(`kind is one of module-assessment, final-assessment, scenario`);
  if (kind || typeof o.scenario === 'string' || typeof o.code === 'string') {
    settings = { ...(kind ? { kind } : {}), ...(typeof o.scenario === 'string' && o.scenario.trim() ? { scenario: o.scenario.trim() } : {}), ...(typeof o.code === 'string' && o.code.trim() ? { scenarioCode: o.code } : {}) };
    if ((settings.scenario?.length ?? 0) > 8000 || (settings.scenarioCode?.length ?? 0) > 8000) errors.push('scenario text and code: at most 8000 characters each');
  }
  if (o.settings !== undefined) {
    const s = (o.settings ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(s)) if (!SETTINGS_KEYS.has(k)) errors.push(`settings: unknown field "${k}"`);
    if (s.kind !== undefined && !KINDS.includes(String(s.kind))) errors.push(`settings.kind is one of ${KINDS.join(', ')}`);
    if (s.pool !== undefined && !['own', 'module', 'course'].includes(String(s.pool))) errors.push('settings.pool is own, module or course');
    if (s.sampleSize !== undefined && (!Number.isInteger(s.sampleSize) || (s.sampleSize as number) < 1 || (s.sampleSize as number) > MAX_QUESTIONS)) errors.push(`settings.sampleSize is 1–${MAX_QUESTIONS}`);
    if (typeof s.sampleSize === 'number' && s.pool !== 'module' && s.pool !== 'course' && s.sampleSize > qs.length) errors.push(`settings.sampleSize ${s.sampleSize} is more than the ${qs.length} questions`);
    settings = { ...(settings ?? {}), ...(s as BankSettings) };
  }
  if (opts.assessment) {
    const total = settings?.sampleSize ?? qs.length;
    if (settings?.kind === 'module' && (total < 15 || total > 30)) warnings.push(`module assessment with ${total} questions per attempt (recommended 15–30)`);
    if (settings?.kind === 'final' && total < 30) warnings.push(`final assessment with ${total} questions per attempt (recommended 30–60)`);
  } else if (opts.durationSec) {
    const [lo, hi] = recommendedRange(opts.durationSec);
    if (qs.length < lo || qs.length > hi) warnings.push(`${qs.length} questions for a ${Math.round(opts.durationSec / 60)}-minute video (recommended ${lo}–${hi}; the content decides)`);
  }
  const section = typeof o.module === 'number' ? o.module : typeof o.section === 'number' ? o.section : undefined;
  return { file: { title: typeof o.title === 'string' ? o.title : undefined, section, kind, settings, questions }, errors, warnings };
}

export async function readQuizFile(path: string, opts: CheckOpts = {}): Promise<Checked> {
  let raw: unknown;
  try { raw = JSON.parse(await readFile(path, 'utf8')); } catch (e) { return { file: { questions: [] }, errors: [`not valid JSON: ${(e as Error).message}`], warnings: [] }; }
  return checkQuizFile(raw, opts);
}

/** Video length in seconds (null when ffprobe can't read it). */
export function probeSeconds(path: string): number | null {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], { encoding: 'utf8' });
  const d = Number.parseFloat(r.stdout);
  return r.status === 0 && Number.isFinite(d) ? d : null;
}

export interface AssessmentFile { key: string; path: string; kind: 'module' | 'final' | 'scenario'; section: number | null; title: string }

/**
 * The course's assessment files: `module-<n>-assessment.json` (end of module n), `final-assessment.json` (end of the
 * last module), `scenario-<name>.json` (end of the module named in the file, else the last).
 */
export async function assessmentFiles(dir: string): Promise<AssessmentFile[]> {
  if (!existsSync(dir)) return [];
  const out: AssessmentFile[] = [];
  for (const name of (await readdir(dir)).sort()) {
    const m = /^module-(\d+)-assessment\.json$/i.exec(name);
    if (m) { out.push({ key: `module-${Number(m[1])}`, path: join(dir, name), kind: 'module', section: Number(m[1]), title: `Module ${Number(m[1])} assessment` }); continue; }
    if (/^final-assessment\.json$/i.test(name)) { out.push({ key: 'final', path: join(dir, name), kind: 'final', section: null, title: 'Final assessment' }); continue; }
    const s = /^scenario-([\w-]+)\.json$/i.exec(name);
    if (s) out.push({ key: `scenario-${s[1]!.toLowerCase()}`, path: join(dir, name), kind: 'scenario', section: null, title: `Scenario: ${s[1]!.replace(/[-_]+/g, ' ')}` });
  }
  return out;
}

/** Checksum of a quiz file's text (the quiz is replaced when it changes). */
export const sha256Text = (s: string) => createHash('sha256').update(s).digest('hex');
