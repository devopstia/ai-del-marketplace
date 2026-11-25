import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

export const MEDIA_QUEUE = 'media';
export const EMAIL_QUEUE = 'email';
/** Money jobs (fee lookup retries, hourly payout release). Processed inside the API process (CommerceModule). */
export const PAYMENTS_QUEUE = 'payments';

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
    @InjectQueue(PAYMENTS_QUEUE) private readonly payments: Queue,
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

  /** Retry reading an order's Stripe fee until Stripe has created the balance transaction (about 2 h of retries). */
  async settleFee(orderId: string) {
    try {
      await this.payments.add('settle-fee', { orderId }, { jobId: `fee-${orderId}`, attempts: 10, backoff: { type: 'exponential', delay: 15_000 }, removeOnComplete: 1000, removeOnFail: 1000 });
    } catch (e) {
      this.logger.warn(`fee job enqueue failed for ${orderId}: ${(e as Error).message} (charge.updated will settle it)`);
    }
  }

  /** Hourly: transfer instructor shares whose refund-window hold has ended. Safe to call on every start (idempotent). */
  async scheduleRecurring() {
    await this.payments.upsertJobScheduler('release-transfers', { every: 60 * 60 * 1000 }, { name: 'release-transfers', data: {} });
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
