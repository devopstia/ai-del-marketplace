import { Injectable } from '@nestjs/common';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, forbidden } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { env, isProd, stepUpSkipped } from '../config/env';
import { SignInService } from '../auth/signin.service';
import { ACCESS_MONTHS } from '../access/access';
import { effectiveTerms, LAUNCH_POLICY, policyProblems, type PolicyInput, type PolicyMessages, type PolicyTerms } from './refund-policy';

type Row = {
  id: string; version: number; windowDays: number; maxWatchedPercent: number; autoCheck: boolean; autoReject: boolean; autoApprove: boolean;
  allowExceptions: boolean; selfServicePerYear: number; messages: unknown; note: string | null; effectiveFrom: Date; createdAt: Date;
};

const clean = (m: unknown): PolicyMessages => {
  const o = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
  const out: PolicyMessages = {};
  for (const k of ['submitted', 'approved', 'declined', 'processed'] as const) {
    const v = typeof o[k] === 'string' ? (o[k] as string).trim() : '';
    if (v) out[k] = v.slice(0, 1000);
  }
  return out;
};

export const toTerms = (r: Row): PolicyTerms & { id: string; effectiveFrom: Date; note: string | null } => ({
  id: r.id, version: r.version, windowDays: r.windowDays, maxWatchedPercent: r.maxWatchedPercent, autoCheck: r.autoCheck, autoReject: r.autoReject,
  autoApprove: r.autoApprove, allowExceptions: r.allowExceptions, selfServicePerYear: r.selfServicePerYear, messages: clean(r.messages),
  effectiveFrom: r.effectiveFrom, note: r.note,
});

/**
 * Super Admin › Refunds › Policy (owner 2026-11-26). Each save creates a new version (the old ones stay, with their
 * dates); orders keep the version they were bought under. Changes need a fresh authenticator code and are audited.
 */
@Injectable()
export class RefundPolicyService {
  private cache: { at: number; value: ReturnType<typeof toTerms> } | null = null;
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly signIn: SignInService,
  ) {}

  /** The version in force now (cached 15 s; a save clears the cache). */
  async current(now = new Date()) {
    if (this.cache && Date.now() - this.cache.at < 15_000) return this.cache.value;
    const r = await this.prisma.refundPolicy.findFirst({ where: { effectiveFrom: { lte: now } }, orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }] });
    const value = r ? toTerms(r) : { ...LAUNCH_POLICY, id: '', effectiveFrom: new Date(0), note: null };
    this.cache = { at: Date.now(), value };
    return value;
  }

  async byIds(ids: (string | null | undefined)[]) {
    const want = [...new Set(ids.filter((x): x is string => !!x))];
    if (!want.length) return new Map<string, ReturnType<typeof toTerms>>();
    const rows = await this.prisma.refundPolicy.findMany({ where: { id: { in: want } } });
    return new Map(rows.map((r) => [r.id, toTerms(r)]));
  }

  /** The rules for one order: its own version plus anything more generous in force today. */
  async termsFor(refundPolicyId: string | null | undefined) {
    const current = await this.current();
    const own = refundPolicyId ? (await this.byIds([refundPolicyId])).get(refundPolicyId) ?? null : null;
    return effectiveTerms(own, current);
  }

  async versions() {
    const rows = await this.prisma.refundPolicy.findMany({ orderBy: { version: 'desc' }, take: 50 });
    const current = await this.current();
    const counts = await this.prisma.order.groupBy({ by: ['refundPolicyId'], _count: { _all: true }, where: { refundPolicyId: { in: rows.map((r) => r.id) } } });
    const users = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.createdById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    return {
      current,
      items: rows.map((r, i) => ({
        ...toTerms(r),
        createdAt: r.createdAt,
        createdBy: users.find((u) => u.id === r.createdById)?.name ?? null,
        // A version is in force from its date until the next one.
        effectiveUntil: i > 0 ? rows[i - 1]!.effectiveFrom : null,
        inForce: r.id === current.id,
        orders: counts.find((c) => c.refundPolicyId === r.id)?._count._all ?? 0,
      })),
    };
  }

  /** What the public pages show: the numbers in force and the dates of earlier versions. */
  async publicPolicy() {
    const c = await this.current();
    const rows = await this.prisma.refundPolicy.findMany({ orderBy: { version: 'desc' }, take: 20, select: { version: true, windowDays: true, maxWatchedPercent: true, effectiveFrom: true } });
    return {
      version: c.version, windowDays: c.windowDays, maxWatchedPercent: c.maxWatchedPercent, effectiveFrom: c.effectiveFrom,
      selfServicePerYear: c.selfServicePerYear, autoApprove: c.autoCheck && c.autoApprove,
      // Course access length (one source: access/access.ts), shown at checkout and on the policy page.
      accessMonths: ACCESS_MONTHS,
      history: rows.map((r, i) => ({ ...r, effectiveUntil: i > 0 ? rows[i - 1]!.effectiveFrom : null })),
    };
  }

  async save(a: Actor, input: PolicyInput & { note?: string; code?: string }) {
    if (!a.user.roles.includes('super_admin')) throw forbidden('Only a super admin can change the refund policy', 'super_admin_required');
    const problems = policyProblems(input);
    if (problems.length) throw badRequest(problems.join(' '), 'invalid_policy');
    await this.stepUp(a, input.code);
    const before = await this.current();
    const last = await this.prisma.refundPolicy.findFirst({ orderBy: { version: 'desc' }, select: { version: true } });
    const row = await this.prisma.refundPolicy.create({
      data: {
        version: (last?.version ?? 0) + 1,
        windowDays: input.windowDays,
        maxWatchedPercent: input.maxWatchedPercent,
        autoCheck: input.autoCheck,
        autoReject: input.autoCheck && input.autoReject,
        autoApprove: input.autoCheck && input.autoApprove,
        allowExceptions: input.allowExceptions,
        selfServicePerYear: input.selfServicePerYear,
        messages: clean(input.messages) as object,
        note: input.note?.trim().slice(0, 500) || null,
        createdById: a.user.id,
      },
    });
    this.cache = null;
    const after = toTerms(row);
    await this.audit.log({
      actorId: a.user.id, action: 'refund.policy_changed', targetType: 'settings', targetId: row.id, ip: a.ip,
      meta: {
        version: row.version,
        before: { version: before.version, windowDays: before.windowDays, maxWatchedPercent: before.maxWatchedPercent, autoCheck: before.autoCheck, autoReject: before.autoReject, autoApprove: before.autoApprove, allowExceptions: before.allowExceptions, selfServicePerYear: before.selfServicePerYear },
        after: { windowDays: after.windowDays, maxWatchedPercent: after.maxWatchedPercent, autoCheck: after.autoCheck, autoReject: after.autoReject, autoApprove: after.autoApprove, allowExceptions: after.allowExceptions, selfServicePerYear: after.selfServicePerYear },
        note: row.note,
      },
    });
    return this.versions();
  }

  private async stepUp(a: Actor, code?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { mfaEnabledAt: true } });
    if (stepUpSkipped(!!me?.mfaEnabledAt)) return;
    if (!code) throw badRequest('Enter the six-digit code from your Google Authenticator app to confirm this change.', 'step_up_required');
    await this.signIn.checkCode(a.user.id, code, a.ip);
  }
}
