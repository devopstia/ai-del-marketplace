import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { page, paged } from '../common/util';
import { recalcRating } from '../learning/learning.service';

export const REPORT_REASONS = ['spam', 'abusive', 'fake', 'off_topic', 'personal_data', 'other'] as const;
export const REASON_LABEL: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: 'Spam or advertising', abusive: 'Harassment or abuse', fake: 'Fake or not a real learner', off_topic: 'Not about the course', personal_data: 'Personal information', other: 'Other policy violation',
};

/**
 * Course review moderation (owner 2026-11-25). Instructors report; super admins (and admins with reviews.moderate)
 * hide or restore; only super admins delete, always with a reason. Ratings and counts are recalculated after every
 * change. A low rating is never a reason by itself: reports must name a policy violation.
 */
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async report(a: Actor, reviewId: string, input: { reason: (typeof REPORT_REASONS)[number]; details: string }) {
    const r = await this.prisma.review.findFirst({ where: { id: reviewId, course: { instructorId: a.user.id } } });
    if (!r) throw notFound('Review');
    if (input.details.trim().length < 10) throw badRequest('Explain what breaks the review policy (at least a sentence)', 'details_required');
    const open = await this.prisma.reviewReport.findFirst({ where: { reviewId, reporterId: a.user.id, status: 'open' } });
    if (open) throw conflict('You already reported this review; DEL is looking at it', 'already_reported');
    const rep = await this.prisma.reviewReport.create({ data: { reviewId, reporterId: a.user.id, reason: input.reason, details: input.details.trim() } });
    await this.audit.log({ actorId: a.user.id, action: 'review.reported', targetType: 'review', targetId: reviewId, ip: a.ip, meta: { reportId: rep.id, reason: input.reason } });
    return { id: rep.id, status: rep.status };
  }

  async list(q: { q?: string; courseId?: string; instructorId?: string; rating?: number; status?: 'visible' | 'hidden'; reported?: boolean; page: number; pageSize: number }) {
    const openReports = q.reported ? await this.prisma.reviewReport.findMany({ where: { status: 'open' }, select: { reviewId: true } }) : [];
    const where: Prisma.ReviewWhereInput = {
      ...(q.courseId ? { courseId: q.courseId } : {}),
      ...(q.instructorId ? { course: { instructorId: q.instructorId } } : {}),
      ...(q.rating ? { rating: q.rating } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.reported ? { id: { in: openReports.map((x) => x.reviewId) } } : {}),
      ...(q.q ? { OR: [{ body: { contains: q.q, mode: 'insensitive' } }, { user: { name: { contains: q.q, mode: 'insensitive' } } }, { course: { title: { contains: q.q, mode: 'insensitive' } } }] } : {}),
    };
    const [total, rows, counts] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where, orderBy: { createdAt: 'desc' }, ...page(q.page, q.pageSize),
        include: { user: { select: { id: true, name: true, email: true } }, course: { select: { id: true, title: true, slug: true, instructor: { select: { id: true, name: true } } } } },
      }),
      Promise.all([this.prisma.review.count(), this.prisma.review.count({ where: { status: 'hidden' } }), this.prisma.reviewReport.count({ where: { status: 'open' } })]),
    ]);
    const reports = await this.prisma.reviewReport.findMany({ where: { reviewId: { in: rows.map((r) => r.id) } }, orderBy: { createdAt: 'desc' } });
    const people = await this.prisma.user.findMany({ where: { id: { in: [...new Set(reports.flatMap((r) => [r.reporterId, r.resolvedById]).filter((x): x is string => !!x))] } }, select: { id: true, name: true } });
    const nameOf = (id?: string | null) => people.find((p) => p.id === id)?.name ?? null;
    return {
      ...paged(rows.map((r) => ({
        id: r.id, rating: r.rating, body: r.body, status: r.status, instructorReply: r.instructorReply, createdAt: r.createdAt,
        author: { id: r.user.id, name: r.user.name, email: r.user.email }, course: r.course,
        reports: reports.filter((x) => x.reviewId === r.id).map((x) => ({ id: x.id, reason: x.reason, reasonLabel: REASON_LABEL[x.reason as keyof typeof REASON_LABEL] ?? x.reason, details: x.details, status: x.status, createdAt: x.createdAt, reporter: nameOf(x.reporterId), resolvedBy: nameOf(x.resolvedById), resolvedAt: x.resolvedAt, resolution: x.resolution })),
      })), total, q),
      counts: { total: counts[0], hidden: counts[1], openReports: counts[2] },
    };
  }

  /** Hide or restore; the reason is kept in the audit log and closes open reports as actioned (hide) or dismissed (restore). */
  async setStatus(a: Actor, id: string, status: 'visible' | 'hidden', reason: string) {
    if (reason.trim().length < 5) throw badRequest('Give the reason (it is kept in the moderation history)', 'reason_required');
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw notFound('Review');
    await this.prisma.review.update({ where: { id }, data: { status } });
    await recalcRating(this.prisma, r.courseId);
    await this.prisma.reviewReport.updateMany({ where: { reviewId: id, status: 'open' }, data: { status: status === 'hidden' ? 'actioned' : 'dismissed', resolvedById: a.user.id, resolvedAt: new Date(), resolution: reason.trim() } });
    await this.audit.log({ actorId: a.user.id, action: `review.${status}`, targetType: 'review', targetId: id, ip: a.ip, meta: { reason: reason.trim(), courseId: r.courseId, rating: r.rating } });
    return { id, status };
  }

  /** Permanent: super admins only, with a reason; a snapshot of the review is kept in the audit log. */
  async remove(a: Actor, id: string, reason: string) {
    if (!a.user.roles.includes('super_admin')) throw forbidden('Only a super admin can delete reviews', 'super_admin_required');
    if (reason.trim().length < 5) throw badRequest('Give the reason (it is kept in the moderation history)', 'reason_required');
    const r = await this.prisma.review.findUnique({ where: { id } });
    if (!r) throw notFound('Review');
    await this.prisma.$transaction([
      this.prisma.reviewReport.updateMany({ where: { reviewId: id, status: 'open' }, data: { status: 'actioned', resolvedById: a.user.id, resolvedAt: new Date(), resolution: `Deleted: ${reason.trim()}` } }),
      this.prisma.review.delete({ where: { id } }),
    ]);
    await recalcRating(this.prisma, r.courseId);
    await this.audit.log({ actorId: a.user.id, action: 'review.deleted', targetType: 'review', targetId: id, ip: a.ip, meta: { reason: reason.trim(), snapshot: { courseId: r.courseId, userId: r.userId, rating: r.rating, body: r.body, createdAt: r.createdAt } } });
    return { id, deleted: true };
  }

  async dismiss(a: Actor, reportId: string, note: string) {
    if (note.trim().length < 3) throw badRequest('Add a short note', 'note_required');
    const rep = await this.prisma.reviewReport.findUnique({ where: { id: reportId } });
    if (!rep || rep.status !== 'open') throw notFound('Open report');
    await this.prisma.reviewReport.update({ where: { id: reportId }, data: { status: 'dismissed', resolvedById: a.user.id, resolvedAt: new Date(), resolution: note.trim() } });
    await this.audit.log({ actorId: a.user.id, action: 'review.report_dismissed', targetType: 'review', targetId: rep.reviewId, ip: a.ip, meta: { reportId, note: note.trim() } });
    return { id: reportId, status: 'dismissed' };
  }

  /** What an instructor sees about their own reports. */
  async myReports(userId: string) {
    const rows = await this.prisma.reviewReport.findMany({ where: { reporterId: userId }, orderBy: { createdAt: 'desc' }, take: 200 });
    return { items: rows.map((r) => ({ id: r.id, reviewId: r.reviewId, reason: r.reason, status: r.status, resolution: r.resolution, createdAt: r.createdAt })) };
  }
}
