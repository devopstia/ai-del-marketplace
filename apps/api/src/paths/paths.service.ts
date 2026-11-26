import { Injectable } from '@nestjs/common';
import { hasAccess } from '../access/access';
import { AuditService } from '../common/audit.service';
import { Actor } from '../common/auth-context';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SalePricingService } from '../common/sale-pricing';
import { cardInclude, cardPriceInput, toCard } from '../catalogue/course-card';
import { MediaService } from '../media/media.service';
import { clampHours, cleanSkills, lectureRemaining, type PlanStep, skillMap, weeklyPlan } from './plan';

/** A path needs at least this many courses to be published (one course is just a course). */
export const MIN_PUBLISHED_STEPS = 2;
export const MAX_STEPS = 20;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Reading time for an article lesson without a length: 200 words a minute, at least a minute. */
const articleSec = (md: string | null) => Math.max(60, Math.round(((md ?? '').split(/\s+/).filter(Boolean).length / 200) * 60));
/** A quiz without a length: 30 seconds a question, at least a minute. */
const quizSec = (questions: unknown) => Math.max(60, (Array.isArray(questions) ? questions.length : 0) * 30);

export interface PathInput {
  title: string;
  slug: string;
  summary: string;
  description: string;
  steps: { courseId: string; skills: string[]; note: string }[];
}

const stepInclude = { course: { include: cardInclude } } as const;

/**
 * Career paths (owner 2026-11-26, idea 4; docs/CAREER_PATHS.md). Super admins write them; learners follow published
 * ones. A path sells nothing: each course is bought on its own through the normal checkout, and the last step points
 * to the full DEL program on devopseasylearning.com (rule 27).
 */
