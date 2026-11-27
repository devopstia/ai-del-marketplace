import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Quiz questions and assessment settings (owner 2026-11-28: no fixed four questions; the count follows the lesson;
 * every option explained; module, final and scenario assessments). Stored in `quizzes.questions` (array) and
 * `quizzes.settings`. Rows written before 2026-11-28 ({ q, options, correct, why }) stay valid: every new field is
 * optional, and a question without an `id` gets a stable one from its text.
 */
export const QUESTION_TYPES = ['concept', 'technical', 'scenario', 'troubleshooting', 'architecture', 'code', 'command', 'security', 'critical-thinking'] as const;
export const DIFFICULTIES = ['foundation', 'applied', 'advanced'] as const;
export const QUIZ_KINDS = ['lesson', 'module', 'final', 'scenario'] as const;
export const MAX_QUESTIONS = 60;

export interface QuizQuestion {
  id?: string;
  q: string;
  options: string[];
  correct: number;
  why: string;
  /** Why each option is right or wrong, same order as `options`. */
  explanations?: string[];
  takeaway?: string;
  difficulty?: (typeof DIFFICULTIES)[number];
  type?: (typeof QUESTION_TYPES)[number];
  topic?: string;
  /** Seconds into the lesson's video where this is taught. */
  timestamp?: number;
  /** A snippet shown with the question (config, command output, code). */
  code?: string;
  /** Keep the options in this order ("all of the above", "both A and B"). */
  fixedOrder?: boolean;
  /** Assessments: the video lesson where this is taught (its `timestamp` points there), and other places it is covered. */
  lessonId?: string;
  related?: { lessonId: string; timestamp: number }[];
}

export interface QuizSettings {
  kind?: (typeof QUIZ_KINDS)[number];
  /** Scenario text shown above the questions (scenario assessments). */
  scenario?: string;
  /** Logs, config or output shown with the scenario. */
  scenarioCode?: string;
  /** Questions drawn per attempt (assessments with a larger bank). */
  sampleSize?: number;
  /** Also draw from the lesson quizzes of this module ("module") or the whole course ("course"). */
  pool?: 'own' | 'module' | 'course';
}

const str = (n: number) => z.string().trim().max(n);
export const questionSchema = z
  .object({
    id: z.string().trim().regex(/^[\w-]{1,64}$/).optional(),
    q: str(1000).min(3),
    options: z.array(str(400).min(1)).min(2).max(6),
    correct: z.number().int().min(0).max(5),
    why: str(2000).min(1),
    explanations: z.array(str(1000)).max(6).optional(),
    takeaway: str(600).optional(),
    difficulty: z.enum(DIFFICULTIES).optional(),
    type: z.enum(QUESTION_TYPES).optional(),
    topic: str(80).min(1).optional(),
    timestamp: z.number().int().min(0).max(24 * 3600).optional(),
    code: z.string().max(4000).optional(),
    fixedOrder: z.boolean().optional(),
    lessonId: z.string().uuid().optional(),
    related: z.array(z.object({ lessonId: z.string().uuid(), timestamp: z.number().int().min(0).max(24 * 3600) }).strict()).max(5).optional(),
  })
  .strict();
export const settingsSchema = z
  .object({
    kind: z.enum(QUIZ_KINDS).optional(),
    scenario: z.string().trim().max(8000).optional(),
    scenarioCode: z.string().max(8000).optional(),
    sampleSize: z.number().int().min(1).max(MAX_QUESTIONS).optional(),
    pool: z.enum(['own', 'module', 'course']).optional(),
  })
  .strict();

/** Problems the zod schema can't see: answer index in range, explanation count, duplicates, unique ids. */
export function quizProblems(questions: QuizQuestion[], settings?: QuizSettings | null): { field: string; message: string }[] {
  const out: { field: string; message: string }[] = [];
  const texts = new Set<string>();
  const ids = new Set<string>();
  for (const [i, q] of questions.entries()) {
    if (q.correct >= q.options.length) out.push({ field: `questions.${i}.correct`, message: `Question ${i + 1}: the correct answer must be one of its ${q.options.length} options` });
    if (q.explanations && q.explanations.length !== q.options.length) out.push({ field: `questions.${i}.explanations`, message: `Question ${i + 1}: one explanation per option (${q.options.length})` });
    const t = norm(q.q);
    if (texts.has(t)) out.push({ field: `questions.${i}.q`, message: `Question ${i + 1} repeats an earlier question` });
    texts.add(t);
    const id = questionId(q);
    if (ids.has(id)) out.push({ field: `questions.${i}.id`, message: `Question ${i + 1}: id "${id}" is used twice` });
    ids.add(id);
    if (new Set(q.options.map(norm)).size !== q.options.length) out.push({ field: `questions.${i}.options`, message: `Question ${i + 1} has the same option twice` });
  }
  if (settings?.sampleSize && settings.pool !== 'module' && settings.pool !== 'course' && settings.sampleSize > questions.length) {
    out.push({ field: 'settings.sampleSize', message: `Draws ${settings.sampleSize} questions but the quiz has ${questions.length}` });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Stable id: the author's, or a hash of the question text (so expanding a bank keeps old attempts readable). */
export function questionId(q: Pick<QuizQuestion, 'id' | 'q'>): string {
  return q.id ?? `q_${createHash('sha256').update(norm(q.q)).digest('hex').slice(0, 12)}`;
}

/** The recommended number of questions for a video length (owner's table, 2026-11-28). */
export function recommendedRange(durationSec: number): [number, number] {
  const m = durationSec / 60;
  return m < 5 ? [3, 5] : m < 10 ? [5, 8] : m < 20 ? [8, 12] : m < 30 ? [10, 15] : m < 45 ? [15, 20] : m < 60 ? [20, 25] : [25, 30];
}

/** Questions for one attempt: everything, or a random sample of `size` (assessments with a bank). */
export function draw<T>(pool: T[], size?: number): T[] {
  if (!size || size >= pool.length) return [...pool];
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, size);
}

/** A signed list of the question ids handed out for one attempt, so a sampled attempt can't pick its own questions. */
export function signDraw(secret: string, userId: string, quizId: string, ids: string[]): string {
  const body = Buffer.from(JSON.stringify(ids)).toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(`${userId}|${quizId}|${body}`).digest('base64url')}`;
}
export function verifyDraw(secret: string, userId: string, quizId: string, token: string): string[] | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = Buffer.from(createHmac('sha256', secret).update(`${userId}|${quizId}|${body}`).digest('base64url'));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const ids = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown;
    return Array.isArray(ids) && ids.every((x) => typeof x === 'string') ? (ids as string[]) : null;
  } catch {
    return null;
  }
}

/** Answers as stored on an attempt: v1 = number[] aligned with the questions; v2 = per question id. */
export interface AttemptAnswersV2 { v: 2; mode: 'full' | 'retry'; items: { id: string; chosen: number; correct: boolean }[] }
export function attemptItems(answers: unknown, questions: QuizQuestion[]): { id: string; chosen: number; correct: boolean }[] {
  if (Array.isArray(answers)) {
    return answers.flatMap((chosen, i) => {
      const q = questions[i];
      return q && typeof chosen === 'number' ? [{ id: questionId(q), chosen, correct: chosen === q.correct }] : [];
    });
  }
  const a = answers as Partial<AttemptAnswersV2> | null;
  return a?.v === 2 && Array.isArray(a.items) ? a.items : [];
}
export const attemptMode = (answers: unknown): 'full' | 'retry' => ((answers as Partial<AttemptAnswersV2> | null)?.v === 2 ? ((answers as AttemptAnswersV2).mode ?? 'full') : 'full');
