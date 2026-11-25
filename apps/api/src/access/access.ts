import type { Prisma } from '../generated/prisma/client';

/**
 * One-year course access (owner 2026-11-25; docs/ACCESS_AND_REFUNDS.md). A purchase gives 12 calendar months from the
 * payment. Renewal is buying again at the current price (no automatic charges): within the last 30 days it adds a year
 * after the current end, after expiry a year from the renewal. Progress is never deleted.
 */
export const ACCESS_MONTHS = 12;
/** Renewal can be bought this many days before access ends (and any time after). */
export const RENEW_WINDOW_DAYS = 30;
const DAY = 86_400_000;

export function addMonths(d: Date, months = ACCESS_MONTHS): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

type EnrollmentLike = { revokedAt: Date | null; accessExpiresAt: Date | null };
export type AccessState = 'active' | 'expiring' | 'expired' | 'revoked';

export function accessState(e: EnrollmentLike, now = new Date()): AccessState {
  if (e.revokedAt) return 'revoked';
  if (!e.accessExpiresAt) return 'active';
  if (e.accessExpiresAt <= now) return 'expired';
  return e.accessExpiresAt.getTime() - now.getTime() <= RENEW_WINDOW_DAYS * DAY ? 'expiring' : 'active';
}
export const hasAccess = (e: EnrollmentLike | null | undefined, now = new Date()) => !!e && !e.revokedAt && (!e.accessExpiresAt || e.accessExpiresAt > now);
export const daysLeft = (expiresAt: Date | null, now = new Date()) => (expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY)) : null);

/** Enrolments that stop someone buying the course again: access in force and not yet in the renewal window. */
export function blockingEnrollmentWhere(now = new Date()): Prisma.EnrollmentWhereInput {
  return { revokedAt: null, OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: new Date(now.getTime() + RENEW_WINDOW_DAYS * DAY) } }] };
}
/** Enrolments with access in force right now. */
export function activeEnrollmentWhere(now = new Date()): Prisma.EnrollmentWhereInput {
  return { revokedAt: null, OR: [{ accessExpiresAt: null }, { accessExpiresAt: { gt: now } }] };
}

/**
 * Grants (or renews) a year of access for one paid order line inside the fulfilment transaction.
 * Returns whether this is a new student for the course (for studentCount).
 */
export async function grantYear(tx: Prisma.TransactionClient, a: { userId: string; courseId: string; orderLineId: string; paidAt: Date; free: boolean }) {
  const key = { userId_courseId: { userId: a.userId, courseId: a.courseId } };
  const existing = await tx.enrollment.findUnique({ where: key });
  const source = a.free ? ('free' as const) : ('purchase' as const);
  if (a.free) {
    // Free courses: no expiry, nothing to renew.
    if (!existing) { await tx.enrollment.create({ data: { ...a2(a), source } }); return { newStudent: true, kind: 'free' as const }; }
    if (existing.revokedAt) { await tx.enrollment.update({ where: key, data: { revokedAt: null, orderLineId: a.orderLineId, source, accessExpiresAt: null } }); return { newStudent: true, kind: 'free' as const }; }
    return { newStudent: false, kind: 'none' as const };
  }
  const active = existing && hasAccess(existing, a.paidAt);
  if (existing && !existing.revokedAt && !existing.accessExpiresAt) return { newStudent: false, kind: 'none' as const }; // unlimited grant already
  // Early renewal continues after the current end; otherwise the year starts now.
  const startsAt = active && existing!.accessExpiresAt ? existing!.accessExpiresAt : a.paidAt;
  const endsAt = addMonths(startsAt);
  await tx.accessPeriod.create({ data: { userId: a.userId, courseId: a.courseId, orderLineId: a.orderLineId, startsAt, endsAt } });
  if (!existing) {
    await tx.enrollment.create({ data: { ...a2(a), source, accessExpiresAt: endsAt } });
    return { newStudent: true, kind: 'new' as const, endsAt };
  }
  await tx.enrollment.update({ where: key, data: { revokedAt: null, orderLineId: a.orderLineId, source, accessExpiresAt: endsAt, remindersSent: [] } });
  return { newStudent: !!existing.revokedAt, kind: existing.revokedAt ? ('new' as const) : ('renewal' as const), endsAt };
}
const a2 = (a: { userId: string; courseId: string; orderLineId: string }) => ({ userId: a.userId, courseId: a.courseId, orderLineId: a.orderLineId });

/**
 * A refunded line gives back only its own year: the enrolment ends at the latest remaining period, or is revoked when
 * none is left. Returns true when the student lost the course entirely.
 */
export async function revokeYear(tx: Prisma.TransactionClient, orderLineId: string, userId: string, courseId: string, now = new Date()) {
  await tx.accessPeriod.updateMany({ where: { orderLineId, revokedAt: null }, data: { revokedAt: now } });
  const key = { userId_courseId: { userId, courseId } };
  const e = await tx.enrollment.findUnique({ where: key });
  if (!e || e.revokedAt) return false;
  const left = await tx.accessPeriod.findMany({ where: { userId, courseId, revokedAt: null }, orderBy: { endsAt: 'desc' } });
  // Enrolments without periods (granted by this line before periods existed, or a free line) end with the line.
  if (!left.length) {
    if (e.orderLineId !== orderLineId && !e.accessExpiresAt) return false; // an unrelated unlimited grant stays
    await tx.enrollment.update({ where: key, data: { revokedAt: now } });
    return true;
  }
  await tx.enrollment.update({ where: key, data: { accessExpiresAt: left[0].endsAt, orderLineId: left[0].orderLineId } });
  return false;
}
