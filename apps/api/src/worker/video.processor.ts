import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { JobsService, MEDIA_QUEUE, ProcessVideoJob } from '../common/jobs';
import { env } from '../config/env';
import { packageHls, UnsupportedVideo } from '../protection/hls-packager';
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
    private readonly jobs: JobsService,
  ) {
    super();
  }

  async process(job: Job<ProcessVideoJob>) {
    if (job.name === 'package-hls') return this.packageHls(job);
    const asset = await this.prisma.videoAsset.findUnique({ where: { id: job.data.assetId } });
    if (!asset || asset.provider !== 'local' || !asset.storageKey) return { skipped: true };
    try {
      const durationSec = await probeDurationSec(await this.storage.presignInternalGet(asset.storageKey));
      await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { status: 'ready', durationSec, error: null } });
      await this.prisma.lecture.updateMany({ where: { videoAssetId: asset.id }, data: { durationSec } });
      this.logger.log(`asset ${asset.id} ready (${durationSec}s)`);
      if (env().PROTECTED_PLAYBACK) {
        await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { hlsStatus: 'queued', hlsAttempts: 0 } });
        await this.jobs.packageHls(asset.id);
      }
      return { durationSec };
    } catch (e) {
      const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (last) {
        await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { status: 'failed', error: (e as Error).message.slice(0, 500) } });
      }
      throw e;
    }
  }

  /** Content protection: encrypted HLS for one ready local video (docs/CONTENT_PROTECTION.md). */
  private async packageHls(job: Job<ProcessVideoJob>) {
    const asset = await this.prisma.videoAsset.findUnique({ where: { id: job.data.assetId } });
    if (!asset || asset.provider !== 'local' || asset.status !== 'ready' || !asset.storageKey) return { skipped: true };
    if (asset.hlsStatus === 'ready') return { skipped: 'already packaged' };
    await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { hlsStatus: 'processing', hlsAttempts: { increment: 1 }, hlsError: null } });
    const started = Date.now();
    try {
      const src = await this.storage.presignInternalGet(asset.storageKey, 6 * 3600);
      const p = await packageHls(src, (key, body) => this.storage.put(key, body, 'video/mp2t'));
      await this.prisma.videoAsset.update({
        where: { id: asset.id },
        data: { hlsStatus: 'ready', hlsPrefix: p.prefix, hlsPlaylist: p.playlist, hlsKey: p.keyWrapped, hlsIv: p.ivHex, hlsPackagedAt: new Date(), hlsError: null },
      });
      this.logger.log(`asset ${asset.id} packaged: ${p.segments} encrypted segments in ${Math.round((Date.now() - started) / 1000)}s`);
      return { segments: p.segments };
    } catch (e) {
      const unsupported = e instanceof UnsupportedVideo;
      const last = unsupported || job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.prisma.videoAsset.update({
        where: { id: asset.id },
        // Until it succeeds, learners keep getting the signed MP4 (the original), so nothing stops playing.
        data: { hlsStatus: last ? (unsupported ? 'unsupported' : 'failed') : 'queued', hlsError: (e as Error).message.slice(0, 500) },
      });
      if (unsupported) return { unsupported: (e as Error).message };
      throw e;
    }
  }
}
