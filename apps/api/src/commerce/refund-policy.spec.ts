import { summariseRefundConsumption } from '../access/consumption';
import { daysLeftUntil, deadlineFor, decisionMessage, effectiveTerms, evaluate, LAUNCH_POLICY, policyProblems, type LineState, type PolicyTerms } from './refund-policy';

const paidAt = new Date('2026-11-01T10:00:00Z');
const terms: PolicyTerms = { ...LAUNCH_POLICY };
const state = (over: Partial<LineState> = {}): LineState => ({
  now: new Date('2026-11-05T10:00:00Z'), paidAt, deadline: deadlineFor(paidAt, 14), watchedPercent: 10, tracking: 'ok',
  refunded: false, free: false, paid: true, disputed: false, certificate: false, ...over,
});
const url = 'https://example.test/policies/access-and-refunds';

describe('refund decision engine (owner 2026-11-26)', () => {
  it('D: within the period and under the limit → refunded at once', () => {
    expect(evaluate(state(), terms)).toEqual({ eligible: true, reasons: [], outcome: 'approve', investigation: false });
  });

  it('exactly the limit is allowed; 0.1 % over is not', () => {
    expect(evaluate(state({ watchedPercent: 25 }), terms).outcome).toBe('approve');
    expect(evaluate(state({ watchedPercent: 25.1 }), terms).reasons).toEqual(['watched_too_much']);
  });

  it('the exact deadline is in time; one millisecond later is not', () => {
    const deadline = deadlineFor(paidAt, 14);
    expect(evaluate(state({ now: deadline }), terms).outcome).toBe('approve');
    expect(evaluate(state({ now: new Date(deadline.getTime() + 1) }), terms).reasons).toEqual(['window_closed']);
  });

  it('A, B and C: the reasons, and the exact messages', () => {
    const late = state({ now: new Date('2026-11-20T10:00:00Z') });
    const a = evaluate(late, terms);
    expect(a).toMatchObject({ outcome: 'reject', reasons: ['window_closed'] });
    const ma = decisionMessage(a, { paidAt, deadline: late.deadline, windowDays: 14, watchedPercent: 10, maxWatchedPercent: 25, policyUrl: url });
    expect(ma).toContain('because the refund period has expired.');
    expect(ma).toContain('Applicable refund period: 14 days');
    expect(ma).toContain('Refund deadline: November 15, 2026');
    expect(ma).toContain(url);

    const b = evaluate(state({ watchedPercent: 40 }), terms);
    const mb = decisionMessage(b, { paidAt, deadline: state().deadline, windowDays: 14, watchedPercent: 40, maxWatchedPercent: 25, policyUrl: url });
    expect(mb).toContain('because your course consumption has exceeded the permitted limit.');
    expect(mb).toContain('Your course consumption: 40%');
    expect(mb).toContain('Maximum permitted consumption: 25%');

    const c = evaluate(state({ now: new Date('2026-11-20T10:00:00Z'), watchedPercent: 40 }), terms);
    expect(c.reasons).toEqual(['window_closed', 'watched_too_much']);
    const mc = decisionMessage(c, { paidAt, deadline: state().deadline, windowDays: 14, watchedPercent: 40, maxWatchedPercent: 25, policyUrl: url });
    expect(mc).toContain('the refund period has expired and your course consumption has exceeded the permitted limit');
    expect(mc).toContain('Purchase date:');
    expect(mc).toContain('Your course consumption: 40%');
  });

  it('missing or inconsistent tracking never rejects automatically: a person decides', () => {
    const e = evaluate(state({ tracking: 'missing', watchedPercent: 90 }), terms);
    expect(e).toMatchObject({ outcome: 'review', investigation: true, eligible: false, reasons: [] });
    // …but an expired period is decided without the tracking data.
    expect(evaluate(state({ tracking: 'inconsistent', now: new Date('2026-12-30T00:00:00Z') }), terms).outcome).toBe('reject');
  });

  it('follows the Super Admin switches', () => {
    expect(evaluate(state(), { ...terms, autoApprove: false }).outcome).toBe('review');
    expect(evaluate(state({ watchedPercent: 90 }), { ...terms, autoReject: false }).outcome).toBe('review');
    expect(evaluate(state({ watchedPercent: 90 }), { ...terms, autoCheck: false, autoReject: false, autoApprove: false }).outcome).toBe('review');
  });

  it('nothing to decide for refunded, free or unpaid lines', () => {
    expect(evaluate(state({ refunded: true }), terms).outcome).toBe('none');
    expect(evaluate(state({ free: true }), terms).outcome).toBe('none');
    expect(evaluate(state({ paid: false }), terms).outcome).toBe('none');
  });

  it('a purchase keeps its policy; a later, more generous one applies, a stricter one never does', () => {
    const stricter = { ...terms, version: 2, windowDays: 7, maxWatchedPercent: 10 };
    expect(effectiveTerms(terms, stricter)).toMatchObject({ windowDays: 14, maxWatchedPercent: 25, purchaseVersion: 1, generousFrom: null });
    const generous = { ...terms, version: 3, windowDays: 30, maxWatchedPercent: 20 };
    expect(effectiveTerms(terms, generous)).toMatchObject({ windowDays: 30, maxWatchedPercent: 25, purchaseVersion: 1, generousFrom: 3 });
    // How requests are handled follows today's switches.
    expect(effectiveTerms(terms, { ...stricter, autoApprove: false }).autoApprove).toBe(false);
  });

  it('days left: whole days, 0 on the last day, null after', () => {
    const d = deadlineFor(paidAt, 14);
    expect(daysLeftUntil(d, new Date('2026-11-05T10:00:00Z'))).toBe(10);
    expect(daysLeftUntil(d, new Date('2026-11-15T09:00:00Z'))).toBe(0);
    expect(daysLeftUntil(d, new Date('2026-11-15T10:00:01Z'))).toBeNull();
  });

  it('validates a new policy version', () => {
    expect(policyProblems({ windowDays: 7, maxWatchedPercent: 10, autoCheck: true, autoReject: true, autoApprove: true, allowExceptions: true, selfServicePerYear: 3 })).toEqual([]);
    expect(policyProblems({ windowDays: 0, maxWatchedPercent: 101, autoCheck: false, autoReject: true, autoApprove: false, allowExceptions: true, selfServicePerYear: -1 })).toHaveLength(4);
    expect(policyProblems({ windowDays: 14, maxWatchedPercent: 25.55, autoCheck: true, autoReject: true, autoApprove: true, allowExceptions: true, selfServicePerYear: 3 })).toHaveLength(1);
  });
});

