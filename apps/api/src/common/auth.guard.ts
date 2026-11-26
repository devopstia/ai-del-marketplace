import { CanActivate, ExecutionContext, Injectable, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Role } from '../generated/prisma/enums';
import { AppRequest, CAPABILITY, hasRole, IS_PUBLIC, PERMISSION, ROLES } from './auth-context';
import { canWithConfig, DEFAULT_ROLE_CONFIG, hasCapability, type AdminPermission, type Capability } from './permissions';
import { RoleConfigService } from './role-config.service';
import { SESSION_COOKIE } from './cookies';
import { ACT_AS_COOKIE, ACT_AS_PLATFORM, acting, STUDIO_PATH } from './acting';
import { forbidden, unauthorized } from './errors';
import { PrismaService } from './prisma.service';
import { ADMIN_MESSAGE, IDLE_MESSAGE, LIFETIME_MESSAGE, REPLACED_MESSAGE, SessionPolicyService } from './session-policy.service';
import { AssistResolver } from '../assist/assist-resolver';

/** Ends a browser is told about (401 `session_<reason>`); a plain logout or a password change just reads as signed out. */
const ENDED_MESSAGES: Record<string, string> = { replaced: REPLACED_MESSAGE, idle: IDLE_MESSAGE, lifetime: LIFETIME_MESSAGE, admin: ADMIN_MESSAGE };
const PROGRESS_PATH = /\/lectures\/[^/]+\/progress\/?$/;

/** What a person with a temporary password may still call (sign-in state, the password change, sign-out). */
const PASSWORD_CHANGE_PATHS = /^\/api\/auth\/(me|password|logout|csrf|security|password-policy)$/;

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Global guard: resolves the `sid` cookie to a live session and user (attached to every request, public or not),
 * then enforces sign-in (unless @Public) and @Roles. Support sessions and AI agent tokens are resolved by
 * AssistResolver (docs/SUPPORT_SESSIONS_AND_AGENTS.md); `req.user` is always the effective user.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly assist: AssistResolver;
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly policy: SessionPolicyService,
    @Optional() private readonly roleConfig?: RoleConfigService,
  ) {
    this.assist = new AssistResolver(prisma);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length >= 20 && token.length <= 200) {
      const session = await this.prisma.session.findUnique({
        where: { id: hashSessionToken(token) },
        include: { user: { select: { id: true, email: true, name: true, roles: true, status: true, adminPermissions: true, mustChangePassword: true } } },
      });
      if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === 'active') {
        const ended = await this.sessionLimits(session, req);
        if (ended) req.sessionEnded = ended;
        else {
          const { status: _s, mustChangePassword, ...user } = session.user;
          req.user = user;
          if (mustChangePassword) req.mustChangePassword = true;
          req.sessionId = session.id;
          req.sessionKind = session.kind;
          // Watching a lesson is activity: the player saves progress every few seconds while it plays.
          if (req.method === 'PUT' && PROGRESS_PATH.test(req.path ?? req.url ?? '')) await this.policy.touch(session.id);
          // A super admin in a support session works as the user; otherwise maybe "DEL Studio".
          if (!(await this.assist.support(req))) await this.maybeActAsPlatform(req);
        }
      } else if (session?.revokedAt && session.endedReason && ENDED_MESSAGES[session.endedReason]) {
        req.sessionEnded = session.endedReason;
      }
    } else {
      await this.assist.agent(req);
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic && !roles?.length) return true;
    if (!req.user && req.sessionEnded) throw unauthorized(ENDED_MESSAGES[req.sessionEnded], `session_${req.sessionEnded}`);
    if (!req.user) throw unauthorized();
    // A temporary password set by a super admin: only the sign-in and password routes until the person picks their own.
    if (req.mustChangePassword && !PASSWORD_CHANGE_PATHS.test(req.path ?? req.url ?? '')) {
      throw forbidden('Choose a new password before you continue.', 'password_change_required');
    }
    if (roles?.length && !roles.some((r) => hasRole(req.user, r))) throw forbidden();
    const perm = this.reflector.getAllAndOverride<AdminPermission | undefined>(PERMISSION, [ctx.getHandler(), ctx.getClass()]);
    // In "DEL Studio" mode req.user is DEL's instructor account; permissions are always the real person's.
    const cap = this.reflector.getAllAndOverride<Capability | undefined>(CAPABILITY, [ctx.getHandler(), ctx.getClass()]);
    if (perm || cap) {
      const cfg = this.roleConfig ? await this.roleConfig.get() : DEFAULT_ROLE_CONFIG;
      // In a support session or agent call they are the USER's: viewing someone's dashboard never widens what it can do.
      const subject = req.support || req.agent ? req.user : (req.realUser ?? req.user);
      if (perm && !canWithConfig(subject, perm, cfg)) throw forbidden('Your admin account does not have this permission', 'permission_required');
      if (cap && !hasCapability(subject, cap, cfg)) throw forbidden('This is turned off on DevOps Easy Learning right now.', 'capability_disabled');
    }
    return true;
  }

  /**
   * Session security (docs/AUTH.md §7), for ordinary sign-ins: the maximum lifetime and the inactivity timeout from the
   * Super Admin's settings. Activity is written by the heartbeat and video progress, not by every request, so background
   * polling never keeps an abandoned browser signed in. Returns the reason when the session has just ended.
   */
  private async sessionLimits(session: { id: string; userId: string; kind: string; createdAt: Date; lastActiveAt: Date | null }, req: AppRequest): Promise<string | null> {
    if (session.kind !== 'user') return null;
    const s = await this.policy.settings();
    const now = Date.now();
    if (session.createdAt.getTime() + s.session.lifetimeHours * 3600_000 <= now) {
      await this.policy.end({ ids: [session.id], userId: session.userId }, 'lifetime', { ip: req.ip ?? null });
      return 'lifetime';
    }
    const last = (session.lastActiveAt ?? session.createdAt).getTime();
    if (last + s.session.inactivityMinutes * 60_000 <= now) {
      await this.policy.end({ ids: [session.id], userId: session.userId }, 'idle', { ip: req.ip ?? null });
      return 'idle';
    }
    return null;
  }

  /** Super admin in "DEL Studio" mode: studio requests run as DEL's instructor account; the real user is kept for audit. */
  private async maybeActAsPlatform(req: AppRequest) {
    if (req.cookies?.[ACT_AS_COOKIE] !== ACT_AS_PLATFORM || !req.user?.roles.includes('super_admin')) return;
    if (!STUDIO_PATH.test(req.path ?? req.url ?? '')) return;
    const del = await this.prisma.instructorProfile.findFirst({
      where: { isPlatform: true, status: 'approved', user: { status: 'active' } },
      orderBy: { createdAt: 'asc' },
      select: { user: { select: { id: true, email: true, name: true, roles: true, adminPermissions: true } } },
    });
    if (!del) return;
    const real = req.user;
    req.realUser = real;
    req.user = { ...del.user, roles: Array.from(new Set([...del.user.roles, 'instructor' as const])) };
    const ctx = acting.getStore();
    if (ctx) Object.assign(ctx, { realUserId: real.id, actingAsId: del.user.id });
  }
}
