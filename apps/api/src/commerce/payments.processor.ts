import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JobsService, PAYMENTS_QUEUE } from '../common/jobs';
import { env } from '../config/env';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../common/prisma.service';
import { sendAccessReminders } from '../access/reminders';
import { sendLearningNudges } from '../learning/nudges';
import { purgeDueCourses } from '../admin/course-lifecycle';
import { AuditService } from '../common/audit.service';
import { StorageService } from '../common/storage.service';

/** Runs in the API process: fee lookups that Stripe hasn't finished yet, and the hourly payout release. */
@Processor(PAYMENTS_QUEUE)
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger('PaymentsJobs');
  constructor(private readonly payouts: PayoutsService, private readonly prisma: PrismaService, private readonly jobs: JobsService, private readonly storage: StorageService, private readonly audit: AuditService) {
    super();
  }

  async process(job: Job<{ orderId?: string }>) {
    if (job.name === 'settle-fee' && job.data.orderId) {
      const done = await this.payouts.fetchStripeFee(job.data.orderId);
      if (!done) throw new Error('Stripe fee not available yet'); // BullMQ retries with backoff
      return { settled: true };
    }
    if (job.name === 'release-transfers') {
      const r = await this.payouts.releaseDue();
      if (r.transferred || r.netted) this.logger.log(`released ${r.transferred} transfers (${r.netted} netted)`);
      return r;
    }
    if (job.name === 'access-reminders') {
      const r = await sendAccessReminders(this.prisma, this.jobs);
      if (r.sent) this.logger.log(`sent ${r.sent} access reminders`);
      return r;
    }
    if (job.name === 'learning-nudges') {
      const r = await sendLearningNudges(this.prisma, this.jobs);
      if (r.sent) this.logger.log(`sent ${r.sent} free-course learning emails`);
      return r;
    }
    if (job.name === 'course-purge') {
      const r = await purgeDueCourses(this.prisma, this.storage, this.audit);
      if (r.purged || r.waiting) this.logger.log(`course deletion: ${r.purged} purged, ${r.waiting} waiting for learners' access to end`);
      return r;
    }
    return { ignored: job.name };
  }
}

/** Registers the hourly payout release once the API starts (not in tests). */
@Injectable()
export class PaymentsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger('PaymentsScheduler');
  constructor(private readonly jobs: JobsService) {}
  async onApplicationBootstrap() {
    if (env().NODE_ENV === 'test') return;
    await this.jobs.scheduleRecurring().catch((e) => this.logger.warn(`could not schedule payout release: ${(e as Error).message}`));
  }
}
