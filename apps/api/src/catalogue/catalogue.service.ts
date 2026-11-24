import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { AuthUser, isAdmin } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
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
  ) {}

  categories() {
    return this.prisma.category.findMany({
      orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, icon: true, _count: { select: { courses: { where: { status: 'published' } } } } },
    }).then((rows) => rows.map(({ _count, ...c }) => ({ ...c, courseCount: _count.courses })));
  }

  async listCourses(q: CourseQuery) {
    const where: Prisma.CourseWhereInput = { status: 'published' };
    if (q.q) {
      where.OR = [
        { title: { contains: q.q, mode: 'insensitive' } },
        { subtitle: { contains: q.q, mode: 'insensitive' } },
        { instructor: { name: { contains: q.q, mode: 'insensitive' } } },
      ];
    }
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
              select: { id: true, title: true, position: true, type: true, durationSec: true, isPreview: true, _count: { select: { resources: true } } },
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
    return {
      ...card,
      description: c.description,
      objectives: c.objectives,
      requirements: c.requirements,
      status: c.status,
      updatedAt: c.updatedAt,
      hasPromo: !!c.promoVideoAssetId,
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
        lectures: s.lectures.map(({ _count, ...l }) => ({ ...l, resourceCount: _count.resources })),
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
    const courses = await this.listCourses({ instructorId: id, sort: 'popular', page: 1, pageSize: 50 });
    const stats = await this.prisma.course.aggregate({
      where: { instructorId: id, status: 'published' },
      _sum: { studentCount: true, ratingCount: true },
    });
    return {
      id: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl,
      headline: u.instructorProfile!.headline,
      bio: u.instructorProfile!.bio,
      website: u.instructorProfile!.website,
      stats: { courses: courses.total, students: stats._sum.studentCount ?? 0, reviews: stats._sum.ratingCount ?? 0 },
      courses: courses.items,
    };
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
