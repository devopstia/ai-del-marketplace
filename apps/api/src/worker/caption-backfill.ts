import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { learningAiEnabled } from '../study/ai-client';
import { CaptionIndexService } from '../study/caption-index.service';
import { StudyNotesService } from '../study/study-notes.service';

const EVERY_MS = 10 * 60_000;

/**
 * Search inside videos (docs/AI_LEARNING.md): on worker start and every 10 minutes, index captions that are new or
 * changed (a caption upload replaces the file in storage; its ETag tells). Study notes someone already opened are
 * regenerated for the new captions.
 */
@Injectable()
export class CaptionBackfill implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('CaptionBackfill');
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly index: CaptionIndexService,
    private readonly notes: StudyNotesService,
  ) {}

  onApplicationBootstrap() {
    void this.run();
    this.timer = setInterval(() => void this.run(), EVERY_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      const changed = await this.index.refreshChanged();
      if (changed.length) this.log.log(`captions indexed for ${changed.length} videos`);
      if (!learningAiEnabled() || !changed.length) return;
      const opened = await this.prisma.studyNotes.findMany({ where: { videoAssetId: { in: changed } }, select: { videoAssetId: true } });
      for (const n of opened) await this.notes.regenerate(n.videoAssetId);
    } catch (e) {
      this.log.warn(`caption scan failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
