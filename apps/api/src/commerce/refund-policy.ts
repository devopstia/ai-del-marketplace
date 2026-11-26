/**
 * Refund policy rules (owner 2026-11-26, prompts.md "Automated Refund Management"; docs/ACCESS_AND_REFUNDS.md).
 * Pure functions: the numbers come from the policy version in force (Super Admin › Refunds › Policy), never constants.
 *
 * - A purchase keeps the policy it was bought under. If a later version is more generous on a rule (a longer period,
 *   a higher watch limit), the more generous value applies; a stricter later version never applies to it.
 * - Deadline: purchase time + period days, to the second, inclusive (a request at the exact deadline is in time).
 * - Watch limit: unique paid video watched, one decimal. Exactly the limit is allowed; anything above is not.
 * - Missing or inconsistent tracking never rejects automatically: the request waits for a person ("investigation").
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface PolicyMessages { submitted?: string; approved?: string; declined?: string; processed?: string }

export interface PolicyTerms {
  version: number;
  windowDays: number;
  maxWatchedPercent: number;
  autoCheck: boolean;
  autoReject: boolean;
  autoApprove: boolean;
  allowExceptions: boolean;
  selfServicePerYear: number;
  messages: PolicyMessages;
}

/** The launch policy (version 1 in the migration); used only if the table were empty. */
export const LAUNCH_POLICY: PolicyTerms = {
  version: 1, windowDays: 14, maxWatchedPercent: 25, autoCheck: true, autoReject: true, autoApprove: true, allowExceptions: true, selfServicePerYear: 3, messages: {},
};

export const WINDOW_DAYS_RANGE = [1, 365] as const;
export const WATCHED_PERCENT_RANGE = [0, 100] as const;

/** Rules that apply to one purchase: its own version, with any more generous rule from the current version. */
export function effectiveTerms(atPurchase: PolicyTerms | null, current: PolicyTerms): PolicyTerms & { purchaseVersion: number; generousFrom: number | null } {
  const base = atPurchase ?? current;
  const windowDays = Math.max(base.windowDays, current.windowDays);
  const maxWatchedPercent = Math.max(base.maxWatchedPercent, current.maxWatchedPercent);
  const generous = windowDays !== base.windowDays || maxWatchedPercent !== base.maxWatchedPercent;
  // How requests are handled (automatic or by a person, messages, exceptions) follows today's settings.
  return {
    ...current,
    version: base.version,
    windowDays,
    maxWatchedPercent,
    purchaseVersion: base.version,
    generousFrom: generous ? current.version : null,
  };
}

export const deadlineFor = (paidAt: Date, windowDays: number) => new Date(paidAt.getTime() + windowDays * DAY_MS);

/** Whole days left before the deadline (0 on the last day, null once it has passed). */
export function daysLeftUntil(deadline: Date | null, now = new Date()): number | null {
  if (!deadline) return null;
  const ms = deadline.getTime() - now.getTime();
  return ms < 0 ? null : Math.floor(ms / DAY_MS);
}

export type Tracking = 'ok' | 'missing' | 'inconsistent';

export type BlockReason = 'already_refunded' | 'free_course' | 'not_paid' | 'disputed' | 'window_closed' | 'watched_too_much' | 'certificate_issued';

/** Reasons that mean there is nothing to decide (no request is recorded for these). */
export const NOT_APPLICABLE: BlockReason[] = ['already_refunded', 'free_course', 'not_paid'];

export interface LineState {
  now: Date;
  paidAt: Date | null;
  deadline: Date | null;
  watchedPercent: number;
  tracking: Tracking;
  refunded: boolean;
  free: boolean;
  paid: boolean;
  disputed: boolean;
  certificate: boolean;
}

export type Outcome = 'approve' | 'review' | 'reject' | 'none';

export interface Evaluation {
  /** Meets the standard policy (period and watch limit, no other block). */
  eligible: boolean;
  reasons: BlockReason[];
  /** What happens to a request: refunded at once, a person decides, declined at once, or nothing to refund. */
  outcome: Outcome;
  /** Tracking data can't be trusted for the watch rule: a person decides. */
  investigation: boolean;
}

/** The decision engine. Never reads the clock or the database: everything comes in `s` and `t`. */
export function evaluate(s: LineState, t: PolicyTerms): Evaluation {
  if (s.refunded) return { eligible: false, reasons: ['already_refunded'], outcome: 'none', investigation: false };
  if (s.free) return { eligible: false, reasons: ['free_course'], outcome: 'none', investigation: false };
  if (!s.paid) return { eligible: false, reasons: ['not_paid'], outcome: 'none', investigation: false };
  const reasons: BlockReason[] = [];
  if (s.disputed) reasons.push('disputed');
  const inTime = !!s.deadline && s.now.getTime() <= s.deadline.getTime();
  if (!inTime) reasons.push('window_closed');
  const trusted = s.tracking === 'ok';
  if (trusted && s.watchedPercent > t.maxWatchedPercent) reasons.push('watched_too_much');
  if (s.certificate) reasons.push('certificate_issued');
  // Unreliable tracking only matters when the watch rule would decide the request.
  const investigation = !trusted && reasons.length === 0;
  const eligible = reasons.length === 0 && trusted;
  let outcome: Outcome;
  if (!t.autoCheck || investigation) outcome = 'review';
  else if (reasons.length) outcome = t.autoReject ? 'reject' : 'review';
  else outcome = t.autoApprove ? 'approve' : 'review';
  return { eligible, reasons, outcome, investigation };
}

