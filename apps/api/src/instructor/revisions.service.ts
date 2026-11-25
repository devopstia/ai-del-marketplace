import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { RevisionStatus } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService, Tx } from '../common/prisma.service';
import { allLectures, Change, CourseRowWithTree, CourseTree, diffTrees, readinessProblems, treeFromRow } from './course-tree';

export const OPEN_REVISION: RevisionStatus[] = ['draft', 'in_review', 'changes_requested'];

/** Prisma include that loads the whole editable tree of a course, in order. */
export const treeInclude = {
  sections: {
    orderBy: { position: 'asc' },
    include: {
      lectures: {
        orderBy: { position: 'asc' },
        include: {
          resources: { orderBy: { createdAt: 'asc' }, select: { id: true, title: true, storageKey: true, sizeBytes: true, mime: true } },
          quiz: { select: { questions: true } },
        },
      },
    },
  },
} satisfies Prisma.CourseInclude;

export async function loadLiveTree(db: Tx, courseId: string): Promise<CourseTree> {
  const c = await db.course.findUnique({ where: { id: courseId }, include: treeInclude });
  if (!c) throw notFound('Course');
  return treeFromRow(c as unknown as CourseRowWithTree);
}

/**
 * Applies a course tree to the live tables: course fields, sections, lectures, resources and quizzes.
 * Items keep their ids (progress, quiz attempts and enrolments survive); items missing from the tree are deleted.
 * Run it inside a transaction: either everything changes or nothing does.
 */
export async function applyTree(tx: Tx, courseId: string, tree: CourseTree, opts: { ownerId: string; requireReady?: boolean }) {
  const lectures = allLectures(tree).map((x) => x.lecture);
  const sectionIds = tree.sections.map((s) => s.id);
  const lectureIds = lectures.map((l) => l.id);
  const resources = lectures.flatMap((l) => l.resources);

  // Ids in the tree are either this course's own rows or new ones; never another course's.
  const [foreignSections, foreignLectures, foreignResources] = await Promise.all([
    tx.section.count({ where: { id: { in: sectionIds }, courseId: { not: courseId } } }),
    tx.lecture.count({ where: { id: { in: lectureIds }, section: { courseId: { not: courseId } } } }),
    tx.resource.count({ where: { id: { in: resources.map((r) => r.id) }, lecture: { section: { courseId: { not: courseId } } } } }),
  ]);
  if (foreignSections || foreignLectures || foreignResources) throw badRequest('The revision refers to content of another course', 'invalid_revision');

  const assetIds = [...new Set([...lectures.map((l) => l.videoAssetId), tree.course.promoVideoAssetId].filter((x): x is string => !!x))];
  const assets = await tx.videoAsset.findMany({ where: { id: { in: assetIds }, ownerId: opts.ownerId }, select: { id: true, status: true, durationSec: true } });
  const byId = new Map(assets.map((a) => [a.id, a]));
  for (const id of assetIds) {
    const a = byId.get(id);
    if (!a) throw badRequest('A video in this revision does not exist', 'invalid_revision');
    if (opts.requireReady && a.status !== 'ready') throw conflict('A video in this revision is still processing', 'video_not_ready');
  }
  if (tree.course.thumbnailKey && !tree.course.thumbnailKey.startsWith(`images/${opts.ownerId}/`)) throw badRequest('Invalid thumbnail', 'invalid_revision');
  if (resources.some((r) => !r.storageKey.startsWith(`resources/${opts.ownerId}/`) || r.storageKey.includes('..'))) {
    throw badRequest('Invalid resource file', 'invalid_revision');
  }

  const c = tree.course;
  await tx.course.update({
    where: { id: courseId },
    data: {
      title: c.title,
      subtitle: c.subtitle,
      description: c.description,
      language: c.language,
      level: c.level,
      objectives: c.objectives,
      requirements: c.requirements,
      priceCents: c.priceCents,
      categoryId: c.categoryId,
      thumbnailKey: c.thumbnailKey,
      promoVideoAssetId: c.promoVideoAssetId,
    },
  });
  await tx.lecture.deleteMany({ where: { section: { courseId }, id: { notIn: lectureIds } } });
  for (const [si, s] of tree.sections.entries()) {
    await tx.section.upsert({ where: { id: s.id }, create: { id: s.id, courseId, title: s.title, position: si }, update: { title: s.title, position: si } });
  }
  for (const s of tree.sections) {
    for (const [li, l] of s.lectures.entries()) {
      const durationSec = l.videoAssetId ? (byId.get(l.videoAssetId)?.durationSec ?? l.durationSec) : l.durationSec;
      const data = { sectionId: s.id, title: l.title, position: li, type: l.type, isPreview: l.isPreview, articleMd: l.articleMd, summary: l.summary ?? '', videoAssetId: l.videoAssetId, durationSec };
      await tx.lecture.upsert({ where: { id: l.id }, create: { id: l.id, ...data }, update: data });
      await tx.resource.deleteMany({ where: { lectureId: l.id, id: { notIn: l.resources.map((r) => r.id) } } });
      for (const r of l.resources) {
        const rd = { lectureId: l.id, title: r.title, storageKey: r.storageKey, sizeBytes: r.sizeBytes, mime: r.mime };
        await tx.resource.upsert({ where: { id: r.id }, create: { id: r.id, ...rd }, update: rd });
      }
      if (l.quiz?.length) {
        const questions = l.quiz as unknown as Prisma.InputJsonValue;
        await tx.quiz.upsert({ where: { lectureId: l.id }, create: { lectureId: l.id, questions }, update: { questions } });
      } else {
        await tx.quiz.deleteMany({ where: { lectureId: l.id } });
      }
    }
  }
  await tx.section.deleteMany({ where: { courseId, id: { notIn: sectionIds } } });
}