@Injectable()
export class PathsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
    private readonly pricing: SalePricingService,
  ) {}

  // ---------- public ----------

  private async publishedPaths(where: { slug?: string } = {}) {
    return this.prisma.careerPath.findMany({
      where: { status: 'published', ...where },
      orderBy: [{ publishedAt: 'asc' }, { title: 'asc' }],
      include: { steps: { orderBy: { position: 'asc' }, where: { course: { status: 'published' } }, include: stepInclude } },
    });
  }

  private async publicView(p: Awaited<ReturnType<PathsService['publishedPaths']>>[number]) {
    const prices = await this.pricing.prices(p.steps.map((s) => cardPriceInput(s.course)));
    const steps = p.steps.map((s, i) => ({ position: i + 1, skills: s.skills, note: s.note, course: toCard(s.course, (k) => this.media.imageUrl(k), prices.get(s.course.id)) }));
    const skills = [...new Map(steps.flatMap((s) => s.skills).map((k) => [k.toLowerCase(), k])).values()];
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      description: p.description,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      courseCount: steps.length,
      totalDurationSec: steps.reduce((n, s) => n + s.course.totalDurationSec, 0),
      totalPriceCents: steps.reduce((n, s) => n + s.course.priceCents, 0),
      currency: steps[0]?.course.currency ?? 'usd',
      skills,
      steps,
    };
  }

  /** Published paths with at least one live course (cards for /paths, the homepage band and the sitemap). */
  async listPublished() {
    const rows = (await this.publishedPaths()).filter((p) => p.steps.length);
    const views = await Promise.all(rows.map((p) => this.publicView(p)));
    return { items: views.map(({ steps, description: _d, ...v }) => ({ ...v, covers: steps.slice(0, 3).map((s) => s.course.thumbnailUrl) })) };
  }

  async publicPath(slug: string) {
    const [p] = await this.publishedPaths({ slug });
    if (!p || !p.steps.length) throw notFound('Career path');
    return this.publicView(p);
  }

  // ---------- student ----------

  private async publishedId(slug: string) {
    const p = await this.prisma.careerPath.findFirst({ where: { slug, status: 'published' }, select: { id: true } });
    if (!p) throw notFound('Career path');
    return p.id;
  }

  async follow(userId: string, slug: string, hoursPerWeek?: number) {
    const pathId = await this.publishedId(slug);
    const hours = clampHours(hoursPerWeek ?? 5);
    await this.prisma.careerPathFollow.upsert({
      where: { userId_pathId: { userId, pathId } },
      create: { userId, pathId, hoursPerWeek: hours },
      update: hoursPerWeek != null ? { hoursPerWeek: hours } : {},
    });
    return this.myPath(userId, slug);
  }

  async unfollow(userId: string, slug: string) {
    const p = await this.prisma.careerPath.findUnique({ where: { slug }, select: { id: true } });
    if (p) await this.prisma.careerPathFollow.deleteMany({ where: { userId, pathId: p.id } });
    return { following: false };
  }

  /** Paths this student follows, with real progress, the weekly plan and the skill map; plus how many are published. */
  async myPaths(userId: string) {
    const [follows, available] = await Promise.all([
      this.prisma.careerPathFollow.findMany({ where: { userId, path: { status: 'published' } }, orderBy: { createdAt: 'asc' }, select: { path: { select: { slug: true } } } }),
      this.prisma.careerPath.count({ where: { status: 'published', steps: { some: { course: { status: 'published' } } } } }),
    ]);
    const items = [];
    for (const f of follows) items.push(await this.myPath(userId, f.path.slug));
    return { items, available };
  }

  async myPath(userId: string, slug: string) {
    const [p] = await this.publishedPaths({ slug });
    if (!p) throw notFound('Career path');
    const follow = await this.prisma.careerPathFollow.findUnique({ where: { userId_pathId: { userId, pathId: p.id } } });
    if (!follow) throw notFound('Career path you follow');
    const courseIds = p.steps.map((s) => s.courseId);
    const [lectures, enrolments, certs] = await Promise.all([
      this.prisma.lecture.findMany({
        where: { section: { courseId: { in: courseIds } } },
        orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
        select: { id: true, title: true, type: true, durationSec: true, articleMd: true, quiz: { select: { questions: true } }, section: { select: { courseId: true } }, progress: { where: { userId }, select: { completed: true, watchedSec: true } } },
      }),
      this.prisma.enrollment.findMany({ where: { userId, courseId: { in: courseIds } } }),
      this.prisma.certificate.findMany({ where: { userId, courseId: { in: courseIds } }, select: { courseId: true, code: true } }),
    ]);
    const enrolled = new Map(enrolments.map((e) => [e.courseId, e]));
    const certOf = new Map(certs.map((c) => [c.courseId, c.code]));
    const prices = await this.pricing.prices(p.steps.map((s) => cardPriceInput(s.course)));

    const planSteps: PlanStep[] = [];
    const steps = p.steps.map((s, i) => {
      const own = lectures.filter((l) => l.section.courseId === s.courseId);
      const done = own.filter((l) => l.progress[0]?.completed).length;
      const percent = own.length ? Math.round((done / own.length) * 100) : 0;
      const e = enrolled.get(s.courseId);
      const access = s.course.instructorId === userId || hasAccess(e);
      const length = (l: (typeof own)[number]) => l.durationSec || (l.type === 'article' ? articleSec(l.articleMd) : l.type === 'quiz' ? quizSec(l.quiz?.questions) : 0);
      planSteps.push({
        courseId: s.courseId, slug: s.course.slug, title: s.course.title, hasAccess: access,
        lectures: own.map((l) => ({ id: l.id, title: l.title, done: !!l.progress[0]?.completed, remainingSec: lectureRemaining({ durationSec: length(l), watchedSec: l.progress[0]?.watchedSec ?? 0, completed: !!l.progress[0]?.completed }) })),
      });
      const card = toCard(s.course, (k) => this.media.imageUrl(k), prices.get(s.course.id));
      return {
        position: i + 1,
        skills: s.skills,
        note: s.note,
        course: card,
        // owned: the student can study it now; expired: they had it, the year is over (renew); none: not bought yet
        access: access ? 'owned' : e && !e.revokedAt ? 'expired' : 'none',
        progress: { total: own.length, completed: done, percent },
        certificateCode: certOf.get(s.courseId) ?? null,
      };
    });
    const plan = weeklyPlan(planSteps, follow.hoursPerWeek);
    const toBuy = steps.filter((s) => s.access !== 'owned');
    return {
      path: { id: p.id, slug: p.slug, title: p.title, summary: p.summary },
      following: true,
      hoursPerWeek: follow.hoursPerWeek,
      followedAt: follow.createdAt,
      progress: {
        coursesDone: steps.filter((s) => s.progress.total && s.progress.percent >= 100).length,
        courseCount: steps.length,
        lecturesDone: steps.reduce((n, s) => n + s.progress.completed, 0),
        lectureCount: steps.reduce((n, s) => n + s.progress.total, 0),
      },
      remainingPriceCents: toBuy.reduce((n, s) => n + s.course.priceCents, 0),
      steps,
      plan,
      skills: skillMap(steps.map((s) => ({ skills: s.skills, percent: s.progress.total ? s.progress.percent : 0 }))),
    };
  }

  // ---------- super admin ----------

  async adminList() {
    const rows = await this.prisma.careerPath.findMany({
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
      include: { _count: { select: { steps: true, followers: true } } },
    });
    return { items: rows.map(({ _count, ...p }) => ({ id: p.id, slug: p.slug, title: p.title, summary: p.summary, status: p.status, publishedAt: p.publishedAt, updatedAt: p.updatedAt, stepCount: _count.steps, followerCount: _count.followers })) };
  }

  async adminGet(id: string) {
    const p = await this.prisma.careerPath.findUnique({
      where: { id },
      include: { steps: { orderBy: { position: 'asc' }, include: { course: { select: { id: true, slug: true, title: true, status: true, instructor: { select: { name: true } } } } } }, _count: { select: { followers: true } } },
    });
    if (!p) throw notFound('Career path');
    return {
      id: p.id, slug: p.slug, title: p.title, summary: p.summary, description: p.description, status: p.status, publishedAt: p.publishedAt, updatedAt: p.updatedAt, followerCount: p._count.followers,
      steps: p.steps.map((s) => ({ courseId: s.courseId, skills: s.skills, note: s.note, course: { id: s.course.id, slug: s.course.slug, title: s.course.title, status: s.course.status, instructor: s.course.instructor.name } })),
    };
  }

  /** Published courses a path can use (the editor's course picker). */
  async courseOptions(q?: string) {
    const rows = await this.prisma.course.findMany({
      where: { status: 'published', ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}) },
      orderBy: { title: 'asc' },
      take: 50,
      select: { id: true, slug: true, title: true, instructor: { select: { name: true } } },
    });
    return { items: rows.map((c) => ({ id: c.id, slug: c.slug, title: c.title, instructor: c.instructor.name })) };
  }

  private async validate(input: PathInput, id?: string) {
    if (!SLUG_RE.test(input.slug)) throw badRequest('Use lowercase letters, numbers and dashes for the link', 'invalid_slug');
    const clash = await this.prisma.careerPath.findFirst({ where: { slug: input.slug, ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
    if (clash) throw conflict('Another path already uses this link', 'slug_taken');
    if (input.steps.length > MAX_STEPS) throw badRequest(`A path has at most ${MAX_STEPS} courses`, 'too_many_steps');
    const ids = input.steps.map((s) => s.courseId);
    if (new Set(ids).size !== ids.length) throw badRequest('Each course can be in a path only once', 'duplicate_course');
    const found = await this.prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } });
    if (found.length !== ids.length) throw badRequest('One of the courses no longer exists', 'unknown_course');
  }

  private stepRows(input: PathInput) {
    return input.steps.map((s, i) => ({ courseId: s.courseId, position: i, skills: cleanSkills(s.skills), note: s.note.trim() }));
  }

  async create(a: Actor, input: PathInput) {
    await this.validate(input);
    const p = await this.prisma.careerPath.create({
      data: { slug: input.slug, title: input.title.trim(), summary: input.summary.trim(), description: input.description.trim(), createdById: a.user.id, steps: { create: this.stepRows(input) } },
    });
    await this.audit.log({ actorId: a.user.id, action: 'career_path.created', targetType: 'career_path', targetId: p.id, ip: a.ip, meta: { slug: p.slug, title: p.title, courseIds: input.steps.map((s) => s.courseId) } });
    return this.adminGet(p.id);
  }

  async update(a: Actor, id: string, input: PathInput) {
    const before = await this.prisma.careerPath.findUnique({ where: { id }, include: { steps: { orderBy: { position: 'asc' }, select: { courseId: true } } } });
    if (!before) throw notFound('Career path');
    await this.validate(input, id);
    if (before.status === 'published') await this.checkPublishable(input.steps.map((s) => s.courseId));
    await this.prisma.$transaction([
      this.prisma.careerPathStep.deleteMany({ where: { pathId: id } }),
      this.prisma.careerPath.update({
        where: { id },
        data: { slug: input.slug, title: input.title.trim(), summary: input.summary.trim(), description: input.description.trim(), steps: { create: this.stepRows(input) } },
      }),
    ]);
    await this.audit.log({
      actorId: a.user.id, action: 'career_path.updated', targetType: 'career_path', targetId: id, ip: a.ip,
      meta: { before: { slug: before.slug, title: before.title, courseIds: before.steps.map((s) => s.courseId) }, after: { slug: input.slug, title: input.title, courseIds: input.steps.map((s) => s.courseId) } },
    });
    return this.adminGet(id);
  }

  private async checkPublishable(courseIds: string[]) {
    if (courseIds.length < MIN_PUBLISHED_STEPS) throw badRequest(`Add at least ${MIN_PUBLISHED_STEPS} courses before publishing`, 'too_few_steps');
    const live = await this.prisma.course.count({ where: { id: { in: courseIds }, status: 'published' } });
    if (live !== courseIds.length) throw badRequest('Every course in a published path must be published', 'course_not_published');
  }

  async publish(a: Actor, id: string) {
    const p = await this.prisma.careerPath.findUnique({ where: { id }, include: { steps: { select: { courseId: true } } } });
    if (!p) throw notFound('Career path');
    if (!p.summary.trim()) throw badRequest('Write a short summary before publishing', 'summary_required');
    await this.checkPublishable(p.steps.map((s) => s.courseId));
    await this.prisma.careerPath.update({ where: { id }, data: { status: 'published', publishedAt: p.publishedAt ?? new Date() } });
    await this.audit.log({ actorId: a.user.id, action: 'career_path.published', targetType: 'career_path', targetId: id, ip: a.ip, meta: { slug: p.slug } });
    return this.adminGet(id);
  }

  async unpublish(a: Actor, id: string) {
    const p = await this.prisma.careerPath.findUnique({ where: { id }, select: { slug: true } });
    if (!p) throw notFound('Career path');
    await this.prisma.careerPath.update({ where: { id }, data: { status: 'draft' } });
    await this.audit.log({ actorId: a.user.id, action: 'career_path.unpublished', targetType: 'career_path', targetId: id, ip: a.ip, meta: { slug: p.slug } });
    return this.adminGet(id);
  }

  /** Only a draft can be deleted (unpublish first), so a live page never disappears by one click. */
  async remove(a: Actor, id: string) {
    const p = await this.prisma.careerPath.findUnique({ where: { id }, include: { _count: { select: { followers: true } } } });
    if (!p) throw notFound('Career path');
    if (p.status === 'published') throw conflict('Unpublish the path before deleting it', 'published');
    await this.prisma.careerPath.delete({ where: { id } });
    await this.audit.log({ actorId: a.user.id, action: 'career_path.deleted', targetType: 'career_path', targetId: id, ip: a.ip, meta: { slug: p.slug, title: p.title, followers: p._count.followers } });
    return { deleted: true };
  }
}
