import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Prisma } from '../generated/prisma/client';
import { HLS_QUEUE, JobsService, MEDIA_QUEUE, ProcessVideoJob } from '../common/jobs';
import { env } from '../config/env';
import { packageHls, UnsupportedVideo } from '../protection/hls-packager';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { StudyNotesService } from '../study/study-notes.service';

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
    private readonly notes: StudyNotesService,
  ) {
    super();
  }

  async process(job: Job<ProcessVideoJob>) {
    if (job.name === 'package-hls') return this.packageHls(job);
    // AI study notes (docs/AI_LEARNING.md): throws to retry; gives up after its attempts.
    if (job.name === 'study-notes') return this.notes.generate(job.data.assetId);
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
    const re = job.data.repackage === true && asset.hlsStatus === 'ready';
    if (asset.hlsStatus === 'ready' && !re) return { skipped: 'already packaged' };
    // a re-packaging leaves the current copy 'ready' (learners keep watching it) until the new one replaces it
    if (!re) await this.prisma.videoAsset.update({ where: { id: asset.id }, data: { hlsStatus: 'processing', hlsAttempts: { increment: 1 }, hlsError: null } });
    const started = Date.now();
    try {
      const src = await this.storage.presignInternalGet(asset.storageKey, 6 * 3600);
      const p = await packageHls(src, (key, body) => this.storage.put(key, body, 'video/mp2t'));
      await this.prisma.videoAsset.update({
        where: { id: asset.id },
        data: { hlsStatus: 'ready', hlsPrefix: p.prefix, hlsPlaylist: p.playlist, hlsVariants: p.variants.map((v) => ({ ...v })), hlsSizes: p.sizes ? { ...p.sizes } : Prisma.DbNull, hlsKey: p.keyWrapped, hlsIv: p.ivHex, hlsPackagedAt: new Date(), hlsError: null },
      });
      // a re-packaging (extra qualities) replaces the previous copy: remove its segments once the new one is live
      if (asset.hlsPrefix && asset.hlsPrefix !== p.prefix) {
        try { await this.storage.deletePrefix(`hls/${asset.hlsPrefix}/`); } catch (e) { this.logger.warn(`old HLS copy of ${asset.id} not removed: ${(e as Error).message}`); }
      }
      this.logger.log(`asset ${asset.id} packaged: ${p.variants.map((v) => v.name).join(', ')}, ${p.segments} encrypted segments in ${Math.round((Date.now() - started) / 1000)}s`);
      return { segments: p.segments };
    } catch (e) {
      if (re) { this.logger.warn(`re-packaging ${asset.id} failed, the current copy stays: ${(e as Error).message}`); throw e; }
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

/** The HLS queue (packaging and re-packaging, one at a time): same handler, separate lane from uploads and study notes. */
@Processor(HLS_QUEUE)
export class HlsProcessor extends WorkerHost {
  constructor(private readonly video: VideoProcessor) { super(); }
  process(job: Job<ProcessVideoJob>) { return this.video.process(job); }
}
