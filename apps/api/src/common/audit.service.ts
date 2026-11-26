import { Injectable } from '@nestjs/common';
import { acting } from './acting';
import { PrismaService, Tx } from './prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
  /** ok (default) | failed */
  status?: 'ok' | 'failed';
  /** Explicit attribution, for entries written outside the acting request (session start/end, token issue). */
  onBehalfOfId?: string | null;
  supportSessionId?: string | null;
  agentTokenId?: string | null;
}

/**
 * Append-only audit trail for every privileged or financial action.
 * When someone acts for another account (DEL Studio, support session, AI agent) the entry names the REAL person as
 * actor and the account worked on as onBehalfOf, so nothing is ever attributed to the student or instructor.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry, tx?: Tx) {
    const db = tx ?? this.prisma;
    return db.auditLog.create({ data: auditData(entry) });
  }
}

/** Pure mapping (unit-tested): an entry plus the request's acting context → the row written. */
export function auditData(entry: AuditEntry, ctx = acting.getStore()) {
  const delegated = !!ctx?.realUserId && (entry.actorId === ctx.actingAsId || entry.actorId == null);
  const meta: Record<string, unknown> = { ...(entry.meta ?? {}) };
  if (delegated) {
    meta.actingAs = ctx!.actingAsId;
    if (ctx!.reason && meta.reason === undefined) meta.reason = ctx!.reason;
  }
  return {
    actorId: delegated ? ctx!.realUserId! : (entry.actorId ?? null),
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    ip: entry.ip ?? null,
    meta: meta as object,
    onBehalfOfId: entry.onBehalfOfId ?? (delegated && (ctx!.supportSessionId || ctx!.agentTokenId) ? (ctx!.actingAsId ?? null) : null),
    agentTokenId: entry.agentTokenId ?? ctx?.agentTokenId ?? null,
    supportSessionId: entry.supportSessionId ?? ctx?.supportSessionId ?? null,
    status: entry.status ?? 'ok',
  };
}
