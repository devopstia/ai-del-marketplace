import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { env } from '../config/env';

/** On worker start: queue encrypted packaging for ready videos that don't have it yet (existing catalogue, earlier failures). */
@Injectable()
export class HlsBackfill implements OnApplicationBootstrap {
  private readonly log = new Logger('HlsBackfill');
  constructor(private readonly prisma: PrismaService, private readonly jobs: JobsService) {}

  async onApplicationBootstrap() {
    if (!env().PROTECTED_PLAYBACK) return;
    const rows = await this.prisma.videoAsset.findMany({
      where: { provider: 'local', status: 'ready', storageKey: { not: null }, OR: [{ hlsStatus: { in: ['none', 'queued', 'processing'] } }, { hlsStatus: 'failed', hlsAttempts: { lt: 6 } }] },
      select: { id: true },
    });
    for (const r of rows) await this.jobs.packageHls(r.id);
    if (rows.length) this.log.log(`queued ${rows.length} videos for encrypted packaging`);
  }
}
