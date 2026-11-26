import { Injectable, Logger, Optional } from '@nestjs/common';
import type Stripe from 'stripe';
import { revokeYear } from '../access/access';
import { refundConsumption } from '../access/consumption';
import { JobsService } from '../common/jobs';
import { NotificationsService } from '../common/notifications.service';
import { refundAiEnabled, summarizeRefund } from './refund-ai';
import { AuditService } from '../common/audit.service';
import { badRequest, conflict, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';
import { daysLeftUntil, decisionMessage, deadlineFor, evaluate, REASON_LABELS, type BlockReason, type Evaluation, type PolicyMessages } from './refund-policy';
import { RefundPolicyService } from './refund-policy.service';
import { PayoutsService } from './payouts.service';
import { StripeService } from './stripe.service';

const DAY = 24 * 60 * 60 * 1000;
const web = () => env().WEB_URL.replace(/\/$/, '');
export const policyUrl = () => `${web()}/policies/access-and-refunds`;

export type PaymentState = 'succeeded' | 'processing' | 'failed';
export interface RefundResult { state: PaymentState; stripeRefundId: string | null; amountCents: number; error: string | null }

type OrderLite = { id: string; status: string; paidAt: Date | null; refundEligibleUntil: Date | null; refundPolicyId: string | null };
type LineLite = { id: string; courseId: string; priceCents: number; refundedAt: Date | null; disputeStatus: string | null; paidVideoSecAtPurchase: number | null; course: { title: string; instructor?: { name: string } | null } };

/** Only a few Stripe failure reasons are safe to show; anything else becomes a generic note. */
const stripeError = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? 'unknown error';
  return m.replace(/(sk|rk|pk)_(test|live)_[A-Za-z0-9]+/g, '[key]').slice(0, 300);
};

