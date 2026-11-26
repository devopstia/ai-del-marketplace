import type { AppRequest } from '../common/auth-context';
import { AuditService } from '../common/audit.service';
import { forbidden, unauthorized } from '../common/errors';
import type { PrismaService } from '../common/prisma.service';
import { AGENT_PATH, agentBearer, enterActing, sha256, SUPPORT_COOKIE, SUPPORT_SELF_PATH, supportBlockReason } from './assist-context';

const pathOf = (req: AppRequest) => req.path ?? req.url ?? '';

/**
 * Resolves support sessions (super admin in a user's dashboard) and AI agent tokens for the global AuthGuard.
 * Plain class (no DI) so the guard keeps its constructor; docs/SUPPORT_SESSIONS_AND_AGENTS.md.
 */
export class AssistResolver {
  private readonly audit: AuditService;
  constructor(private readonly prisma: PrismaService) {
    this.audit = new AuditService(prisma);
  }

  /**
   * The super admin's browser carries `support_sid` next to their own `sid`. Valid only for the admin who started it,
   * with the same admin session, until it ends or expires; the target must still be an active non-super-admin.
   * Returns true when a support session is active for this request (even on /support-session paths, which keep the
   * admin's identity).
   */
  async support(req: AppRequest): Promise<boolean> {
    const raw = req.cookies?.[SUPPORT_COOKIE];
    if (typeof raw !== 'string' || raw.length < 20 || raw.length > 200) return false;
    const admin = req.user;
    if (!admin?.roles.includes('super_admin') || !req.sessionId) return false;
    const s = await this.prisma.supportSession.findUnique({ where: { id: sha256(raw) } });
    if (!s || s.endedAt || s.expiresAt <= new Date() || s.actorId !== admin.id || s.adminSessionId !== req.sessionId) return false;
    const subject = await this.prisma.user.findUnique({ where: { id: s.subjectId }, select: { id: true, email: true, name: true, roles: true, status: true, adminPermissions: true } });
    if (!subject || subject.status !== 'active' || subject.roles.includes('super_admin')) return false;
    const { status: _st, ...subjectUser } = subject;
    req.support = {
      id: s.id, reason: s.reason, startedAt: s.startedAt, expiresAt: s.expiresAt,
      actor: { id: admin.id, name: admin.name, email: admin.email },
      subject: { id: subject.id, name: subject.name, email: subject.email, roles: subject.roles },
    };
    const path = pathOf(req);
    if (SUPPORT_SELF_PATH.test(path)) return true;
    req.realUser = admin;
    req.user = subjectUser;
    enterActing({ realUserId: admin.id, actingAsId: subject.id, supportSessionId: s.id, reason: s.reason });
    const why = supportBlockReason(req.method, path);
    if (why) {
      await this.audit.log({ actorId: admin.id, action: 'support.request_blocked', targetType: 'user', targetId: subject.id, ip: req.ip ?? null, status: 'failed', meta: { method: req.method, path } }).catch(() => undefined);
      throw forbidden(`Not available in a support session. ${why}`, 'support_restricted');
    }
    return true;
  }

  /**
   * `Authorization: Bearer del_agent_…` (no session cookie): an AI agent working for one instructor, only on
   * /api/agent/*. The request runs as the instructor (ownership stays theirs); audit names the issuing admin + agent.
   */
  async agent(req: AppRequest): Promise<void> {
    const token = agentBearer(req);
    if (!token) return;
    const t = await this.prisma.agentToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!t || t.revokedAt || t.expiresAt <= new Date()) throw unauthorized('This agent token is expired or was revoked. Ask a super admin for a new one.', 'agent_token_invalid');
    const user = await this.prisma.user.findUnique({ where: { id: t.instructorId }, select: { id: true, email: true, name: true, roles: true, status: true } });
    if (!user || user.status !== 'active' || !user.roles.includes('instructor')) throw unauthorized('The instructor of this agent token is no longer active.', 'agent_token_invalid');
    if (!AGENT_PATH.test(pathOf(req))) throw forbidden('Agent tokens only work on /api/agent/*.', 'agent_scope');
    // Only the instructor role: the token can never use any admin power the account may also have.
    req.user = { id: user.id, email: user.email, name: user.name, roles: ['student', 'instructor'], adminPermissions: [] };
    req.agent = { tokenId: t.id, name: t.name, issuedById: t.issuedById, instructorId: t.instructorId, scopes: t.scopes, expiresAt: t.expiresAt };
    enterActing({ realUserId: t.issuedById, actingAsId: user.id, agentTokenId: t.id, reason: t.reason || undefined });
    if (!t.lastUsedAt || Date.now() - t.lastUsedAt.getTime() > 60_000) {
      await this.prisma.agentToken.update({ where: { id: t.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
    }
  }
}
