import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MediaService } from '../media/media.service';
import { averageProgress, byCourse, dailySeries, money, ownershipOf, pct, resolveRange, type RangeKey, type SaleLine } from './dashboard';

const PAID = ['paid', 'refunded', 'partially_refunded'] as const;
const firstName = (n: string | null | undefined) => (n ?? '').trim().split(/\s+/)[0] || 'A learner';

/**
 * Instructor / DEL Studio dashboard (owner 2026-11-27, Option A; docs/DASHBOARD_DESIGN.md). Read-only reporting over the
 * real records for ONE account (req.user: the instructor, or the DEL platform account in DEL Studio). It never changes
 * money: amounts are the order-line snapshots taken at purchase. The account's own learning activity is left out.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService, private readonly media: MediaService) {}

  async overview(userId: string, q: { range?: RangeKey; from?: Date; to?: Date }, now = new Date()) {
    const range = resolveRange(q.range ?? '30d', now, q.from, q.to);
    const { current: cur, previous: prev } = range;
    const notMe = { not: userId };

    const [profile, courses] = await Promise.all([
      this.prisma.instructorProfile.findUnique({ where: { userId }, select: { isPlatform: true, payToPlatform: true, official: true } }),
      this.prisma.course.findMany({
        where: { instructorId: userId, archivedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true, title: true, slug: true, status: true, coverKey: true, updatedAt: true, ratingAvg: true, ratingCount: true,
          sections: { select: { lectures: { select: { id: true, quiz: { select: { id: true } } } } } },
        },
      }),
    ]);
    const ownership = ownershipOf(profile);
    const courseIds = courses.map((c) => c.id);
    const lectureCourse = new Map<string, string>();
    const lessonsPerCourse = new Map<string, number>();
    const quizIds: string[] = [];
    for (const c of courses) {
      const ls = c.sections.flatMap((s) => s.lectures);
      lessonsPerCourse.set(c.id, ls.length);
      for (const l of ls) {
        lectureCourse.set(l.id, c.id);
        if (l.quiz) quizIds.push(l.quiz.id);
      }
    }
    const lectureIds = [...lectureCourse.keys()];

    const [lineRows, enrolNow, enrolPrev, enrolled, activeNow, activePrev, quizNow, certsAll, certsNow, reviews, payoutRows] = await Promise.all([
      this.prisma.orderLine.findMany({
        where: { instructorId: userId, order: { status: { in: [...PAID] }, paidAt: { gte: prev.from, lt: cur.to } } },
        select: { courseId: true, priceCents: true, feeCents: true, instructorShareCents: true, refundedAt: true, transferStatus: true, payee: true, order: { select: { paidAt: true } } },
      }),
      this.prisma.enrollment.count({ where: { courseId: { in: courseIds }, userId: notMe, createdAt: { gte: cur.from, lt: cur.to } } }),
      this.prisma.enrollment.count({ where: { courseId: { in: courseIds }, userId: notMe, createdAt: { gte: prev.from, lt: prev.to } } }),
      this.prisma.enrollment.findMany({ where: { courseId: { in: courseIds }, userId: notMe, revokedAt: null }, select: { userId: true, courseId: true } }),
      lectureIds.length ? this.prisma.lectureProgress.findMany({ where: { lectureId: { in: lectureIds }, userId: notMe, updatedAt: { gte: cur.from, lt: cur.to } }, distinct: ['userId'], select: { userId: true } }) : Promise.resolve([]),
      lectureIds.length ? this.prisma.lectureProgress.findMany({ where: { lectureId: { in: lectureIds }, userId: notMe, updatedAt: { gte: prev.from, lt: prev.to } }, distinct: ['userId'], select: { userId: true } }) : Promise.resolve([]),
      quizIds.length ? this.prisma.quizAttempt.aggregate({ where: { quizId: { in: quizIds }, userId: notMe, at: { gte: cur.from, lt: cur.to } }, _avg: { score: true }, _count: { _all: true } }) : Promise.resolve(null),
      this.prisma.certificate.groupBy({ by: ['courseId'], where: { courseId: { in: courseIds }, userId: notMe }, _count: { _all: true } }),
      this.prisma.certificate.count({ where: { courseId: { in: courseIds }, userId: notMe, issuedAt: { gte: cur.from, lt: cur.to } } }),
      this.prisma.review.findMany({ where: { courseId: { in: courseIds }, status: 'visible' }, orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, rating: true, body: true, createdAt: true, instructorReply: true, user: { select: { name: true } }, course: { select: { id: true, title: true } } } }),
      this.prisma.orderLine.findMany({ where: { instructorId: userId, refundedAt: null, payee: 'instructor', transferStatus: { in: ['pending', 'paid'] }, order: { status: { in: [...PAID] } } }, select: { instructorShareCents: true, transferStatus: true } }),
    ]);

    const lines: SaleLine[] = lineRows.filter((l) => l.order.paidAt).map((l) => ({ paidAt: l.order.paidAt!, courseId: l.courseId, priceCents: l.priceCents, feeCents: l.feeCents, instructorShareCents: l.instructorShareCents, refundedAt: l.refundedAt, transferStatus: l.transferStatus, payee: l.payee }));
    const inCur = lines.filter((l) => l.paidAt >= cur.from && l.paidAt < cur.to);
    const inPrev = lines.filter((l) => l.paidAt >= prev.from && l.paidAt < prev.to);
    const perCourseMoney = byCourse(inCur);

    // Progress and completion over current enrolments (all time, not the range: they describe the courses as they are).
    const enrolledUsers = [...new Set(enrolled.map((e) => e.userId))];
    const done = enrolledUsers.length && lectureIds.length
      ? await this.prisma.lectureProgress.findMany({ where: { lectureId: { in: lectureIds }, userId: { in: enrolledUsers }, completed: true }, select: { userId: true, lectureId: true } })
      : [];
    const doneBy = new Map<string, number>();
    for (const d of done) {
      const k = `${d.userId}:${lectureCourse.get(d.lectureId)}`;
      doneBy.set(k, (doneBy.get(k) ?? 0) + 1);
    }
    const progressRows = enrolled.map((e) => ({ courseId: e.courseId, completed: doneBy.get(`${e.userId}:${e.courseId}`) ?? 0, total: lessonsPerCourse.get(e.courseId) ?? 0 }));
    const enrolledBy = new Map<string, number>();
    for (const e of enrolled) enrolledBy.set(e.courseId, (enrolledBy.get(e.courseId) ?? 0) + 1);
    const certsBy = new Map(certsAll.map((c) => [c.courseId, c._count._all]));
    const totalCerts = certsAll.reduce((a, c) => a + c._count._all, 0);

    const rated = courses.filter((c) => c.ratingCount > 0);
    const ratingCount = rated.reduce((a, c) => a + c.ratingCount, 0);

    return {
      ownership,
      official: !!profile?.official,
      range: { key: range.key, from: cur.from, to: cur.to, days: cur.days, previousFrom: prev.from, previousTo: prev.to },
      current: { ...money(inCur), enrolments: enrolNow, activeStudents: activeNow.length },
      previous: { ...money(inPrev), enrolments: enrolPrev, activeStudents: activePrev.length },
      series: dailySeries(inCur, cur),
      payouts: ownership === 'revenue_share'
        ? { pendingCents: payoutRows.filter((r) => r.transferStatus === 'pending').reduce((a, r) => a + r.instructorShareCents, 0), paidCents: payoutRows.filter((r) => r.transferStatus === 'paid').reduce((a, r) => a + r.instructorShareCents, 0) }
        : null,
      catalogue: {
        published: courses.filter((c) => c.status === 'published').length,
        drafts: courses.filter((c) => c.status !== 'published').length,
        ratingAvg: ratingCount ? Math.round((rated.reduce((a, c) => a + c.ratingAvg * c.ratingCount, 0) / ratingCount) * 100) / 100 : null,
        ratingCount,
        completionRate: pct(totalCerts, enrolled.length),
      },
      students: {
        total: enrolledUsers.length,
        active: activeNow.length,
        averageProgress: averageProgress(progressRows),
        completionRate: pct(totalCerts, enrolled.length),
        quizAverage: quizNow && quizNow._count._all ? Math.round(quizNow._avg.score ?? 0) : null,
        quizAttempts: quizNow?._count._all ?? 0,
        certificatesIssued: certsNow,
        certificatesTotal: totalCerts,
      },
      courses: courses.map((c) => {
        const m = perCourseMoney.get(c.id);
        return {
          id: c.id, title: c.title, slug: c.slug, status: c.status, updatedAt: c.updatedAt,
          thumbnailUrl: this.media.imageUrl(c.coverKey),
          students: enrolledBy.get(c.id) ?? 0,
          sales: m?.sales ?? 0,
          grossCents: m?.grossCents ?? 0,
          netCents: m?.netCents ?? 0,
          instructorShareCents: m?.instructorShareCents ?? 0,
          ratingAvg: c.ratingCount ? c.ratingAvg : null,
          ratingCount: c.ratingCount,
          completionRate: pct(certsBy.get(c.id) ?? 0, enrolledBy.get(c.id) ?? 0),
        };
      }),
      reviews: reviews.map((r) => ({ id: r.id, rating: r.rating, body: r.body, createdAt: r.createdAt, replied: !!r.instructorReply, learner: firstName(r.user.name), course: r.course })),
      activity: await this.activity(userId, courseIds, courses),
    };
  }

  /** The latest events on this account's courses, newest first (not limited to the range). First names only. */
  private async activity(userId: string, courseIds: string[], courses: { id: string; title: string; status: string; updatedAt: Date }[]) {
    if (!courseIds.length) return [];
    const title = new Map(courses.map((c) => [c.id, c.title]));
    const notMe = { not: userId };
    const [sales, enrols, revs, certs, refunds] = await Promise.all([
      this.prisma.orderLine.findMany({ where: { instructorId: userId, order: { status: { in: [...PAID] }, paidAt: { not: null } } }, orderBy: { order: { paidAt: 'desc' } }, take: 8, select: { id: true, courseId: true, priceCents: true, refundedAt: true, order: { select: { paidAt: true, user: { select: { name: true } } } } } }),
      this.prisma.enrollment.findMany({ where: { courseId: { in: courseIds }, userId: notMe, source: { not: 'purchase' } }, orderBy: { createdAt: 'desc' }, take: 6, select: { courseId: true, createdAt: true, source: true, user: { select: { name: true } } } }),
      this.prisma.review.findMany({ where: { courseId: { in: courseIds }, status: 'visible' }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, courseId: true, rating: true, createdAt: true, user: { select: { name: true } } } }),
      this.prisma.certificate.findMany({ where: { courseId: { in: courseIds }, userId: notMe }, orderBy: { issuedAt: 'desc' }, take: 6, select: { code: true, courseId: true, issuedAt: true, user: { select: { name: true } } } }),
      this.prisma.refundRequest.findMany({ where: { order: { lines: { some: { instructorId: userId } } } }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, status: true, createdAt: true, order: { select: { lines: { where: { instructorId: userId }, take: 1, select: { courseId: true } } } } } }),
    ]);
    const ev: { kind: string; at: Date; text: string; detail: string; courseId: string | null }[] = [];
    for (const s of sales) ev.push({ kind: 'purchase', at: s.order.paidAt!, text: `New purchase · ${title.get(s.courseId) ?? 'a course'}`, detail: `${firstName(s.order.user.name)} · $${(s.priceCents / 100).toFixed(2)}${s.refundedAt ? ' · refunded' : ''}`, courseId: s.courseId });
    for (const e of enrols) ev.push({ kind: 'enrolment', at: e.createdAt, text: `New enrolment · ${title.get(e.courseId) ?? 'a course'}`, detail: `${firstName(e.user.name)} · ${e.source === 'free' ? 'free course' : e.source === 'manual' ? 'manual enrolment' : 'added by DEL'}`, courseId: e.courseId });
    for (const r of revs) ev.push({ kind: 'review', at: r.createdAt, text: `New ${r.rating}★ review · ${title.get(r.courseId) ?? 'a course'}`, detail: firstName(r.user.name), courseId: r.courseId });
    for (const c of certs) ev.push({ kind: 'certificate', at: c.issuedAt, text: `Course completed · ${title.get(c.courseId) ?? 'a course'}`, detail: `${firstName(c.user.name)} · certificate issued`, courseId: c.courseId });
    for (const r of refunds) { const cid = r.order.lines[0]?.courseId ?? null; ev.push({ kind: 'refund', at: r.createdAt, text: `Refund request · ${(cid && title.get(cid)) || 'a course'}`, detail: r.status.replace(/_/g, ' '), courseId: cid }); }
    for (const c of courses.slice(0, 4)) ev.push({ kind: 'course', at: c.updatedAt, text: `${c.status === 'published' ? 'Course updated' : 'Draft updated'} · ${c.title || 'Untitled course'}`, detail: c.status.replace(/_/g, ' '), courseId: c.id });
    return ev.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
  }
}
