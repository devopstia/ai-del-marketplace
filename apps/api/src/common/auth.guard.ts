import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Role } from '../generated/prisma/enums';
import { AppRequest, hasRole, IS_PUBLIC, PERMISSION, ROLES } from './auth-context';
import { can, type AdminPermission } from './permissions';
import { SESSION_COOKIE } from './cookies';
import { ACT_AS_COOKIE, ACT_AS_PLATFORM, acting, STUDIO_PATH } from './acting';
import { forbidden, unauthorized } from './errors';
import { PrismaService } from './prisma.service';
import { AssistResolver } from '../assist/assist-resolver';

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
  ) {
    this.assist = new AssistResolver(prisma);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length >= 20 && token.length <= 200) {
      const session = await this.prisma.session.findUnique({
        where: { id: hashSessionToken(token) },
        include: { user: { select: { id: true, email: true, name: true, roles: true, status: true, adminPermissions: true } } },
      });
      if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === 'active') {
        const { status: _s, ...user } = session.user;
        req.user = user;
        req.sessionId = session.id;
        // A super admin in a support session works as the user; otherwise maybe "DEL Studio".
        if (!(await this.assist.support(req))) await this.maybeActAsPlatform(req);
      }
    } else {
      await this.assist.agent(req);
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic && !roles?.length) return true;
    if (!req.user) throw unauthorized();
    if (roles?.length && !roles.some((r) => hasRole(req.user, r))) throw forbidden();
    const perm = this.reflector.getAllAndOverride<AdminPermission | undefined>(PERMISSION, [ctx.getHandler(), ctx.getClass()]);
    // In "DEL Studio" mode req.user is DEL's instructor account; permissions are always the real person's.
    // In a support session they are the USER's: viewing someone's dashboard never widens what it can do.
    if (perm && !can(req.support || req.agent ? req.user : (req.realUser ?? req.user), perm)) throw forbidden('Your admin account does not have this permission', 'permission_required');
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
