import { Injectable } from '@nestjs/common';
import { parseRanges } from '../access/consumption';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { averageWatched, biggestDrop, MIN_SAMPLE, quizMisses, retentionCurve } from './insights';

/**
 * Instructor Studio › Insights (owner 2026-11-26): where learners stop watching, which quiz questions they get wrong and
 * how often they ask the AI assistant, per lesson of one course. The course's instructor only (a super admin may look at
 * any course; that is audited). No learner names, no question text (the assistant stores none), and no curve or quiz
 * figure below MIN_SAMPLE learners. The instructor's own viewing is left out. docs/API.md.
 */
@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async course(a: Actor, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, slug: true, instructorId: true } });
    const superAdmin = a.user.roles.includes('super_admin');
    if (!course || (course.instructorId !== a.user.id && !superAdmin)) throw notFound('Course');
    if (course.instructorId !== a.user.id) await this.audit.log({ actorId: a.user.id, action: 'course.insights_viewed', targetType: 'course', targetId: course.id, ip: a.ip });
    const others = { not: course.instructorId };

    const sections = await this.prisma.section.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { title: true, lectures: { orderBy: { position: 'asc' }, select: { id: true, title: true, type: true, durationSec: true, quiz: { select: { id: true, questions: true } } } } },
    });
    const lectures = sections.flatMap((s) => s.lectures.map((l) => ({ ...l, section: s.title })));
    const ids = lectures.map((l) => l.id);
    const quizIds = lectures.flatMap((l) => (l.quiz ? [l.quiz.id] : []));

    const [progress, attempts, asks, askTotal, learners] = await Promise.all([
      this.prisma.lectureProgress.findMany({ where: { lectureId: { in: ids }, userId: others, watchedSec: { gt: 0 } }, select: { userId: true, lectureId: true, watchedRanges: true, watchedSec: true } }),
      quizIds.length
        ? this.prisma.quizAttempt.findMany({ where: { quizId: { in: quizIds }, userId: others }, orderBy: { at: 'desc' }, select: { userId: true, quizId: true, answers: true } })
        : Promise.resolve([]),
      this.prisma.aiUsage.groupBy({ by: ['lectureId'], where: { kind: 'ask', courseId, status: { in: ['ok', 'not_covered'] } }, _count: { _all: true } }),
      this.prisma.aiUsage.count({ where: { kind: 'ask', courseId, status: { in: ['ok', 'not_covered'] } } }),
      this.prisma.enrollment.count({ where: { courseId, revokedAt: null, userId: others } }),
    ]);

    const byLecture = new Map<string, typeof progress>();
    for (const p of progress) byLecture.set(p.lectureId, [...(byLecture.get(p.lectureId) ?? []), p]);
    // each learner's latest attempt per quiz (rows are newest first)
    const latest = new Map<string, unknown[]>();
    const seen = new Set<string>();
    for (const t of attempts) {
      const k = `${t.quizId}:${t.userId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      latest.set(t.quizId, [...(latest.get(t.quizId) ?? []), t.answers]);
    }
    const askBy = new Map(asks.map((r) => [r.lectureId, r._count._all]));

    const rows = lectures.map((l) => {
      const rowsFor = byLecture.get(l.id) ?? [];
      const enough = l.type === 'video' && l.durationSec > 0 && rowsFor.length >= MIN_SAMPLE;
      const curve = enough ? retentionCurve(rowsFor.map((p) => parseRanges(p.watchedRanges)), l.durationSec) : null;
      const questions = l.quiz ? ((l.quiz.questions as unknown as { q: string; correct: number }[]) ?? []) : [];
      const answers = l.quiz ? latest.get(l.quiz.id) ?? [] : [];
      const misses = l.quiz ? quizMisses(questions, answers) : [];
      return {
        id: l.id,
        title: l.title,
        section: l.section,
        type: l.type,
        durationSec: l.durationSec,
        viewers: rowsFor.length,
        enoughData: enough,
        averageWatchedPct: enough ? averageWatched(rowsFor.map((p) => p.watchedSec), l.durationSec) : null,
        retention: curve,
        biggestDrop: curve ? biggestDrop(curve) : null,
        aiQuestions: askBy.get(l.id) ?? 0,
        quiz: l.quiz ? { learners: answers.length, enoughData: misses.length > 0, hardest: misses.slice(0, 5) } : null,
      };
    });
    const measured = rows.filter((r) => r.averageWatchedPct !== null);
    return {
      course: { id: course.id, title: course.title, slug: course.slug },
      minSample: MIN_SAMPLE,
      totals: {
        learners,
        viewers: new Set(progress.map((p) => p.userId)).size,
        averageWatchedPct: measured.length ? Math.round(measured.reduce((n, r) => n + r.averageWatchedPct!, 0) / measured.length) : null,
        aiQuestions: askTotal,
        aiQuestionsWithoutLesson: askBy.get(null) ?? 0,
      },
      // the lessons where most viewers stop: worth a look first
      attention: rows.filter((r) => r.biggestDrop).sort((x, y) => y.biggestDrop!.drop - x.biggestDrop!.drop).slice(0, 3).map((r) => ({ id: r.id, title: r.title, at: r.biggestDrop!.at, drop: r.biggestDrop!.drop })),
      lectures: rows,
    };
  }
}
