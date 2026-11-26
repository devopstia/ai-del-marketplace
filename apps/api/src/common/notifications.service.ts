import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * In-platform notifications (owner 2026-11-26, refund management): the bell in the site header and the studios.
 * Short, plain text; the link opens the page where the student acts. Best effort: a failure never blocks the caller.
 * Emails are sent separately through the queue (docs/EMAIL.md).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, n: { kind: string; title: string; body: string; link?: string | null }) {
    try {
      await this.prisma.notification.create({ data: { userId, kind: n.kind, title: n.title.slice(0, 200), body: n.body.slice(0, 2000), link: n.link ?? null } });
    } catch (e) {
      this.logger.warn(`notification skipped: ${(e as Error).message}`);
    }
  }

  async list(userId: string, limit = 20) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(50, Math.max(1, limit)) }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { unread, items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.readAt, createdAt: n.createdAt })) };
  }

  /** Marks the given notifications (or all) as read; only the owner's own rows change. */
  async markRead(userId: string, ids?: string[]) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    return { unread: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }
}