@Injectable()
export class RefundsService {
  private readonly logger = new Logger('Refunds');
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
    private readonly payouts: PayoutsService,
    private readonly policy: RefundPolicyService,
    @Optional() private readonly jobs?: JobsService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  /**
   * Sends the money back. Stripe orders: a Stripe refund (idempotency key per order and lines); the lines are refunded
   * locally only once Stripe confirms (`succeeded` now, or later through the `refund.updated` / `charge.refunded`
   * webhooks). Dev test payments and free orders have no provider: they succeed at once. Nothing here tells the student
   * the money is back unless the state is `succeeded`.
   */
  async refund(orderId: string, lineIds: string[] | undefined, reason: string | undefined, actor: { id: string | null; ip: string | null }, opts: { requestId?: string; retry?: boolean } = {}): Promise<RefundResult> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { lines: true } });
    if (!order) throw notFound('Order');
    if (!['paid', 'partially_refunded'].includes(order.status)) throw badRequest('Only paid orders can be refunded', 'not_refundable');
    const lines = order.lines.filter((l) => !l.refundedAt && (!lineIds?.length || lineIds.includes(l.id)));
    if (!lines.length) throw badRequest('Nothing left to refund', 'already_refunded');
    const amount = lines.reduce((n, l) => n + l.priceCents, 0);
    const ids = lines.map((l) => l.id).sort();

    let result: RefundResult = { state: 'succeeded', stripeRefundId: null, amountCents: amount, error: null };
    if (order.provider === 'stripe' && amount > 0) {
      if (!order.stripePaymentIntentId) throw badRequest('Order has no payment to refund', 'no_payment');
      try {
        const key = `refund:${orderId}:${ids.join(',')}${opts.retry ? `:retry:${Date.now()}` : ''}`;
        const refund = await this.stripe.client.refunds.create(
          { payment_intent: order.stripePaymentIntentId, amount, metadata: { orderId, lineIds: ids.join(','), ...(opts.requestId ? { requestId: opts.requestId } : {}) } },
          { idempotencyKey: key },
        );
        result = {
          state: refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' || refund.status === 'canceled' ? 'failed' : 'processing',
          stripeRefundId: refund.id, amountCents: amount, error: refund.status === 'failed' || refund.status === 'canceled' ? (refund.failure_reason ?? refund.status) : null,
        };
      } catch (e) {
        result = { state: 'failed', stripeRefundId: null, amountCents: amount, error: stripeError(e) };
      }
    }
    await this.audit.log({
      actorId: actor.id, action: result.state === 'failed' ? 'refund.payment_failed' : 'order.refund_requested', targetType: 'order', targetId: orderId, ip: actor.ip,
      meta: { amount, lineIds: ids, reason: reason ?? null, stripeRefundId: result.stripeRefundId, state: result.state, error: result.error, requestId: opts.requestId ?? null },
    });
    if (result.state === 'succeeded') await this.applyRefund(orderId, ids, { actorId: actor.id, ip: actor.ip });
    return result;
  }

  /**
   * Idempotent local side of a confirmed refund (Stripe confirmation, test payment, or a lost dispute): mark lines
   * refunded, revoke the access year they granted, cancel or claw back the instructor's share, update the order status.
   */
  async applyRefund(orderId: string, lineIds: string[], who: { actorId?: string | null; ip?: string | null } = {}, kind: 'refund_clawback' | 'dispute_clawback' = 'refund_clawback') {
    const newlyRefunded: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const lineId of lineIds) {
        const r = await tx.orderLine.updateMany({ where: { id: lineId, orderId, refundedAt: null }, data: { refundedAt: new Date() } });
        if (!r.count) continue;
        newlyRefunded.push(lineId);
        const line = await tx.orderLine.findUniqueOrThrow({ where: { id: lineId }, include: { order: { select: { userId: true } } } });
        // Only this line's year goes back; a refunded renewal leaves the earlier year in force.
        const lost = await revokeYear(tx, lineId, line.order.userId, line.courseId);
        if (lost) {
          await tx.course.update({ where: { id: line.courseId }, data: { studentCount: { decrement: 1 } } });
          // A refunded course no longer counts as completed: its certificate stops verifying.
          await tx.certificate.deleteMany({ where: { userId: line.order.userId, courseId: line.courseId } });
        }
        // Owed-but-unpaid shares are simply cancelled.
        await tx.orderLine.updateMany({ where: { id: lineId, transferStatus: 'pending' }, data: { transferStatus: 'none' } });
      }
      const all = await tx.orderLine.findMany({ where: { orderId }, select: { refundedAt: true } });
      const status = all.every((l) => l.refundedAt) ? 'refunded' : 'partially_refunded';
      await tx.order.update({ where: { id: orderId }, data: { status } });
    });

    // Shares already transferred to the instructor are recovered (Stripe reversal, else netted later). Network calls
    // stay outside the DB transaction.
    for (const lineId of newlyRefunded) await this.payouts.clawback(lineId, kind);
    if (newlyRefunded.length) {
      await this.audit.log({ actorId: who.actorId ?? null, action: 'order.refunded', targetType: 'order', targetId: orderId, ip: who.ip ?? null, meta: { lineIds: newlyRefunded } });
    }
    return this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
  }

  // ---------- Stripe confirmation (webhooks) ----------

  /** `refund.created` / `refund.updated` / `refund.failed` / `charge.refund.updated`: settle what this refund paid for. */
  async onStripeRefund(refund: Stripe.Refund) {
    const orderId = refund.metadata?.orderId;
    const lineIds = (refund.metadata?.lineIds ?? '').split(',').filter(Boolean);
    if (refund.status === 'succeeded') {
      if (orderId && lineIds.length) await this.applyRefund(orderId, lineIds);
      await this.settleRequests(refund.id, 'succeeded', null);
    } else if (refund.status === 'failed' || refund.status === 'canceled') {
      await this.settleRequests(refund.id, 'failed', refund.failure_reason ?? refund.status);
      if (orderId) await this.audit.log({ action: 'refund.payment_failed', targetType: 'order', targetId: orderId, meta: { stripeRefundId: refund.id, reason: refund.failure_reason ?? refund.status } });
    }
  }

  /** On `charge.refunded`: ask Stripe about every refund still processing for the order (missed or late events). */
  async syncProcessing(orderId: string) {
    if (!this.stripe.configured) return;
    const open = await this.prisma.refundRequest.findMany({ where: { orderId, paymentStatus: 'processing', stripeRefundId: { not: null } }, select: { stripeRefundId: true } });
    for (const r of open) {
      try {
        await this.onStripeRefund(await this.stripe.client.refunds.retrieve(r.stripeRefundId!));
      } catch (e) {
        this.logger.warn(`refund ${r.stripeRefundId} not checked: ${stripeError(e)}`);
      }
    }
  }

  /** Moves requests paid by this Stripe refund to their final payment state and tells the student, once. */
  private async settleRequests(stripeRefundId: string, state: 'succeeded' | 'failed', error: string | null) {
    const rows = await this.prisma.refundRequest.findMany({ where: { stripeRefundId, paymentStatus: 'processing' } });
    for (const r of rows) {
      const moved = await this.prisma.refundRequest.updateMany({
        where: { id: r.id, paymentStatus: 'processing' },
        data: state === 'succeeded' ? { paymentStatus: 'succeeded', processedAt: new Date(), paymentError: null } : { paymentStatus: 'failed', paymentError: error },
      });
      if (moved.count) await this.tellPayment(r.id, state);
    }
  }

  // ---------- facts and the decision ----------

  /** The facts for one order line, from purchase records and playback ranges only (docs/ACCESS_AND_REFUNDS.md). */
  private async lineFacts(userId: string, order: OrderLite, l: LineLite, terms: Awaited<ReturnType<RefundPolicyService['termsFor']>>, now = new Date()) {
    const c = await refundConsumption(this.prisma, userId, l.courseId, l.paidVideoSecAtPurchase);
    const cert = await this.prisma.certificate.findUnique({ where: { userId_courseId: { userId, courseId: l.courseId } } });
    const renewal = (await this.prisma.accessPeriod.count({ where: { userId, courseId: l.courseId, orderLineId: { not: l.id } } })) > 0;
    const lessonIds = await this.prisma.lecture.findMany({ where: { section: { courseId: l.courseId } }, select: { id: true } });
    const lessonsCompleted = await this.prisma.lectureProgress.count({ where: { userId, completed: true, lectureId: { in: lessonIds.map((x) => x.id) } } });
    const downloads = await this.prisma.resourceDownload.count({ where: { userId, courseId: l.courseId, ...(order.paidAt ? { at: { gte: order.paidAt } } : {}) } });
    // The deadline stored at purchase; later only if a more generous policy (a longer period) is in force now.
    const own = order.refundEligibleUntil ?? (order.paidAt ? deadlineFor(order.paidAt, terms.windowDays) : null);
    const deadline = order.paidAt && own && terms.generousFrom ? new Date(Math.max(own.getTime(), deadlineFor(order.paidAt, terms.windowDays).getTime())) : own;
    const ev = evaluate({
      now, paidAt: order.paidAt, deadline, watchedPercent: c.percent, tracking: c.tracking, refunded: !!l.refundedAt, free: l.priceCents === 0,
      paid: order.status === 'paid' || order.status === 'partially_refunded', disputed: l.disputeStatus === 'open', certificate: !!cert,
    }, terms);
    const message = decisionMessage(ev, { paidAt: order.paidAt, deadline, windowDays: terms.windowDays, watchedPercent: c.percent, maxWatchedPercent: terms.maxWatchedPercent, policyUrl: policyUrl() });
    return {
      lineId: l.id, courseId: l.courseId, title: l.course.title, instructor: l.course.instructor?.name ?? null, priceCents: l.priceCents,
      purchasedAt: order.paidAt, windowEndsAt: deadline, withinWindow: !!deadline && now.getTime() <= deadline.getTime(), daysLeft: daysLeftUntil(deadline, now),
      daysSincePurchase: order.paidAt ? Math.floor((now.getTime() - order.paidAt.getTime()) / DAY) : null, renewal,
      totalSec: c.totalSec, watchedSec: c.watchedSec, watchedPercent: c.percent, lessons: c.lessons, lessonsStarted: c.lessonsStarted,
      lessonsTotal: lessonIds.length, lessonsCompleted, downloads, tracking: c.tracking, paidVideoSecAtPurchase: l.paidVideoSecAtPurchase,
      thresholdPercent: terms.maxWatchedPercent, windowDays: terms.windowDays, policyVersion: terms.purchaseVersion, generousFrom: terms.generousFrom,
      eligible: ev.eligible, reason: ev.reasons[0] ?? null, reasons: ev.reasons, outcome: ev.outcome, investigation: ev.investigation, message,
    };
  }

  private async factsForOrder(userId: string, order: OrderLite & { lines: LineLite[] }, now = new Date()) {
    const terms = await this.policy.termsFor(order.refundPolicyId);
    const lines = [];
    for (const l of order.lines) lines.push(await this.lineFacts(userId, order, l, terms, now));
    return { terms, lines };
  }

  private lineInclude = { course: { select: { id: true, title: true, instructor: { select: { name: true } } } } } as const;

  async eligibility(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: { lines: { include: this.lineInclude } } });
    if (!order) throw notFound('Order');
    const yearAgo = new Date(Date.now() - 365 * DAY);
    const used = await this.prisma.orderLine.count({ where: { order: { userId }, refundedAt: { gte: yearAgo } } });
    const pending = await this.prisma.refundRequest.findFirst({ where: { orderId, userId, OR: [{ status: 'pending' }, { paymentStatus: 'processing' }] } });
    const { terms, lines } = await this.factsForOrder(userId, order);
    return {
      orderId,
      eligibleUntil: lines.find((l) => l.windowEndsAt)?.windowEndsAt ?? order.refundEligibleUntil,
      policy: {
        version: terms.purchaseVersion, generousFrom: terms.generousFrom, windowDays: terms.windowDays, maxWatchedPercent: terms.maxWatchedPercent,
        selfServicePerYear: terms.selfServicePerYear, autoApprove: terms.autoCheck && terms.autoApprove, url: policyUrl(),
      },
      selfServiceLeft: Math.max(0, terms.selfServicePerYear - used),
      pendingRequest: pending ? { id: pending.id, createdAt: pending.createdAt, status: pending.status, paymentStatus: pending.paymentStatus } : null,
      lines,
    };
  }

  /**
   * The student's refund position for their courses (Student Studio), without asking for anything: for each course,
   * the latest paid purchase that isn't refunded, with the deadline, days left, watch share and the decision a
   * request would get now.
   */
  async courseStatus(userId: string, courseIds: string[]) {
    const out = new Map<string, {
      state: 'eligible' | 'review' | 'not_eligible' | 'requested' | 'refunded'; orderId: string; lineId: string; purchasedAt: Date | null; deadline: Date | null; daysLeft: number | null;
      watchedPercent: number; maxWatchedPercent: number; windowDays: number; reasons: BlockReason[]; message: string; policyVersion: number; tracking: string;
    }>();
    if (!courseIds.length) return out;
    const lines = await this.prisma.orderLine.findMany({
      where: { courseId: { in: courseIds }, priceCents: { gt: 0 }, order: { userId, status: { in: ['paid', 'partially_refunded', 'refunded'] } } },
      orderBy: { order: { paidAt: 'desc' } },
      include: { ...this.lineInclude, order: true },
    });
    const open = await this.prisma.refundRequest.findMany({ where: { userId, OR: [{ status: 'pending' }, { paymentStatus: 'processing' }] }, select: { lineIds: true } });
    const openLines = new Set(open.flatMap((r) => r.lineIds));
    for (const l of lines) {
      if (out.has(l.courseId)) continue;
      const terms = await this.policy.termsFor(l.order.refundPolicyId);
      const f = await this.lineFacts(userId, l.order, l, terms);
      const state = l.refundedAt ? 'refunded' : openLines.has(l.id) ? 'requested' : f.outcome === 'approve' ? 'eligible' : f.outcome === 'review' ? (f.eligible || f.investigation ? 'review' : 'not_eligible') : 'not_eligible';
      out.set(l.courseId, {
        state, orderId: l.orderId, lineId: l.id, purchasedAt: f.purchasedAt, deadline: f.windowEndsAt, daysLeft: f.daysLeft, watchedPercent: f.watchedPercent,
        maxWatchedPercent: f.thresholdPercent, windowDays: f.windowDays, reasons: f.reasons, message: f.message, policyVersion: f.policyVersion, tracking: f.tracking,
      });
    }
    return out;
  }

  /**
   * A student's refund request. It is always recorded with its facts and handled by the policy in force
   * (docs/ACCESS_AND_REFUNDS.md): eligible → refunded at once (or waits for a person if the Super Admin requires
   * manual approval or the yearly self-service limit is reached); breaks a rule → declined at once with the exact
   * reasons (or waits for a person if automatic rejection is off); tracking data missing → a person decides.
   */
  async request(actor: { id: string; ip: string | null }, orderId: string, lineIds: string[] | undefined, reason: string | undefined) {
    const e = await this.eligibility(actor.id, orderId);
    if (e.pendingRequest) throw conflict('A refund request for this order is already being handled', 'request_pending');
    const wanted = e.lines.filter((l) => !lineIds?.length || lineIds.includes(l.lineId)).filter((l) => l.outcome !== 'none');
    if (!wanted.length) throw badRequest('Nothing to refund in this order', 'nothing_to_refund');
    const requestedAt = new Date();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true, name: true } });
    const facts = (ls: typeof wanted) => JSON.parse(JSON.stringify({ orderId, requestedAt, policyVersion: e.policy.version, generousFrom: e.policy.generousFrom, windowDays: e.policy.windowDays, thresholdPercent: e.policy.maxWatchedPercent, selfServiceLeft: e.selfServiceLeft, lines: ls })) as object;
    const current = await this.policy.current();
    const results: { requestId: string; status: string; lineIds: string[]; message: string }[] = [];
    const msgOf = (ls: typeof wanted) => (ls.length === 1 ? ls[0]!.message : ls.map((l) => `${l.title}:\n${l.message}`).join('\n\n'));

    const reject = wanted.filter((l) => l.outcome === 'reject');
    let approve = wanted.filter((l) => l.outcome === 'approve');
    let review = wanted.filter((l) => l.outcome === 'review');
    // Beyond the yearly self-service limit, eligible requests wait for a person.
    if (approve.length > e.selfServiceLeft) { review = [...review, ...approve]; approve = []; }

    if (reject.length) {
      const message = msgOf(reject);
      const req = await this.prisma.refundRequest.create({ data: { orderId, userId: actor.id, lineIds: reject.map((l) => l.lineId), reason: reason?.trim() || null, status: 'auto_declined', analysis: facts(reject), decisionNote: reject.map((l) => `${l.title}: ${l.reasons.map((r) => REASON_LABELS[r]).join(', ')}`).join(' '), message, policyVersion: e.policy.version, decidedAt: requestedAt } });
      await this.audit.log({ actorId: actor.id, action: 'refund.auto_declined', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { requestId: req.id, policyVersion: e.policy.version, lines: reject.map((l) => ({ lineId: l.lineId, reasons: l.reasons, watchedPercent: l.watchedPercent, threshold: l.thresholdPercent, deadline: l.windowEndsAt })) } });
      const top = reject[0]!;
      await this.jobs?.sendEmail({ to: user.email, template: 'refund-declined', dedupeKey: `refund-declined:${req.id}`, data: { name: user.name, course: top.title, courses: reject.map((l) => l.title), message, purchasedAt: top.purchasedAt, deadline: top.windowEndsAt, windowDays: top.windowDays, watchedPercent: top.watchedPercent, thresholdPercent: top.thresholdPercent, reasons: top.reasons, policyUrl: policyUrl(), extra: current.messages.declined ?? null, requestId: req.id, orderId } });
      await this.notifications?.notify(actor.id, { kind: 'refund.declined', title: 'Refund request not eligible', body: message.split('\n\n')[0]!, link: `/student/purchases/${orderId}` });
      void this.addAiSummary(req.id);
      results.push({ requestId: req.id, status: 'declined', lineIds: req.lineIds, message });
    }
    if (review.length) {
      const investigation = review.some((l) => l.investigation);
      const message = msgOf(review);
      const req = await this.prisma.refundRequest.create({ data: { orderId, userId: actor.id, lineIds: review.map((l) => l.lineId), reason: reason?.trim() || null, analysis: facts(review), investigation, message, policyVersion: e.policy.version } });
      await this.audit.log({ actorId: actor.id, action: 'order.refund_request_created', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { requestId: req.id, lineIds: req.lineIds, investigation, why: investigation ? 'tracking data missing or inconsistent' : 'waits for a person (policy or yearly limit)' } });
      await this.jobs?.sendEmail({ to: user.email, template: 'refund-received', dedupeKey: `refund-received:${req.id}`, data: { name: user.name, courses: review.map((l) => l.title), message, extra: current.messages.submitted ?? null, requestId: req.id, orderId } });
      await this.notifications?.notify(actor.id, { kind: 'refund.submitted', title: 'Refund request received', body: 'A member of our team will review it and email you the decision.', link: `/student/purchases/${orderId}` });
      void this.addAiSummary(req.id);
      results.push({ requestId: req.id, status: 'pending_review', lineIds: req.lineIds, message });
    }
    if (approve.length) {
      const message = msgOf(approve);
      const req = await this.prisma.refundRequest.create({ data: { orderId, userId: actor.id, lineIds: approve.map((l) => l.lineId), reason: reason?.trim() || null, status: 'auto_approved', analysis: facts(approve), message, policyVersion: e.policy.version, decidedAt: requestedAt, paymentStatus: 'processing' } });
      await this.audit.log({ actorId: actor.id, action: 'refund.auto_approved', targetType: 'order', targetId: orderId, ip: actor.ip, meta: { requestId: req.id, lineIds: req.lineIds, policyVersion: e.policy.version } });
      const paid = await this.pay(req.id, { id: actor.id, ip: actor.ip }, reason ? `Learner: ${reason}` : 'Learner self-service refund');
      void this.addAiSummary(req.id);
      results.push({ requestId: req.id, status: paid === 'succeeded' ? 'refunded' : paid === 'processing' ? 'processing' : 'payment_failed', lineIds: req.lineIds, message });
    }
    const status = results.length === 1 ? results[0]!.status : results.every((r) => r.status === 'refunded') ? 'refunded' : 'partial';
    return { status, requests: results, requestId: results[0]?.requestId, message: results.map((r) => r.message).join('\n\n') };
  }

  /**
   * Pays an approved request through the provider and records the payment state. Never says "refunded" before the
   * provider confirms: `processing` waits for the webhook; `failed` keeps the decision and lets an admin retry.
   */
  async pay(requestId: string, actor: { id: string | null; ip: string | null }, reason: string, retry = false): Promise<PaymentState> {
    const r = await this.prisma.refundRequest.findUniqueOrThrow({ where: { id: requestId } });
    let res: RefundResult;
    try {
      res = await this.refund(r.orderId, r.lineIds, reason, actor, { requestId, retry });
    } catch (e) {
      res = { state: 'failed', stripeRefundId: null, amountCents: 0, error: stripeError(e) };
    }
    await this.prisma.refundRequest.update({
      where: { id: requestId },
      data: {
        paymentStatus: res.state, stripeRefundId: res.stripeRefundId ?? r.stripeRefundId, paymentError: res.error,
        ...(res.state === 'succeeded' ? { processedAt: new Date() } : {}),
      },
    });
    await this.tellPayment(requestId, res.state);
    return res.state;
  }

  /** Email + bell for a payment state of an approved request (refunded / on its way / delayed). */
  private async tellPayment(requestId: string, state: PaymentState) {
    const r = await this.prisma.refundRequest.findUnique({ where: { id: requestId }, include: { user: { select: { email: true, name: true } }, order: { include: { lines: { include: { course: { select: { title: true } } } } } } } });
    if (!r) return;
    const lines = r.order.lines.filter((l) => r.lineIds.includes(l.id));
    const courses = lines.map((l) => l.course.title);
    const amountCents = lines.reduce((n, l) => n + l.priceCents, 0);
    const messages: PolicyMessages = (await this.policy.current()).messages;
    const link = `/student/purchases/${r.orderId}`;
    if (state === 'succeeded') {
      await this.jobs?.sendEmail({ to: r.user.email, template: 'refund-approved', dedupeKey: `refund-done:${requestId}`, data: { name: r.user.name, courses, amountCents, requestId, orderId: r.orderId, note: r.status === 'approved' ? r.decisionNote : null, extra: messages.processed ?? messages.approved ?? null } });
      await this.notifications?.notify(r.userId, { kind: 'refund.processed', title: 'Refund completed', body: `We refunded $${(amountCents / 100).toFixed(2)} for ${courses.join(', ')}. Your bank shows it in 5–10 business days.`, link });
    } else if (state === 'processing') {
      await this.jobs?.sendEmail({ to: r.user.email, template: 'refund-processing', dedupeKey: `refund-processing:${requestId}`, data: { name: r.user.name, courses, amountCents, requestId, orderId: r.orderId, extra: messages.approved ?? null } });
      await this.notifications?.notify(r.userId, { kind: 'refund.approved', title: 'Refund approved', body: `Your refund for ${courses.join(', ')} is approved and being processed by our payment provider. We’ll tell you when it’s complete.`, link });
    } else {
      await this.jobs?.sendEmail({ to: r.user.email, template: 'refund-delayed', dedupeKey: `refund-delayed:${requestId}:${Date.now()}`, data: { name: r.user.name, courses, requestId, orderId: r.orderId } });
      await this.notifications?.notify(r.userId, { kind: 'refund.delayed', title: 'Refund approved, payment delayed', body: 'Your refund is approved, but our payment provider couldn’t process it yet. Our team is retrying; you don’t need to do anything.', link });
    }
  }

  /** The student asks a person to look at an automatic decline (wrong data, legal rights, an exception). */
  async requestReview(actor: { id: string; ip: string | null }, requestId: string, note: string) {
    const r = await this.prisma.refundRequest.findFirst({ where: { id: requestId, userId: actor.id } });
    if (!r) throw notFound('Refund request');
    if (r.status !== 'auto_declined') throw conflict('Only an automatic decline can be sent for review', 'not_reviewable');
    if (r.reviewRequestedAt) throw conflict('A review was already requested', 'review_requested');
    await this.prisma.refundRequest.update({ where: { id: r.id }, data: { reviewRequestedAt: new Date(), reviewNote: note.trim().slice(0, 2000) } });
    await this.audit.log({ actorId: actor.id, action: 'refund.review_requested', targetType: 'order', targetId: r.orderId, ip: actor.ip, meta: { requestId: r.id } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true, name: true } });
    await this.jobs?.sendEmail({ to: user.email, template: 'refund-review-received', data: { name: user.name, requestId: r.id } });
    await this.notifications?.notify(actor.id, { kind: 'refund.review_requested', title: 'Review requested', body: 'A member of our team will look at your refund request and email you the decision.', link: `/student/purchases/${r.orderId}` });
    return { ok: true };
  }

  /** The student's refund requests for an order (receipt page). */
  async requestsFor(userId: string, orderId: string) {
    const rows = await this.prisma.refundRequest.findMany({ where: { orderId, userId }, orderBy: { createdAt: 'desc' } });
    return {
      items: rows.map((r) => ({
        id: r.id, status: r.status, paymentStatus: r.paymentStatus, lineIds: r.lineIds, decisionNote: r.decisionNote, message: r.message, createdAt: r.createdAt,
        decidedAt: r.decidedAt, processedAt: r.processedAt, reviewRequestedAt: r.reviewRequestedAt, policyVersion: r.policyVersion, analysis: r.analysis,
      })),
    };
  }

  /** Optional AI explanation for the admin; failure or no key changes nothing. AI never decides (AGENTS rule 20). */
  async addAiSummary(requestId: string) {
    if (!refundAiEnabled()) return;
    const r = await this.prisma.refundRequest.findUnique({ where: { id: requestId } });
    if (!r?.analysis) return;
    const refundsThisYear = await this.prisma.orderLine.count({ where: { order: { userId: r.userId }, refundedAt: { gte: new Date(Date.now() - 365 * DAY) } } });
    const s = await summarizeRefund({ status: r.status, ...(r.analysis as object), refundsThisYear });
    if (s) await this.prisma.refundRequest.update({ where: { id: requestId }, data: { aiSummary: s.text, aiModel: s.model } });
  }
}

export type { Evaluation };
export const REASONS: Record<string, string> = REASON_LABELS;