describe('refund consumption measure', () => {
  const p = (sec: number, ranges: [number, number][]) => ({ watchedSec: sec, watchedRanges: ranges });

  it('unique paid seconds over paid video; replays already merged; one decimal', () => {
    const c = summariseRefundConsumption([{ durationSec: 600, progress: p(150, [[0, 150]]) }, { durationSec: 400, progress: null }], null);
    expect(c).toMatchObject({ totalSec: 1000, watchedSec: 150, percent: 15, tracking: 'ok', lessonsStarted: 1 });
  });

  it('uses the larger of today’s and the purchase-time length (removed lessons never make it harsher)', () => {
    const c = summariseRefundConsumption([{ durationSec: 600, progress: p(300, [[0, 300]]) }], 1200);
    expect(c.percent).toBe(25);
    expect(summariseRefundConsumption([{ durationSec: 600, progress: p(300, [[0, 300]]) }, { durationSec: 600, progress: null }], 600).percent).toBe(25);
  });

  it('flags missing and inconsistent data', () => {
    expect(summariseRefundConsumption([{ durationSec: 0, progress: null }], null).tracking).toBe('missing');
    expect(summariseRefundConsumption([{ durationSec: 600, progress: p(300, []) }], null).tracking).toBe('inconsistent');
    expect(summariseRefundConsumption([{ durationSec: 600, progress: p(300, [[0, 100]]) }], null).tracking).toBe('inconsistent');
    expect(summariseRefundConsumption([], null)).toMatchObject({ tracking: 'ok', percent: 0 });
  });
});
