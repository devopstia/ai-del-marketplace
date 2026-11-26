import { Injectable } from '@nestjs/common';
import type { Actor } from '../common/auth-context';
import { AuditService } from '../common/audit.service';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { randomToken } from '../common/util';
import { env, isProd, stepUpSkipped } from '../config/env';
import { SignInService } from '../auth/signin.service';
import { AGENT_SCOPES, AGENT_TOKEN_PREFIX, isScope, sha256 } from '../assist/assist-context';

export const AGENT_MAX_DAYS = 30;
const stamp = (d: Date) => d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

/** Plain-English description of each scope (admin page and docs). */
export const SCOPE_INFO: Record<(typeof AGENT_SCOPES)[number], string> = {
  'courses:read': 'See the instructor’s courses, videos and processing status',
  'courses:write': 'Create courses and edit drafts: details, sections, lessons, quizzes, cover',
  uploads: 'Upload videos and files and attach them to lessons',
  submit: 'Submit a validated course for review (a super admin still approves publication)',
};

/**
 * AI agent tokens (docs/SUPPORT_SESSIONS_AND_AGENTS.md): a super admin issues a token for ONE instructor with explicit
 * scopes and an expiry (max 30 days). Stored hashed and shown once. Never publishes, never sees payments or anyone
 * else's data; the instructor is emailed and stays the owner of everything the agent creates.
 */
@Injectable()
export class AgentTokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly signIn: SignInService,
  ) {}

  scopes() {
    return { scopes: AGENT_SCOPES.map((k) => ({ key: k, description: SCOPE_INFO[k] })), maxDays: AGENT_MAX_DAYS };
  }

  async issue(a: Actor, input: { instructorId: string; name: string; scopes: string[]; days?: number; reason: string; code?: string }) {
    const scopes = [...new Set(input.scopes)];
    if (!scopes.length || !scopes.every(isScope)) throw badRequest(`Pick scopes from: ${AGENT_SCOPES.join(', ')}`, 'invalid_scopes');
    if (input.reason.trim().length < 5) throw badRequest('Say what the agent is for (it is shown to the instructor and kept in the audit log).', 'reason_required');
    const who = await this.prisma.user.findUnique({ where: { id: input.instructorId }, select: { id: true, name: true, email: true, roles: true, status: true } });
    if (!who) throw notFound('Instructor');
    if (!who.roles.includes('instructor')) throw badRequest('Agent tokens are only for instructor accounts', 'not_instructor');
    if (who.roles.includes('super_admin')) throw forbidden('Issue the token for the instructor account, not a super admin.', 'agent_target_super_admin');
    if (who.status !== 'active') throw conflict('This account is suspended', 'inactive');
    await this.stepUp(a, input.code);
    const days = Math.min(AGENT_MAX_DAYS, Math.max(1, input.days ?? 7));
    const token = `${AGENT_TOKEN_PREFIX}${randomToken(32)}`;
    const expiresAt = new Date(Date.now() + days * 86_400_000);
    const t = await this.prisma.agentToken.create({
      data: { name: input.name.trim(), tokenHash: sha256(token), prefix: token.slice(0, AGENT_TOKEN_PREFIX.length + 6), instructorId: who.id, issuedById: a.user.id, scopes, reason: input.reason.trim(), expiresAt },
    });
    await this.audit.log({ actorId: a.user.id, action: 'agent.token_issued', targetType: 'user', targetId: who.id, ip: a.ip, onBehalfOfId: who.id, agentTokenId: t.id, meta: { name: t.name, scopes, expiresAt, reason: t.reason } });
    await this.jobs.sendEmail({ to: who.email, template: 'security-agent-access', dedupeKey: `agent-token:${t.id}`, data: { name: who.name, admin: a.user.name, agent: t.name, reason: t.reason, expiresAt: stamp(expiresAt) } });
    // The only time the token is returned.
    return { token, ...(await this.view(t.id)) };
  }

  async list() {
    const rows = await this.prisma.agentToken.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return { items: await Promise.all(rows.map((r) => this.view(r.id, r))) };
  }

  async revoke(a: Actor, id: string) {
    const t = await this.prisma.agentToken.findUnique({ where: { id } });
    if (!t) throw notFound('Agent token');
    if (!t.revokedAt) {
      await this.prisma.agentToken.update({ where: { id }, data: { revokedAt: new Date(), revokedById: a.user.id } });
      await this.audit.log({ actorId: a.user.id, action: 'agent.token_revoked', targetType: 'user', targetId: t.instructorId, ip: a.ip, onBehalfOfId: t.instructorId, agentTokenId: t.id });
    }
    return this.view(id);
  }

  /** What agents did (newest first), optionally for one token. */
  async activity(tokenId?: string) {
    const rows = await this.prisma.auditLog.findMany({ where: tokenId ? { agentTokenId: tokenId } : { agentTokenId: { not: null } }, orderBy: { at: 'desc' }, take: 100 });
    const tokens = new Map((await this.prisma.agentToken.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.agentTokenId!))] } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]));
    return { items: rows.map((r) => ({ id: r.id, at: r.at, action: r.action, status: r.status, targetType: r.targetType, targetId: r.targetId, agent: tokens.get(r.agentTokenId!) ?? null, meta: r.meta })) };
  }

  /** Courses agents submitted that wait for a super admin decision (approved in Admin › Course reviews). */
  async pending() {
    const subs = await this.prisma.auditLog.findMany({ where: { agentTokenId: { not: null }, action: { in: ['course.submitted', 'course.revision_submitted'] } }, select: { targetId: true, at: true, agentTokenId: true }, orderBy: { at: 'desc' }, take: 200 });
    const ids = [...new Set(subs.map((s) => s.targetId).filter((x): x is string => !!x))];
    const courses = await this.prisma.course.findMany({
      where: { id: { in: ids }, OR: [{ status: 'in_review' }, { revisions: { some: { status: 'in_review' } } }] },
      select: { id: true, title: true, status: true, slug: true, instructor: { select: { id: true, name: true } } },
    });
    return { items: courses.map((c) => ({ ...c, submittedAt: subs.find((s) => s.targetId === c.id)?.at ?? null })) };
  }

  private async view(id: string, row?: Awaited<ReturnType<PrismaService['agentToken']['findUnique']>>) {
    const t = row ?? (await this.prisma.agentToken.findUniqueOrThrow({ where: { id } }));
    const people = new Map((await this.prisma.user.findMany({ where: { id: { in: [t!.instructorId, t!.issuedById] } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
    const actions = await this.prisma.auditLog.count({ where: { agentTokenId: t!.id } });
    const now = Date.now();
    return {
      id: t!.id, name: t!.name, prefix: t!.prefix, scopes: t!.scopes, reason: t!.reason, createdAt: t!.createdAt, expiresAt: t!.expiresAt, revokedAt: t!.revokedAt, lastUsedAt: t!.lastUsedAt,
      status: t!.revokedAt ? 'revoked' : t!.expiresAt.getTime() <= now ? 'expired' : 'active',
      instructor: people.get(t!.instructorId) ?? null, issuedBy: people.get(t!.issuedById) ?? null, actions,
    };
  }

  private async stepUp(a: Actor, code?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { mfaEnabledAt: true } });
    if (stepUpSkipped(!!me?.mfaEnabledAt)) return;
    if (!code) throw badRequest('Enter the six-digit code from your Google Authenticator app to issue an agent token.', 'step_up_required');
    await this.signIn.checkCode(a.user.id, code, a.ip);
  }
}
