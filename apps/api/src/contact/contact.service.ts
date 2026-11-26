import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../common/audit.service';
import type { Actor, AuthUser } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';
import { page, paged } from '../common/util';
import { env } from '../config/env';

export const CONTACT_TOPICS = ['general', 'courses', 'payment', 'account', 'instructor', 'full_program', 'technical'] as const;
export const CONTACT_MAX_FILES = 3;
export const CONTACT_MAX_BYTES = 5 * 1024 * 1024;

/** Image type from the file's first bytes (never trust the browser's name or type). */
export function sniffImage(b: Buffer): { mime: string; ext: string } | null {
  if (b.length > 8 && b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return { mime: 'image/png', ext: 'png' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

export interface ContactFile { originalname: string; buffer: Buffer; size: number }

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  /** Stores the message and its screenshots privately, emails DEL support (with the images) and confirms to the sender. */
  async send(input: { name: string; email: string; topic: string; subject: string; body: string }, files: ContactFile[], user: AuthUser | undefined, ip: string | null) {
    if (files.length > CONTACT_MAX_FILES) throw badRequest(`Attach up to ${CONTACT_MAX_FILES} images`, 'attachment_count');
    const checked = files.map((f) => {
      if (f.size <= 0 || f.size > CONTACT_MAX_BYTES) throw badRequest('Images can be up to 5 MB each', 'attachment_size');
      const kind = sniffImage(f.buffer);
      if (!kind) throw badRequest('Attach PNG, JPG or WebP images only', 'attachment_type');
      return { f, kind };
    });
    const id = randomUUID();
    const attachments: { key: string; name: string; mime: string; sizeBytes: number }[] = [];
    for (const { f, kind } of checked) {
      const key = `contact/${id}/${randomUUID()}.${kind.ext}`;
      await this.storage.put(key, f.buffer, kind.mime);
      attachments.push({ key, name: f.originalname.replace(/[^\w.\- ]/g, '_').slice(0, 120) || `image.${kind.ext}`, mime: kind.mime, sizeBytes: f.size });
    }
    const msg = await this.prisma.contactMessage.create({
      data: { id, name: input.name, email: input.email.toLowerCase(), topic: input.topic, subject: input.subject, body: input.body, userId: user?.id ?? null, attachments },
    });
    const ref = `C-${msg.number}`;
    await this.jobs.sendEmail({
      to: env().CONTACT_EMAIL,
      template: 'contact-message',
      data: { ref, name: input.name, email: input.email, topic: input.topic, subject: input.subject, body: input.body, signedIn: !!user, link: `${env().WEB_URL}/admin/contact` },
      replyTo: input.email,
      attachments: attachments.map((a) => ({ key: a.key, name: a.name, mime: a.mime })),
    });
    await this.jobs.sendEmail({ to: input.email, template: 'contact-received', data: { ref, name: input.name, subject: input.subject, topic: input.topic }, dedupeKey: `contact-received:${ref}` });
    await this.audit.log({ actorId: user?.id ?? null, action: 'contact.sent', targetType: 'contact', targetId: msg.id, ip, meta: { ref, topic: input.topic, files: attachments.length } });
    return { ok: true, ref };
  }

  async list(q: { status?: 'new' | 'handled'; page: number; pageSize: number }) {
    const where = q.status ? { status: q.status } : {};
    const [total, rows, open] = await Promise.all([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q.page, q.pageSize) }),
      this.prisma.contactMessage.count({ where: { status: 'new' } }),
    ]);
    return {
      ...paged(rows.map((m) => ({ ...m, ref: `C-${m.number}`, attachments: (m.attachments as { key: string; name: string; mime: string; sizeBytes: number }[]).map((a, i) => ({ name: a.name, mime: a.mime, sizeBytes: a.sizeBytes, url: `/admin/contact/${m.id}/files/${i}` })) })), total, q),
      newCount: open,
    };
  }

  async file(id: string, index: number) {
    const m = await this.prisma.contactMessage.findUnique({ where: { id } });
    const a = (m?.attachments as { key: string; name: string; mime: string }[] | undefined)?.[index];
    if (!a) throw notFound('File');
    const obj = await this.storage.getStream(a.key);
    if (!obj) throw notFound('File');
    return { ...obj, name: a.name, mime: a.mime };
  }

  async setStatus(a: Actor, id: string, status: 'new' | 'handled') {
    const m = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!m) throw notFound('Message');
    await this.prisma.contactMessage.update({ where: { id }, data: { status, handledById: status === 'handled' ? a.user.id : null, handledAt: status === 'handled' ? new Date() : null } });
    await this.audit.log({ actorId: a.user.id, action: `contact.${status}`, targetType: 'contact', targetId: id, ip: a.ip });
    return { id, status };
  }
}
