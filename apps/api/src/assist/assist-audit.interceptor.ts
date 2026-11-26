import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { catchError, from, mergeMap, Observable, throwError } from 'rxjs';
import type { AppRequest } from '../common/auth-context';
import { AuditService } from '../common/audit.service';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Every state-changing request made inside a support session or with an AI agent token is recorded, whether it
 * succeeds or fails (with the error code), next to the specific entries services write (course.created, …).
 */
@Injectable()
export class AssistAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const delegated = (req.support && req.realUser) || req.agent;
    if (!delegated || SAFE.has(req.method)) return next.handle();
    const base = {
      actorId: req.agent ? req.agent.issuedById : req.realUser!.id,
      action: req.agent ? 'agent.request' : 'support.request',
      targetType: 'request',
      ip: req.ip ?? null,
      onBehalfOfId: req.agent ? req.agent.instructorId : req.user!.id,
    };
    const meta = { method: req.method, path: req.path ?? req.url, agent: req.agent?.name };
    const write = (status: 'ok' | 'failed', extra: Record<string, unknown> = {}) =>
      this.audit.log({ ...base, status, meta: { ...meta, ...extra } }).catch(() => undefined);
    return next.handle().pipe(
      mergeMap((value) => from(write('ok')).pipe(mergeMap(() => [value]))),
      catchError((err: { code?: string; status?: number; message?: string }) =>
        from(write('failed', { error: err?.code ?? err?.message ?? 'error' })).pipe(mergeMap(() => throwError(() => err)))),
    );
  }
}
