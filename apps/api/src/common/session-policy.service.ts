import { Injectable } from '@nestjs/common';
import { AUTH_SETTINGS_KEY, type AuthSettings, DEFAULT_AUTH_SETTINGS, normalizeSettings, RELAXED_TEST_SETTINGS } from '../auth/security-settings';
import { env, isProd } from '../config/env';
import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';

const CACHE_MS = 15_000;
/** How often the API writes "last activity" for one session (a heartbeat every minute is plenty). */
export const ACTIVITY_WRITE_MS = 60_000;

/** Why a session ended (sessions.endedReason). */
export type EndReason = 'logout' | 'replaced' | 'idle' | 'lifetime' | 'admin' | 'password' | 'mfa_reset' | 'user' | 'suspended';

/** The message the disconnected browser shows (owner's wording, prompts.md). */
export const REPLACED_MESSAGE = 'Your session has ended because your account was signed in from another device or browser. If you did not authorize this login, please reset your password and contact support.';
export const IDLE_MESSAGE = 'You were signed out after a period of inactivity. Please sign in again.';
export const LIFETIME_MESSAGE = 'Your session reached its maximum length. Please sign in again.';
export const ADMIN_MESSAGE = 'Your session was ended by DevOps Easy Learning support. Please sign in again.';

/**
 * Session security (docs/AUTH.md §7): the Super Admin's settings (cached 15 s per API process, refreshed at once on save)
 * and the one place that ends sessions, so every end has a reason, an audit entry and stops the person's video keys.
 */
@Injectable()
export class SessionPolicyService {
  private cache?: { at: number; value: AuthSettings };

  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** Defaults when nothing is saved: the owner's recommended values (relaxed on test stacks only, never production). */
  defaults(): AuthSettings {
    return !isProd() && env().AUTH_SESSION_LIMITS === 'off' ? RELAXED_TEST_SETTINGS : DEFAULT_AUTH_SETTINGS;
  }

  async settings(): Promise<AuthSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const row = await this.prisma.platformSetting.findUnique({ where: { key: AUTH_SETTINGS_KEY } });
    const value = row ? normalizeSettings(row.value, this.defaults()) : this.defaults();
    this.cache = { at: Date.now(), value };
    return value;
  }

  async saved(): Promise<boolean> {
    return !!(await this.prisma.platformSetting.findUnique({ where: { key: AUTH_SETTINGS_KEY }, select: { key: true } }));
  }

  async save(value: AuthSettings) {
    await this.prisma.platformSetting.upsert({ where: { key: AUTH_SETTINGS_KEY }, create: { key: AUTH_SETTINGS_KEY, value: value as object }, update: { value: value as object } });
    this.cache = { at: Date.now(), value };
  }

  async reset() {
    await this.prisma.platformSetting.deleteMany({ where: { key: AUTH_SETTINGS_KEY } });
    this.cache = undefined;
  }

  /** Real activity on a session (heartbeat, video progress): written at most once a minute. */
  async touch(sessionId: string) {
    const cutoff = new Date(Date.now() - ACTIVITY_WRITE_MS);
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: cutoff } }] }, data: { lastActiveAt: new Date() } });
  }

  /**
   * Ends sessions with a reason, audits each and expires the person's video playback sessions (so the encryption key
   * and playlists stop at once; segment links already handed out expire with their short signature).
   */
  async end(where: { ids?: string[]; userId: string; exceptId?: string; kind?: string }, reason: EndReason, meta: { actorId?: string | null; ip?: string | null; extra?: Record<string, unknown> } = {}) {
    const rows = await this.prisma.session.findMany({
      where: { userId: where.userId, revokedAt: null, ...(where.ids ? { id: { in: where.ids } } : {}), ...(where.exceptId ? { NOT: { id: where.exceptId } } : {}), ...(where.kind ? { kind: where.kind } : {}) },
      select: { id: true, kind: true },
    });
    if (!rows.length) return 0;
    const now = new Date();
    await this.prisma.session.updateMany({ where: { id: { in: rows.map((r) => r.id) }, revokedAt: null }, data: { revokedAt: now, endedReason: reason } });
    // A replaced, idle or admin-ended browser must stop playing too. Logout ends only that browser's playback; the
    // person's other browsers (if allowed) keep theirs, so only end playback when no ordinary session is left.
    const left = await this.prisma.session.count({ where: { userId: where.userId, revokedAt: null, kind: 'user', expiresAt: { gt: now } } });
    if (!left || reason === 'replaced' || reason === 'admin' || reason === 'password' || reason === 'mfa_reset' || reason === 'suspended') {
      await this.prisma.playbackSession.updateMany({ where: { userId: where.userId, expiresAt: { gt: now } }, data: { expiresAt: now } });
    }
    const action = reason === 'replaced' ? 'auth.session_replaced' : reason === 'idle' ? 'auth.session_idle_logout' : reason === 'lifetime' ? 'auth.session_expired' : reason === 'logout' ? 'auth.logout' : reason === 'admin' ? 'auth.session_revoked_by_admin' : 'auth.session_revoked';
    for (const r of rows) {
      await this.audit.log({ actorId: meta.actorId === undefined ? where.userId : meta.actorId, action, targetType: 'session', targetId: r.id, ip: meta.ip ?? null, meta: { userId: where.userId, reason, kind: r.kind, ...(meta.extra ?? {}) } });
    }
    return rows.length;
  }
}
