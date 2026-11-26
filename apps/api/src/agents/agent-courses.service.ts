import { Injectable } from '@nestjs/common';
import type { Actor } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { env } from '../config/env';
import type { CourseTree } from '../instructor/course-tree';
import { allLectures } from '../instructor/course-tree';
import { InstructorService } from '../instructor/instructor.service';
import { RevisionsService } from '../instructor/revisions.service';
import { validateCourse, type Validation } from './course-validation';

/** Course checks for agents: completeness validation, preview outline, submit only when ready. */
@Injectable()
export class AgentCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly instructor: InstructorService,
    private readonly revisions: RevisionsService,
  ) {}

  /** The version the studio edits: the draft revision of a published course, else the course itself. */
  private async editableTree(ownerId: string, courseId: string): Promise<{ tree: CourseTree; course: { id: string; slug: string; status: string; coverTemplateId: string | null; title: string } }> {
    const course = await this.prisma.course.findFirst({ where: { id: courseId, instructorId: ownerId }, select: { id: true, slug: true, status: true, coverTemplateId: true, title: true } });
    if (!course) throw notFound('Course');
    const rev = course.status === 'published' ? await this.revisions.open(courseId) : null;
    const tree = rev ? (rev.snapshot as unknown as CourseTree) : await this.revisions.liveTree(courseId);
    return { tree, course };
  }

  async validation(ownerId: string, courseId: string): Promise<Validation> {
    const { tree, course } = await this.editableTree(ownerId, courseId);
    const ids = [...new Set([...allLectures(tree).map((x) => x.lecture.videoAssetId), tree.course.promoVideoAssetId].filter((x): x is string => !!x))];
    const [assets, uploads] = await Promise.all([
      this.prisma.videoAsset.findMany({ where: { id: { in: ids }, ownerId }, select: { id: true, status: true, error: true } }),
      this.prisma.uploadSession.findMany({ where: { assetId: { in: ids }, status: 'completed' }, select: { assetId: true, sha256: true, filename: true } }),
    ]);
    const sha = new Map(uploads.map((u) => [u.assetId!, u]));
    const facts = new Map(assets.map((x) => [x.id, { status: x.status as string, error: x.error, sha256: sha.get(x.id)?.sha256 ?? null, filename: sha.get(x.id)?.filename ?? null }]));
    const keys = [...new Set(allLectures(tree).flatMap((x) => x.lecture.resources.map((r) => r.storageKey)))];
    const present = new Set<string>();
    for (let i = 0; i < keys.length; i += 10) {
      const batch = keys.slice(i, i + 10);
      const heads = await Promise.all(batch.map((k) => this.storage.head(k)));
      batch.forEach((k, j) => heads[j] && present.add(k));
    }
    return validateCourse(tree, { asset: (id) => facts.get(id), resourceExists: (k) => present.has(k), hasCover: !!course.coverTemplateId });
  }

  /** What learners will see, in outline, with each lesson's status, plus links for a human to look. */
  async preview(ownerId: string, courseId: string) {
    const { tree, course } = await this.editableTree(ownerId, courseId);
    const v = await this.validation(ownerId, courseId);
    const ids = allLectures(tree).map((x) => x.lecture.videoAssetId).filter((x): x is string => !!x);
    const status = new Map((await this.prisma.videoAsset.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } })).map((a) => [a.id, a.status]));
    const web = env().WEB_URL.replace(/\/$/, '');
    return {
      course: { id: course.id, title: tree.course.title, subtitle: tree.course.subtitle, status: course.status, level: tree.course.level, priceCents: tree.course.priceCents, objectives: tree.course.objectives },
      outline: tree.sections.map((s) => ({
        title: s.title,
        lessons: s.lectures.map((l) => ({ id: l.id, title: l.title, type: l.type, isPreview: l.isPreview, video: l.videoAssetId ? (status.get(l.videoAssetId) ?? 'unknown') : null, durationSec: l.durationSec, files: l.resources.map((r) => r.title), quizQuestions: l.quiz?.length ?? 0 })),
      })),
      validation: v,
      // For the human reviewer: the instructor studio editor and the public page once published.
      studioUrl: `${web}/studio/courses/${course.id}`,
      publicUrl: course.status === 'published' ? `${web}/courses/${course.slug}` : null,
    };
  }

  /** Submit for review only after validation passes; publishing stays a super admin decision. */
  async submit(a: Actor, courseId: string) {
    const v = await this.validation(a.user.id, courseId);
    if (!v.ready) throw badRequest(`Not ready for review: ${v.errors.map((e) => e.message).join('; ')}`, 'not_ready', v);
    return this.instructor.submit(a, courseId);
  }
}
