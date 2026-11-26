import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { mergeCues, parseVtt } from './vtt';

export type IndexResult = { status: 'indexed' | 'unchanged' | 'empty' | 'missing' | 'cleared'; segments: number; contentHash?: string; changed: boolean };

/**
 * Builds the "search inside videos" index (docs/AI_LEARNING.md): a video's WebVTT captions become ~15-second passages
 * in caption_segments, where Postgres keeps a full-text vector of each one. Works without any AI key.
 * Runs in the worker (start-up backfill and a periodic ETag check) and, for a course nobody indexed yet, in the API
 * right before a search, so results never depend on timing.
 */
@Injectable()
export class CaptionIndexService {
  private readonly log = new Logger('CaptionIndex');
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** (Re)indexes one video's captions when the file changed (or `force`). Same content = nothing rewritten. */
  async indexAsset(assetId: string, opts: { force?: boolean } = {}): Promise<IndexResult> {
    const asset = await this.prisma.videoAsset.findUnique({ where: { id: assetId }, select: { id: true, captionsKey: true, captionIndex: true } });
    if (!asset) return { status: 'missing', segments: 0, changed: false };
    if (!asset.captionsKey) {
      if (!asset.captionIndex) return { status: 'cleared', segments: 0, changed: false };
      await this.prisma.$transaction([
        this.prisma.captionSegment.deleteMany({ where: { videoAssetId: asset.id } }),
        this.prisma.captionIndex.delete({ where: { videoAssetId: asset.id } }),
      ]);
      return { status: 'cleared', segments: 0, changed: true };
    }
    const file = await this.storage.getText(asset.captionsKey);
    // Upload announced but not finished yet: try again on the next scan.
    if (!file) return { status: 'missing', segments: 0, changed: false };
    const contentHash = createHash('sha256').update(file.text).digest('hex');
    const prev = asset.captionIndex;
    if (!opts.force && prev && prev.contentHash === contentHash && prev.captionsKey === asset.captionsKey) {
      if (prev.etag !== file.etag) await this.prisma.captionIndex.update({ where: { videoAssetId: asset.id }, data: { etag: file.etag } });
      return { status: 'unchanged', segments: prev.segmentCount, contentHash, changed: false };
    }
    const segments = mergeCues(parseVtt(file.text));
    const status = segments.length ? 'ready' : 'empty';
    const data = { captionsKey: asset.captionsKey, etag: file.etag, contentHash, segmentCount: segments.length, status, error: null, indexedAt: new Date() };
    await this.prisma.$transaction([
      this.prisma.captionSegment.deleteMany({ where: { videoAssetId: asset.id } }),
      this.prisma.captionSegment.createMany({ data: segments.map((s) => ({ videoAssetId: asset.id, seq: s.seq, startSec: s.start, endSec: s.end, text: s.text })) }),
      this.prisma.captionIndex.upsert({ where: { videoAssetId: asset.id }, create: { videoAssetId: asset.id, ...data }, update: data }),
    ]);
    this.log.log(`captions of video ${asset.id} indexed: ${segments.length} passages`);
    return { status: segments.length ? 'indexed' : 'empty', segments: segments.length, contentHash, changed: prev?.contentHash !== contentHash };
  }

  /** Indexes the videos among `assetIds` that have captions but no (current) index. Bounded per call. */
  async ensureIndexed(assetIds: string[], max = 25): Promise<number> {
    if (!assetIds.length) return 0;
    const rows = await this.prisma.videoAsset.findMany({
      where: { id: { in: assetIds }, captionsKey: { not: null } },
      select: { id: true, captionsKey: true, captionIndex: { select: { captionsKey: true } } },
    });
    const todo = rows.filter((r) => !r.captionIndex || r.captionIndex.captionsKey !== r.captionsKey).slice(0, max);
    let n = 0;
    for (const r of todo) {
      try {
        if ((await this.indexAsset(r.id)).status === 'indexed') n++;
      } catch (e) {
        this.log.warn(`indexing captions of video ${r.id} failed: ${(e as Error).message}`);
      }
    }
    return n;
  }

  /**
   * Worker scan: every video with captions whose file is new or changed (ETag differs from the indexed one), plus
   * indexes left behind by removed captions. Returns the ids whose content changed (their study notes go stale).
   */
  async refreshChanged(): Promise<string[]> {
    const rows = await this.prisma.videoAsset.findMany({
      where: { OR: [{ captionsKey: { not: null } }, { captionIndex: { isNot: null } }] },
      select: { id: true, captionsKey: true, captionIndex: { select: { captionsKey: true, etag: true } } },
    });
    const changed: string[] = [];
    for (const r of rows) {
      try {
        let due = !r.captionsKey || !r.captionIndex || r.captionIndex.captionsKey !== r.captionsKey;
        if (!due && r.captionsKey) {
          const head = await this.storage.head(r.captionsKey);
          due = !!head && head.etag !== r.captionIndex!.etag;
        }
        if (!due) continue;
        const res = await this.indexAsset(r.id);
        if (res.changed) changed.push(r.id);
      } catch (e) {
        this.log.warn(`caption scan of video ${r.id} failed: ${(e as Error).message}`);
      }
    }
    return changed;
  }
}
