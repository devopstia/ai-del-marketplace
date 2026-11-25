import { Injectable } from '@nestjs/common';
import { createHash, randomInt } from 'node:crypto';
import type { Response } from 'express';
import type { Prisma } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import type { Actor, AppRequest, AuthUser } from '../common/auth-context';
import { AppError, badRequest, conflict, forbidden, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { can } from '../common/permissions';
import { PrismaService, type Tx } from '../common/prisma.service';
import { SettingsService } from '../common/settings.service';
import { page, paged, randomToken } from '../common/util';
import { env } from '../config/env';
import { addMonths, hasAccess } from '../access/access';
import { allocateFee, splitLine } from '../commerce/money';
import { AuthService } from '../auth/auth.service';
import { SignInService } from '../auth/signin.service';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const DAY = 86_400_000;
export const INVITE_TTL_DAYS = 7;
const CODE_TTL_MS = 15 * 60_000;
/** Instructors may ask for up to 12 months (the marketplace policy); a super admin may set up to 5 years. */
const MAX_MONTHS = { instructor: 12, super_admin: 60 };
const OPEN = ['pending', 'needs_info'];

export interface ItemInput { courseId: string; expiresAt?: string }
export interface PaymentInput {
  method: 'bank_transfer' | 'mobile_money' | 'cash' | 'paypal' | 'other';
  reference: string;
  currency: string;
  /** Amount as entered, in major units of `currency` (e.g. "50000" XAF, "120.50" USD). */
  amount: string;
  /** USD for 1 unit of `currency`; "1" for USD. */
  usdRate: string;
  /** Verified processing fees in USD cents (0 when none applied). */
  feeUsdCents: number;
  notes?: string;
  /** Gross USD cents per course line; must add up to the payment's USD value. */
  allocations: { itemId?: string; courseId?: string; grossUsdCents: number }[];
  verify?: boolean;
}

type Role = 'instructor' | 'super_admin';
const roleOf = (u: AuthUser): Role | null => (u.roles.includes('super_admin') ? 'super_admin' : u.roles.includes('instructor') ? 'instructor' : null);
const ref = (n: number) => `ME-${n}`;

/** Minor-unit digits of a currency (USD 2, XAF 0, KWD 3). */
export function currencyDigits(currency: string) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { throw badRequest('Unknown currency code', 'invalid_currency'); }
}
/** Exact USD cents from an amount and a documented rate, no float drift: both are decimals as strings. */
export function toUsdCents(amount: string, usdRate: string) {
  const dec = (s: string) => {
    if (!/^\d+(\.\d+)?$/.test(s.trim())) throw badRequest('Amounts and rates are plain numbers like 120.50', 'invalid_number');
    const [i, f = ''] = s.trim().split('.');
    return { n: BigInt(i + f), d: f.length };
  };
  const a = dec(amount), r = dec(usdRate);
  const scale = 10n ** BigInt(a.d + r.d);
  // cents = amount × rate × 100, rounded half up
  const num = a.n * r.n * 100n;
  const cents = (num * 2n + scale) / (scale * 2n);
  if (cents > 100_000_000n) throw badRequest('Amount too large', 'invalid_number');
  return Number(cents);
}

