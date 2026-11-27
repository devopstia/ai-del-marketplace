import { createHash } from 'node:crypto';
import type { CookieOptions } from 'express';
import type { AppRequest } from '../common/auth-context';
import { acting } from '../common/acting';
import { isProd } from '../config/env';

/**
 * Support sessions and AI agent tokens (docs/SUPPORT_SESSIONS_AND_AGENTS.md): how a request becomes "the super admin
 * working in Sam's dashboard" or "an AI agent working for instructor Nadia". Used by the global AuthGuard.
 */
export const SUPPORT_COOKIE = 'support_sid';
export const AGENT_TOKEN_PREFIX = 'del_agent_';
export const SUPPORT_DEFAULT_MINUTES = 60;
export const SUPPORT_MAX_MINUTES = 120;
export const AGENT_SCOPES = ['courses:read', 'courses:write', 'uploads', 'submit'] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export const supportCookieOptions = (maxAgeMs: number): CookieOptions => ({ httpOnly: true, secure: isProd(), sameSite: 'lax', path: '/', maxAge: maxAgeMs });

/** Requests about the support session itself keep the super admin's own identity (status, return, history). */
export const SUPPORT_SELF_PATH = /^\/api\/support-session(\/|$)/;
/** The only paths an agent token may call. */
export const AGENT_PATH = /^\/api\/agent(\/|$)/;

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * What a super admin may NOT do inside someone else's dashboard. Account security, money and anything that would be
 * published or counted under the person's name stays theirs; admin work is done as yourself after Return.
 * Matched against the path (with the /api prefix). `any` = also blocks reads.
 */
const SUPPORT_BLOCKED: { re: RegExp; any?: boolean; why: string }[] = [
  { re: /^\/api\/auth\/(?!me$|csrf$|session$|session\/heartbeat$)/, any: true, why: 'Password, email, two-step sign-in, sessions and linked sign-in methods stay private to the account owner.' },
  { re: /^\/api\/me\/profile$/, why: 'Profile and email changes are made by the account owner, or as yourself in Super Admin › Users.' },
  { re: /^\/api\/lectures\/[^/]+\/(progress|quiz)(\/|$)/, why: 'Watching progress and quiz answers are not recorded during a support session, so the learner’s progress and refund facts stay accurate.' },
  { re: /^\/api\/courses\/[^/]+\/(reviews|certificate)$/, why: 'Reviews and certificates are only created by the learner.' },
  { re: /^\/api\/me\/courses\/[^/]+\/ask$/, why: 'The AI assistant isn’t used in a support session.' },
  { re: /^\/api\/(cart|checkout|orders|refund-requests|dev\/test-payments)(\/|$)/, why: 'Purchases and refund requests are made only by the account owner.' },
  { re: /^\/api\/instructor\/stripe(\/|$)/, any: true, why: 'Payout and Stripe settings stay with the instructor.' },
  { re: /^\/api\/instructor\/(apply|reviews)(\/|$)/, why: 'Applications and public review replies are written by the instructor themselves.' },
  { re: /^\/api\/(instructor\/)?enrollments(\/|$)/, why: 'Manual enrollment requests involve payments; handle them as yourself in Super Admin › Enrollments.' },
  { re: /^\/api\/support\//, why: 'Support tickets are written by the account owner.' },
  { re: /^\/api\/invitations\//, why: 'Invitations are accepted by the person invited.' },
  { re: /^\/api\/admin\//, why: 'Admin changes are made as yourself: return to your Super Admin dashboard first.' },
];

/** Why this request is not allowed in a support session (null = allowed). Pure: unit-tested. */
export function supportBlockReason(method: string, path: string): string | null {
  for (const b of SUPPORT_BLOCKED) {
    if (b.re.test(path) && (b.any || !SAFE.has(method))) return b.why;
  }
  return null;
}

/** Bearer token of an agent request, when present and well formed. */
export function agentBearer(req: Pick<AppRequest, 'headers'>): string | null {
  const h = req.headers?.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return null;
  const t = h.slice(7).trim();
  return t.startsWith(AGENT_TOKEN_PREFIX) && t.length >= 30 && t.length <= 120 ? t : null;
}

export function enterActing(values: { realUserId: string; actingAsId: string; supportSessionId?: string; agentTokenId?: string; reason?: string }) {
  const ctx = acting.getStore();
  if (ctx) Object.assign(ctx, values);
}

export const isScope = (s: string): s is AgentScope => (AGENT_SCOPES as readonly string[]).includes(s);

/** Duration label used in emails and the banner ("45 min", "1 h 05 min"). */
export function minutesLabel(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
