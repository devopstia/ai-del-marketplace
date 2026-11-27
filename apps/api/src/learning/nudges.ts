import { createHmac, timingSafeEqual } from 'node:crypto';
import type { JobsService } from '../common/jobs';
import type { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';

const DAY = 86_400_000;

/**
 * Free-course learning emails (owner 2026-11-28, "grow from the free courses"): a short series after a free
 * enrolment. Each step has a window, so a deploy never sends a backlog of old steps:
 *  - welcome       day 0–2   how to start, the first lesson
 *  - keep-going    day 3–5   only when progress is under 20%
 *  - next-courses  day 7–10  the paid courses the free course itself recommends (its "continue your learning journey"
 *                            lesson links), minus the ones the learner already owns
 * Never for learners who turned these emails off, finished the course (certificate), lost access, or aren't active.
 * Idempotent: `nudgesSent` is marked with a conditional update before the email is queued (and the queue dedupes).
 */
export const NUDGE_STEPS = [
  { key: 'welcome', from: 0, to: 2 * DAY, template: 'learn-welcome' },
  { key: 'keep-going', from: 3 * DAY, to: 6 * DAY, template: 'learn-keep-going' },
  { key: 'next-courses', from: 7 * DAY, to: 10 * DAY, template: 'learn-next-courses' },
] as const;
export type NudgeKey = (typeof NUDGE_STEPS)[number]['key'];

/** The step due for an enrolment of this age, if any (the latest window that contains the age). */
export function dueStep(ageMs: number, sent: string[]): (typeof NUDGE_STEPS)[number] | null {
  const step = NUDGE_STEPS.find((s) => ageMs >= s.from && ageMs < s.to);
  return step && !sent.includes(step.key) ? step : null;
}

/** Course slugs linked from a course's text lessons ("continue your learning journey"), in order, de-duplicated. */
export function linkedCourseSlugs(markdown: string[], selfSlug: string): string[] {
  const out: string[] = [];
  for (const md of markdown) for (const m of md.matchAll(/\]\((?:https?:\/\/[^/)\s]+)?\/courses\/([a-z0-9-]+)\)/g)) {
    const slug = m[1]!;
    if (slug !== selfSlug && !out.includes(slug)) out.push(slug);
  }
  return out;
}

// ---------- one-click opt-out (signed link; no sign-in needed) ----------
const sign = (userId: string) => createHmac('sha256', env().SESSION_SECRET).update(`learning-emails:${userId}`).digest('base64url').slice(0, 32);
export const optOutToken = (userId: string) => sign(userId);
export function verifyOptOutToken(userId: string, token: string): boolean {
  const a = Buffer.from(sign(userId));
  const b = Buffer.from(String(token ?? ''));
  return a.length === b.length && timingSafeEqual(a, b);
}
export const optOutUrl = (userId: string) => `${env().WEB_URL.replace(/\/$/, '')}/email/learning-emails?u=${encodeURIComponent(userId)}&t=${optOutToken(userId)}`;

/** Hourly job: send the due step of each recent free enrolment. */
export async function sendLearningNudges(prisma: PrismaService, jobs: JobsService, now = new Date()) {
  let sent = 0;
  const rows = await prisma.enrollment.findMany({
    where: {
      revokedAt: null,
      createdAt: { gt: new Date(now.getTime() - 10 * DAY) },
      course: { priceCents: 0, status: 'published' },
      user: { status: 'active', learningEmailsOptOutAt: null },
    },
    include: {
      user: { select: { id: true, email: true, name: true } },
      course: { select: { id: true, slug: true, title: true, instructorId: true } },
    },
    take: 2000,
  });
  for (const e of rows) {
    if (e.course.instructorId === e.userId) continue; // the course's own instructor
    const step = dueStep(now.getTime() - e.createdAt.getTime(), e.nudgesSent);
    if (!step) continue;
    if (await prisma.certificate.findUnique({ where: { userId_courseId: { userId: e.userId, courseId: e.courseId } }, select: { code: true } })) continue; // finished
    const lectures = await prisma.lecture.findMany({ where: { section: { courseId: e.courseId } }, select: { id: true, type: true, articleMd: true, title: true }, orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }] });
    const data: Record<string, unknown> = { name: e.user.name, course: e.course.title, slug: e.course.slug, optOutUrl: optOutUrl(e.userId) };
    if (step.key === 'welcome') {
      data.firstLesson = lectures.find((l) => l.type !== 'article')?.title ?? lectures[0]?.title ?? null;
      data.lessons = lectures.filter((l) => l.type === 'video').length;
    } else if (step.key === 'keep-going') {
      const total = lectures.length;
      const done = total ? await prisma.lectureProgress.count({ where: { userId: e.userId, completed: true, lectureId: { in: lectures.map((l) => l.id) } } }) : 0;
      if (total && done / total >= 0.2) { await mark(prisma, e.userId, e.courseId, step.key); continue; } // already learning
      data.done = done;
      data.total = total;
    } else {
      const slugs = linkedCourseSlugs(lectures.filter((l) => l.type === 'article').map((l) => l.articleMd ?? ''), e.course.slug);
      const owned = new Set((await prisma.enrollment.findMany({ where: { userId: e.userId, revokedAt: null }, select: { courseId: true } })).map((x) => x.courseId));
      const found = slugs.length ? await prisma.course.findMany({ where: { slug: { in: slugs }, status: 'published', priceCents: { gt: 0 } }, select: { id: true, slug: true, title: true, subtitle: true } }) : [];
      const next = slugs.map((s) => found.find((c) => c.slug === s)).filter((c): c is NonNullable<typeof c> => !!c && !owned.has(c.id)).slice(0, 3);
      if (!next.length) { await mark(prisma, e.userId, e.courseId, step.key); continue; } // nothing relevant to suggest
      data.courses = next.map((c) => ({ title: c.title, slug: c.slug, subtitle: c.subtitle ?? '' }));
    }
    if (!(await mark(prisma, e.userId, e.courseId, step.key))) continue;
    await jobs.sendEmail({ to: e.user.email, template: step.template, dedupeKey: `nudge:${step.key}:${e.userId}:${e.courseId}`, data });
    sent++;
  }
  return { sent };
}

async function mark(prisma: PrismaService, userId: string, courseId: string, key: string) {
  const r = await prisma.enrollment.updateMany({ where: { userId, courseId, NOT: { nudgesSent: { has: key } } }, data: { nudgesSent: { push: key } } });
  return r.count > 0;
}
