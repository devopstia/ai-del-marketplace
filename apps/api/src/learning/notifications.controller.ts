import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor } from '../common/auth-context';
import { NotificationsService } from '../common/notifications.service';
import { ZBody, ZQuery } from '../common/zod';

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) });
const readSchema = z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).strict();

/** The signed-in user's in-platform notifications (bell in the header and studios). Own rows only. */
@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get() list(@ZQuery(listQuery) q: z.infer<typeof listQuery>, @ActorCtx() a: Actor) { return this.svc.list(a.user.id, q.limit); }

  /** Marks the given ids (or all) as read. */
  @HttpCode(200) @Post('read') read(@ZBody(readSchema) b: z.infer<typeof readSchema>, @ActorCtx() a: Actor) { return this.svc.markRead(a.user.id, b.ids); }
}
