import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { AuthUser, isAdmin } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { CURRENCY, PRICE_MAX_CENTS, PRICE_MIN_CENTS } from '../common/pricing';
import { SettingsService } from '../common/settings.service';
import { MediaService } from '../media/media.service';
import { cardInclude, toCard } from './course-card';

export interface CourseQuery {
  q?: string;
  category?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  price?: 'free' | 'paid';
  sort: 'popular' | 'newest' | 'rating' | 'price_asc' | 'price_desc';
  page: number;
  pageSize: number;
  instructorId?: string;
}

const ORDER: Record<CourseQuery['sort'], Prisma.CourseOrderByWithRelationInput[]> = {
  popular: [{ studentCount: 'desc' }, { ratingAvg: 'desc' }],
  newest: [{ publishedAt: 'desc' }],
  rating: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
  price_asc: [{ priceCents: 'asc' }],
  price_desc: [{ priceCents: 'desc' }],
};

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly settings: SettingsService,
  ) {}

  /** Public marketplace terms (pricing rules + revenue share) so the web never hard-codes them. */
  async terms() {
    const commissionBps = await this.settings.commissionBps();
    return {
      currency: CURRENCY,
      pricing: { freeAllowed: true, minCents: PRICE_MIN_CENTS, maxCents: PRICE_MAX_CENTS },
      commissionBps,
      instructorSharePercent: Math.round((10000 - commissionBps) / 100),
      singleCoursePurchases: true,
    };
  }

  categories() {
    return this.prisma.category.findMany({
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, icon: true, _count: { select: { courses: { where: { status: 'published' } } } } },
    }).then((rows) => rows.map(({ _count, ...c }) => ({ ...c, courseCount: _count.courses })));
  }

  async listCourses(q: CourseQuery) {
    const where: Prisma.CourseWhereInput = { status: 'published' };
    if (q.q) Object.assign(where, searchWhere(q.q));
    if (q.category) where.category = { slug: q.category };
    if (q.level) where.level = q.level;
    if (q.price === 'free') where.priceCents = 0;
    if (q.price === 'paid') where.priceCents = { gt: 0 };
    if (q.instructorId) where.instructorId = q.instructorId;
    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        include: cardInclude,
        orderBy: [...ORDER[q.sort], { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return {
      items: rows.map((r) => toCard(r, (k) => this.media.imageUrl(k))),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    };
  }

  /** Public course page. Curriculum has titles/durations/isPreview only: never asset URLs or keys. */
  async courseDetail(slug: string, viewer?: AuthUser) {
    const c = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        ...cardInclude,
        instructor: {
          select: { id: true, name: true, avatarUrl: true, instructorProfile: { select: { headline: true, bio: true } } },
        },
        sections: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            position: true,
            lectures: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                position: true,
                type: true,
                summary: true,
                durationSec: true,
                isPreview: true,
                quiz: { select: { id: true } },
                videoAsset: { select: { captionsKey: true } },
                resources: { orderBy: { createdAt: 'asc' }, select: { id: true, title: true, sizeBytes: true, mime: true } },
              },
            },
          },
        },
      },
    });
    const canSeeUnpublished = viewer && c && (c.instructorId === viewer.id || isAdmin(viewer));
    if (!c || (c.status !== 'published' && !canSeeUnpublished)) throw notFound('Course');

    let viewerState = { signedIn: false, enrolled: false, inCart: false, isOwner: false };
    if (viewer) {
      const [enr, cart] = await Promise.all([
        this.prisma.enrollment.findUnique({ where: { userId_courseId: { userId: viewer.id, courseId: c.id } } }),
        this.prisma.cartItem.findUnique({ where: { userId_courseId: { userId: viewer.id, courseId: c.id } } }),
      ]);
      viewerState = { signedIn: true, enrolled: !!enr && !enr.revokedAt, inCart: !!cart, isOwner: c.instructorId === viewer.id };
    }

    const card = toCard(
      { ...c, instructor: { id: c.instructor.id, name: c.instructor.name }, sections: c.sections.map((s) => ({ lectures: s.lectures })) },
      (k) => this.media.imageUrl(k),
    );
    const lectures = c.sections.flatMap((s) => s.lectures);
    const labFiles = c.sections.flatMap((s) => s.lectures.flatMap((l) => l.resources.map((r) => ({ title: r.title, sizeBytes: r.sizeBytes, mime: r.mime, lectureId: l.id, lectureTitle: l.title }))));
    const totals = {
      sections: c.sections.length,
      lectures: lectures.length,
      videoLectures: lectures.filter((l) => l.type === 'video').length,
      previewLectures: lectures.filter((l) => l.isPreview).length,
      quizzes: lectures.filter((l) => l.quiz).length,
      resources: labFiles.length,
      captionedLectures: lectures.filter((l) => l.videoAsset?.captionsKey).length,
      durationSec: card.totalDurationSec,
    };
    return {
      ...card,
      description: c.description,
      objectives: c.objectives,
      requirements: c.requirements,
      status: c.status,
      updatedAt: c.updatedAt,
      hasPromo: !!c.promoVideoAssetId,
      lastVerifiedAt: c.lastVerifiedAt,
      resourceCount: totals.resources,
      hasCaptions: totals.captionedLectures > 0,
      totals,
      labFiles,
      instructor: {
        id: c.instructor.id,
        name: c.instructor.name,
        avatarUrl: c.instructor.avatarUrl,
        headline: c.instructor.instructorProfile?.headline ?? '',
        bio: c.instructor.instructorProfile?.bio ?? '',
      },
      curriculum: c.sections.map((s) => ({
        id: s.id,
        title: s.title,
        lectures: s.lectures.map(({ resources, quiz, videoAsset, ...l }) => ({ ...l, resourceCount: resources.length, hasQuiz: !!quiz, hasCaptions: !!videoAsset?.captionsKey })),
      })),
      viewer: viewerState,
    };
  }

  async courseReviews(slug: string, page: number, pageSize: number) {
    const course = await this.prisma.course.findFirst({ where: { slug, status: 'published' }, select: { id: true, ratingAvg: true, ratingCount: true } });
    if (!course) throw notFound('Course');
    const where = { courseId: course.id, status: 'visible' as const };
    const [rows, total, dist] = await Promise.all([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, rating: true, body: true, instructorReply: true, createdAt: true, user: { select: { name: true, avatarUrl: true } } },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true } }),
    ]);
    const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const d of dist) distribution[String(d.rating)] = d._count._all;
    return {
      items: rows.map(({ user, ...r }) => ({ ...r, author: { name: user.name, avatarUrl: user.avatarUrl }, verifiedPurchase: true })),
      ratingAvg: Math.round(course.ratingAvg * 10) / 10,
      ratingCount: course.ratingCount,
      distribution,
      page,
      pageSize,
      total,
    };
  }

  async instructor(id: string) {
    const u = await this.prisma.user.findFirst({
      where: { id, instructorProfile: { status: 'approved' } },
      select: { id: true, name: true, avatarUrl: true, instructorProfile: { select: { headline: true, bio: true, website: true } } },
    });
    if (!u) throw notFound('Instructor');
    const courses = await this.listCourses({ instructorId: id, sort: 'popular', page: 1, pageSize: 48 });
    const [stats] = await this.instructorStats([id]);
    return {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      headline: u.instructorProfile!.headline,
      bio: u.instructorProfile!.bio,
      website: u.instructorProfile!.website,
      stats: { courses: stats.courseCount, students: stats.studentCount, reviews: stats.reviewCount },
      courses: courses.items,
    };
  }

  /**
   * Per instructor, over PUBLISHED courses only: courseCount, studentCount (distinct learners with an active
   * enrolment, so a learner in two courses counts once), reviewCount and the review-weighted ratingAvg.
   */
  async instructorStats(ids: string[]) {
    if (!ids.length) return [];
    const [courses, students] = await Promise.all([
      this.prisma.course.groupBy({ by: ['instructorId'], where: { instructorId: { in: ids }, status: 'published' }, _count: { _all: true } }),
      this.prisma.$queryRaw<{ instructorId: string; n: bigint }[]>`
        SELECT c."instructorId", COUNT(DISTINCT e."userId") AS n
        FROM enrollments e JOIN courses c ON c.id = e."courseId"
        WHERE c."instructorId" = ANY(${ids}) AND c.status = 'published' AND e."revokedAt" IS NULL
        GROUP BY c."instructorId"`,
    ]);
    const reviews = await this.prisma.review.groupBy({
      by: ['courseId'],
      where: { status: 'visible', course: { instructorId: { in: ids }, status: 'published' } },
      _count: { _all: true },
      _sum: { rating: true },
    });
    const courseOwner = new Map(
      (await this.prisma.course.findMany({ where: { id: { in: reviews.map((r) => r.courseId) } }, select: { id: true, instructorId: true } })).map((c) => [c.id, c.instructorId]),
    );
    return ids.map((id) => {
      const mine = reviews.filter((r) => courseOwner.get(r.courseId) === id);
      const reviewCount = mine.reduce((n, r) => n + r._count._all, 0);
      const ratingSum = mine.reduce((n, r) => n + (r._sum.rating ?? 0), 0);
      return {
        instructorId: id,
        courseCount: courses.find((c) => c.instructorId === id)?._count._all ?? 0,
        studentCount: Number(students.find((s) => s.instructorId === id)?.n ?? 0),
        reviewCount,
        ratingAvg: reviewCount ? Math.round((ratingSum / reviewCount) * 10) / 10 : null,
      };
    });
  }

  /** Approved instructors with at least one published course, most learners first. */
  async featuredInstructors(limit: number) {
    const users = await this.prisma.user.findMany({
      where: { status: 'active', instructorProfile: { status: 'approved' }, courses: { some: { status: 'published' } } },
      select: { id: true, name: true, avatarUrl: true, instructorProfile: { select: { headline: true, bio: true, isPlatform: true } } },
    });
    const stats = await this.instructorStats(users.map((u) => u.id));
    const byId = new Map(stats.map((s) => [s.instructorId, s]));
    const items = users
      .map((u) => {
        const s = byId.get(u.id)!;
        return {
          id: u.id,
          name: u.name,
          avatarUrl: u.avatarUrl,
          headline: u.instructorProfile?.headline ?? '',
          bio: u.instructorProfile?.bio ?? '',
          isPlatform: !!u.instructorProfile?.isPlatform,
          courseCount: s.courseCount,
          studentCount: s.studentCount,
          reviewCount: s.reviewCount,
          ratingAvg: s.ratingAvg,
        };
      })
      .sort((a, b) => b.studentCount - a.studentCount || b.courseCount - a.courseCount || a.name.localeCompare(b.name))
      .slice(0, limit);
    return { items };
  }

  async previewPlayback(lectureId: string, viewer?: AuthUser) {
    const l = await this.prisma.lecture.findUnique({
      where: { id: lectureId },
      include: { videoAsset: true, section: { select: { course: { select: { status: true } } } } },
    });
    if (!l || !l.isPreview || l.section.course.status !== 'published') throw notFound('Preview');
    if (!l.videoAsset) throw badRequest('This preview has no video', 'no_video');
    return this.media.playback(l.videoAsset, viewer?.id ?? null);
  }

  async promoPlayback(slug: string, viewer?: AuthUser) {
    const c = await this.prisma.course.findFirst({ where: { slug, status: 'published' }, select: { promoVideoAssetId: true } });
    if (!c?.promoVideoAssetId) throw notFound('Promo video');
    const asset = await this.prisma.videoAsset.findUnique({ where: { id: c.promoVideoAssetId } });
    if (!asset) throw notFound('Promo video');
    return this.media.playback(asset, viewer?.id ?? null);
  }

  async verifyCertificate(code: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { code },
      select: {
        code: true,
        issuedAt: true,
        user: { select: { name: true } },
        course: { select: { title: true, slug: true, instructor: { select: { name: true } }, sections: { select: { lectures: { select: { durationSec: true } } } } } },
      },
    });
    if (!cert) throw notFound('Certificate');
    return {
      code: cert.code,
      issuedAt: cert.issuedAt,
      studentName: cert.user.name,
      course: {
        title: cert.course.title,
        slug: cert.course.slug,
        instructorName: cert.course.instructor.name,
        totalDurationSec: cert.course.sections.flatMap((s) => s.lectures).reduce((n, l) => n + l.durationSec, 0),
      },
      valid: true,
    };
  }
}

/**
 * Catalogue search: every word must appear somewhere in the course (title, subtitle, description, instructor,
 * section or lecture titles of the live course). Simple plural stemming ("servers" also finds "server"). Only published
 * content is searched; draft revisions are separate and never match.
 */
export function searchWhere(raw: string): Prisma.CourseWhereInput {
  const words = raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  if (!words.length) return {};
  return {
    AND: words.map((w): Prisma.CourseWhereInput => {
      const c = { contains: w, mode: 'insensitive' as const };
      return {
        OR: [
          { title: c },
          { subtitle: c },
          { description: c },
          { instructor: { name: c } },
          { sections: { some: { title: c } } },
          { sections: { some: { lectures: { some: { title: c } } } } },
        ],
      };
    }),
  };
}