@Injectable()
export class ManualEnrollmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly settings: SettingsService,
    private readonly auth: AuthService,
    private readonly signIn: SignInService,
  ) {}

  // ---------- options ----------
  /** Courses this person may assign: an instructor's own published courses, every published course for a super admin. */
  async courseOptions(u: AuthUser, q?: string) {
    const role = roleOf(u);
    if (!role) throw forbidden();
    const rows = await this.prisma.course.findMany({
      where: { status: 'published', ...(role === 'instructor' ? { instructorId: u.id } : {}), ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}) },
      orderBy: { title: 'asc' },
      take: 200,
      select: { id: true, slug: true, title: true, priceCents: true, currency: true, instructor: { select: { id: true, name: true } } },
    });
    return { items: rows };
  }

  /** Does this email have an account already? Instructors learn only the name on an exact email match. */
  async lookup(u: AuthUser, emailRaw: string) {
    if (!roleOf(u)) throw forbidden();
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true, name: true, status: true, enrollments: { where: { revokedAt: null }, select: { courseId: true, accessExpiresAt: true, revokedAt: true } } } });
    if (!user) return { exists: false };
    return { exists: true, name: user.name, suspended: user.status !== 'active', activeCourseIds: user.enrollments.filter((e) => hasAccess(e)).map((e) => e.courseId) };
  }

  // ---------- create ----------
  async create(a: Actor, input: { studentEmail: string; studentName: string; items: ItemInput[]; note?: string; complimentary?: boolean; complimentaryReason?: string; payment?: PaymentInput; activate?: boolean }) {
    const role = roleOf(a.user);
    if (!role) throw forbidden();
    const email = input.studentEmail.trim().toLowerCase();
    const ids = input.items.map((i) => i.courseId);
    if (!ids.length) throw badRequest('Choose at least one course', 'no_courses');
    if (new Set(ids).size !== ids.length) throw badRequest('A course is listed twice', 'duplicate_course');
    const courses = await this.prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, status: true, instructorId: true, priceCents: true } });
    for (const id of ids) {
      const c = courses.find((x) => x.id === id);
      if (!c || c.status !== 'published') throw badRequest('Only published courses can be assigned', 'course_unavailable');
      // The backend check: an instructor can never include someone else's course, whatever the request says.
      if (role === 'instructor' && c.instructorId !== a.user.id) throw forbidden('You can only request enrollment in your own courses', 'not_your_course');
    }
    const now = Date.now();
    const items = input.items.map((i) => {
      const expiresAt = i.expiresAt ? new Date(i.expiresAt) : addMonths(new Date());
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now + DAY) throw badRequest('Each expiration date must be at least one day ahead', 'invalid_expiry');
      if (expiresAt > addMonths(new Date(), MAX_MONTHS[role])) throw badRequest(role === 'instructor' ? 'Instructors can request up to 12 months of access (a super admin can extend it).' : 'Access can be set up to 5 years ahead', 'expiry_too_far');
      const c = courses.find((x) => x.id === i.courseId)!;
      return { courseId: c.id, instructorId: c.instructorId, listPriceCents: c.priceCents, expiresAt };
    });
    const student = await this.prisma.user.findUnique({ where: { email }, select: { id: true, name: true, status: true, enrollments: { select: { courseId: true, accessExpiresAt: true, revokedAt: true } } } });
    if (student?.status === 'suspended') throw conflict('This account is suspended', 'account_suspended');
    const already = student?.enrollments.filter((e) => ids.includes(e.courseId) && hasAccess(e)).map((e) => courses.find((c) => c.id === e.courseId)!.title) ?? [];
    if (already.length) throw conflict(`Already enrolled with active access: ${already.join(', ')}`, 'already_enrolled');
    const dup = await this.prisma.manualEnrollmentItem.findFirst({ where: { courseId: { in: ids }, request: { studentEmail: email, status: { in: OPEN } } }, include: { request: { select: { number: true } } } });
    if (dup) throw conflict(`An open request (${ref(dup.request.number)}) already includes one of these courses for this student`, 'duplicate_request');

    const direct = role === 'super_admin' && input.activate !== false;
    if (direct && input.complimentary && (input.complimentaryReason?.trim().length ?? 0) < 5) throw badRequest('Say why this enrollment is complimentary', 'reason_required');
    if (direct && !input.complimentary && !input.payment) throw badRequest('Record the verified payment, or mark the enrollment complimentary with a reason', 'payment_required');
    const req = await this.prisma.manualEnrollment.create({
      data: {
        studentEmail: email, studentName: student?.name ?? input.studentName.trim(), studentId: student?.id ?? null,
        requestedById: a.user.id, requestedByRole: role, note: input.note?.trim() ?? '',
        items: { create: items },
      },
      include: { items: true },
    });
    await this.audit.log({ actorId: a.user.id, action: 'manual_enrollment.created', targetType: 'manual_enrollment', targetId: req.id, ip: a.ip, meta: { ref: ref(req.number), courses: ids, existingStudent: !!student } });

    if (role === 'instructor') {
      const staff = await this.prisma.user.findMany({ where: { roles: { has: 'super_admin' }, status: 'active' }, select: { email: true, name: true } });
      for (const s of staff) await this.jobs.sendEmail({ to: s.email, template: 'manual-enrollment-submitted', data: { staffName: s.name, ref: ref(req.number), instructor: a.user.name, student: req.studentName, courses: courses.map((c) => c.title), link: `${env().WEB_URL}/admin/enrollments` } });
      await this.jobs.sendEmail({ to: a.user.email, template: 'manual-enrollment-request-received', data: { name: a.user.name, ref: ref(req.number), student: req.studentName, courses: courses.map((c) => c.title), link: `${env().WEB_URL}/studio/enrollments` } });
      return this.detail(a.user, req.id);
    }
    // Super admin: direct enrollment, no second approval, but the payment or the complimentary reason is still recorded.
    try {
      if (input.payment) await this.recordPayment(a, req.id, { ...input.payment, verify: input.payment.verify ?? true });
      if (direct) return await this.approve(a, req.id, { complimentary: input.complimentary, complimentaryReason: input.complimentaryReason });
    } catch (e) {
      // All or nothing: a direct enrollment that can't be completed leaves no half-made request behind.
      await this.prisma.manualEnrollment.delete({ where: { id: req.id } }).catch(() => {});
      throw e;
    }
    return this.detail(a.user, req.id);
  }

  /** The requesting instructor answers "needs more information" (note and dates); it goes back to pending. */
  async resubmit(a: Actor, id: string, input: { note?: string; expiries?: Record<string, string> }) {
    const r = await this.load(id);
    if (r.requestedById !== a.user.id) throw notFound('Request');
    if (r.status !== 'needs_info') throw conflict('Only a request waiting for information can be sent again', 'not_waiting');
    await this.prisma.$transaction(async (tx) => {
      for (const [itemId, d] of Object.entries(input.expiries ?? {})) {
        const it = r.items.find((x) => x.id === itemId);
        const when = new Date(d);
        if (!it || Number.isNaN(when.getTime()) || when > addMonths(new Date(), MAX_MONTHS.instructor) || when.getTime() < Date.now() + DAY) throw badRequest('Invalid expiration date', 'invalid_expiry');
        await tx.manualEnrollmentItem.update({ where: { id: itemId }, data: { expiresAt: when } });
      }
      await tx.manualEnrollment.update({ where: { id }, data: { status: 'pending', note: input.note?.trim() ? `${r.note}\n\n${input.note.trim()}`.trim() : r.note } });
    });
    await this.audit.log({ actorId: a.user.id, action: 'manual_enrollment.resubmitted', targetType: 'manual_enrollment', targetId: id, ip: a.ip });
    return this.detail(a.user, id);
  }

  // ---------- payments ----------
  async recordPayment(a: Actor, requestId: string, p: PaymentInput) {
    this.superOnly(a.user);
    const r = await this.load(requestId);
    if (r.status === 'rejected' || r.status === 'cancelled') throw conflict('This request is closed', 'closed');
    // Same transaction reference twice = the same money: refuse before anything else (safe retries, no double income).
    const reference = p.reference.trim();
    const exists = await this.prisma.externalPayment.findUnique({ where: { method_reference: { method: p.method, reference } } });
    if (exists) throw conflict('A payment with this method and reference is already recorded', 'duplicate_payment');
    const digits = currencyDigits(p.currency.toUpperCase());
    if ((p.amount.split('.')[1]?.length ?? 0) > digits) throw badRequest(`${p.currency} amounts have ${digits} decimal places`, 'invalid_number');
    const gross = toUsdCents(p.amount, p.currency.toUpperCase() === 'USD' ? '1' : p.usdRate);
    if (gross <= 0) throw badRequest('The amount must be more than zero', 'invalid_number');
    if (!Number.isInteger(p.feeUsdCents) || p.feeUsdCents < 0 || p.feeUsdCents > gross) throw badRequest('Fees must be between zero and the amount', 'invalid_fee');
    // Allocation: the super admin decides how the payment is shared between the courses (never assumed from list prices).
    const alloc = p.allocations.map((x) => {
      const it = r.items.find((i) => i.id === x.itemId || i.courseId === x.courseId);
      if (!it) throw badRequest('An allocation names a course that is not in this request', 'invalid_allocation');
      if (!Number.isInteger(x.grossUsdCents) || x.grossUsdCents < 0) throw badRequest('Allocations are whole cents', 'invalid_allocation');
      return { item: it, gross: x.grossUsdCents };
    });
    if (new Set(alloc.map((x) => x.item.id)).size !== alloc.length) throw badRequest('A course is allocated twice', 'invalid_allocation');
    const sum = alloc.reduce((n, x) => n + x.gross, 0);
    if (sum !== gross) throw badRequest(`The allocations add up to ${(sum / 100).toFixed(2)} USD but the payment is ${(gross / 100).toFixed(2)} USD`, 'allocation_mismatch', { grossUsdCents: gross, allocatedUsdCents: sum });
    const fees = allocateFee(p.feeUsdCents, alloc.map((x) => x.gross));
    const defaultBps = await this.settings.commissionBps();
    const profiles = await this.prisma.instructorProfile.findMany({ where: { userId: { in: alloc.map((x) => x.item.instructorId) } }, select: { userId: true, isPlatform: true, commissionBps: true } });
    const lines = alloc.map((x, i) => {
      const prof = profiles.find((pp) => pp.userId === x.item.instructorId);
      const bps = prof?.isPlatform ? 10000 : (prof?.commissionBps ?? defaultBps);
      const s = splitLine(x.gross, fees[i]!, bps);
      return { itemId: x.item.id, instructorId: x.item.instructorId, grossUsdCents: x.gross, feeUsdCents: s.feeCents, netUsdCents: s.netCents, instructorCents: s.instructorShareCents, platformCents: s.platformCents };
    });
    const pay = await this.prisma.externalPayment.create({
      data: {
        requestId, method: p.method, reference, currency: p.currency.toUpperCase(), amountMinor: Math.round(Number(p.amount) * 10 ** digits), usdRate: p.currency.toUpperCase() === 'USD' ? '1' : p.usdRate,
        grossUsdCents: gross, feeUsdCents: p.feeUsdCents, netUsdCents: gross - p.feeUsdCents, notes: p.notes?.trim() ?? '', recordedById: a.user.id,
        ...(p.verify ? { status: 'verified', verifiedById: a.user.id, verifiedAt: new Date() } : {}),
        allocations: { create: lines },
      },
    });
    await this.audit.log({ actorId: a.user.id, action: p.verify ? 'external_payment.recorded_verified' : 'external_payment.recorded', targetType: 'manual_enrollment', targetId: requestId, ip: a.ip, meta: { paymentId: pay.id, method: p.method, currency: pay.currency, grossUsdCents: gross, feeUsdCents: p.feeUsdCents, lines } });
    return this.detail(a.user, requestId);
  }

  async verifyPayment(a: Actor, paymentId: string) {
    this.superOnly(a.user);
    const p = await this.prisma.externalPayment.findUnique({ where: { id: paymentId } });
    if (!p) throw notFound('Payment');
    if (p.status !== 'verified') {
      await this.prisma.externalPayment.update({ where: { id: paymentId }, data: { status: 'verified', verifiedById: a.user.id, verifiedAt: new Date() } });
      await this.audit.log({ actorId: a.user.id, action: 'external_payment.verified', targetType: 'manual_enrollment', targetId: p.requestId, ip: a.ip, meta: { paymentId } });
    }
    return this.detail(a.user, p.requestId);
  }

  /** Payouts of manual earnings happen outside Stripe; only a super admin records each step. */
  async setPayout(a: Actor, allocationId: string, status: 'payout_pending' | 'payout_completed', reference?: string) {
    this.superOnly(a.user);
    const al = await this.prisma.externalPaymentAllocation.findUnique({ where: { id: allocationId }, include: { payment: true } });
    if (!al) throw notFound('Allocation');
    if (al.payment.status !== 'verified') throw conflict('Verify the payment first', 'payment_not_verified');
    if (status === 'payout_completed' && !reference?.trim()) throw badRequest('Add the payout reference (bank or transfer id)', 'reference_required');
    await this.prisma.externalPaymentAllocation.update({ where: { id: allocationId }, data: { payoutStatus: status, payoutReference: reference?.trim() || al.payoutReference, payoutAt: status === 'payout_completed' ? new Date() : null, payoutById: a.user.id } });
    await this.audit.log({ actorId: a.user.id, action: `external_payment.${status}`, targetType: 'manual_enrollment', targetId: al.payment.requestId, ip: a.ip, meta: { allocationId, reference: reference ?? null, instructorCents: al.instructorCents } });
    return this.detail(a.user, al.payment.requestId);
  }

  // ---------- decisions ----------
  /**
   * Activates paid access: only with a verified payment covering every course, or an explicit complimentary reason.
   * Existing account: enrollments now. New student: an invitation (the courses activate when they create the account).
   * Safe to retry: already-activated lines are skipped and the same emails are not sent twice.
   */
  async approve(a: Actor, id: string, input: { complimentary?: boolean; complimentaryReason?: string; expiries?: Record<string, string> } = {}) {
    this.superOnly(a.user);
    const r = await this.load(id);
    if (r.status === 'approved') return this.detail(a.user, id);
    if (!OPEN.includes(r.status)) throw conflict('This request is closed', 'closed');
    const comp = !!input.complimentary;
    if (comp && (input.complimentaryReason?.trim().length ?? 0) < 5) throw badRequest('Say why this enrollment is complimentary', 'reason_required');
    if (!comp) {
      const covered = new Set(r.payments.filter((p) => p.status === 'verified').flatMap((p) => p.allocations.map((x) => x.itemId)));
      const missing = r.items.filter((i) => !covered.has(i.id));
      if (missing.length) throw conflict('Record and verify the payment for every course first, or mark the enrollment complimentary with a reason', 'payment_not_verified');
    }
    const student = await this.prisma.user.findUnique({ where: { email: r.studentEmail } });
    if (student?.status === 'suspended') throw conflict('This account is suspended', 'account_suspended');
    await this.prisma.$transaction(async (tx) => {
      for (const [itemId, d] of Object.entries(input.expiries ?? {})) {
        const when = new Date(d);
        if (!r.items.some((i) => i.id === itemId) || Number.isNaN(when.getTime()) || when.getTime() < Date.now() + DAY) throw badRequest('Invalid expiration date', 'invalid_expiry');
        await tx.manualEnrollmentItem.update({ where: { id: itemId }, data: { expiresAt: when } });
      }
      // Status change first, guarded: a second concurrent approval finds nothing to update and stops.
      const ok = await tx.manualEnrollment.updateMany({ where: { id, status: { in: OPEN } }, data: { status: 'approved', decidedById: a.user.id, decidedAt: new Date(), complimentary: comp, complimentaryReason: comp ? input.complimentaryReason!.trim() : null, studentId: student?.id ?? null } });
      if (!ok.count) throw conflict('This request was already decided', 'closed');
      if (student) await this.activate(tx, id, student.id);
    });
    await this.audit.log({ actorId: a.user.id, action: 'manual_enrollment.approved', targetType: 'manual_enrollment', targetId: id, ip: a.ip, meta: { ref: ref(r.number), complimentary: comp, reason: comp ? input.complimentaryReason : null, existingStudent: !!student } });
    const fresh = await this.load(id);
    const titles = await this.titles(fresh.items.map((i) => i.courseId));
    if (student) {
      await this.jobs.sendEmail({ to: student.email, template: fresh.items.length > 1 ? 'courses-assigned' : 'course-access-activated', data: { name: student.name, courses: fresh.items.map((i) => ({ title: titles[i.courseId], expiresAt: i.expiresAt })), link: `${env().WEB_URL}/student/courses` } });
    } else {
      await this.newInvitation(a, fresh, true);
    }
    if (fresh.requestedByRole === 'instructor') {
      const inst = await this.prisma.user.findUnique({ where: { id: fresh.requestedById }, select: { email: true, name: true } });
      if (inst) await this.jobs.sendEmail({ to: inst.email, template: 'manual-enrollment-approved', data: { name: inst.name, ref: ref(fresh.number), student: fresh.studentName, link: `${env().WEB_URL}/studio/enrollments` } });
    }
    return this.detail(a.user, id);
  }

  async decide(a: Actor, id: string, decision: 'rejected' | 'needs_info', note: string) {
    this.superOnly(a.user);
    if (note.trim().length < 3) throw badRequest('Add a note for the instructor', 'note_required');
    const r = await this.load(id);
    const ok = await this.prisma.manualEnrollment.updateMany({ where: { id, status: { in: OPEN } }, data: { status: decision, reviewNote: note.trim(), decidedById: a.user.id, decidedAt: new Date() } });
    if (!ok.count) throw conflict('This request is closed', 'closed');
    await this.audit.log({ actorId: a.user.id, action: `manual_enrollment.${decision}`, targetType: 'manual_enrollment', targetId: id, ip: a.ip, meta: { note: note.trim() } });
    const inst = await this.prisma.user.findUnique({ where: { id: r.requestedById }, select: { email: true, name: true } });
    if (inst && r.requestedByRole === 'instructor') await this.jobs.sendEmail({ to: inst.email, template: decision === 'rejected' ? 'manual-enrollment-rejected' : 'manual-enrollment-needs-info', data: { name: inst.name, ref: ref(r.number), student: r.studentName, note: note.trim(), link: `${env().WEB_URL}/studio/enrollments` } });
    return this.detail(a.user, id);
  }

  /** Creates enrollments for the approved lines (keeps a later end date if the student already has one; progress is never touched). */
  private async activate(tx: Tx, requestId: string, userId: string) {
    const items = await tx.manualEnrollmentItem.findMany({ where: { requestId, activatedAt: null, revokedAt: null } });
    const now = new Date();
    for (const it of items) {
      const key = { userId_courseId: { userId, courseId: it.courseId } };
      const existing = await tx.enrollment.findUnique({ where: key });
      const keepUnlimited = existing && !existing.revokedAt && !existing.accessExpiresAt;
      const end = existing && hasAccess(existing, now) && existing.accessExpiresAt && existing.accessExpiresAt > it.expiresAt ? existing.accessExpiresAt : it.expiresAt;
      await tx.accessPeriod.create({ data: { userId, courseId: it.courseId, manualItemId: it.id, startsAt: now, endsAt: it.expiresAt } });
      if (!existing) await tx.enrollment.create({ data: { userId, courseId: it.courseId, source: 'manual', accessExpiresAt: end } });
      else if (!keepUnlimited) await tx.enrollment.update({ where: key, data: { revokedAt: null, source: 'manual', accessExpiresAt: end, remindersSent: [] } });
      await tx.manualEnrollmentItem.update({ where: { id: it.id }, data: { activatedAt: now } });
    }
    await tx.manualEnrollment.update({ where: { id: requestId }, data: { studentId: userId } });
  }

  // ---------- expiry ----------
  async extend(a: Actor, itemId: string, expiresAt: string, reason: string) {
    this.superOnly(a.user);
    const it = await this.prisma.manualEnrollmentItem.findUnique({ where: { id: itemId }, include: { request: true } });
    if (!it) throw notFound('Course line');
    const when = new Date(expiresAt);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() + DAY || when > addMonths(new Date(), MAX_MONTHS.super_admin)) throw badRequest('Choose a date between tomorrow and 5 years ahead', 'invalid_expiry');
    if (reason.trim().length < 3) throw badRequest('Say why the date changes', 'reason_required');
    const before = it.expiresAt;
    await this.prisma.$transaction(async (tx) => {
      await tx.manualEnrollmentItem.update({ where: { id: itemId }, data: { expiresAt: when } });
      if (it.activatedAt && it.request.studentId) {
        await tx.accessPeriod.updateMany({ where: { manualItemId: itemId }, data: { endsAt: when } });
        await tx.enrollment.update({ where: { userId_courseId: { userId: it.request.studentId, courseId: it.courseId } }, data: { accessExpiresAt: when, revokedAt: null, remindersSent: [] } });
      }
    });
    await this.audit.log({ actorId: a.user.id, action: 'manual_enrollment.expiry_changed', targetType: 'manual_enrollment', targetId: it.requestId, ip: a.ip, meta: { itemId, before, after: when, reason: reason.trim() } });
    if (it.activatedAt && it.request.studentId) {
      const s = await this.prisma.user.findUnique({ where: { id: it.request.studentId }, select: { email: true, name: true } });
      const t = await this.titles([it.courseId]);
      if (s && when > before) await this.jobs.sendEmail({ to: s.email, template: 'course-access-extended', data: { name: s.name, course: t[it.courseId], expiresAt: when, link: `${env().WEB_URL}/student/courses` } });
    }
    return this.detail(a.user, it.requestId);
  }

  async revokeItem(a: Actor, itemId: string, reason: string) {
    this.superOnly(a.user);
    const it = await this.prisma.manualEnrollmentItem.findUnique({ where: { id: itemId }, include: { request: true } });
    if (!it) throw notFound('Course line');
    if (reason.trim().length < 3) throw badRequest('Say why access is revoked', 'reason_required');
    await this.prisma.$transaction(async (tx) => {
      await tx.manualEnrollmentItem.update({ where: { id: itemId }, data: { revokedAt: new Date() } });
      await tx.accessPeriod.updateMany({ where: { manualItemId: itemId, revokedAt: null }, data: { revokedAt: new Date() } });
      if (it.activatedAt && it.request.studentId) {
        // Like a refund: the student keeps any other period (a purchase); otherwise access ends. Progress stays.
        const other = await tx.accessPeriod.findFirst({ where: { userId: it.request.studentId, courseId: it.courseId, revokedAt: null, endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' } });
        await tx.enrollment.update({ where: { userId_courseId: { userId: it.request.studentId, courseId: it.courseId } }, data: other ? { accessExpiresAt: other.endsAt } : { revokedAt: new Date() } });
      }
    });
    await this.audit.log({ actorId: a.user.id, action: 'manual_enrollment.access_revoked', targetType: 'manual_enrollment', targetId: it.requestId, ip: a.ip, meta: { itemId, reason: reason.trim() } });
    return this.detail(a.user, it.requestId);
  }

  // ---------- invitations ----------
  /** Super admin always; the requesting instructor only once the request is approved (never to bypass approval). */
  private async assertInviteRights(u: AuthUser, r: { requestedById: string; status: string }) {
    if (u.roles.includes('super_admin')) return;
    if (r.requestedById !== u.id) throw notFound('Request');
    if (r.status !== 'approved') throw forbidden('The invitation is available once DEL approves the request', 'not_approved');
  }

  private async newInvitation(a: Actor, r: { id: string; studentEmail: string; studentName: string; number: number; items: { courseId: string; expiresAt: Date }[] }, send: boolean) {
    const raw = randomToken(32);
    await this.prisma.$transaction([
      this.prisma.invitation.updateMany({ where: { requestId: r.id, status: 'pending' }, data: { status: 'revoked', revokedAt: new Date() } }),
      this.prisma.invitation.create({ data: { tokenHash: sha256(raw), requestId: r.id, email: r.studentEmail, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * DAY), createdById: a.user.id } }),
    ]);
    const link = `${env().WEB_URL}/invite/${raw}`;
    if (send) {
      const titles = await this.titles(r.items.map((i) => i.courseId));
      await this.jobs.sendEmail({ to: r.studentEmail, template: 'student-invitation', data: { name: r.studentName, courses: r.items.map((i) => ({ title: titles[i.courseId], expiresAt: i.expiresAt })), link, expiresInDays: INVITE_TTL_DAYS } });
    }
    await this.audit.log({ actorId: a.user.id, action: send ? 'invitation.sent' : 'invitation.link_created', targetType: 'manual_enrollment', targetId: r.id, ip: a.ip, meta: { ref: ref(r.number) } });
    return link;
  }

  /** A fresh link to copy (WhatsApp, SMS): earlier links stop working. */
  async copyLink(a: Actor, requestId: string) {
    const r = await this.load(requestId);
    await this.assertInviteRights(a.user, r);
    if (r.studentId) throw conflict('This student already has an account; their courses are active', 'has_account');
    if (r.status !== 'approved') throw conflict('Approve the request first', 'not_approved');
    return { link: await this.newInvitation(a, r, false), expiresInDays: INVITE_TTL_DAYS };
  }

  async resend(a: Actor, requestId: string) {
    const r = await this.load(requestId);
    await this.assertInviteRights(a.user, r);
    if (r.studentId) throw conflict('This student already has an account; their courses are active', 'has_account');
    if (r.status !== 'approved') throw conflict('Approve the request first', 'not_approved');
    await this.newInvitation(a, r, true);
    return this.detail(a.user, requestId);
  }

  async revokeInvitation(a: Actor, requestId: string) {
    this.superOnly(a.user);
    const n = await this.prisma.invitation.updateMany({ where: { requestId, status: 'pending' }, data: { status: 'revoked', revokedAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: 'invitation.revoked', targetType: 'manual_enrollment', targetId: requestId, ip: a.ip, meta: { count: n.count } });
    return this.detail(a.user, requestId);
  }

  private async invitation(raw: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { tokenHash: sha256(raw) }, include: { request: { include: { items: true } } } });
    if (!inv) throw new AppError(404, 'invitation_invalid', 'This invitation link is not valid. Ask for a new one.');
    if (inv.status === 'pending' && inv.expiresAt < new Date()) {
      await this.prisma.invitation.update({ where: { id: inv.id }, data: { status: 'expired' } });
      throw new AppError(410, 'invitation_expired', 'This invitation has expired. Ask DevOps Easy Learning for a new link.');
    }
    if (inv.status === 'expired') throw new AppError(410, 'invitation_expired', 'This invitation has expired. Ask DevOps Easy Learning for a new link.');
    if (inv.status === 'revoked') throw new AppError(410, 'invitation_revoked', 'This link was replaced by a newer one or cancelled. Use the latest invitation.');
    if (inv.status === 'accepted') throw new AppError(409, 'invitation_used', 'This invitation was already used. Sign in to see your courses.');
    return inv;
  }

  /** What the invitation page shows: who it is for (masked email) and which courses. Opening it changes nothing. */
  async invitationInfo(raw: string) {
    const inv = await this.invitation(raw);
    const titles = await this.titles(inv.request.items.map((i) => i.courseId));
    const [local, domain] = inv.email.split('@');
    const masked = `${local!.slice(0, 2)}${'•'.repeat(Math.min(4, Math.max(1, local!.length - 2)))}@${domain}`;
    const exists = !!(await this.prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } }));
    return { email: masked, name: inv.request.studentName, expiresAt: inv.expiresAt, accountExists: exists, courses: inv.request.items.filter((i) => !i.revokedAt).map((i) => ({ title: titles[i.courseId], expiresAt: i.expiresAt })) };
  }

  /** Ownership check: a six-digit code sent to the invited address (15 minutes, 5 tries, 3 per hour). */
  async sendCode(raw: string) {
    const inv = await this.invitation(raw);
    if (inv.codeExpiresAt && inv.codeExpiresAt.getTime() - CODE_TTL_MS > Date.now() - 60_000) throw new AppError(429, 'too_many_requests', 'We sent a code less than a minute ago. Check your inbox and spam folder.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.invitation.update({ where: { id: inv.id }, data: { codeHash: sha256(`${inv.id}:${code}`), codeExpiresAt: new Date(Date.now() + CODE_TTL_MS), codeTries: 0 } });
    await this.jobs.sendEmail({ to: inv.email, template: 'invitation-code', data: { name: inv.request.studentName, code } });
    return { ok: true };
  }

  /** New student: proves the email with the code, sets a strong password, then sets up Google Authenticator (same flow as sign-up). */
  async accept(raw: string, input: { code: string; name: string; password: string }, req: AppRequest, res: Response, ip: string | null, userAgent: string | null) {
    const inv = await this.invitation(raw);
    if (await this.prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } })) throw conflict('An account with this email exists. Sign in, then open the invitation again.', 'email_taken');
    if (!inv.codeHash || !inv.codeExpiresAt || inv.codeExpiresAt < new Date()) throw badRequest('Ask for a code first (it is valid for 15 minutes)', 'code_expired');
    if (inv.codeTries >= 5) throw new AppError(429, 'too_many_attempts', 'Too many wrong codes. Ask for a new one.');
    if (sha256(`${inv.id}:${input.code.trim()}`) !== inv.codeHash) {
      await this.prisma.invitation.update({ where: { id: inv.id }, data: { codeTries: { increment: 1 } } });
      throw badRequest('That code is not right. Check the six digits in the email.', 'invalid_code');
    }
    await this.auth.assertStrong(input.password, { email: inv.email, name: input.name });
    const passwordHash = await this.auth.hashPassword(input.password);
    const user = await this.prisma.$transaction(async (tx) => {
      const taken = await tx.invitation.updateMany({ where: { id: inv.id, status: 'pending' }, data: { status: 'accepted', acceptedAt: new Date() } });
      if (!taken.count) throw conflict('This invitation was already used', 'invitation_used');
      const u = await tx.user.create({ data: { email: inv.email, name: input.name.trim() || inv.request.studentName, passwordHash, passwordChangedAt: new Date(), roles: ['student'], signupMethod: 'invitation', emailVerifiedAt: new Date() } });
      await tx.invitation.update({ where: { id: inv.id }, data: { acceptedUserId: u.id } });
      if (inv.request.status === 'approved') await this.activate(tx, inv.requestId, u.id);
      return u;
    });
    await this.audit.log({ actorId: user.id, action: 'invitation.accepted', targetType: 'manual_enrollment', targetId: inv.requestId, ip, meta: { userId: user.id } });
    return this.signIn.begin(user, 'password', req, res, { ip, userAgent }, { next: '/student/courses' });
  }

  /** Someone who already has an account: signed in as the invited address, the courses join their Student Studio. */
  async claim(u: AuthUser, raw: string, ip: string | null) {
    const inv = await this.invitation(raw);
    if (u.email.toLowerCase() !== inv.email) throw forbidden('This invitation is for a different email address. Sign in with the invited account.', 'wrong_account');
    await this.prisma.$transaction(async (tx) => {
      const taken = await tx.invitation.updateMany({ where: { id: inv.id, status: 'pending' }, data: { status: 'accepted', acceptedAt: new Date(), acceptedUserId: u.id } });
      if (!taken.count) throw conflict('This invitation was already used', 'invitation_used');
      if (inv.request.status === 'approved') await this.activate(tx, inv.requestId, u.id);
    });
    await this.audit.log({ actorId: u.id, action: 'invitation.claimed', targetType: 'manual_enrollment', targetId: inv.requestId, ip });
    return { ok: true };
  }

  // ---------- lists and detail ----------
  async list(u: AuthUser, q: { status?: string; instructorId?: string; courseId?: string; q?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
    const isSuper = u.roles.includes('super_admin') || can(u, 'enrollments.manage');
    if (!isSuper && !u.roles.includes('instructor')) throw forbidden();
    const where: Prisma.ManualEnrollmentWhereInput = {
      ...(isSuper ? {} : { requestedById: u.id }),
      ...(q.status === 'open' ? { status: { in: OPEN } } : q.status ? { status: q.status } : {}),
      ...(q.instructorId ? { items: { some: { instructorId: q.instructorId } } } : {}),
      ...(q.courseId ? { items: { some: { courseId: q.courseId } } } : {}),
      ...(q.from || q.to ? { createdAt: { gte: q.from, lte: q.to } } : {}),
      ...(q.q ? { OR: [{ studentEmail: { contains: q.q, mode: 'insensitive' } }, { studentName: { contains: q.q, mode: 'insensitive' } }, ...(/^ME-?\d+$/i.test(q.q) ? [{ number: Number(q.q.replace(/\D/g, '')) }] : [])] } : {}),
    };
    const [total, rows, counts] = await Promise.all([
      this.prisma.manualEnrollment.count({ where }),
      this.prisma.manualEnrollment.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q.page, q.pageSize), select: { id: true } }),
      this.prisma.manualEnrollment.groupBy({ by: ['status'], where: isSuper ? {} : { requestedById: u.id }, _count: true }),
    ]);
    const items = await Promise.all(rows.map((r) => this.detail(u, r.id, false)));
    return { ...paged(items, total, q), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
  }

  async detail(u: AuthUser, id: string, withHistory = true) {
    const r = await this.load(id);
    const isSuper = u.roles.includes('super_admin') || can(u, 'enrollments.manage');
    if (!isSuper && r.requestedById !== u.id) throw notFound('Request');
    const courses = await this.prisma.course.findMany({ where: { id: { in: r.items.map((i) => i.courseId) } }, select: { id: true, slug: true, title: true, instructor: { select: { id: true, name: true } } } });
    const people = await this.prisma.user.findMany({ where: { id: { in: [r.requestedById, r.decidedById, ...r.payments.flatMap((p) => [p.recordedById, p.verifiedById])].filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    const name = (x?: string | null) => (x ? people.find((p) => p.id === x)?.name ?? null : null);
    const inv = r.invitations.sort((a, b) => +b.createdAt - +a.createdAt)[0];
    const invStatus = r.studentId ? 'not_needed' : !inv ? 'none' : inv.status === 'pending' && inv.expiresAt < new Date() ? 'expired' : inv.status;
    const history = withHistory
      ? (await this.prisma.auditLog.findMany({ where: { targetType: 'manual_enrollment', targetId: id }, orderBy: { at: 'desc' }, take: 50, include: { actor: { select: { name: true } } } })).map((h) => ({ action: h.action, at: h.at, actor: h.actor?.name ?? null }))
      : undefined;
    return {
      id: r.id, ref: ref(r.number), status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
      student: { email: r.studentEmail, name: r.studentName, hasAccount: !!r.studentId },
      requestedBy: { id: r.requestedById, name: name(r.requestedById), role: r.requestedByRole },
      note: r.note, reviewNote: r.reviewNote, complimentary: r.complimentary, complimentaryReason: r.complimentaryReason, decidedBy: name(r.decidedById), decidedAt: r.decidedAt,
      invitation: { status: invStatus, expiresAt: inv?.expiresAt ?? null, acceptedAt: inv?.acceptedAt ?? null },
      items: r.items.map((i) => {
        const c = courses.find((x) => x.id === i.courseId);
        return { id: i.id, courseId: i.courseId, title: c?.title ?? '(deleted course)', slug: c?.slug, instructor: c?.instructor ?? null, listPriceCents: i.listPriceCents, expiresAt: i.expiresAt, activatedAt: i.activatedAt, revokedAt: i.revokedAt };
      }),
      // Instructors see their own course lines' earnings; the full payment details are for super admins.
      payments: isSuper ? r.payments.map((p) => ({ ...p, recordedBy: name(p.recordedById), verifiedBy: name(p.verifiedById) })) : [],
      earnings: r.payments.filter((p) => p.status === 'verified').flatMap((p) => p.allocations).filter((al) => isSuper || al.instructorId === u.id)
        .map((al) => ({ id: al.id, itemId: al.itemId, netUsdCents: al.netUsdCents, instructorCents: al.instructorCents, platformCents: al.platformCents, payoutStatus: al.payoutStatus, payoutAt: al.payoutAt })),
      paymentStatus: r.complimentary ? 'complimentary' : !r.payments.length ? 'payment_pending' : r.payments.every((p) => p.status === 'verified') ? 'payment_verified' : 'payment_pending',
      ...(history ? { history } : {}),
    };
  }

  /** Instructor's manual earnings (Studio › Sales) and the super admin's totals (Money). */
  async earnings(u: AuthUser, instructorId?: string) {
    const isSuper = u.roles.includes('super_admin') || can(u, 'finance.view');
    const who = isSuper ? instructorId : u.id;
    const rows = await this.prisma.externalPaymentAllocation.findMany({
      where: { ...(who ? { instructorId: who } : {}), payment: { status: 'verified' } },
      orderBy: { payment: { verifiedAt: 'desc' } },
      take: 500,
      include: { payment: { select: { verifiedAt: true, method: true, currency: true, request: { select: { number: true, studentName: true } } } }, item: { select: { courseId: true } } },
    });
    const titles = await this.titles(rows.map((r) => r.item.courseId));
    const sum = (k: 'netUsdCents' | 'instructorCents' | 'platformCents', st?: string) => rows.filter((r) => !st || r.payoutStatus === st).reduce((n, r) => n + r[k], 0);
    return {
      totals: { netUsdCents: sum('netUsdCents'), instructorCents: sum('instructorCents'), platformCents: sum('platformCents'), payoutPendingCents: sum('instructorCents', 'payout_pending') + sum('instructorCents', 'earnings_recorded'), paidOutCents: sum('instructorCents', 'payout_completed') },
      items: rows.map((r) => ({ id: r.id, ref: ref(r.payment.request.number), student: r.payment.request.studentName, course: titles[r.item.courseId], at: r.payment.verifiedAt, method: r.payment.method, currency: r.payment.currency, netUsdCents: r.netUsdCents, instructorCents: r.instructorCents, platformCents: r.platformCents, payoutStatus: r.payoutStatus, ...(isSuper ? { instructorId: r.instructorId } : {}) })),
    };
  }

  // ---------- helpers ----------
  private superOnly(u: AuthUser) {
    if (!u.roles.includes('super_admin')) throw forbidden('Only a super admin can do this', 'super_admin_required');
  }
  private async load(id: string) {
    const r = await this.prisma.manualEnrollment.findUnique({ where: { id }, include: { items: { orderBy: { id: 'asc' } }, payments: { include: { allocations: true }, orderBy: { createdAt: 'asc' } }, invitations: true } });
    if (!r) throw notFound('Request');
    return r;
  }
  private async titles(ids: string[]) {
    const rows = await this.prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
    return Object.fromEntries(rows.map((c) => [c.id, c.title])) as Record<string, string>;
  }
}
