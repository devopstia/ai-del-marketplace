import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EMAIL_QUEUE, EmailJob } from '../common/jobs';

/** Email stub: logs instead of sending (wire a provider here later). Never logs message bodies with secrets. */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger('Email');
  async process(job: Job<EmailJob>) {
    const masked = job.data.to.replace(/^(.).*(@.*)$/, '$1***$2');
    this.logger.log(`[stub] would send "${job.data.template}" to ${masked}`);
    return { stub: true };
  }
}
