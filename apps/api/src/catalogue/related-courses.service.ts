import { Injectable } from '@nestjs/common';
import { hasAccess } from '../access/access';
import { AuditService } from '../common/audit.service';
import { Actor, AuthUser } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { SalePricingService } from '../common/sale-pricing';
import { MediaService } from '../media/media.service';

/** At most this many related courses per course; the student dashboard shows at most `STUDENT_MAX`. */
export const RELATED_MAX = 6;
export const STUDENT_MAX = 3;
export const REASON_MAX = 200;

export interface RelatedInput { courseId: string; reason?: string }

/** A recommendation card: what the course page, the player and the student dashboard show. */
export interface RelatedCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  coverUrl: string | null;
  priceCents: number;
  listPriceCents: number;
  currency: string;
  reason: string;
  /** The viewer has access now: show "Continue learning", never a price or "Buy". Always false for anonymous viewers. */
  owned: boolean;
}

/**
 * "Continue your learning journey" (owner 2026-11-28; docs/COURSE_PLATFORM_REFERENCE.md › Recommendations).
 * Related courses are not course content: an instructor (or DEL Studio) sets them directly, without a revision review,
 * and every change is audited. Only published related courses are ever shown; an owned course is never offered for sale.
 */
@Injectable()
export class RelatedCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly pricing: SalePricingService,
    private readonly audit: AuditService,
  ) {}

  /** Cards for one course, in order, only published targets. `viewer` decides `owned`. */
  async forCourse(courseId: string, viewer?: AuthUser | null): Promise<RelatedCard[]> {
    const rows = await this.prisma.courseRelated.findMany({
      where: { courseId, relatedCourse: { status: 'published', archivedAt: null } },
      orderBy: { position: 'asc' },
      select: { reason: true, relatedCourse: { select: { id: true, slug: true, title: true, subtitle: true, coverKey: true, priceCents: true, currency: true } } },
    });
    return this.cards(rows.map((r) => ({ ...r.relatedCourse, reason: r.reason })), viewer?.id);
  }

  /** The student dashboard: related courses of the courses the student has access to, minus those, deduplicated, ≤ 3. */
  async forStudent(userId: string): Promise<RelatedCard[]> {
    const enrolments = await this.prisma.enrollment.findMany({ where: { userId }, select: { courseId: true, revokedAt: true, accessExpiresAt: true } });
    const owned = new Set(enrolments.filter((e) => hasAccess(e)).map((e) => e.courseId));
    if (!owned.size) return [];
    const rows = await this.prisma.courseRelated.findMany({
      where: { courseId: { in: [...owned] }, relatedCourseId: { notIn: [...owned] }, relatedCourse: { status: 'published', archivedAt: null } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { reason: true, relatedCourse: { select: { id: true, slug: true, title: true, subtitle: true, coverKey: true, priceCents: true, currency: true } } },
    });
    const seen = new Set<string>();
    const picked = rows.filter((r) => (seen.has(r.relatedCourse.id) ? false : (seen.add(r.relatedCourse.id), true))).slice(0, STUDENT_MAX);
    return this.cards(picked.map((r) => ({ ...r.relatedCourse, reason: r.reason })), userId);
  }

  /** What the studio editor shows: the current list (any status, so an owner sees a target that was unpublished). */
  async list(ownerId: string, courseId: string) {
    await this.own(ownerId, courseId);
    const rows = await this.prisma.courseRelated.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { reason: true, relatedCourse: { select: { id: true, slug: true, title: true, status: true } } },
    });
    return { items: rows.map((r) => ({ courseId: r.relatedCourse.id, slug: r.relatedCourse.slug, title: r.relatedCourse.title, status: r.relatedCourse.status, reason: r.reason })) };
  }

  /** Courses the owner may pick: every published course, plus the owner's own (DEL Studio: any DEL course). */
  async candidates(ownerId: string, courseId: string) {
    await this.own(ownerId, courseId);
    const rows = await this.prisma.course.findMany({
      where: { id: { not: courseId }, archivedAt: null, OR: [{ status: 'published' }, { instructorId: ownerId }] },
      orderBy: { title: 'asc' },
      select: { id: true, slug: true, title: true, status: true, instructorId: true },
    });
    return { items: rows.map((r) => ({ id: r.id, slug: r.slug, title: r.title, status: r.status, own: r.instructorId === ownerId })) };
  }

  /** Replace the list (order = array order). Targets: published courses or the owner's own; never itself. Audited. */
  async set(a: Actor, courseId: string, items: RelatedInput[]) {
    await this.own(a.user.id, courseId);
    const clean = validateRelated(courseId, items);
    if (clean.length) {
      const found = await this.prisma.course.findMany({
        where: { id: { in: clean.map((i) => i.courseId) }, archivedAt: null, OR: [{ status: 'published' }, { instructorId: a.user.id }] },
        select: { id: true },
      });
      const ok = new Set(found.map((f) => f.id));
      const bad = clean.find((i) => !ok.has(i.courseId));
      if (bad) throw badRequest('Choose a published course (or one of your own)', 'invalid_related', [{ field: 'items', message: `Not available: ${bad.courseId}` }]);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.courseRelated.deleteMany({ where: { courseId } });
      if (clean.length) await tx.courseRelated.createMany({ data: clean.map((i, position) => ({ courseId, relatedCourseId: i.courseId, position, reason: i.reason })) });
      // The audit layer adds the real person, support session and agent token from the request (AGENTS.md rule 28).
      await this.audit.log({ actorId: a.user.id, action: 'course.related_set', targetType: 'course', targetId: courseId, ip: a.ip, meta: { related: clean.map((i) => i.courseId) } }, tx);
    });
    return this.list(a.user.id, courseId);
  }

  private async own(ownerId: string, courseId: string) {
    const c = await this.prisma.course.findFirst({ where: { id: courseId, instructorId: ownerId }, select: { id: true } });
    if (!c) throw notFound('Course');
  }

  private async cards(rows: { id: string; slug: string; title: string; subtitle: string; coverKey: string | null; priceCents: number; currency: string; reason: string }[], viewerId?: string): Promise<RelatedCard[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [prices, enrolments] = await Promise.all([
      this.pricing.pricesForIds(ids),
      viewerId ? this.prisma.enrollment.findMany({ where: { userId: viewerId, courseId: { in: ids } }, select: { courseId: true, revokedAt: true, accessExpiresAt: true } }) : Promise.resolve([]),
    ]);
    const owned = new Set(enrolments.filter((e) => hasAccess(e)).map((e) => e.courseId));
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      subtitle: r.subtitle,
      coverUrl: this.media.imageUrl(r.coverKey),
      priceCents: prices.get(r.id)?.priceCents ?? r.priceCents,
      listPriceCents: r.priceCents,
      currency: r.currency,
      reason: r.reason,
      owned: owned.has(r.id),
    }));
  }
}

/** Trim, drop duplicates and self-links, enforce the limits. Pure: unit-tested. */
export function validateRelated(courseId: string, items: RelatedInput[]): { courseId: string; reason: string }[] {
  if (items.length > RELATED_MAX) throw badRequest(`At most ${RELATED_MAX} related courses`, 'too_many_related');
  const out: { courseId: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const i of items) {
    if (i.courseId === courseId) throw badRequest('A course cannot recommend itself', 'related_self');
    if (seen.has(i.courseId)) continue;
    seen.add(i.courseId);
    const reason = (i.reason ?? '').trim();
    if (reason.length > REASON_MAX) throw badRequest(`Keep the reason under ${REASON_MAX} characters`, 'related_reason_too_long');
    out.push({ courseId: i.courseId, reason });
  }
  return out;
}
