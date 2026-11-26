import { env } from '../config/env';
import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';
import type { TicketPriority, TicketStatus } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import { Actor, hasRole, isAdmin, type AuthUser } from '../common/auth-context';
import { AppError, badRequest, conflict, forbidden, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { PrismaService } from '../common/prisma.service';
import { StorageService } from '../common/storage.service';

/**
 * Support Center (owner 2026-11-25, adapted from the Insurance Knowledge Hub's SUPPORT.md). Anyone signed in opens tickets
 * and follows their own; admins work the queue; only a super admin closes a ticket directly. Message bodies are plain
 * text, never HTML. Statuses move only here:
 *   requester opens → new · staff reply: new → open · staff asks for information → waiting_user
 *   requester reply: new|waiting_user|resolved → open · staff resolves → resolved (requester asked to confirm)
 *   requester "Issue resolved": resolved → closed · "Still need help": resolved → open
 *   7 days resolved without a reply → closed (checked on reads) · requester reopens within 30 days of closing → open
 */

export const CATEGORIES = ['account', 'payments_refunds', 'course_content', 'video_playback', 'technical', 'instructor', 'certificates', 'bug_report', 'feature_request', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
const ATTACH_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']);
const ATTACH_MAX_BYTES = 5 * 1024 * 1024;
const ATTACH_MAX_PER_MESSAGE = 3;
const NEW_TICKETS_PER_HOUR = 5;
const AUTO_CLOSE_DAYS = 7;
const REOPEN_DAYS = 30;
const DAY = 86400_000;

export const ticketNumber = (n: number) => `SUP-${String(n).padStart(6, '0')}`;
export function parseNumber(raw: string): number | null {
  const m = /^(?:sup-)?0*(\d{1,9})$/i.exec(raw.trim());
  return m ? Number(m[1]) : null;
}

/** Plain text only: normalised newlines, no control characters, trimmed. */
export function cleanText(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

export interface AttachmentInput { key: string; name: string; mime: string; sizeBytes: number }
export interface NewTicket { subject: string; category: Category; priority?: 'low' | 'normal' | 'high'; description: string; courseId?: string | null; orderId?: string | null; context?: Record<string, unknown>; attachments?: AttachmentInput[] }

const ticketInclude = {
  requester: { select: { id: true, name: true, email: true, avatarUrl: true, roles: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.SupportTicketInclude;

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
  ) {}

  // ---------- reading ----------
  /** Resolved tickets older than 7 days close themselves; run on every read (no scheduler needed). */
  async autoCloseDue() {
    const due = await this.prisma.supportTicket.findMany({ where: { status: 'resolved', resolvedAt: { lt: new Date(Date.now() - AUTO_CLOSE_DAYS * DAY) } }, select: { id: true, requesterId: true } });
    for (const t of due) {
      const r = await this.prisma.supportTicket.updateMany({ where: { id: t.id, status: 'resolved' }, data: { status: 'closed', closedAt: new Date() } });
      if (r.count) await this.prisma.supportMessage.create({ data: { ticketId: t.id, authorId: t.requesterId, kind: 'system', body: `Closed automatically after ${AUTO_CLOSE_DAYS} days without a reply.` } });
    }
  }

  private async findByNumber(raw: string) {
    const n = parseNumber(raw);
    if (n === null) throw notFound('Ticket');
    const t = await this.prisma.supportTicket.findUnique({ where: { number: n }, include: ticketInclude });
    if (!t) throw notFound('Ticket');
    return t;
  }

  /** Requester or staff; anyone else gets 404 so ticket numbers can't be probed. */
  private async readable(user: AuthUser, raw: string) {
    const t = await this.findByNumber(raw);
    if (t.requesterId !== user.id && !isAdmin(user)) throw notFound('Ticket');
    return t;
  }

  private summary(t: Prisma.SupportTicketGetPayload<{ include: typeof ticketInclude }> & { messages?: { body: string; createdAt: Date; staff: boolean }[] }) {
    const last = t.messages?.[0];
    return {
      number: ticketNumber(t.number),
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      awaiting: t.status === 'closed' ? null : ['waiting_user', 'resolved'].includes(t.status) ? 'requester' : 'staff',
      requester: { id: t.requester.id, name: t.requester.name, email: t.requester.email, avatarUrl: t.requester.avatarUrl, roles: t.requester.roles },
      assignedTo: t.assignedTo,
      courseId: t.courseId,
      orderId: t.orderId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      resolvedAt: t.resolvedAt,
      closedAt: t.closedAt,
      lastMessage: last ? { preview: last.body.slice(0, 160), at: last.createdAt, staff: last.staff } : null,
    };
  }

  async mine(userId: string) {
    await this.autoCloseDue();
    const rows = await this.prisma.supportTicket.findMany({
      where: { requesterId: userId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: { ...ticketInclude, messages: { where: { internal: false }, orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true, staff: true } } },
    });
    return { items: rows.map((t) => this.summary(t)) };
  }

  async ticket(user: AuthUser, raw: string) {
    await this.autoCloseDue();
    const t = await this.readable(user, raw);
    const staff = isAdmin(user);
    const messages = await this.prisma.supportMessage.findMany({
      where: { ticketId: t.id, ...(staff ? {} : { internal: false }) },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, avatarUrl: true } }, attachments: true },
    });
    const [course, order] = await Promise.all([
      t.courseId ? this.prisma.course.findUnique({ where: { id: t.courseId }, select: { id: true, slug: true, title: true } }) : null,
      t.orderId ? this.prisma.order.findUnique({ where: { id: t.orderId }, select: { id: true, totalCents: true, status: true } }) : null,
    ]);
    const closedFor = t.closedAt ? Date.now() - t.closedAt.getTime() : 0;
    return {
      ...this.summary(t),
      context: staff ? t.context : undefined,
      firstResponseAt: t.firstResponseAt,
      course,
      order,
      canReopen: t.status === 'closed' && t.requesterId === user.id && closedFor < REOPEN_DAYS * DAY,
      messages: messages.map((m) => ({
        id: m.id, kind: m.kind, body: m.body, staff: m.staff, internal: m.internal, createdAt: m.createdAt,
        author: m.kind === 'system' ? null : m.staff && !staff ? { id: null, name: 'DEL Support', avatarUrl: null } : m.author,
        attachments: m.attachments.map((x) => ({ id: x.id, name: x.name, mime: x.mime, sizeBytes: x.sizeBytes, url: `/support/attachments/${x.id}` })),
      })),
    };
  }

  // ---------- attachments ----------
  /** A short-lived upload link for one private file; the key is tied to the uploader. */
  async uploadUrl(userId: string, input: { name: string; contentType: string; sizeBytes: number }) {
    if (!ATTACH_TYPES.has(input.contentType)) throw badRequest('Attach a PNG, JPG, WebP image or a PDF', 'attachment_type');
    if (input.sizeBytes <= 0 || input.sizeBytes > ATTACH_MAX_BYTES) throw badRequest('Files can be up to 5 MB', 'attachment_size');
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' }[input.contentType]!;
    const key = `support/${userId}/${randomUUID()}.${ext}`;
    return { key, uploadUrl: await this.storage.presignPut(key, input.contentType, 900), method: 'PUT', headers: { 'Content-Type': input.contentType } };
  }

  private checkAttachments(userId: string, list: AttachmentInput[] | undefined) {
    const items = list ?? [];
    if (items.length > ATTACH_MAX_PER_MESSAGE) throw badRequest(`Attach up to ${ATTACH_MAX_PER_MESSAGE} files per message`, 'attachment_count');
    for (const x of items) {
      if (!x.key.startsWith(`support/${userId}/`) || !/^support\/[\w-]+\/[\w-]+\.(png|jpg|webp|pdf)$/.test(x.key)) throw badRequest('Upload the file again', 'attachment_key');
      if (!ATTACH_TYPES.has(x.mime) || x.sizeBytes <= 0 || x.sizeBytes > ATTACH_MAX_BYTES) throw badRequest('Files can be up to 5 MB (PNG, JPG, WebP or PDF)', 'attachment_type');
    }
    return items.map((x) => ({ storageKey: x.key, name: cleanText(x.name).slice(0, 200) || 'file', mime: x.mime, sizeBytes: x.sizeBytes }));
  }

  async attachment(user: AuthUser, id: string) {
    const a = await this.prisma.supportAttachment.findUnique({ where: { id }, include: { message: { select: { internal: true, ticket: { select: { requesterId: true } } } } } });
    if (!a) throw notFound('File');
    const staff = isAdmin(user);
    if (!staff && (a.message.ticket.requesterId !== user.id || a.message.internal)) throw notFound('File');
    const obj = await this.storage.getStream(a.storageKey);
    if (!obj) throw notFound('File');
    return { ...obj, name: a.name, mime: a.mime };
  }

  // ---------- requester ----------
  async create(a: Actor, input: NewTicket) {
    const recent = await this.prisma.supportTicket.count({ where: { requesterId: a.user.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
    if (recent >= NEW_TICKETS_PER_HOUR) throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'too_many_tickets', 'You have opened several tickets in the last hour. Add to an open ticket, or try again later.');
    const subject = cleanText(input.subject);
    const description = cleanText(input.description);
    if (subject.length < 5 || subject.length > 160) throw badRequest('The subject needs 5 to 160 characters', 'subject');
    if (description.length < 10 || description.length > 5000) throw badRequest('Describe the problem in 10 to 5,000 characters', 'description');
    if (input.orderId && !(await this.prisma.order.findFirst({ where: { id: input.orderId, userId: a.user.id }, select: { id: true } }))) throw badRequest('That order is not on your account', 'order');
    if (input.courseId && !(await this.prisma.course.findUnique({ where: { id: input.courseId }, select: { id: true } }))) throw badRequest('Unknown course', 'course');
    const files = this.checkAttachments(a.user.id, input.attachments);
    const t = await this.prisma.supportTicket.create({
      data: {
        requesterId: a.user.id, subject, category: input.category, priority: input.priority ?? 'normal',
        courseId: input.courseId ?? null, orderId: input.orderId ?? null,
        context: (input.context ?? {}) as Prisma.InputJsonValue,
        messages: { create: { authorId: a.user.id, body: description, attachments: { create: files } } },
      },
    });
    await this.audit.log({ actorId: a.user.id, action: 'support.ticket_opened', targetType: 'support_ticket', targetId: ticketNumber(t.number), ip: a.ip, meta: { category: t.category } });
    // confirmation to the requester + notification to the support inbox (owner, 2026-11-25)
    const ref = ticketNumber(t.number);
    const who = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { email: true, name: true } });
    if (who) {
      await this.jobs.sendEmail({ to: who.email, template: 'support-ticket-received', data: { ticket: ref, subject, category: t.category, name: who.name }, dedupeKey: `support-received:${ref}` });
      await this.jobs.sendEmail({ to: env().CONTACT_EMAIL, replyTo: who.email, template: 'support-ticket-new', data: { ticket: ref, subject, category: t.category, priority: t.priority, name: who.name, email: who.email, body: description, link: `${env().WEB_URL}/admin/support` }, dedupeKey: `support-new:${ref}` });
    }
    return { number: ref };
  }

  async reply(a: Actor, raw: string, input: { body: string; attachments?: AttachmentInput[] }) {
    const t = await this.readable(a.user, raw);
    if (t.requesterId !== a.user.id) throw forbidden('Reply from the support queue instead', 'use_staff_reply');
    if (t.status === 'closed') throw conflict('This ticket is closed. Reopen it to add a message.', 'ticket_closed');
    const body = cleanText(input.body);
    if (!body || body.length > 5000) throw badRequest('Write a message of up to 5,000 characters', 'body');
    const files = this.checkAttachments(a.user.id, input.attachments);
    await this.prisma.supportMessage.create({ data: { ticketId: t.id, authorId: a.user.id, body, attachments: { create: files } } });
    await this.prisma.supportTicket.update({ where: { id: t.id }, data: { status: ['new'].includes(t.status) ? 'new' : 'open' } });
    return this.ticket(a.user, raw);
  }

  async confirm(a: Actor, raw: string, resolved: boolean) {
    const t = await this.readable(a.user, raw);
    if (t.requesterId !== a.user.id) throw notFound('Ticket');
    if (t.status !== 'resolved') throw conflict('Only a resolved ticket can be confirmed', 'not_resolved');
    await this.prisma.supportTicket.update({ where: { id: t.id }, data: resolved ? { status: 'closed', closedAt: new Date() } : { status: 'open' } });
    await this.system(t.id, a.user.id, resolved ? 'Confirmed as resolved by the requester.' : 'The requester still needs help.');
    return this.ticket(a.user, raw);
  }

  async reopen(a: Actor, raw: string, note: string) {
    const t = await this.readable(a.user, raw);
    if (t.requesterId !== a.user.id) throw notFound('Ticket');
    if (t.status !== 'closed' || !t.closedAt || Date.now() - t.closedAt.getTime() > REOPEN_DAYS * DAY) throw conflict(`A ticket can be reopened within ${REOPEN_DAYS} days of closing; open a new one instead`, 'reopen_window');
    const body = cleanText(note);
    if (body.length < 5) throw badRequest('Say what still needs help', 'body');
    await this.prisma.supportMessage.create({ data: { ticketId: t.id, authorId: a.user.id, body } });
    await this.prisma.supportTicket.update({ where: { id: t.id }, data: { status: 'open', closedAt: null } });
    await this.system(t.id, a.user.id, 'Reopened by the requester.');
    return this.ticket(a.user, raw);
  }

  // ---------- staff ----------
  private system(ticketId: string, authorId: string, body: string) {
    return this.prisma.supportMessage.create({ data: { ticketId, authorId, kind: 'system', staff: true, body } });
  }

  async queue(q: { status?: TicketStatus | 'active'; assigned?: 'me' | 'none'; priority?: TicketPriority; q?: string; page: number; pageSize: number }, me: string) {
    await this.autoCloseDue();
    const where: Prisma.SupportTicketWhereInput = {};
    if (q.status === 'active' || !q.status) where.status = { in: ['new', 'open', 'waiting_user', 'resolved'] };
    else where.status = q.status;
    if (q.assigned === 'me') where.assignedToId = me;
    if (q.assigned === 'none') where.assignedToId = null;
    if (q.priority) where.priority = q.priority;
    if (q.q) {
      const n = parseNumber(q.q);
      where.OR = [
        ...(n !== null ? [{ number: n }] : []),
        { subject: { contains: q.q, mode: 'insensitive' } },
        { requester: { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } },
      ];
    }
    const [total, rows, counts] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        // Most urgent first, then oldest waiting.
        orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { ...ticketInclude, messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, createdAt: true, staff: true } } },
      }),
      this.prisma.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return { items: rows.map((t) => this.summary(t)), total, page: q.page, pageSize: q.pageSize, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) };
  }

  /** For the admin menu badge: tickets waiting on staff. */
  async awaitingStaff() {
    await this.autoCloseDue();
    return { awaitingStaff: await this.prisma.supportTicket.count({ where: { status: { in: ['new', 'open'] } } }) };
  }

  private async notify(t: { number: number; requesterId: string; subject: string }, template: string) {
    const u = await this.prisma.user.findUnique({ where: { id: t.requesterId }, select: { email: true } });
    if (u) await this.jobs.sendEmail({ to: u.email, template, data: { ticket: ticketNumber(t.number), subject: t.subject } });
  }

  /** kind: reply (public), note (staff only), request_info (public, waits on the requester), resolve (public, asks to confirm). */
  async staffMessage(a: Actor, raw: string, input: { kind: 'reply' | 'note' | 'request_info' | 'resolve'; body: string; attachments?: AttachmentInput[] }) {
    const t = await this.findByNumber(raw);
    if (t.status === 'closed') throw conflict('This ticket is closed', 'ticket_closed');
    const body = cleanText(input.body);
    if ((input.kind !== 'resolve' && !body) || body.length > 5000) throw badRequest('Write a message of up to 5,000 characters', 'body');
    const files = this.checkAttachments(a.user.id, input.attachments);
    const now = new Date();
    if (body) await this.prisma.supportMessage.create({ data: { ticketId: t.id, authorId: a.user.id, staff: true, internal: input.kind === 'note', body, attachments: { create: files } } });
    const data: Prisma.SupportTicketUpdateInput = {};
    if (input.kind !== 'note') {
      if (!t.firstResponseAt) data.firstResponseAt = now;
      if (input.kind === 'reply' && t.status === 'new') data.status = 'open';
      if (input.kind === 'request_info') data.status = 'waiting_user';
      if (input.kind === 'resolve') { data.status = 'resolved'; data.resolvedAt = now; }
      if (!t.assignedToId) data.assignedTo = { connect: { id: a.user.id } };
    }
    if (Object.keys(data).length) await this.prisma.supportTicket.update({ where: { id: t.id }, data });
    if (input.kind === 'resolve') await this.system(t.id, a.user.id, 'Marked as resolved. Confirm it, or reply if you still need help.');
    if (input.kind !== 'note') await this.notify(t, input.kind === 'resolve' ? 'support-resolved' : input.kind === 'request_info' ? 'support-info-requested' : 'support-reply');
    await this.audit.log({ actorId: a.user.id, action: `support.${input.kind}`, targetType: 'support_ticket', targetId: ticketNumber(t.number), ip: a.ip });
    return this.ticket(a.user, raw);
  }

  /** Assign, prioritise, re-categorise, set a status. Only a super admin closes directly. */
  async update(a: Actor, raw: string, input: { priority?: TicketPriority; category?: Category; status?: TicketStatus; assignedToId?: string | null }) {
    const t = await this.findByNumber(raw);
    if (input.status === 'closed' && !hasRole(a.user, 'super_admin')) throw conflict('Tickets close after the requester confirms, or automatically after 7 days', 'close_not_allowed');
    if (input.assignedToId) {
      const s = await this.prisma.user.findUnique({ where: { id: input.assignedToId }, select: { roles: true } });
      if (!s || !(s.roles.includes('admin') || s.roles.includes('super_admin'))) throw badRequest('Tickets can be assigned to admins only', 'assignee');
    }
    const now = new Date();
    const data: Prisma.SupportTicketUncheckedUpdateInput = {
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      ...(input.status ? { status: input.status, ...(input.status === 'resolved' ? { resolvedAt: now } : {}), ...(input.status === 'closed' ? { closedAt: now } : { closedAt: null }) } : {}),
    };
    await this.prisma.supportTicket.update({ where: { id: t.id }, data });
    if (input.status && input.status !== t.status) await this.system(t.id, a.user.id, `Status changed to ${input.status.replace('_', ' ')}.`);
    await this.audit.log({ actorId: a.user.id, action: 'support.ticket_updated', targetType: 'support_ticket', targetId: ticketNumber(t.number), ip: a.ip, meta: input });
    return this.ticket(a.user, raw);
  }

  /** Admins a ticket can be assigned to. */
  async staffList() {
    const rows = await this.prisma.user.findMany({ where: { OR: [{ roles: { has: 'admin' } }, { roles: { has: 'super_admin' } }], status: 'active' }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    return { items: rows };
  }
}