const fmtDate = (d: Date | null) => (d ? d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }) : 'unknown');
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

export interface MessageFacts { paidAt: Date | null; deadline: Date | null; windowDays: number; watchedPercent: number; maxWatchedPercent: number; policyUrl: string }

const FOOTER = (url: string) => `Please review our Refund Policy for additional information or contact support if you believe an exception applies.\n\nRefund Policy: ${url}`;

/**
 * The exact text a student sees for a declined standard request (scenarios A, B and C of the owner's brief) or the
 * short confirmation for an eligible one (scenario D). Other blocks get one plain sentence.
 */
export function decisionMessage(e: Evaluation, f: MessageFacts): string {
  const late = e.reasons.includes('window_closed');
  const over = e.reasons.includes('watched_too_much');
  const dates = [`Purchase date: ${fmtDate(f.paidAt)}`, `Refund deadline: ${fmtDate(f.deadline)}`, `Applicable refund period: ${f.windowDays} days`];
  const usage = [`Your course consumption: ${pct(f.watchedPercent)}`, `Maximum permitted consumption: ${pct(f.maxWatchedPercent)}`];
  if (late && over) {
    return [
      'Your refund request is not eligible under our standard refund policy because the refund period has expired and your course consumption has exceeded the permitted limit.',
      [...dates, ...usage].join('\n'),
      FOOTER(f.policyUrl),
    ].join('\n\n');
  }
  if (late) return ['Your refund request is not eligible under our standard refund policy because the refund period has expired.', dates.join('\n'), FOOTER(f.policyUrl)].join('\n\n');
  if (over) return ['Your refund request is not eligible under our standard refund policy because your course consumption has exceeded the permitted limit.', usage.join('\n'), FOOTER(f.policyUrl)].join('\n\n');
  if (e.reasons.includes('certificate_issued')) return `A certificate was issued for this course, so it can no longer be refunded under our standard refund policy.\n\n${FOOTER(f.policyUrl)}`;
  if (e.reasons.includes('disputed')) return 'This payment is being disputed with your bank, so the refund is handled through that dispute.';
  if (e.investigation) return 'Your request is within the refund period. We couldn’t confirm how much of the course was watched from our records, so a member of our team will review it and email you the decision.';
  if (e.outcome === 'review') return `Your request meets our refund policy (within ${f.windowDays} days of purchase, ${pct(f.watchedPercent)} watched of the ${pct(f.maxWatchedPercent)} allowed). A member of our team approves refunds and will email you shortly.`;
  return `Your request meets our refund policy: within ${f.windowDays} days of purchase and ${pct(f.watchedPercent)} watched of the ${pct(f.maxWatchedPercent)} allowed.`;
}

/** Short labels for lists and filters. */
export const REASON_LABELS: Record<BlockReason, string> = {
  already_refunded: 'Already refunded',
  free_course: 'Free course',
  not_paid: 'Not paid',
  disputed: 'Payment disputed with the bank',
  window_closed: 'Refund period expired',
  watched_too_much: 'Over the watch limit',
  certificate_issued: 'Certificate issued',
};

export interface PolicyInput {
  windowDays: number; maxWatchedPercent: number; autoCheck: boolean; autoReject: boolean; autoApprove: boolean; allowExceptions: boolean; selfServicePerYear: number; messages?: PolicyMessages;
}

/** Validation a new version must pass (also enforced by the request schema). */
export function policyProblems(p: PolicyInput): string[] {
  const out: string[] = [];
  if (!Number.isInteger(p.windowDays) || p.windowDays < WINDOW_DAYS_RANGE[0] || p.windowDays > WINDOW_DAYS_RANGE[1]) out.push(`The refund period must be a whole number of days between ${WINDOW_DAYS_RANGE[0]} and ${WINDOW_DAYS_RANGE[1]}.`);
  if (!(p.maxWatchedPercent >= WATCHED_PERCENT_RANGE[0] && p.maxWatchedPercent <= WATCHED_PERCENT_RANGE[1]) || Math.round(p.maxWatchedPercent * 10) !== p.maxWatchedPercent * 10) out.push('The watch limit must be between 0% and 100%, with at most one decimal.');
  if (!Number.isInteger(p.selfServicePerYear) || p.selfServicePerYear < 0 || p.selfServicePerYear > 100) out.push('Automatic refunds per student per year must be between 0 and 100.');
  if (!p.autoCheck && (p.autoApprove || p.autoReject)) out.push('Automatic approval and rejection need automatic checks turned on.');
  return out;
}
