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

/** What a person with a temporary password may still call (sign-in state, the password change, sign-out). */
const PASSWORD_CHANGE_PATHS = /^\/api\/auth\/(me|password|logout|csrf|security|password-policy)$/;

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Global guard: resolves the `sid` cookie to a live session and user (attached to every request, public or not),
 * then enforces sign-in (unless @Public) and @Roles.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Optional() private readonly roleConfig?: RoleConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length >= 20 && token.length <= 200) {
      const session = await this.prisma.session.findUnique({
        where: { id: hashSessionToken(token) },
        include: { user: { select: { id: true, email: true, name: true, roles: true, status: true, adminPermissions: true, mustChangePassword: true } } },
      });
      if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === 'active') {
        const { status: _s, mustChangePassword, ...user } = session.user;
        req.user = user;
        if (mustChangePassword) req.mustChangePassword = true;
        req.sessionId = session.id;
        await this.maybeActAsPlatform(req);
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic && !roles?.length) return true;
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
      if (perm && !canWithConfig(req.realUser ?? req.user, perm, cfg)) throw forbidden('Your admin account does not have this permission', 'permission_required');
      if (cap && !hasCapability(req.realUser ?? req.user, cap, cfg)) throw forbidden('This is turned off on DevOps Easy Learning right now.', 'capability_disabled');
    }
    return true;
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
