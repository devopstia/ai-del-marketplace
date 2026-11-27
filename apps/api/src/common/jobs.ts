import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

export const MEDIA_QUEUE = 'media';
/** Encrypted HLS packaging (long re-encodes) has its own queue, so a new upload never waits behind it. */
export const HLS_QUEUE = 'hls';
export const EMAIL_QUEUE = 'email';
/** Money jobs (fee lookup retries, hourly payout release). Processed inside the API process (CommerceModule). */
export const PAYMENTS_QUEUE = 'payments';

const NOTES_JOB_ATTEMPTS = 3;

export interface ProcessVideoJob {
  /** package-hls only: package again although a copy exists (adds qualities); the current copy plays until replaced. */
  repackage?: boolean;
  assetId: string;
}
export interface EmailJob {
  to: string;
  template: string;
  data?: Record<string, unknown>;
  /** Reply-To (e.g. the sender of a contact message). */
  replyTo?: string;
  /** Same key = same email: a retried operation never sends it twice (BullMQ job id). */
  dedupeKey?: string;
  /** Private storage objects attached to the email (fetched by the worker at send time). */
  attachments?: { key: string; name: string; mime: string }[];
}

/** Thin wrapper over BullMQ so services (and tests) don't depend on queue internals. */
@Injectable()
export class JobsService {
  private readonly logger = new Logger('Jobs');
  constructor(
    @InjectQueue(MEDIA_QUEUE) private readonly media: Queue,
    @InjectQueue(HLS_QUEUE) private readonly hls: Queue,
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

  /** Content protection: package a ready video as encrypted HLS. One queued job per asset at a time. */
  async packageHls(assetId: string, opts: { repackage?: boolean } = {}) {
    await this.hls.add('package-hls', { assetId, ...(opts.repackage ? { repackage: true } : {}) } satisfies ProcessVideoJob, {
      jobId: opts.repackage ? `hls-re-${assetId}` : `hls-${assetId}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: true,
    });
  }

  /** AI study notes of one lesson video (docs/AI_LEARNING.md). One queued job per video at a time. */
  async studyNotes(assetId: string) {
    try {
      await this.media.add('study-notes', { assetId } satisfies ProcessVideoJob, {
        jobId: `notes-${assetId}`,
        attempts: NOTES_JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch (e) {
      this.logger.warn(`study notes enqueue failed for ${assetId}: ${(e as Error).message}`);
    }
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
    // One-year access: expiry reminders and notices (docs/ACCESS_AND_REFUNDS.md).
    await this.payments.upsertJobScheduler('access-reminders', { every: 60 * 60 * 1000 }, { name: 'access-reminders', data: {} });
    // Free-course learning emails (owner 2026-11-28; learning/nudges.ts).
    await this.payments.upsertJobScheduler('learning-nudges', { every: 60 * 60 * 1000 }, { name: 'learning-nudges', data: {} });
    // Course soft deletion: content is removed after the 30-day window (docs/SUPER_ADMIN.md).
    await this.payments.upsertJobScheduler('course-purge', { every: 60 * 60 * 1000 }, { name: 'course-purge', data: {} });
  }

  async sendEmail(job: EmailJob) {
    try {
      await this.email.add('send', job, { attempts: 4, backoff: { type: 'exponential', delay: 30_000 }, removeOnComplete: 5000, removeOnFail: 5000, ...(job.dedupeKey ? { jobId: `mail:${job.dedupeKey}` } : {}) });
    } catch (e) {
      // Email is best effort: never fail a business action because the queue is down.
      this.logger.warn(`email enqueue failed: ${(e as Error).message}`);
    }
  }
}
