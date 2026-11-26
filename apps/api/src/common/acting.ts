import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * "DEL Studio": a super admin working in the instructor studio as the platform's own instructor account (DEL).
 * The swap only applies to `/api/instructor/*`; every audit entry written during such a request names the real person.
 * Support sessions and AI agents (docs/SUPPORT_SESSIONS_AND_AGENTS.md) use the same context.
 */
export const ACT_AS_COOKIE = 'act_as';
export const ACT_AS_PLATFORM = 'platform';
export const STUDIO_PATH = /^\/api\/instructor(\/|$)/;

/** One mutable object per request (opened by `actingContextMiddleware`), filled in by the auth guard when acting. */
export interface ActingContext {
  /** The real person (super admin; for agents the admin who issued the token). */
  realUserId?: string;
  /** The account whose dashboard/data the request uses. */
  actingAsId?: string;
  supportSessionId?: string;
  agentTokenId?: string;
  /** Why (support session reason, agent token reason). */
  reason?: string;
}
export const acting = new AsyncLocalStorage<ActingContext>();

/** Express middleware: every request runs inside its own context, so the guard's values reach services and audit. */
export const actingContextMiddleware = (_req: unknown, _res: unknown, next: () => void) => acting.run({}, next);