type RevisionRow = { id: string; courseId: string; status: RevisionStatus; snapshot: unknown; reviewNote: string | null; submittedAt: Date | null; createdAt: Date; updatedAt: Date };

/**
 * Revisions of PUBLISHED courses (PHASE1 A1): the instructor edits a draft snapshot while the live course stays
 * exactly as it is; an admin approves (applied atomically), requests changes or rejects (live unchanged).
 */
@Injectable()
export class RevisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  open(courseId: string, db: Tx = this.prisma) {
    return db.courseRevision.findFirst({ where: { courseId, status: { in: OPEN_REVISION } }, orderBy: { createdAt: 'desc' } });
  }

  liveTree(courseId: string, db: Tx = this.prisma) {
    return loadLiveTree(db, courseId);
  }

  /** Serialises edits of one course (first edit creates the draft; parallel requests must not create two). */
  private lock(tx: Tx, courseId: string) {
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${courseId}))`;
  }

  /**
   * Runs `fn` on the course's draft tree and saves it. Creates the draft from the live course on the first edit.
   * 409 `course_locked` while the revision is in review.
   */
  async mutate<T>(courseId: string, fn: (tree: CourseTree) => T): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, courseId);
      let rev = await this.open(courseId, tx);
      if (rev?.status === 'in_review') throw conflict('Your changes are in review; you can edit again after the decision', 'course_locked');
      if (!rev) {
        const tree = await loadLiveTree(tx, courseId);
        rev = await tx.courseRevision.create({ data: { courseId, status: 'draft', snapshot: tree as unknown as Prisma.InputJsonValue } });
      }
      const tree = rev.snapshot as unknown as CourseTree;
      const result = fn(tree);
      await tx.courseRevision.update({ where: { id: rev.id }, data: { snapshot: tree as unknown as Prisma.InputJsonValue } });
      return result;
    });
  }

  /** Revision summary for the studio and the admin queue. */
  async summary(rev: RevisionRow, live?: CourseTree) {
    const liveTree = live ?? (await this.liveTree(rev.courseId));
    const cats = await this.prisma.category.findMany({ select: { id: true, name: true } });
    const name = new Map(cats.map((c) => [c.id, c.name]));
    const changes: Change[] = diffTrees(liveTree, rev.snapshot as CourseTree, (id) => (id ? (name.get(id) ?? 'unknown') : 'none'));
    return { id: rev.id, status: rev.status, reviewNote: rev.reviewNote, submittedAt: rev.submittedAt, createdAt: rev.createdAt, updatedAt: rev.updatedAt, changes };
  }

  async submit(a: Actor, courseId: string) {
    const rev = await this.open(courseId);
    if (!rev) throw conflict('There are no changes to submit', 'no_changes');
    if (rev.status === 'in_review') throw conflict('These changes are already in review', 'invalid_status');
    const tree = rev.snapshot as unknown as CourseTree;
    const live = await this.liveTree(courseId);
    const changes = diffTrees(live, tree);
    if (!changes.length) throw conflict('There are no changes to submit', 'no_changes');
    const assetIds = [...new Set([...allLectures(tree).map((x) => x.lecture.videoAssetId), tree.course.promoVideoAssetId].filter((x): x is string => !!x))];
    const assets = await this.prisma.videoAsset.findMany({ where: { id: { in: assetIds } }, select: { id: true, status: true } });
    const status = new Map(assets.map((x) => [x.id, x.status as string]));
    const problems = readinessProblems(tree, (id) => status.get(id));
    if (problems.length) throw badRequest(`Before submitting: ${problems.map((p) => p.message.toLowerCase()).join(', ')}`, 'not_ready', problems);
    const r = await this.prisma.courseRevision.updateMany({ where: { id: rev.id, status: { in: ['draft', 'changes_requested'] } }, data: { status: 'in_review', submittedAt: new Date() } });
    if (!r.count) throw conflict('These changes are already in review', 'invalid_status');
    await this.audit.log({ actorId: a.user.id, action: 'course.revision_submitted', targetType: 'course', targetId: courseId, ip: a.ip, meta: { revisionId: rev.id, changes: changes.map((c) => c.message) } });
  }

  /** Throw away a draft (or changes-requested) revision; the live course was never touched. */
  async discard(a: Actor, courseId: string) {
    const rev = await this.open(courseId);
    if (!rev) throw notFound('Draft changes');
    if (rev.status === 'in_review') throw conflict('Your changes are in review and cannot be discarded now', 'course_locked');
    await this.prisma.courseRevision.delete({ where: { id: rev.id } });
    await this.audit.log({ actorId: a.user.id, action: 'course.revision_discarded', targetType: 'course', targetId: courseId, ip: a.ip, meta: { revisionId: rev.id } });
  }

  // ---------- admin decisions ----------

  /** Approve: the snapshot becomes the live course in ONE transaction (new videos/resources go live together). */
  async approve(a: Actor, courseId: string, note?: string | null) {
    const out = await this.prisma.$transaction(
      async (tx) => {
        await this.lock(tx, courseId);
        const rev = await this.open(courseId, tx);
        if (!rev || rev.status !== 'in_review') throw conflict('There are no changes waiting for review', 'invalid_status');
        const course = await tx.course.findUnique({ where: { id: courseId }, select: { instructorId: true, status: true } });
        if (!course) throw notFound('Course');
        const before = await loadLiveTree(tx, courseId);
        const tree = rev.snapshot as unknown as CourseTree;
        await applyTree(tx, courseId, tree, { ownerId: course.instructorId, requireReady: true });
        await tx.courseRevision.update({ where: { id: rev.id }, data: { status: 'approved', decidedAt: new Date(), decidedById: a.user.id, reviewNote: note?.trim() || null } });
        await tx.course.update({ where: { id: courseId }, data: { reviewNote: note?.trim() || null } });
        const changes = diffTrees(before, tree).map((c) => c.message);
        await this.audit.log({ actorId: a.user.id, action: 'course.revision_approved', targetType: 'course', targetId: courseId, ip: a.ip, meta: { revisionId: rev.id, note: note ?? null, changes } }, tx);
        return { revisionId: rev.id, status: course.status };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
    return out;
  }

  /** request-changes (editable again) or reject (closed): the live course is not touched either way. */
  async decide(a: Actor, courseId: string, decision: 'changes_requested' | 'rejected', note: string) {
    const rev = await this.open(courseId);
    if (!rev || rev.status !== 'in_review') throw conflict('There are no changes waiting for review', 'invalid_status');
    const r = await this.prisma.courseRevision.updateMany({
      where: { id: rev.id, status: 'in_review' },
      data: { status: decision, reviewNote: note.trim(), decidedAt: new Date(), decidedById: a.user.id },
    });
    if (!r.count) throw conflict('There are no changes waiting for review', 'invalid_status');
    await this.audit.log({
      actorId: a.user.id,
      action: decision === 'rejected' ? 'course.revision_rejected' : 'course.revision_changes_requested',
      targetType: 'course',
      targetId: courseId,
      ip: a.ip,
      meta: { revisionId: rev.id, note },
    });
    return { revisionId: rev.id, status: decision };
  }

  /** When a course stops being published, its open revision no longer applies. */
  async closeOpen(courseId: string, note: string, actorId: string) {
    await this.prisma.courseRevision.updateMany({
      where: { courseId, status: { in: OPEN_REVISION } },
      data: { status: 'rejected', reviewNote: note, decidedAt: new Date(), decidedById: actorId },
    });
  }
}
