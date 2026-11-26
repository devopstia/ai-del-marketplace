import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EMAIL_QUEUE, HLS_QUEUE, MEDIA_QUEUE, PAYMENTS_QUEUE } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { env, isProd } from '../config/env';

type Check = { name: string; ok: boolean; detail: string; ms?: number };
const LABEL: Record<string, string> = { [MEDIA_QUEUE]: 'Video processing', [HLS_QUEUE]: 'Video packaging', [EMAIL_QUEUE]: 'Email', [PAYMENTS_QUEUE]: 'Payments and scheduled jobs' };

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const t = Date.now();
  try { return { value: await fn(), ms: Date.now() - t }; } catch (e) { return { error: (e as Error).message, ms: Date.now() - t }; }
}

/**
 * Super Admin › System health (owner 2026-11-26, section 6 review): the services the marketplace depends on, checked
 * live when the page opens. Read-only; no secrets or connection strings are returned.
 */
@Injectable()
export class SystemService {
  private readonly queues: Queue[];
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(MEDIA_QUEUE) media: Queue,
    @InjectQueue(HLS_QUEUE) hls: Queue,
    @InjectQueue(EMAIL_QUEUE) email: Queue,
    @InjectQueue(PAYMENTS_QUEUE) payments: Queue,
  ) {
    this.queues = [media, hls, email, payments];
  }

  async health() {
    const e = env();
    const checks: Check[] = [];
    const db = await timed(() => this.prisma.$queryRaw`select 1`);
    checks.push({ name: 'Database', ok: !db.error, detail: db.error ? 'Not reachable' : 'Connected', ms: db.ms });
    const redis = await timed(() => this.queues[0]!.getJobCounts('waiting'));
    checks.push({ name: 'Job queue (Redis)', ok: !redis.error, detail: redis.error ? 'Not reachable' : 'Connected', ms: redis.ms });
    const store = await timed(() => this.storage.head('health/does-not-exist'));
    checks.push({ name: 'File storage', ok: !store.error, detail: store.error ? 'Not reachable' : 'Connected', ms: store.ms });
    checks.push({ name: 'Email', ok: e.EMAIL_PROVIDER !== 'console' || !isProd(), detail: e.EMAIL_PROVIDER === 'console' ? 'Written to the log only (no emails leave the server)' : `Sending through ${e.EMAIL_PROVIDER.toUpperCase()}` });

    const queues = await Promise.all(this.queues.map(async (q) => {
      const r = await timed(async () => ({ counts: await q.getJobCounts('waiting', 'active', 'delayed', 'failed'), workers: await q.getWorkersCount() }));
      return { name: LABEL[q.name] ?? q.name, key: q.name, ok: !r.error && (r.value?.workers ?? 0) > 0, workers: r.value?.workers ?? 0, ...(r.value?.counts ?? { waiting: 0, active: 0, delayed: 0, failed: 0 }), error: r.error ? 'Not reachable' : null };
    }));

    const day = new Date(Date.now() - 86_400_000);
    const [failedVideos, packagingFailed, pendingPurge, failedLogins] = await Promise.all([
      this.prisma.videoAsset.count({ where: { status: 'failed' } }),
      this.prisma.videoAsset.count({ where: { hlsStatus: 'failed' } }),
      this.prisma.course.count({ where: { deleteRequestedAt: { not: null }, purgedAt: null, deleteAfter: { lte: new Date() } } }),
      this.prisma.auditLog.count({ where: { action: { in: ['auth.login_failed', 'auth.mfa_failed'] }, at: { gte: day } } }),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      environment: e.NODE_ENV,
      checks,
      queues,
      attention: { failedVideos, packagingFailed, deletionsWaitingForAccess: pendingPurge, failedSignInsLastDay: failedLogins },
    };
  }
}
