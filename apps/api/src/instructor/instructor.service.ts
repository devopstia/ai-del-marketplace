import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { LectureType } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { slugify } from '../common/util';
import { MediaService } from '../media/media.service';

export interface CourseInput {
  title?: string;
  subtitle?: string;
  description?: string;
  language?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  objectives?: string[];
  requirements?: string[];
  priceCents?: number;
  categoryId?: string | null;
  thumbnailKey?: string | null;
  promoVideoAssetId?: string | null;
}

export interface LectureInput {
  title?: string;
  type?: LectureType;
  isPreview?: boolean;
  articleMd?: string | null;
  videoAssetId?: string | null;
  sectionId?: string;
}

export interface QuizQuestionInput {
  q: string;
  options: string[];
  correct: number;
  why: string;
}

const EDITABLE_LOCKED = new Set(['in_review']);

/**
 * Instructor studio. EVERY query is scoped by the caller's user id (ownership is enforced here, in the service
 * layer, not only in controllers): another instructor's course simply does not exist for you (404).
 */
@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly storage: StorageService,
  ) {}

  // ---------- profile ----------
  async apply(a: Actor, input: { headline: string; bio: string; website?: string | null }) {
    const existing = await this.prisma.instructorProfile.findUnique({ where: { userId: a.user.id } });
    if (existing?.status === 'approved') throw conflict('You are already an instructor', 'already_instructor');
    if (existing?.status === 'pending') throw conflict('Your application is already under review', 'already_applied');
    const profile = await this.prisma.instructorProfile.upsert({
      where: { userId: a.user.id },
      create: { userId: a.user.id, headline: input.headline, bio: input.bio, website: input.website ?? null, status: 'pending' },
      update: { headline: input.headline, bio: input.bio, website: input.website ?? null, status: 'pending', reviewNote: null },
    });
    await this.audit.log({ actorId: a.user.id, action: 'instructor.applied', targetType: 'instructor', targetId: a.user.id, ip: a.ip });
    return profile;
  }

  async profile(userId: string) {
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId } });
    if (!p) throw notFound('Instructor profile');
    const { stripeAccountId, ...rest } = p;
    return { ...rest, stripeConnected: !!stripeAccountId };
  }

  async updateProfile(userId: string, input: { headline?: string; bio?: string; website?: string | null }) {
    const r = await this.prisma.instructorProfile.updateMany({ where: { userId }, data: input });
    if (!r.count) throw notFound('Instructor profile');
    return this.profile(userId);
  }

  // ---------- courses ----------
  /** The single ownership gate: course must belong to `userId`. */
  async ownCourse(userId: string, courseId: string) {
    const c = await this.prisma.course.findFirst({ where: { id: courseId, instructorId: userId } });
    if (!c) throw notFound('Course');
    return c;
  }

  private async editableCourse(userId: string, courseId: string) {
    const c = await this.ownCourse(userId, courseId);
    if (EDITABLE_LOCKED.has(c.status)) throw conflict('The course is in review and cannot be edited right now', 'course_locked');
    return c;
  }

  async listCourses(userId: string) {
    const rows = await this.prisma.course.findMany({
      where: { instructorId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { enrollments: { where: { revokedAt: null } }, sections: true } }, category: { select: { name: true, slug: true } } },
    });
    return {
      items: rows.map(({ _count, ...c }) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        status: c.status,
        reviewNote: c.reviewNote,
        priceCents: c.priceCents,
        category: c.category,
        thumbnailUrl: this.media.imageUrl(c.thumbnailKey),
        students: _count.enrollments,
        ratingAvg: c.ratingAvg,
        ratingCount: c.ratingCount,
        updatedAt: c.updatedAt,
        publishedAt: c.publishedAt,
      })),
    };
  }

  private async uniqueSlug(title: string) {
    const base = slugify(title);
    for (let i = 0; i < 50; i++) {
      const slug = i === 0 ? base : `${base}-${i + 1}`;
      if (!(await this.prisma.course.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    }
    return `${base}-${Date.now().toString(36)}`;
  }

  private async validateCourseInput(userId: string, input: CourseInput) {
    if (input.categoryId && !(await this.prisma.category.findUnique({ where: { id: input.categoryId } }))) {
      throw badRequest('Unknown category', 'invalid_category');
    }
    if (input.thumbnailKey && !input.thumbnailKey.startsWith(`images/${userId}/`)) throw badRequest('Invalid thumbnail', 'invalid_thumbnail');
    if (input.promoVideoAssetId) await this.media.ownedAsset(userId, input.promoVideoAssetId);
  }

  async createCourse(a: Actor, input: CourseInput & { title: string }) {
    await this.validateCourseInput(a.user.id, input);
    const course = await this.prisma.course.create({
      data: { ...input, slug: await this.uniqueSlug(input.title), instructorId: a.user.id, status: 'draft' },
    });
    await this.audit.log({ actorId: a.user.id, action: 'course.created', targetType: 'course', targetId: course.id, ip: a.ip });
    return this.courseDetail(a.user.id, course.id);
  }

  async courseDetail(userId: string, courseId: string) {
    await this.ownCourse(userId, courseId);
    const c = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        sections: {
          orderBy: { position: 'asc' },
          include: {
            lectures: {
              orderBy: { position: 'asc' },
              include: {
                videoAsset: { select: { id: true, status: true, durationSec: true, captionsKey: true, provider: true } },
                resources: { select: { id: true, title: true, sizeBytes: true, mime: true } },
                quiz: { select: { questions: true } },
              },
            },
          },
        },
      },
    });
    const { thumbnailKey, sections, ...rest } = c;
    return {
      ...rest,
      thumbnailKey,
      thumbnailUrl: this.media.imageUrl(thumbnailKey),
      sections: sections.map((s) => ({
        id: s.id,
        title: s.title,
        position: s.position,
        lectures: s.lectures.map(({ videoAsset, quiz, ...l }) => ({
          ...l,
          video: videoAsset ? { id: videoAsset.id, status: videoAsset.status, durationSec: videoAsset.durationSec, hasCaptions: !!videoAsset.captionsKey, provider: videoAsset.provider } : null,
          quiz: quiz ? { questions: quiz.questions } : null,
        })),
      })),
    };
  }

  async updateCourse(a: Actor, courseId: string, input: CourseInput) {
    await this.editableCourse(a.user.id, courseId);
    await this.validateCourseInput(a.user.id, input);
    await this.prisma.course.update({ where: { id: courseId }, data: input });
    if (input.priceCents !== undefined) {
      await this.audit.log({ actorId: a.user.id, action: 'course.price_changed', targetType: 'course', targetId: courseId, ip: a.ip, meta: { priceCents: input.priceCents } });
    }
    return this.courseDetail(a.user.id, courseId);
  }

  async deleteCourse(a: Actor, courseId: string) {
    const c = await this.editableCourse(a.user.id, courseId);
    const sold = await this.prisma.orderLine.count({ where: { courseId } });
    const enrolled = await this.prisma.enrollment.count({ where: { courseId } });
    if (sold || enrolled || c.status === 'published') {
      throw conflict('Courses with students or sales cannot be deleted; ask an admin to unpublish instead', 'course_has_students');
    }
    await this.prisma.$transaction([this.prisma.cartItem.deleteMany({ where: { courseId } }), this.prisma.course.delete({ where: { id: courseId } })]);
    await this.audit.log({ actorId: a.user.id, action: 'course.deleted', targetType: 'course', targetId: courseId, ip: a.ip, meta: { title: c.title } });
    return { ok: true };
  }

  async submit(a: Actor, courseId: string) {
    const c = await this.ownCourse(a.user.id, courseId);
    if (!['draft', 'changes_requested', 'unpublished', 'rejected'].includes(c.status)) {
      throw conflict(`A ${c.status.replace('_', ' ')} course cannot be submitted`, 'invalid_status');
    }
    const lectures = await this.prisma.lecture.findMany({ where: { section: { courseId } }, include: { videoAsset: { select: { status: true } } } });
    const problems: string[] = [];
    if (!c.description.trim()) problems.push('add a description');
    if (!c.categoryId) problems.push('choose a category');
    if (!lectures.length) problems.push('add at least one lecture');
    if (lectures.some((l) => l.type === 'video' && l.videoAsset?.status !== 'ready')) problems.push('every video lecture needs a processed video');
    if (problems.length) throw badRequest(`Before submitting: ${problems.join(', ')}`, 'not_ready', problems);
    await this.prisma.course.update({ where: { id: courseId }, data: { status: 'in_review' } });
    await this.audit.log({ actorId: a.user.id, action: 'course.submitted', targetType: 'course', targetId: courseId, ip: a.ip });
    return this.courseDetail(a.user.id, courseId);
  }

  // ---------- sections ----------
  async addSection(a: Actor, courseId: string, title: string) {
    await this.editableCourse(a.user.id, courseId);
    const max = await this.prisma.section.aggregate({ where: { courseId }, _max: { position: true } });
    return this.prisma.section.create({ data: { courseId, title, position: (max._max.position ?? -1) + 1 } });
  }

  private async ownSection(userId: string, courseId: string, sectionId: string) {
    await this.editableCourse(userId, courseId);
    const s = await this.prisma.section.findFirst({ where: { id: sectionId, courseId } });
    if (!s) throw notFound('Section');
    return s;
  }

  async updateSection(a: Actor, courseId: string, sectionId: string, title: string) {
    await this.ownSection(a.user.id, courseId, sectionId);
    return this.prisma.section.update({ where: { id: sectionId }, data: { title } });
  }

  async deleteSection(a: Actor, courseId: string, sectionId: string) {
    await this.ownSection(a.user.id, courseId, sectionId);
    await this.prisma.section.delete({ where: { id: sectionId } });
    return { ok: true };
  }

  async reorderSections(a: Actor, courseId: string, ids: string[]) {
    await this.editableCourse(a.user.id, courseId);
    const existing = await this.prisma.section.findMany({ where: { courseId }, select: { id: true } });
    assertSameSet(existing.map((s) => s.id), ids);
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.section.update({ where: { id }, data: { position: i } })));
    return this.courseDetail(a.user.id, courseId);
  }

  // ---------- lectures ----------
  private async ownLecture(userId: string, courseId: string, lectureId: string) {
    await this.editableCourse(userId, courseId);
    const l = await this.prisma.lecture.findFirst({ where: { id: lectureId, section: { courseId } } });
    if (!l) throw notFound('Lecture');
    return l;
  }

  private async videoFields(userId: string, videoAssetId: string | null | undefined): Promise<Prisma.LectureUncheckedUpdateInput> {
    if (videoAssetId === undefined) return {};
    if (videoAssetId === null) return { videoAssetId: null, durationSec: 0 };
    const asset = await this.media.ownedAsset(userId, videoAssetId);
    return { videoAssetId: asset.id, durationSec: asset.durationSec };
  }

  async addLecture(a: Actor, courseId: string, sectionId: string, input: LectureInput & { title: string }) {
    await this.ownSection(a.user.id, courseId, sectionId);
    const max = await this.prisma.lecture.aggregate({ where: { sectionId }, _max: { position: true } });
    const video = await this.videoFields(a.user.id, input.videoAssetId);
    return this.prisma.lecture.create({
      data: {
        sectionId,
        title: input.title,
        type: input.type ?? 'video',
        isPreview: input.isPreview ?? false,
        articleMd: input.articleMd ?? null,
        position: (max._max.position ?? -1) + 1,
        ...(video as object),
      },
    });
  }

  async updateLecture(a: Actor, courseId: string, lectureId: string, input: LectureInput) {
    await this.ownLecture(a.user.id, courseId, lectureId);
    const { videoAssetId, sectionId, ...rest } = input;
    const data: Prisma.LectureUncheckedUpdateInput = { ...rest, ...(await this.videoFields(a.user.id, videoAssetId)) };
    if (sectionId) {
      await this.ownSection(a.user.id, courseId, sectionId);
      const max = await this.prisma.lecture.aggregate({ where: { sectionId }, _max: { position: true } });
      data.sectionId = sectionId;
      data.position = (max._max.position ?? -1) + 1;
    }
    return this.prisma.lecture.update({ where: { id: lectureId }, data });
  }

  async deleteLecture(a: Actor, courseId: string, lectureId: string) {
    await this.ownLecture(a.user.id, courseId, lectureId);
    await this.prisma.lecture.delete({ where: { id: lectureId } });
    return { ok: true };
  }

  async reorderLectures(a: Actor, courseId: string, sectionId: string, ids: string[]) {
    await this.ownSection(a.user.id, courseId, sectionId);
    const existing = await this.prisma.lecture.findMany({ where: { sectionId }, select: { id: true } });
    assertSameSet(existing.map((l) => l.id), ids);
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.lecture.update({ where: { id }, data: { position: i } })));
    return this.courseDetail(a.user.id, courseId);
  }

  async setQuiz(a: Actor, courseId: string, lectureId: string, questions: QuizQuestionInput[]) {
    await this.ownLecture(a.user.id, courseId, lectureId);
    for (const [i, q] of questions.entries()) {
      if (q.correct >= q.options.length) throw badRequest(`Question ${i + 1}: correct answer index is out of range`, 'invalid_quiz');
    }
    return this.prisma.quiz.upsert({
      where: { lectureId },
      create: { lectureId, questions: questions as unknown as Prisma.InputJsonValue },
      update: { questions: questions as unknown as Prisma.InputJsonValue },
    });
  }

  async deleteQuiz(a: Actor, courseId: string, lectureId: string) {
    await this.ownLecture(a.user.id, courseId, lectureId);
    await this.prisma.quiz.deleteMany({ where: { lectureId } });
    return { ok: true };
  }

  /** Step 2 of a resource upload: the file must already be in storage under the caller's prefix. */
  async addResource(a: Actor, courseId: string, lectureId: string, input: { title: string; storageKey: string }) {
    await this.ownLecture(a.user.id, courseId, lectureId);
    if (!input.storageKey.startsWith(`resources/${a.user.id}/`) || input.storageKey.includes('..')) throw badRequest('Invalid storage key', 'invalid_key');
    const head = await this.storage.head(input.storageKey);
    if (!head) throw badRequest('Upload the file first', 'upload_missing');
    const r = await this.prisma.resource.create({ data: { lectureId, title: input.title, storageKey: input.storageKey, sizeBytes: head.size, mime: head.contentType } });
    await this.audit.log({ actorId: a.user.id, action: 'resource.added', targetType: 'resource', targetId: r.id, ip: a.ip });
    return { id: r.id, title: r.title, sizeBytes: r.sizeBytes, mime: r.mime };
  }

  async deleteResource(a: Actor, courseId: string, resourceId: string) {
    await this.editableCourse(a.user.id, courseId);
    const r = await this.prisma.resource.findFirst({ where: { id: resourceId, lecture: { section: { courseId } } } });
    if (!r) throw notFound('Resource');
    await this.prisma.resource.delete({ where: { id: r.id } });
    return { ok: true };
  }

  // ---------- sales, students, reviews (own data only) ----------
  async sales(userId: string, from?: Date, to?: Date) {
    const lines = await this.prisma.orderLine.findMany({
      where: {
        instructorId: userId,
        order: { status: { in: ['paid', 'refunded', 'partially_refunded'] }, paidAt: { gte: from, lte: to } },
      },
      orderBy: { order: { paidAt: 'desc' } },
      include: { order: { select: { id: true, paidAt: true, currency: true } }, course: { select: { id: true, title: true, slug: true } } },
      take: 1000,
    });
    const totals = { grossCents: 0, commissionCents: 0, earningsCents: 0, refundedCents: 0, paidOutCents: 0, pendingPayoutCents: 0, sales: 0 };
    const byCourse = new Map<string, { courseId: string; title: string; sales: number; grossCents: number; earningsCents: number }>();
    for (const l of lines) {
      if (l.refundedAt) {
        totals.refundedCents += l.priceCents;
        continue;
      }
      totals.sales++;
      totals.grossCents += l.priceCents;
      totals.commissionCents += l.priceCents - l.instructorShareCents;
      totals.earningsCents += l.instructorShareCents;
      if (l.transferStatus === 'paid') totals.paidOutCents += l.instructorShareCents;
      if (l.transferStatus === 'pending') totals.pendingPayoutCents += l.instructorShareCents;
      const c = byCourse.get(l.courseId) ?? { courseId: l.courseId, title: l.course.title, sales: 0, grossCents: 0, earningsCents: 0 };
      c.sales++;
      c.grossCents += l.priceCents;
      c.earningsCents += l.instructorShareCents;
      byCourse.set(l.courseId, c);
    }
    return {
      totals,
      byCourse: [...byCourse.values()],
      items: lines.map((l) => ({
        orderLineId: l.id,
        orderId: l.order.id,
        paidAt: l.order.paidAt,
        course: l.course,
        priceCents: l.priceCents,
        commissionBps: l.commissionBps,
        instructorShareCents: l.instructorShareCents,
        transferStatus: l.transferStatus,
        refundedAt: l.refundedAt,
      })),
    };
  }

  async students(userId: string, courseId?: string) {
    if (courseId) await this.ownCourse(userId, courseId);
    const rows = await this.prisma.enrollment.findMany({
      where: { course: { instructorId: userId }, courseId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { id: true, name: true } }, course: { select: { id: true, title: true } } },
    });
    const lectureCounts = new Map<string, string[]>();
    const items = [];
    for (const r of rows) {
      if (!lectureCounts.has(r.courseId)) {
        lectureCounts.set(r.courseId, (await this.prisma.lecture.findMany({ where: { section: { courseId: r.courseId } }, select: { id: true } })).map((l) => l.id));
      }
      const ids = lectureCounts.get(r.courseId)!;
      const done = await this.prisma.lectureProgress.count({ where: { userId: r.userId, completed: true, lectureId: { in: ids } } });
      items.push({ student: r.user, course: r.course, enrolledAt: r.createdAt, source: r.source, progressPercent: ids.length ? Math.round((done / ids.length) * 100) : 0 });
    }
    return { items };
  }

  async reviews(userId: string) {
    const rows = await this.prisma.review.findMany({
      where: { course: { instructorId: userId } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { user: { select: { name: true } }, course: { select: { id: true, title: true, slug: true } } },
    });
    return { items: rows.map((r) => ({ id: r.id, rating: r.rating, body: r.body, status: r.status, instructorReply: r.instructorReply, createdAt: r.createdAt, author: r.user, course: r.course })) };
  }

  async reply(a: Actor, reviewId: string, reply: string) {
    const r = await this.prisma.review.findFirst({ where: { id: reviewId, course: { instructorId: a.user.id } } });
    if (!r) throw notFound('Review');
    return this.prisma.review.update({ where: { id: r.id }, data: { instructorReply: reply || null } });
  }
}

function assertSameSet(existing: string[], given: string[]) {
  const a = new Set(existing);
  if (given.length !== existing.length || new Set(given).size !== given.length || !given.every((g) => a.has(g))) {
    throw badRequest('ids must list every item exactly once', 'invalid_order');
  }
}
