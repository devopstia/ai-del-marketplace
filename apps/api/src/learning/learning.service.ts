import { Injectable, Optional } from '@nestjs/common';
import { accessState, daysLeft, hasAccess } from '../access/access';
import { mergeRanges, parseRanges, rangeSeconds } from '../access/consumption';
import { ProtectionService } from '../protection/protection.service';
import { AuditService } from '../common/audit.service';
import { AuthUser, isAdmin } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { randomToken } from '../common/util';
import { MediaService } from '../media/media.service';

export interface QuizQuestion {
  q: string;
  options: string[];
  correct: number;
  why: string;
}

export type Access = 'enrolled' | 'owner' | 'admin';

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @Optional() private readonly protection?: ProtectionService,
  ) {}

  /** Who may open the paid content of a course: an active enrolment, the course owner, or an admin. */
  async access(user: AuthUser, course: { id: string; instructorId: string }): Promise<Access | null> {
    if (course.instructorId === user.id) return 'owner';
    if (isAdmin(user)) return 'admin';
    const e = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
    // Enforced here for every lecture, video, resource, quiz and progress call: an expired year means no access.
    return hasAccess(e) ? 'enrolled' : null;
  }

  private async lectureWithCourse(lectureId: string) {
    const l = await this.prisma.lecture.findUnique({
      where: { id: lectureId },
      include: { videoAsset: true, section: { select: { courseId: true, course: { select: { id: true, instructorId: true, slug: true } } } } },
    });
    if (!l) throw notFound('Lecture');
    return l;
  }

  private async requireLectureAccess(user: AuthUser, lectureId: string, opts: { allowPreview?: boolean } = {}) {
    const l = await this.lectureWithCourse(lectureId);
    const access = await this.access(user, l.section.course);
    if (!access && !(opts.allowPreview && l.isPreview)) throw forbidden('Enrol in this course to open this lecture', 'not_enrolled');
    return { lecture: l, access };
  }

  private async progressFor(userId: string, courseId: string) {
    const lectures = await this.prisma.lecture.findMany({ where: { section: { courseId } }, select: { id: true } });
    const done = await this.prisma.lectureProgress.count({ where: { userId, completed: true, lectureId: { in: lectures.map((l) => l.id) } } });
    return { total: lectures.length, completed: done, percent: lectures.length ? Math.round((done / lectures.length) * 100) : 0 };
  }

  async myReviews(userId: string) {
    const [reviews, enrolled] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId }, orderBy: { updatedAt: 'desc' },
        include: { course: { select: { id: true, slug: true, title: true, coverKey: true, ratingAvg: true, ratingCount: true } } },
      }),
      this.prisma.enrollment.findMany({ where: { userId, revokedAt: null }, select: { course: { select: { id: true, slug: true, title: true, coverKey: true, instructorId: true } } } }),
    ]);
    const reviewed = new Set(reviews.map((r) => r.courseId));
    const card = (c: { id: string; slug: string; title: string; coverKey: string | null }) => ({ id: c.id, slug: c.slug, title: c.title, thumbnailUrl: this.media.imageUrl(c.coverKey) });
    return {
      items: reviews.map((r) => ({ id: r.id, rating: r.rating, body: r.body, status: r.status, instructorReply: r.instructorReply, createdAt: r.createdAt, updatedAt: r.updatedAt, course: { ...card(r.course), ratingAvg: r.course.ratingAvg, ratingCount: r.course.ratingCount } })),
      toReview: enrolled.filter((e) => !reviewed.has(e.course.id) && e.course.instructorId !== userId).map((e) => card(e.course)),
    };
  }

  async myLearning(userId: string) {
    const enrolments = await this.prisma.enrollment.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { id: true, slug: true, title: true, coverKey: true, instructor: { select: { name: true } } } } },
    });
    const items = [];
    for (const e of enrolments) {
      const progress = await this.progressFor(userId, e.courseId);
      const last = await this.prisma.lectureProgress.findFirst({
        where: { userId, lecture: { section: { courseId: e.courseId } } },
        orderBy: { updatedAt: 'desc' },
        select: { positionSec: true, updatedAt: true, lecture: { select: { id: true, title: true } } },
      });
      const cert = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId: e.courseId } }, select: { code: true } });
      const line = e.orderLineId ? await this.prisma.orderLine.findUnique({ where: { id: e.orderLineId }, select: { order: { select: { paidAt: true } } } }) : null;
      const state = accessState(e);
      items.push({
        course: { id: e.course.id, slug: e.course.slug, title: e.course.title, thumbnailUrl: this.media.imageUrl(e.course.coverKey), instructor: e.course.instructor },
        enrolledAt: e.createdAt,
        // One-year access (owner 2026-11-25): when it was bought, when it ends, days left; expired courses keep progress.
        access: { state, purchasedAt: line?.order.paidAt ?? e.createdAt, expiresAt: e.accessExpiresAt, daysLeft: daysLeft(e.accessExpiresAt), canRenew: state === 'expiring' || state === 'expired' },
        progress,
        lastLecture: last ? { id: last.lecture.id, title: last.lecture.title, positionSec: last.positionSec, at: last.updatedAt } : null,
        certificateCode: cert?.code ?? null,
      });
    }
    return { items: items.filter((i) => i.access.state !== 'expired'), expired: items.filter((i) => i.access.state === 'expired') };
  }

  /** The learner's access dates for the player (null for owners, admins and courses without an end date). */
  private async accessInfo(userId: string, courseId: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    if (!e?.accessExpiresAt) return null;
    const state = accessState(e);
    return { state, expiresAt: e.accessExpiresAt, daysLeft: daysLeft(e.accessExpiresAt), canRenew: state === 'expiring' || state === 'expired' };
  }

  /** Full curriculum for someone with access (no URLs: playback/download go through signed-URL endpoints). */
  async courseForLearner(user: AuthUser, slug: string) {
    const c = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        instructor: { select: { id: true, name: true } },
        sections: {
          orderBy: { position: 'asc' },
          include: {
            lectures: {
              orderBy: { position: 'asc' },
              include: {
                resources: { select: { id: true, title: true, sizeBytes: true, mime: true } },
                quiz: { select: { id: true } },
                videoAsset: { select: { status: true, captionsKey: true } },
              },
            },
          },
        },
      },
    });
    if (!c) throw notFound('Course');
    const access = await this.access(user, c);
    if (!access) throw forbidden('You are not enrolled in this course', 'not_enrolled');
    const lectureIds = c.sections.flatMap((s) => s.lectures.map((l) => l.id));
    const progress = await this.prisma.lectureProgress.findMany({ where: { userId: user.id, lectureId: { in: lectureIds } } });
    const byLecture = new Map(progress.map((p) => [p.lectureId, p]));
    const last = [...progress].sort((a, b) => +b.updatedAt - +a.updatedAt)[0];
    const done = progress.filter((p) => p.completed).length;
    const [cert, review] = await Promise.all([
      this.prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: c.id } }, select: { code: true, issuedAt: true } }),
      this.prisma.review.findUnique({ where: { userId_courseId: { userId: user.id, courseId: c.id } }, select: { id: true, rating: true, body: true, status: true, instructorReply: true, createdAt: true, updatedAt: true } }),
    ]);
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      instructor: c.instructor,
      thumbnailUrl: this.media.imageUrl(c.coverKey),
      access,
      progress: { total: lectureIds.length, completed: done, percent: lectureIds.length ? Math.round((done / lectureIds.length) * 100) : 0 },
      lastLectureId: last?.lectureId ?? null,
      certificate: cert,
      myReview: review,
      // Reviews inside the learning view (owner 2026-11-25): the same numbers as the public course page.
      rating: { average: Math.round(c.ratingAvg * 10) / 10, count: c.ratingCount },
      accessInfo: await this.accessInfo(user.id, c.id),
      canReview: access === 'enrolled',
      sections: c.sections.map((s) => ({
        id: s.id,
        title: s.title,
        lectures: s.lectures.map((l) => ({
          id: l.id,
          title: l.title,
          type: l.type,
          summary: l.summary,
          durationSec: l.durationSec,
          isPreview: l.isPreview,
          articleMd: l.type === 'article' ? l.articleMd : undefined,
          videoStatus: l.videoAsset?.status ?? null,
          hasCaptions: !!l.videoAsset?.captionsKey,
          hasQuiz: !!l.quiz,
          resources: l.resources,
          progress: { positionSec: byLecture.get(l.id)?.positionSec ?? 0, completed: byLecture.get(l.id)?.completed ?? false },
        })),
      })),
    };
  }

  async playback(user: AuthUser, lectureId: string, ctx: { ip?: string | null; userAgent?: string | null } = {}) {
    const { lecture, access } = await this.requireLectureAccess(user, lectureId, { allowPreview: true });
    if (!lecture.videoAsset) throw badRequest('This lecture has no video', 'no_video');
    if (lecture.videoAsset.status !== 'ready') throw badRequest('This video is still processing', 'video_not_ready');
    // Paid content for enrolled learners, owners and admins: encrypted HLS through a session (content protection).
    // Free previews and videos not packaged yet: the short-lived signed file, as before.
    if (access) {
      const p = await this.protection?.session(lecture.videoAsset, user, { lectureId, ...ctx });
      if (p) return p;
    }
    return this.media.playback(lecture.videoAsset, user.id);
  }

  async saveProgress(user: AuthUser, lectureId: string, input: { positionSec: number; completed?: boolean; played?: [number, number][] }) {
    const { lecture, access } = await this.requireLectureAccess(user, lectureId);
    if (!access) throw forbidden('Enrol in this course to track progress', 'not_enrolled');
    const pos = lecture.durationSec > 0 ? Math.min(input.positionSec, lecture.durationSec) : input.positionSec;
    const existing = await this.prisma.lectureProgress.findUnique({ where: { userId_lectureId: { userId: user.id, lectureId } } });
    const completed = (existing?.completed ?? false) || !!input.completed; // completion is sticky
    // Unique seconds watched: merged with what was already played, so replays never add (docs/ACCESS_AND_REFUNDS.md).
    const ranges = mergeRanges([...parseRanges(existing?.watchedRanges), ...(input.played ?? [])], lecture.durationSec);
    const watched = { watchedRanges: ranges as unknown as object, watchedSec: rangeSeconds(ranges) };
    const row = await this.prisma.lectureProgress.upsert({
      where: { userId_lectureId: { userId: user.id, lectureId } },
      create: { userId: user.id, lectureId, positionSec: pos, completed, ...watched },
      update: { positionSec: pos, completed, ...watched },
    });
    const course = await this.progressFor(user.id, lecture.section.courseId);
    return { lectureId, positionSec: row.positionSec, completed: row.completed, courseProgress: course };
  }

  async resources(user: AuthUser, lectureId: string) {
    await this.requireLectureAccess(user, lectureId);
    const items = await this.prisma.resource.findMany({ where: { lectureId }, select: { id: true, title: true, sizeBytes: true, mime: true }, orderBy: { createdAt: 'asc' } });
    return { items };
  }

  async download(user: AuthUser, resourceId: string) {
    const r = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!r) throw notFound('Resource');
    await this.requireLectureAccess(user, r.lectureId);
    const ttl = 300;
    const filename = r.storageKey.split('/').pop() ?? 'download';
    return { url: await this.storage.presignGet(r.storageKey, ttl, { downloadName: filename }), expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), filename };
  }

  private async quizFor(user: AuthUser, lectureId: string) {
    await this.requireLectureAccess(user, lectureId);
    const quiz = await this.prisma.quiz.findUnique({ where: { lectureId } });
    if (!quiz) throw notFound('Quiz');
    return quiz;
  }

  async getQuiz(user: AuthUser, lectureId: string) {
    const quiz = await this.quizFor(user, lectureId);
    const questions = quiz.questions as unknown as QuizQuestion[];
    const last = await this.prisma.quizAttempt.findFirst({ where: { userId: user.id, quizId: quiz.id }, orderBy: { at: 'desc' }, select: { score: true, at: true } });
    // Never send the answers before an attempt.
    return { id: quiz.id, lectureId, questions: questions.map((q, i) => ({ index: i, q: q.q, options: q.options })), lastAttempt: last };
  }

  async submitQuiz(user: AuthUser, lectureId: string, answers: number[]) {
    const quiz = await this.quizFor(user, lectureId);
    const questions = quiz.questions as unknown as QuizQuestion[];
    if (answers.length !== questions.length) throw badRequest(`Expected ${questions.length} answers`, 'answer_count');
    const results = questions.map((q, i) => ({ index: i, chosen: answers[i], correct: q.correct, isCorrect: answers[i] === q.correct, why: q.why }));
    const score = Math.round((results.filter((r) => r.isCorrect).length / questions.length) * 100);
    await this.prisma.quizAttempt.create({ data: { userId: user.id, quizId: quiz.id, score, answers } });
    const passed = score >= 70;
    if (passed) {
      await this.prisma.lectureProgress.upsert({
        where: { userId_lectureId: { userId: user.id, lectureId } },
        create: { userId: user.id, lectureId, completed: true },
        update: { completed: true },
      });
    }
    return { score, passed, results };
  }

  async review(user: AuthUser, slug: string, input: { rating: number; body: string }) {
    const c = await this.prisma.course.findUnique({ where: { slug }, select: { id: true, instructorId: true } });
    if (!c) throw notFound('Course');
    const e = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: c.id } } });
    if (!e || e.revokedAt) throw forbidden('Only enrolled students can review this course', 'not_enrolled');
    const review = await this.prisma.review.upsert({
      where: { userId_courseId: { userId: user.id, courseId: c.id } },
      create: { userId: user.id, courseId: c.id, rating: input.rating, body: input.body },
      update: { rating: input.rating, body: input.body },
    });
    await recalcRating(this.prisma, c.id);
    const course = await this.prisma.course.findUniqueOrThrow({ where: { id: c.id }, select: { ratingAvg: true, ratingCount: true } });
    // An edit never un-hides a review an admin hid (moderation stays in force); the student sees its status.
    return { ...review, rating: review.rating, courseRating: { average: Math.round(course.ratingAvg * 10) / 10, count: course.ratingCount } };
  }

  async certificate(user: AuthUser, slug: string) {
    const c = await this.prisma.course.findUnique({ where: { slug }, select: { id: true, instructorId: true } });
    if (!c) throw notFound('Course');
    if ((await this.access(user, c)) !== 'enrolled') throw forbidden('Only enrolled students earn certificates', 'not_enrolled');
    const existing = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: c.id } } });
    if (existing) return existing;
    const p = await this.progressFor(user.id, c.id);
    if (p.total === 0 || p.completed < p.total) throw conflict(`Complete every lecture first (${p.completed}/${p.total})`, 'not_complete');
    const cert = await this.prisma.certificate.create({ data: { userId: user.id, courseId: c.id, code: `DEL-${randomToken(9).replace(/[-_]/g, 'X').toUpperCase()}` } });
    await this.audit.log({ actorId: user.id, action: 'certificate.issued', targetType: 'certificate', targetId: cert.id, meta: { courseId: c.id, code: cert.code } });
    return cert;
  }

  async myCertificates(userId: string) {
    const rows = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      select: { code: true, issuedAt: true, course: { select: { slug: true, title: true } } },
    });
    return { items: rows };
  }
}

export async function recalcRating(prisma: PrismaService, courseId: string) {
  const agg = await prisma.review.aggregate({ where: { courseId, status: 'visible' }, _avg: { rating: true }, _count: { _all: true } });
  await prisma.course.update({ where: { id: courseId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
}
