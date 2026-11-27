import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MediaService } from '../media/media.service';
import { LearningService } from './learning.service';
import { orderRef } from '../receipts/receipt-number';

const DAY = 86_400_000;
export const ACTIVITY_DAYS = 30;

/** YYYY-MM-DD in UTC (the series is UTC; the web labels it per day). */
export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Learning activity for the last `days` days from real records only (owner 2026-11-28, dashboard phase 2):
 * a day counts lessons the learner opened (a playback session per video lesson, counted once per lesson and day) and
 * quiz attempts. Watch *minutes* per day aren't recorded (LectureProgress keeps a running total), so they aren't shown.
 */
export function activitySeries(now: Date, days: number, opened: { lectureId: string | null; at: Date }[], quizzes: { at: Date }[]) {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const keys = Array.from({ length: days }, (_, i) => dayKey(new Date(end - (days - 1 - i) * DAY)));
  const lessons = new Map<string, Set<string>>();
  for (const o of opened) {
    const k = dayKey(o.at);
    if (!lessons.has(k)) lessons.set(k, new Set());
    lessons.get(k)!.add(o.lectureId ?? `asset-${o.at.getTime()}`);
  }
  const quizCount = new Map<string, number>();
  for (const q of quizzes) quizCount.set(dayKey(q.at), (quizCount.get(dayKey(q.at)) ?? 0) + 1);
  const series = keys.map((date) => ({ date, lessons: lessons.get(date)?.size ?? 0, quizzes: quizCount.get(date) ?? 0 }));
  const active = series.map((d) => d.lessons + d.quizzes > 0);
  // Current streak: consecutive active days ending today, or yesterday when today hasn't started yet.
  let i = active.length - 1;
  if (i >= 0 && !active[i]) i -= 1;
  let streak = 0;
  for (; i >= 0 && active[i]; i -= 1) streak += 1;
  return { days: series, activeDays: active.filter(Boolean).length, streak, lessonsOpened: series.reduce((n, d) => n + d.lessons, 0), quizAttempts: series.reduce((n, d) => n + d.quizzes, 0) };
}

/** Quiz results: best score per quiz, averaged per course and overall; the latest attempts. */
export function quizSummary(attempts: { score: number; at: Date; quizId: string; lectureId: string; lectureTitle: string; course: { slug: string; title: string } }[]) {
  const best = new Map<string, { score: number; course: { slug: string; title: string } }>();
  for (const a of attempts) {
    const b = best.get(a.quizId);
    if (!b || a.score > b.score) best.set(a.quizId, { score: a.score, course: a.course });
  }
  const perCourse = new Map<string, { slug: string; title: string; scores: number[] }>();
  for (const b of best.values()) {
    if (!perCourse.has(b.course.slug)) perCourse.set(b.course.slug, { ...b.course, scores: [] });
    perCourse.get(b.course.slug)!.scores.push(b.score);
  }
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((n, x) => n + x, 0) / xs.length) : null);
  return {
    averageScore: avg([...best.values()].map((b) => b.score)),
    quizzesTaken: best.size,
    attempts: attempts.length,
    courses: [...perCourse.values()].map((c) => ({ slug: c.slug, title: c.title, quizzes: c.scores.length, averageScore: avg(c.scores) })).sort((a, b) => a.title.localeCompare(b.title)),
    recent: [...attempts].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 5).map((a) => ({ at: a.at, score: a.score, lectureId: a.lectureId, lectureTitle: a.lectureTitle, course: a.course })),
  };
}

/** Student Studio home in one call: everything is the signed-in student's own data (GET /api/me/dashboard). */
@Injectable()
export class StudentDashboardService {
  constructor(private readonly prisma: PrismaService, private readonly media: MediaService, private readonly learning: LearningService) {}

