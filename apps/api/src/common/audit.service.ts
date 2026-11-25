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
}

/** Append-only audit trail for every privileged or financial action. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry, tx?: Tx) {
    const db = tx ?? this.prisma;
    // In DEL Studio mode the action is recorded against the real person, noting that they acted as DEL.
    const ctx = acting.getStore();
    const asDel = !!ctx?.realUserId && (entry.actorId === ctx.actingAsId || entry.actorId == null);
    return db.auditLog.create({
      data: {
        actorId: asDel ? ctx!.realUserId : (entry.actorId ?? null),
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        meta: (asDel ? { ...(entry.meta ?? {}), actingAs: ctx!.actingAsId } : (entry.meta ?? {})) as object,
      },
    });
  }
}
