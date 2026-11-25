import { Injectable, Optional } from '@nestjs/common';
import { CoversService } from '../covers/covers.service';
import type { Prisma } from '../generated/prisma/client';
import type { LectureType } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { slugify } from '../common/util';
import { MediaService } from '../media/media.service';
import * as T from './course-tree';
import { OPEN_REVISION, RevisionsService } from './revisions.service';

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
  summary?: string;
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

type Version = 'live' | 'draft';

/**
 * Instructor studio. EVERY query is scoped by the caller's user id (ownership is enforced here, in the service
 * layer, not only in controllers): another instructor's course simply does not exist for you (404).
 *
 * Published courses are never edited in place: every edit goes to the course's draft revision (RevisionsService),
 * which an admin reviews; the live course only changes when the revision is approved. Other statuses (draft,
 * changes requested, rejected, unpublished) are edited directly, as before.
 */
@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly storage: StorageService,
    private readonly revisions: RevisionsService,
    @Optional() private readonly covers?: CoversService,
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
      include: {
        _count: { select: { enrollments: { where: { revokedAt: null } }, sections: true } },
        category: { select: { name: true, slug: true } },
        revisions: { where: { status: { in: OPEN_REVISION } }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, reviewNote: true, submittedAt: true, updatedAt: true } },
      },
    });
    return {
      items: rows.map(({ _count, revisions, ...c }) => ({
        id: c.id,
        slug: c.slug,
        title: c.title,
        status: c.status,
        reviewNote: c.reviewNote,
        priceCents: c.priceCents,
        category: c.category,
        thumbnailUrl: this.media.imageUrl(c.coverKey),
        students: _count.enrollments,
        ratingAvg: c.ratingAvg,
        ratingCount: c.ratingCount,
        updatedAt: c.updatedAt,
        publishedAt: c.publishedAt,
        revision: c.status === 'published' ? (revisions[0] ?? null) : null,
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
      throw badRequest('Choose a category from the list', 'invalid_category', [{ field: 'categoryId', message: 'Choose a category from the list' }]);
    }
    if (input.thumbnailKey && !input.thumbnailKey.startsWith(`images/${userId}/`)) {
      throw badRequest('Upload the thumbnail again', 'invalid_thumbnail', [{ field: 'thumbnailKey', message: 'Upload the thumbnail again' }]);
    }
    if (input.promoVideoAssetId) await this.media.ownedAsset(userId, input.promoVideoAssetId);
  }

  async createCourse(a: Actor, input: CourseInput & { title: string }) {
    await this.validateCourseInput(a.user.id, input);
    const course = await this.prisma.course.create({
      data: { ...input, slug: await this.uniqueSlug(input.title), instructorId: a.user.id, status: 'draft' },
    });
    await this.audit.log({ actorId: a.user.id, action: 'course.created', targetType: 'course', targetId: course.id, ip: a.ip });
    // Every new course gets a standard cover straight away (template picked for its topic; changeable in the studio).
    await this.covers?.ensureCover(course.id);
    return this.courseDetail(a.user.id, course.id);
  }

  /**
   * InstructorCourse. For a published course with draft changes the content is the DRAFT (what the studio edits)
   * unless `version: 'live'` is asked for; `version` and `revision` say which one this is.
   */
  async courseDetail(userId: string, courseId: string, want?: Version) {
    await this.ownCourse(userId, courseId);
    const row = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
    const rev = row.status === 'published' ? await this.revisions.open(courseId) : null;
    const live = await this.revisions.liveTree(courseId);
    const version: Version = rev && want !== 'live' ? 'draft' : 'live';
    const tree = version === 'draft' ? (rev!.snapshot as unknown as T.CourseTree) : live;
    const revision = rev ? await this.revisions.summary(rev, live) : null;
    return this.render(row, tree, version, revision);
  }

  private async render(
    row: Prisma.CourseGetPayload<{ include: { category: { select: { id: true; name: true; slug: true } } } }>,
    tree: T.CourseTree,
    version: Version,
    revision: unknown,
  ) {
    const lectures = T.allLectures(tree).map((x) => x.lecture);
    const assetIds = [...new Set([...lectures.map((l) => l.videoAssetId), tree.course.promoVideoAssetId].filter((x): x is string => !!x))];
    const assets = assetIds.length
      ? await this.prisma.videoAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, status: true, durationSec: true, captionsKey: true, provider: true } })
      : [];
    const byId = new Map(assets.map((x) => [x.id, x]));
    const videoView = (id: string | null) => {
      const v = id ? byId.get(id) : undefined;
      return v ? { id: v.id, status: v.status, durationSec: v.durationSec, hasCaptions: !!v.captionsKey, provider: v.provider } : null;
    };
    const c = tree.course;
    const category = c.categoryId === row.category?.id ? row.category : c.categoryId ? await this.prisma.category.findUnique({ where: { id: c.categoryId }, select: { id: true, name: true, slug: true } }) : null;
    return {
      id: row.id,
      slug: row.slug,
      instructorId: row.instructorId,
      status: row.status,
      reviewNote: row.reviewNote,
      publishedAt: row.publishedAt,
      lastVerifiedAt: row.lastVerifiedAt,
      ratingAvg: row.ratingAvg,
      ratingCount: row.ratingCount,
      studentCount: row.studentCount,
      currency: row.currency,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...c,
      category,
      thumbnailUrl: this.media.imageUrl(row.coverKey),
      coverTemplateId: row.coverTemplateId,
      promoVideo: videoView(c.promoVideoAssetId),
      version,
      revision,
      sections: tree.sections.map((s, si) => ({
        id: s.id,
        courseId: row.id,
        title: s.title,
        position: si,
        lectures: s.lectures.map((l, li) => {
          const video = videoView(l.videoAssetId);
          return {
            id: l.id,
            sectionId: s.id,
            title: l.title,
            position: li,
            type: l.type,
            videoAssetId: l.videoAssetId,
            articleMd: l.articleMd,
            summary: l.summary ?? '',
            durationSec: video?.status === 'ready' ? video.durationSec : l.durationSec,
            isPreview: l.isPreview,
            resources: l.resources.map((r) => ({ id: r.id, title: r.title, sizeBytes: r.sizeBytes, mime: r.mime })),
            video,
            quiz: l.quiz ? { questions: l.quiz } : null,
          };
        }),
      })),
    };
  }

  async updateCourse(a: Actor, courseId: string, input: CourseInput) {
    const c = await this.editableCourse(a.user.id, courseId);
    await this.validateCourseInput(a.user.id, input);
    if (c.status === 'published') {
      await this.revisions.mutate(courseId, (t) => T.updateCourseFields(t, input));
      return this.courseDetail(a.user.id, courseId);
    }
    await this.prisma.course.update({ where: { id: courseId }, data: input });
    if (input.title !== undefined || input.categoryId !== undefined) await this.covers?.ensureCover(courseId);
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

  /** Submit a new/changed course for review; for a published course this submits its draft revision. */
  async submit(a: Actor, courseId: string) {
    const c = await this.ownCourse(a.user.id, courseId);
    if (c.status === 'published') {
      await this.revisions.submit(a, courseId);
      return this.courseDetail(a.user.id, courseId);
    }
    if (!['draft', 'changes_requested', 'unpublished', 'rejected'].includes(c.status)) {
      throw conflict(`A ${c.status.replace('_', ' ')} course cannot be submitted`, 'invalid_status');
    }
    const tree = await this.revisions.liveTree(courseId);
    const ids = [...new Set([...T.allLectures(tree).map((x) => x.lecture.videoAssetId), tree.course.promoVideoAssetId].filter((x): x is string => !!x))];
    const assets = await this.prisma.videoAsset.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
    const status = new Map(assets.map((x) => [x.id, x.status as string]));
    const problems = T.readinessProblems(tree, (id) => status.get(id));
    if (problems.length) throw badRequest(`Before submitting: ${problems.map((p) => p.message.toLowerCase()).join(', ')}`, 'not_ready', problems);
    await this.prisma.course.update({ where: { id: courseId }, data: { status: 'in_review' } });
    await this.audit.log({ actorId: a.user.id, action: 'course.submitted', targetType: 'course', targetId: courseId, ip: a.ip });
    return this.courseDetail(a.user.id, courseId);
  }

  /** Throw away the draft changes of a published course (the live course was never touched). */
  async discardRevision(a: Actor, courseId: string) {
    const c = await this.ownCourse(a.user.id, courseId);
    if (c.status !== 'published') throw notFound('Draft changes');
    await this.revisions.discard(a, courseId);
    return this.courseDetail(a.user.id, courseId);
  }

  // ---------- sections ----------
  async addSection(a: Actor, courseId: string, title: string) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      const s = await this.revisions.mutate(courseId, (t) => {
        const sec = T.addSection(t, title);
        return { id: sec.id, courseId, title: sec.title, position: t.sections.length - 1 };
      });
      return s;
    }
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
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      return this.revisions.mutate(courseId, (t) => {
        const s = T.renameSection(t, sectionId, title);
        return { id: s.id, courseId, title: s.title, position: t.sections.indexOf(s) };
      });
    }
    await this.ownSection(a.user.id, courseId, sectionId);
    return this.prisma.section.update({ where: { id: sectionId }, data: { title } });
  }

  async deleteSection(a: Actor, courseId: string, sectionId: string) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      await this.revisions.mutate(courseId, (t) => T.deleteSection(t, sectionId));
      return { ok: true };
    }
    await this.ownSection(a.user.id, courseId, sectionId);
    await this.prisma.section.delete({ where: { id: sectionId } });
    return { ok: true };
  }

  async reorderSections(a: Actor, courseId: string, ids: string[]) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      await this.revisions.mutate(courseId, (t) => T.reorderSections(t, ids));
      return this.courseDetail(a.user.id, courseId);
    }
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

  private async treeVideo(userId: string, videoAssetId: string | null | undefined) {
    if (videoAssetId === undefined) return undefined;
    if (videoAssetId === null) return { videoAssetId: null, durationSec: 0 };
    const asset = await this.media.ownedAsset(userId, videoAssetId);
    return { videoAssetId: asset.id, durationSec: asset.durationSec };
  }

  private treeLectureView(t: T.CourseTree, lectureId: string) {
    const { section, lecture, index } = T.findLecture(t, lectureId);
    const { resources: _r, quiz: _q, ...l } = lecture;
    return { ...l, sectionId: section.id, position: index };
  }

  async addLecture(a: Actor, courseId: string, sectionId: string, input: LectureInput & { title: string }) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      const video = await this.treeVideo(a.user.id, input.videoAssetId);
      return this.revisions.mutate(courseId, (t) => {
        const l = T.addLecture(t, sectionId, { ...input, video });
        return this.treeLectureView(t, l.id);
      });
    }
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
        summary: input.summary ?? '',
        position: (max._max.position ?? -1) + 1,
        ...(video as object),
      },
    });
  }

  async updateLecture(a: Actor, courseId: string, lectureId: string, input: LectureInput) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      const video = await this.treeVideo(a.user.id, input.videoAssetId);
      return this.revisions.mutate(courseId, (t) => {
        T.updateLecture(t, lectureId, { ...input, video });
        return this.treeLectureView(t, lectureId);
      });
    }
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
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      await this.revisions.mutate(courseId, (t) => T.deleteLecture(t, lectureId));
      return { ok: true };
    }
    await this.ownLecture(a.user.id, courseId, lectureId);
    await this.prisma.lecture.delete({ where: { id: lectureId } });
    return { ok: true };
  }

  async reorderLectures(a: Actor, courseId: string, sectionId: string, ids: string[]) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      await this.revisions.mutate(courseId, (t) => T.reorderLectures(t, sectionId, ids));
      return this.courseDetail(a.user.id, courseId);
    }
    await this.ownSection(a.user.id, courseId, sectionId);
    const existing = await this.prisma.lecture.findMany({ where: { sectionId }, select: { id: true } });
    assertSameSet(existing.map((l) => l.id), ids);
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.lecture.update({ where: { id }, data: { position: i } })));
    return this.courseDetail(a.user.id, courseId);
  }

  async setQuiz(a: Actor, courseId: string, lectureId: string, questions: QuizQuestionInput[]) {
    for (const [i, q] of questions.entries()) {
      if (q.correct >= q.options.length) {
        const message = `Question ${i + 1}: the correct answer must be one of its ${q.options.length} options`;
        throw badRequest(message, 'invalid_quiz', [{ field: `questions.${i}.correct`, message }]);
      }
    }
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      return this.revisions.mutate(courseId, (t) => {
        T.setQuiz(t, lectureId, questions);
        return { lectureId, questions };
      });
    }
    await this.ownLecture(a.user.id, courseId, lectureId);
    return this.prisma.quiz.upsert({
      where: { lectureId },
      create: { lectureId, questions: questions as unknown as Prisma.InputJsonValue },
      update: { questions: questions as unknown as Prisma.InputJsonValue },
    });
  }

  async deleteQuiz(a: Actor, courseId: string, lectureId: string) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      await this.revisions.mutate(courseId, (t) => T.setQuiz(t, lectureId, null));
      return { ok: true };
    }
    await this.ownLecture(a.user.id, courseId, lectureId);
    await this.prisma.quiz.deleteMany({ where: { lectureId } });
    return { ok: true };
  }

  /** Step 2 of a resource upload: the file must already be in storage under the caller's prefix. */
  async addResource(a: Actor, courseId: string, lectureId: string, input: { title: string; storageKey: string }) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (!input.storageKey.startsWith(`resources/${a.user.id}/`) || input.storageKey.includes('..')) throw badRequest('Invalid storage key', 'invalid_key');
    const head = await this.storage.head(input.storageKey);
    if (!head) throw badRequest('Upload the file first', 'upload_missing');
    if (c.status === 'published') {
      const r = await this.revisions.mutate(courseId, (t) => T.addResource(t, lectureId, { title: input.title, storageKey: input.storageKey, sizeBytes: head.size, mime: head.contentType }));
      await this.audit.log({ actorId: a.user.id, action: 'resource.added_to_draft', targetType: 'course', targetId: courseId, ip: a.ip, meta: { resourceId: r.id } });
      return { id: r.id, title: r.title, sizeBytes: r.sizeBytes, mime: r.mime };
    }
    await this.ownLecture(a.user.id, courseId, lectureId);
    const r = await this.prisma.resource.create({ data: { lectureId, title: input.title, storageKey: input.storageKey, sizeBytes: head.size, mime: head.contentType } });
    await this.audit.log({ actorId: a.user.id, action: 'resource.added', targetType: 'resource', targetId: r.id, ip: a.ip });
    return { id: r.id, title: r.title, sizeBytes: r.sizeBytes, mime: r.mime };
  }

  async deleteResource(a: Actor, courseId: string, resourceId: string) {
    const c = await this.editableCourse(a.user.id, courseId);
    if (c.status === 'published') {
      await this.revisions.mutate(courseId, (t) => T.deleteResource(t, resourceId));
      return { ok: true };
    }
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
    const now = new Date();
    // grossCents: what learners paid; feesCents: Stripe's processing fee; commissionCents: the platform's share of the net.
    const totals = { grossCents: 0, feesCents: 0, commissionCents: 0, earningsCents: 0, refundedCents: 0, paidOutCents: 0, pendingPayoutCents: 0, heldCents: 0, sales: 0 };
    const byCourse = new Map<string, { courseId: string; title: string; sales: number; grossCents: number; earningsCents: number }>();
    for (const l of lines) {
      if (l.refundedAt) {
        totals.refundedCents += l.priceCents;
        continue;
      }
      totals.sales++;
      totals.grossCents += l.priceCents;
      totals.feesCents += l.feeCents;
      totals.commissionCents += l.netCents - l.instructorShareCents;
      totals.earningsCents += l.instructorShareCents;
      if (l.transferStatus === 'paid') totals.paidOutCents += l.instructorShareCents;
      if (l.transferStatus === 'pending') totals.pendingPayoutCents += l.instructorShareCents;
      if (l.transferStatus === 'pending' && (!l.transferDueAt || l.transferDueAt > now)) totals.heldCents += l.instructorShareCents;
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
        listPriceCents: l.listPriceCents ?? l.priceCents,
        saleKind: l.saleKind,
        feeCents: l.feeCents,
        netCents: l.netCents,
        commissionBps: l.commissionBps,
        instructorShareCents: l.instructorShareCents,
        payee: l.payee,
        transferStatus: l.transferStatus,
        transferDueAt: l.transferDueAt,
        disputeStatus: l.disputeStatus,
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