  async forStudent(userId: string, now = new Date()) {
    const since = new Date(now.getTime() - ACTIVITY_DAYS * DAY);
    const [learning, certificates, attempts, opened, downloads, orders] = await Promise.all([
      this.learning.myLearning(userId),
      this.learning.myCertificates(userId),
      this.prisma.quizAttempt.findMany({
        where: { userId }, orderBy: { at: 'desc' }, take: 500,
        select: { score: true, at: true, quizId: true, quiz: { select: { lecture: { select: { id: true, title: true, section: { select: { course: { select: { slug: true, title: true } } } } } } } } },
      }),
      this.prisma.playbackSession.findMany({ where: { userId, createdAt: { gte: since } }, select: { lectureId: true, createdAt: true } }),
      this.prisma.resourceDownload.findMany({ where: { userId }, orderBy: { at: 'desc' }, take: 5, select: { id: true, title: true, at: true, courseId: true } }),
      this.prisma.order.findMany({
        where: { userId, status: { in: ['paid', 'refunded', 'partially_refunded'] } }, orderBy: { createdAt: 'desc' }, take: 3,
        select: { id: true, status: true, totalCents: true, currency: true, paidAt: true, createdAt: true, receiptNumber: true, lines: { select: { course: { select: { title: true } } } } },
      }),
    ]);

    // The course to continue: the most recently studied unfinished course; its module name and the time left.
    const active = learning.items.filter((i) => i.progress.percent < 100);
    const cont = [...active].sort((a, b) => (b.lastLecture?.at?.getTime() ?? 0) - (a.lastLecture?.at?.getTime() ?? 0))[0] ?? null;
    let continueLearning: null | { slug: string; lectureId: string | null; lectureTitle: string | null; moduleTitle: string | null; positionSec: number; remainingSec: number; lessonsLeft: number } = null;
    if (cont) {
      const lectures = await this.prisma.lecture.findMany({
        where: { section: { courseId: cont.course.id } },
        select: { id: true, durationSec: true, section: { select: { title: true } }, progress: { where: { userId }, select: { completed: true } } },
      });
      const left = lectures.filter((l) => !l.progress[0]?.completed);
      const lastId = cont.lastLecture?.id ?? null;
      continueLearning = {
        slug: cont.course.slug,
        lectureId: lastId,
        lectureTitle: cont.lastLecture?.title ?? null,
        moduleTitle: lastId ? lectures.find((l) => l.id === lastId)?.section.title ?? null : null,
        positionSec: cont.lastLecture?.positionSec ?? 0,
        remainingSec: left.reduce((n, l) => n + l.durationSec, 0),
        lessonsLeft: left.length,
      };
    }

    const courseTitles = new Map<string, { slug: string; title: string }>();
    if (downloads.length) {
      for (const c of await this.prisma.course.findMany({ where: { id: { in: [...new Set(downloads.map((d) => d.courseId))] } }, select: { id: true, slug: true, title: true } })) courseTitles.set(c.id, { slug: c.slug, title: c.title });
    }

    // A new student's way in: the free published courses.
    const freeCourses = learning.items.length || learning.expired.length ? [] : (await this.prisma.course.findMany({
      where: { status: 'published', priceCents: 0 }, orderBy: { publishedAt: 'desc' }, take: 3, select: { slug: true, title: true, subtitle: true, coverKey: true },
    })).map((c) => ({ slug: c.slug, title: c.title, subtitle: c.subtitle, thumbnailUrl: this.media.imageUrl(c.coverKey) }));

    return {
      learning,
      continueLearning,
      certificates: certificates.items,
      quizzes: quizSummary(attempts.filter((a) => a.quiz?.lecture).map((a) => ({ score: a.score, at: a.at, quizId: a.quizId, lectureId: a.quiz.lecture.id, lectureTitle: a.quiz.lecture.title, course: a.quiz.lecture.section.course }))),
      activity: activitySeries(now, ACTIVITY_DAYS, opened.map((o) => ({ lectureId: o.lectureId, at: o.createdAt })), attempts.filter((a) => a.at >= since)),
      downloads: downloads.map((d) => ({ id: d.id, title: d.title, at: d.at, course: courseTitles.get(d.courseId) ?? null })),
      purchases: orders.map((o) => ({ id: o.id, status: o.status, totalCents: o.totalCents, currency: o.currency, paidAt: o.paidAt ?? o.createdAt, receiptNumber: o.receiptNumber, orderRef: orderRef(o.id), courses: o.lines.map((l) => l.course.title) })),
      freeCourses,
    };
  }
}
