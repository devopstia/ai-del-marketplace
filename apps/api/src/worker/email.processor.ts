import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { EMAIL_QUEUE, EmailJob } from '../common/jobs';
import { StorageService } from '../common/storage.service';
import { sendMail } from '../email/sender';
import { render } from '../email/templates';

const MAX_ATTACH = 15 * 1024 * 1024;

/** Renders the DEL template and sends it (docs/EMAIL.md). BullMQ retries 3 times; the job id stops duplicates. */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger('Email');
  constructor(private readonly storage: StorageService) { super(); }

  async process(job: Job<EmailJob>) {
    const r = render(job.data.template, job.data.data ?? {});
    if (!r) {
      this.logger.warn(`no template "${job.data.template}"; not sent`);
      return { skipped: true };
    }
    const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
    let total = 0;
    for (const a of job.data.attachments ?? []) {
      const obj = await this.storage.getStream(a.key);
      if (!obj) continue;
      const chunks: Buffer[] = [];
      for await (const c of obj.body) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as Uint8Array));
      const buf = Buffer.concat(chunks);
      total += buf.length;
      if (total > MAX_ATTACH) break; // large files stay in the admin inbox only
      attachments.push({ filename: a.name, content: buf, contentType: a.mime });
    }
    return sendMail({ to: job.data.to, subject: r.subject, html: r.html, text: r.text, replyTo: job.data.replyTo, attachments }, job.data.template, this.logger);
  }
}
