import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

export const MEDIA_QUEUE = 'media';
export const EMAIL_QUEUE = 'email';

export interface ProcessVideoJob {
  assetId: string;
}
export interface EmailJob {
  to: string;
  template: string;
  data?: Record<string, unknown>;
}

/** Thin wrapper over BullMQ so services (and tests) don't depend on queue internals. */
@Injectable()
export class JobsService {
  private readonly logger = new Logger('Jobs');
  constructor(
    @InjectQueue(MEDIA_QUEUE) private readonly media: Queue,
    @InjectQueue(EMAIL_QUEUE) private readonly email: Queue,
  ) {}

  async processVideo(assetId: string) {
    await this.media.add('process-video', { assetId } satisfies ProcessVideoJob, {
      jobId: `video-${assetId}-${Date.now()}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  }

  async sendEmail(job: EmailJob) {
    try {
      await this.email.add('send', job, { attempts: 3, removeOnComplete: 1000, removeOnFail: 1000 });
    } catch (e) {
      // Email is best effort: never fail a business action because the queue is down.
      this.logger.warn(`email enqueue failed: ${(e as Error).message}`);
    }
  }
}
