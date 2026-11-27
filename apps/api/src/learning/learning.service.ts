import { Injectable, Optional } from '@nestjs/common';
import { accessState, daysLeft, hasAccess } from '../access/access';
import { mergeRanges, parseRanges, rangeSeconds, reviewerWatch, watchOf } from '../access/consumption';
import { QUIZ_PASS_PERCENT, certificateUrl, linkedInAddUrl } from '../catalogue/certificate-share';
import { JobsService } from '../common/jobs';
import { env } from '../config/env';
import { sizesOf } from '../protection/data-saver';
import { ProtectionService } from '../protection/protection.service';
import { AuditService } from '../common/audit.service';
import { AuthUser, isAdmin } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { randomToken } from '../common/util';
import { MediaService } from '../media/media.service';
import { learningAiEnabled } from '../study/ai-client';
import { RefundsService } from '../commerce/refunds.service';
import { refundConsumption } from '../access/consumption';

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
    @Optional() private readonly refunds?: RefundsService,
    @Optional() private readonly jobs?: JobsService,
  ) {}

  /** Who may open the paid content of a course: an active enrolment, the course owner, or an admin. */
  async access(user: AuthUser, course: { id: string; instructorId: string }): Promise<Access | null> {
    if (course.instructorId === user.id) return 'owner';
    if (isAdmin(user)) return 'admin';
    const e = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId: course.id } } });
    // Enforced here for every lecture, video, resource, quiz and progress call: an expired year means no access.
    return hasAccess(e) ? 'enrolled' : null;
  }

  async accessBySlug(user: AuthUser, slug: string): Promise<Access | null> {
    const c = await this.prisma.course.findUnique({ where: { slug }, select: { id: true, instructorId: true } });
    return c ? this.access(user, c) : null;
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

  /** Study material downloads are recorded for the student's history and refund reviews (never for the refund measure). */
  private async recordDownload(userId: string, courseId: string, f: { resourceId?: string; courseResourceId?: string; title: string }) {
    await this.prisma.resourceDownload.create({ data: { userId, courseId, resourceId: f.resourceId ?? null, courseResourceId: f.courseResourceId ?? null, title: f.title.slice(0, 300) } }).catch(() => undefined);
  }

  /**
   * One course's report for the student (owner 2026-11-26): purchase and enrolment dates, completion, video watched
   * (unique seconds; free previews counted in "all video", left out of the refund measure), last access, downloads and
   * the refund position. Only the student's own data; needs an enrolment (also an expired one).
   */
  async courseReport(userId: string, slug: string) {
    const course = await this.prisma.course.findUnique({ where: { slug }, select: { id: true, slug: true, title: true, coverKey: true, taughtBy: true, instructor: { select: { name: true } } } });
    if (!course) throw notFound('Course');
    const e = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: course.id } } });
    if (!e || e.revokedAt) throw notFound('Enrolment');
    const lectures = await this.prisma.lecture.findMany({
      where: { section: { courseId: course.id } },
      select: { id: true, type: true, isPreview: true, durationSec: true, progress: { where: { userId }, select: { watchedSec: true, completed: true, updatedAt: true } } },
    });
    const videos = lectures.filter((l) => l.type === 'video');
    const totalVideoSec = videos.reduce((a, l) => a + l.durationSec, 0);
    const uniqueWatchedSec = videos.reduce((a, l) => a + Math.min(l.durationSec, l.progress[0]?.watchedSec ?? 0), 0);
    const completed = lectures.filter((l) => l.progress[0]?.completed).length;
    const lastAccessAt = lectures.reduce<Date | null>((m, l) => { const t = l.progress[0]?.updatedAt; return t && (!m || t > m) ? t : m; }, null);
    const line = e.orderLineId ? await this.prisma.orderLine.findUnique({ where: { id: e.orderLineId }, select: { paidVideoSecAtPurchase: true, order: { select: { id: true, paidAt: true } } } }) : null;
    const paid = await refundConsumption(this.prisma, userId, course.id, line?.paidVideoSecAtPurchase ?? null);
    const downloads = await this.prisma.resourceDownload.findMany({ where: { userId, courseId: course.id }, orderBy: { at: 'desc' }, take: 100, select: { title: true, at: true } });
    const refund = (await this.refunds?.courseStatus(userId, [course.id]))?.get(course.id);
    return {
      course: { id: course.id, slug: course.slug, title: course.title, thumbnailUrl: this.media.imageUrl(course.coverKey), instructor: { name: course.taughtBy || course.instructor.name } },
      purchasedAt: line?.order.paidAt ?? null,
      orderId: line?.order.id ?? null,
      enrolledAt: e.createdAt,
      accessUntil: e.accessExpiresAt,
      lessons: { total: lectures.length, completed, percent: lectures.length ? Math.round((completed / lectures.length) * 100) : 0 },
      video: {
        totalSec: totalVideoSec,
        uniqueWatchedSec,
        percent: totalVideoSec ? Math.round((uniqueWatchedSec / totalVideoSec) * 1000) / 10 : 0,
        paidSec: paid.totalSec,
        paidWatchedSec: paid.watchedSec,
        paidPercent: paid.percent,
      },
      lastAccessAt,
      downloads: { count: downloads.length, items: downloads },
      refund: refundSummary(refund),
    };
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
    const watch = await reviewerWatch(this.prisma, reviews.map((r) => ({ userId, courseId: r.courseId })));
    return {
      items: reviews.map((r) => ({ id: r.id, rating: r.rating, body: r.body, status: r.status, instructorReply: r.instructorReply, createdAt: r.createdAt, updatedAt: r.updatedAt, ...watchOf(watch, userId, r.courseId), course: { ...card(r.course), ratingAvg: r.course.ratingAvg, ratingCount: r.course.ratingCount } })),
      toReview: enrolled.filter((e) => !reviewed.has(e.course.id) && e.course.instructorId !== userId).map((e) => card(e.course)),
    };
  }

  async myLearning(userId: string) {
    const enrolments = await this.prisma.enrollment.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { course: { select: { id: true, slug: true, title: true, coverKey: true, taughtBy: true, instructor: { select: { name: true } } } } },
    });
    const items = [];
    // The refund position per course, without asking for a refund (owner 2026-11-26).
    const refund = (await this.refunds?.courseStatus(userId, enrolments.map((e) => e.courseId))) ?? new Map();
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
        course: { id: e.course.id, slug: e.course.slug, title: e.course.title, thumbnailUrl: this.media.imageUrl(e.course.coverKey), instructor: { name: e.course.taughtBy || e.course.instructor.name } },
        enrolledAt: e.createdAt,
        // One-year access (owner 2026-11-25): when it was bought, when it ends, days left; expired courses keep progress.
        access: { state, purchasedAt: line?.order.paidAt ?? e.createdAt, expiresAt: e.accessExpiresAt, daysLeft: daysLeft(e.accessExpiresAt), canRenew: state === 'expiring' || state === 'expired' },
        progress,
        lastLecture: last ? { id: last.lecture.id, title: last.lecture.title, positionSec: last.positionSec, at: last.updatedAt } : null,
        certificateCode: cert?.code ?? null,
        refund: refundSummary(refund.get(e.courseId)),
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
                videoAsset: { select: { status: true, captionsKey: true, hlsStatus: true, hlsSizes: true } },
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
      instructor: { ...c.instructor, taughtBy: c.taughtBy ?? null },
      thumbnailUrl: this.media.imageUrl(c.coverKey),
      access,
      progress: { total: lectureIds.length, completed: done, percent: lectureIds.length ? Math.round((done / lectureIds.length) * 100) : 0 },
      lastLectureId: last?.lectureId ?? null,
      certificate: cert,
      myReview: review,
      // Reviews inside the learning view (owner 2026-11-25): the same numbers as the public course page.
      rating: { average: Math.round(c.ratingAvg * 10) / 10, count: c.ratingCount },
      accessInfo: await this.accessInfo(user.id, c.id),
      packageFiles: await this.prisma.courseResource.findMany({ where: { courseId: c.id }, orderBy: { position: 'asc' }, select: { id: true, title: true, sizeBytes: true, mime: true } }),
      canReview: access === 'enrolled',
      // Search inside videos needs captions only; the assistant and study notes exist only with an AI key (docs/AI_LEARNING.md).
      study: { search: c.sections.some((s) => s.lectures.some((l) => !!l.videoAsset?.captionsKey)), assistant: learningAiEnabled(), notes: learningAiEnabled() },
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
          // data saver: about how many bytes the lesson takes at each setting (packaged videos only)
          sizes: l.videoAsset?.hlsStatus === 'ready' ? sizesOf(l.videoAsset.hlsSizes) ?? null : null,
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
    const certificateCode = row.completed ? await this.issueIfComplete(user, lecture.section.courseId, course) : null;
    return { lectureId, positionSec: row.positionSec, completed: row.completed, courseProgress: course, certificateCode };
  }

  async resources(user: AuthUser, lectureId: string) {
    await this.requireLectureAccess(user, lectureId);
    const items = await this.prisma.resource.findMany({ where: { lectureId }, select: { id: true, title: true, sizeBytes: true, mime: true }, orderBy: { createdAt: 'asc' } });
    return { items };
  }

  async download(user: AuthUser, resourceId: string) {
    const r = await this.prisma.resource.findUnique({ where: { id: resourceId } });
    if (!r) throw notFound('Resource');
    const { lecture } = await this.requireLectureAccess(user, r.lectureId);
    await this.recordDownload(user.id, lecture.section.courseId, { resourceId: r.id, title: r.title });
    const ttl = 300;
    const filename = r.storageKey.split('/').pop() ?? 'download';
    return { url: await this.storage.presignGet(r.storageKey, ttl, { downloadName: filename }), expiresAt: new Date(Date.now() + ttl * 1000).toISOString(), filename };
  }

  /** Complete course package file: same rule as lesson files (owner, admin, or an active enrolment). */
  async downloadPackageFile(user: AuthUser, id: string) {
    const r = await this.prisma.courseResource.findUnique({ where: { id }, include: { course: { select: { id: true, instructorId: true } } } });
    if (!r) throw notFound('File');
    if (!(await this.access(user, r.course))) throw forbidden('Enrol in this course to download its files', 'not_enrolled');
    await this.recordDownload(user.id, r.course.id, { courseResourceId: r.id, title: r.title });
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
    const passed = score >= QUIZ_PASS_PERCENT;
    if (passed) {
      await this.prisma.lectureProgress.upsert({
        where: { userId_lectureId: { userId: user.id, lectureId } },
        create: { userId: user.id, lectureId, completed: true },
        update: { completed: true },
      });
      const lecture = await this.prisma.lecture.findUnique({ where: { id: lectureId }, select: { section: { select: { courseId: true } } } });
      if (lecture) {
        const certificateCode = await this.issueIfComplete(user, lecture.section.courseId, await this.progressFor(user.id, lecture.section.courseId));
        return { score, passed, results, certificateCode };
      }
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
    // An earned certificate is kept for good: new lessons or the end of the access period never take it away.
    const existing = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId: c.id } } });
    if (existing) return existing;
    if ((await this.access(user, c)) !== 'enrolled') throw forbidden('Only enrolled students earn certificates', 'not_enrolled');
    const p = await this.progressFor(user.id, c.id);
    if (p.total === 0 || p.completed < p.total) throw conflict(`Complete every lecture first (${p.completed}/${p.total})`, 'not_complete');
    return this.issue(user.id, c.id);
  }

  private async issue(userId: string, courseId: string) {
    try {
      const cert = await this.prisma.certificate.create({ data: { userId, courseId, code: `DEL-${randomToken(9).replace(/[-_]/g, 'X').toUpperCase()}` } });
      await this.audit.log({ actorId: userId, action: 'certificate.issued', targetType: 'certificate', targetId: cert.id, meta: { courseId, code: cert.code } });
      await this.sendCompletionEmail(userId, courseId, cert).catch(() => undefined);
      return cert;
    } catch (e) {
      // Two requests finishing the course at once: the unique (user, course) keeps one certificate.
      const again = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
      if (again) return again;
      throw e;
    }
  }

  /**
   * The completion moment (owner 2026-11-28): one email when the certificate is issued, with the certificate link,
   * Add to LinkedIn, and a rating request when the learner hasn't reviewed the course yet. Once per certificate.
   */
  private async sendCompletionEmail(userId: string, courseId: string, cert: { id: string; code: string; issuedAt: Date }) {
    if (!this.jobs) return;
    const [user, course, review] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, status: true } }),
      this.prisma.course.findUnique({ where: { id: courseId }, select: { title: true, slug: true } }),
      this.prisma.review.findUnique({ where: { userId_courseId: { userId, courseId } }, select: { id: true } }),
    ]);
    if (!user || user.status !== 'active' || !course) return;
    const certUrl = certificateUrl(env().WEB_URL, cert.code);
    await this.jobs.sendEmail({
      to: user.email,
      template: 'course-completed',
      dedupeKey: `completed:${cert.id}`,
      data: { name: user.name, course: course.title, slug: course.slug, code: cert.code, certUrl, linkedInUrl: linkedInAddUrl({ courseTitle: course.title, issuedAt: cert.issuedAt, code: cert.code, certUrl }), reviewed: !!review },
    });
  }

  /**
   * Automatic issuance (owner 2026-11-27): the moment an enrolled learner has completed every lesson, the certificate is
   * created (code, date, verification record); nobody has to request or sign it. Returns its code, or null.
   */
  private async issueIfComplete(user: AuthUser, courseId: string, progress: { total: number; completed: number }) {
    if (progress.total === 0 || progress.completed < progress.total) return null;
    const existing = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId } }, select: { code: true } });
    if (existing) return existing.code;
    const c = await this.prisma.course.findUnique({ where: { id: courseId }, select: { id: true, instructorId: true } });
    if (!c || (await this.access(user, c)) !== 'enrolled') return null;
    return (await this.issue(user.id, courseId)).code;
  }

  async myCertificates(userId: string) {
    const rows = await this.prisma.certificate.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      select: { code: true, issuedAt: true, revokedAt: true, course: { select: { slug: true, title: true } } },
    });
    return { items: rows.map(({ revokedAt, ...r }) => ({ ...r, status: revokedAt ? 'revoked' : 'valid' })) };
  }
}

export async function recalcRating(prisma: PrismaService, courseId: string) {
  const agg = await prisma.review.aggregate({ where: { courseId, status: 'visible' }, _avg: { rating: true }, _count: { _all: true } });
  await prisma.course.update({ where: { id: courseId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
}

type CourseRefund = Awaited<ReturnType<RefundsService['courseStatus']>> extends Map<string, infer V> ? V : never;

/** The refund block the Student Studio shows (null when the course wasn't bought, e.g. free or granted). */
function refundSummary(r: CourseRefund | undefined) {
  if (!r) return null;
  return {
    state: r.state, orderId: r.orderId, purchasedAt: r.purchasedAt, deadline: r.deadline, daysLeft: r.daysLeft, watchedPercent: r.watchedPercent,
    maxWatchedPercent: r.maxWatchedPercent, windowDays: r.windowDays, reasons: r.reasons, message: r.message, policyVersion: r.policyVersion,
  };
}
