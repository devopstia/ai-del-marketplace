import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import type { Actor, AppRequest } from '../common/auth-context';
import { AuditService } from '../common/audit.service';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { randomToken } from '../common/util';
import { env, isProd } from '../config/env';
import { SignInService } from '../auth/signin.service';
import { minutesLabel, sha256, SUPPORT_COOKIE, SUPPORT_DEFAULT_MINUTES, SUPPORT_MAX_MINUTES, supportCookieOptions } from './assist-context';

const stamp = (d: Date) => d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';

/** Where the support session opens: the account's main dashboard. */
export function landingFor(roles: string[]) {
  if (roles.includes('admin')) return '/admin';
  if (roles.includes('instructor')) return '/studio';
  return '/student';
}

/**
 * "Switch to user dashboard" (owner 2026-11-26, docs/SUPPORT_SESSIONS_AND_AGENTS.md). A super admin, after an
 * authenticator code and a written reason, sees and works in another account's dashboard for a limited time, without
 * that person's password. The person's own sessions are untouched; they get an email; everything is audited.
 */
@Injectable()
export class SupportSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly signIn: SignInService,
  ) {}

  async start(req: AppRequest, res: Response, input: { userId: string; reason: string; code?: string; minutes?: number }) {
    const admin = req.user!;
    if (!admin.roles.includes('super_admin') || !req.sessionId) throw forbidden();
    const reason = input.reason.trim();
    if (reason.length < 5) throw badRequest('Say why you are opening this dashboard (at least a few words). It is shown to the person and kept in the audit log.', 'reason_required');
    if (input.userId === admin.id) throw badRequest('You are already in your own dashboard.', 'self');
    const target = await this.prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, name: true, email: true, roles: true, status: true } });
    if (!target) throw notFound('User');
    if (target.roles.includes('super_admin')) throw forbidden('Super admin dashboards can’t be opened in a support session. Ask that super admin directly.', 'support_target_super_admin');
    if (target.status !== 'active') throw conflict('This account is suspended. Reactivate it first, or look at it in Super Admin › Users.', 'support_target_inactive');
    await this.stepUp({ user: admin, ip: req.ip ?? null }, input.code);

    // One support session at a time per admin browser: replace any open one.
    if (req.support) await this.close(req.support.id, 'returned');
    const minutes = Math.min(SUPPORT_MAX_MINUTES, Math.max(5, input.minutes ?? SUPPORT_DEFAULT_MINUTES));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + minutes * 60_000);
    const { token, s } = await this.createSupportRecord({ actorId: admin.id, subjectId: target.id, adminSessionId: req.sessionId, reason, expiresAt, ip: req.ip ?? null, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) || null });
    res.cookie(SUPPORT_COOKIE, token, supportCookieOptions(minutes * 60_000));
    await this.audit.log({ actorId: admin.id, action: 'support.session_started', targetType: 'user', targetId: target.id, ip: req.ip ?? null, onBehalfOfId: target.id, supportSessionId: s.id, meta: { reason, minutes, expiresAt: expiresAt.toISOString() } });
    await this.jobs.sendEmail({
      to: target.email, template: 'security-support-session', dedupeKey: `support-start:${s.id}`,
      data: { name: target.name, admin: `${admin.name} (DevOps Easy Learning super admin)`, reason, startedAt: stamp(now), expiresAt: stamp(expiresAt) },
    });
    return { active: true, subject: { id: target.id, name: target.name, email: target.email, roles: target.roles }, expiresAt, landing: landingFor(target.roles) };
  }

  /** Banner data. Public: answers { active: false } for everyone else. */
  status(req: AppRequest) {
    const s = req.support;
    if (!s) return { active: false };
    return {
      active: true,
      id: s.id,
      reason: s.reason,
      startedAt: s.startedAt,
      expiresAt: s.expiresAt,
      actor: { name: s.actor.name },
      subject: s.subject,
      returnTo: `/admin/users?open=${encodeURIComponent(s.subject.id)}`,
    };
  }

  /** "Return to Super Admin dashboard": ends the support session; the admin's own session simply continues. */
  async end(req: AppRequest, res: Response) {
    res.clearCookie(SUPPORT_COOKIE, { path: '/', httpOnly: true, secure: isProd(), sameSite: 'lax' });
    const s = req.support;
    if (!s) return { ended: false, returnTo: '/admin' };
    await this.close(s.id, 'returned');
    return { ended: true, returnTo: `/admin/users?open=${encodeURIComponent(s.subject.id)}` };
  }

  /** Super admin: recent support sessions (optionally for one user). */
  async history(userId?: string) {
    const rows = await this.prisma.supportSession.findMany({ where: userId ? { OR: [{ subjectId: userId }, { actorId: userId }] } : {}, orderBy: { startedAt: 'desc' }, take: 50 });
    const ids = [...new Set(rows.flatMap((r) => [r.actorId, r.subjectId]))];
    const people = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u]));
    const actions = await this.prisma.auditLog.groupBy({ by: ['supportSessionId'], where: { supportSessionId: { in: rows.map((r) => r.id) } }, _count: true });
    const count = new Map(actions.map((a) => [a.supportSessionId, a._count]));
    const now = Date.now();
    return {
      items: rows.map((r) => {
        const open = !r.endedAt && r.expiresAt.getTime() > now;
        const end = r.endedAt ?? (open ? null : r.expiresAt);
        return {
          id: r.id, reason: r.reason, startedAt: r.startedAt, expiresAt: r.expiresAt, endedAt: end,
          status: open ? 'active' : r.endedReason ?? 'expired',
          duration: minutesLabel((end?.getTime() ?? now) - r.startedAt.getTime()),
          admin: people.get(r.actorId) ?? null, user: people.get(r.subjectId) ?? null,
          actions: count.get(r.id) ?? 0,
        };
      }),
    };
  }

  /** Another super admin (or the same one from another browser) ends a running support session. */
  async revoke(a: Actor, id: string) {
    const s = await this.prisma.supportSession.findUnique({ where: { id } });
    if (!s) throw notFound('Support session');
    if (s.endedAt || s.expiresAt <= new Date()) return { ended: true };
    await this.close(id, 'revoked');
    await this.audit.log({ actorId: a.user.id, action: 'support.session_revoked', targetType: 'user', targetId: s.subjectId, ip: a.ip, onBehalfOfId: s.subjectId, supportSessionId: id });
    return { ended: true };
  }

  /**
   * MERGE POINT (auth fork, feat/auth-sessions): the ONLY place a support session is created. When sessions gain
   * `kind`, also create the session row here with `SignInService.createSession(subjectId, ctx, { kind: 'support',
   * ttlMs })` so it never counts toward or ends the person's own sessions and only its own expiresAt applies.
   */
  private async createSupportRecord(data: { actorId: string; subjectId: string; adminSessionId: string; reason: string; expiresAt: Date; ip: string | null; userAgent: string | null }) {
    const token = randomToken(32);
    const s = await this.prisma.supportSession.create({ data: { id: sha256(token), ...data } });
    return { token, s };
  }

  /**
   * MERGE POINT (auth fork): the ONLY place a support session ends. After the merge, end the matching
   * `kind: 'support'` session through `SessionPolicyService.end()` here as well.
   */
  private async close(id: string, why: 'returned' | 'revoked') {
    const s = await this.prisma.supportSession.findUnique({ where: { id } });
    if (!s || s.endedAt) return;
    const endedAt = new Date();
    await this.prisma.supportSession.update({ where: { id }, data: { endedAt, endedReason: why } });
    if (why === 'returned') {
      await this.audit.log({ actorId: s.actorId, action: 'support.session_ended', targetType: 'user', targetId: s.subjectId, onBehalfOfId: s.subjectId, supportSessionId: id, meta: { duration: minutesLabel(endedAt.getTime() - s.startedAt.getTime()) } });
    }
  }

  private async stepUp(a: Actor, code?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { mfaEnabledAt: true } });
    // Same rule as every other privileged change: local development without an authenticator only.
    if (!me?.mfaEnabledAt && !env().MFA_REQUIRED && !isProd()) return;
    if (!code) throw badRequest('Enter the six-digit code from your Google Authenticator app to open this dashboard.', 'step_up_required');
    await this.signIn.checkCode(a.user.id, code, a.ip);
  }
}
