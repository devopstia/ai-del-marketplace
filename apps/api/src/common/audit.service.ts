import { Injectable } from '@nestjs/common';
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
    return db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        ip: entry.ip ?? null,
        meta: (entry.meta ?? {}) as object,
      },
    });
  }
}
