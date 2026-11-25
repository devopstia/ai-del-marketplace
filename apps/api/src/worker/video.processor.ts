import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { MEDIA_QUEUE, ProcessVideoJob } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';

const run = promisify(execFile);

/** Reads a video's duration with ffprobe (streamed via a short-lived internal URL) and marks the asset ready. */
export async function probeDurationSec(url: string): Promise<number> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', url], { timeout: 120_000 });
  const d = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(d) || d <= 0) throw new Error(`ffprobe returned no duration (${stdout.trim() || 'empty'})`);
  return Math.round(d);
}

@Processor(MEDIA_QUEUE)
export class VideoProcessor extends WorkerHost {
  private readonly logger = new Logger('VideoProcessor');
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<ProcessVideoJob>) {
    const asset = await this.prisma.videoAsset.findUnique({ where: { id: job.data.assetId } });
    if (!asset || asset.provider !== 'local' || !asset.storageKey) return { skipped: true };
    try {
      const durationSec = await probeDurationSec(await this.storage.presignInternalGet(asset.storageKey));
      await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { status: 'ready', durationSec, error: null } });
      await this.prisma.lecture.updateMany({ where: { videoAssetId: asset.id }, data: { durationSec } });
      this.logger.log(`asset ${asset.id} ready (${durationSec}s)`);
      return { durationSec };
    } catch (e) {
      const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (last) {
        await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { status: 'failed', error: (e as Error).message.slice(0, 500) } });
      }
      throw e;
    }
  }
}
