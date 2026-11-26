import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums';
import type { AdminPermission } from './permissions';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  /** Admin role only (src/common/permissions.ts). */
  adminPermissions?: string[];
}

/** sessionKind: 'user' or 'support' (docs/AUTH.md §7); sessionEnded: why the cookie's session ended (replaced, idle, …). */
export type AppRequest = Request & { user?: AuthUser; realUser?: AuthUser; sessionId?: string; sessionKind?: string; sessionEnded?: string; rawBody?: Buffer };

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const SKIP_CSRF = 'skipCsrf';
export const PERMISSION = 'permission';

/** Route is reachable without a session (a session, if present, is still attached). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route requires one of these roles. super_admin implicitly has admin. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/**
 * Route requires an admin permission (super admins have all). Implies an admin role; use instead of @Roles('admin').
 * Checked by the global guard on every request: switching dashboards never changes what an account may do.
 */
export const Perm = (perm: AdminPermission) => SetMetadata(PERMISSION, perm);
/** Route is exempt from CSRF (server-to-server webhooks only). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AppRequest>().user);

export interface Actor {
  user: AuthUser;
  ip: string | null;
}
/** The signed-in user plus request IP, for services that audit. */
export const ActorCtx = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  return { user: req.user!, ip: req.ip ?? null };
});

export const hasRole = (user: Pick<AuthUser, 'roles'> | undefined, role: Role) =>
  !!user && (user.roles.includes(role) || (role === 'admin' && user.roles.includes('super_admin')));
export const isAdmin = (user: Pick<AuthUser, 'roles'> | undefined) => hasRole(user, 'admin');
