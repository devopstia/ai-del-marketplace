import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Role } from '../generated/prisma/enums';
import { AppRequest, hasRole, IS_PUBLIC, ROLES } from './auth-context';
import { SESSION_COOKIE } from './cookies';
import { forbidden, unauthorized } from './errors';
import { PrismaService } from './prisma.service';

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
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length >= 20 && token.length <= 200) {
      const session = await this.prisma.session.findUnique({
        where: { id: hashSessionToken(token) },
        include: { user: { select: { id: true, email: true, name: true, roles: true, status: true } } },
      });
      if (session && !session.revokedAt && session.expiresAt > new Date() && session.user.status === 'active') {
        const { status: _s, ...user } = session.user;
        req.user = user;
        req.sessionId = session.id;
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic && !roles?.length) return true;
    if (!req.user) throw unauthorized();
    if (roles?.length && !roles.some((r) => hasRole(req.user, r))) throw forbidden();
    return true;
  }
}
