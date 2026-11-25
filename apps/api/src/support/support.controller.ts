import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, CurrentUser, Perm } from '../common/auth-context';
import type { AuthUser } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { CATEGORIES, SupportService } from './support.service';

const attachment = z.object({ key: z.string().max(200), name: z.string().max(200), mime: z.string().max(60), sizeBytes: z.number().int().positive() });
const createSchema = z.object({
  subject: z.string().max(200),
  category: z.enum(CATEGORIES),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  description: z.string().max(6000),
  courseId: z.string().uuid().nullable().optional(),
  orderId: z.string().uuid().nullable().optional(),
  context: z.record(z.string(), z.union([z.string().max(300), z.number(), z.boolean(), z.null()])).optional(),
  attachments: z.array(attachment).max(3).optional(),
});
const replySchema = z.object({ body: z.string().max(6000), attachments: z.array(attachment).max(3).optional() });
const reopenSchema = z.object({ note: z.string().max(6000) });
const uploadSchema = z.object({ name: z.string().max(200), contentType: z.string().max(60), sizeBytes: z.number().int().positive() });
const staffMessage = replySchema.extend({ kind: z.enum(['reply', 'note', 'request_info', 'resolve']) });
const updateSchema = z
  .object({
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    category: z.enum(CATEGORIES).optional(),
    status: z.enum(['new', 'open', 'waiting_user', 'resolved', 'closed']).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change');
const queueQuery = z.object({
  status: z.enum(['active', 'new', 'open', 'waiting_user', 'resolved', 'closed']).optional(),
  assigned: z.enum(['me', 'none']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** Support Center: everyone signed in has their own tickets; admins work the queue. Plain text only. */
@Controller()
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  @Get('support/tickets') mine(@ActorCtx() a: Actor) { return this.svc.mine(a.user.id); }
  @Post('support/tickets') create(@ZBody(createSchema) b: z.infer<typeof createSchema>, @ActorCtx() a: Actor) { return this.svc.create(a, b); }
  @Get('support/tickets/:number') one(@Param('number') n: string, @CurrentUser() u: AuthUser) { return this.svc.ticket(u, n); }
  @Post('support/tickets/:number/messages') reply(@Param('number') n: string, @ZBody(replySchema) b: z.infer<typeof replySchema>, @ActorCtx() a: Actor) { return this.svc.reply(a, n, b); }
  @HttpCode(200) @Post('support/tickets/:number/resolved') resolved(@Param('number') n: string, @ActorCtx() a: Actor) { return this.svc.confirm(a, n, true); }
  @HttpCode(200) @Post('support/tickets/:number/still-need-help') still(@Param('number') n: string, @ActorCtx() a: Actor) { return this.svc.confirm(a, n, false); }
  @HttpCode(200) @Post('support/tickets/:number/reopen') reopen(@Param('number') n: string, @ZBody(reopenSchema) b: z.infer<typeof reopenSchema>, @ActorCtx() a: Actor) { return this.svc.reopen(a, n, b.note); }
  @HttpCode(200) @Post('support/uploads') upload(@ZBody(uploadSchema) b: z.infer<typeof uploadSchema>, @ActorCtx() a: Actor) { return this.svc.uploadUrl(a.user.id, b); }

  /** A private file, only for people who may read the ticket. */
  @Get('support/attachments/:id')
  async file(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @CurrentUser() u: AuthUser, @Res() res: Response) {
    const f = await this.svc.attachment(u, id);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `${f.mime === 'application/pdf' ? 'attachment' : 'inline'}; filename="${f.name.replace(/[^\w.\- ]/g, '_')}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Shown in the web app (another origin) to the signed-in reader only.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (f.size) res.setHeader('Content-Length', String(f.size));
    f.body.pipe(res);
  }

  // ---------- staff ----------
  @Perm('support.manage') @Get('admin/support/tickets') queue(@ZQuery(queueQuery) q: z.infer<typeof queueQuery>, @ActorCtx() a: Actor) { return this.svc.queue(q, a.user.id); }
  @Perm('support.manage') @Get('admin/support/summary') summary() { return this.svc.awaitingStaff(); }
  @Perm('support.manage') @Get('admin/support/staff') staff() { return this.svc.staffList(); }
  @Perm('support.manage') @Post('admin/support/tickets/:number/messages') staffMessage(@Param('number') n: string, @ZBody(staffMessage) b: z.infer<typeof staffMessage>, @ActorCtx() a: Actor) { return this.svc.staffMessage(a, n, b); }
  @Perm('support.manage') @Patch('admin/support/tickets/:number') update(@Param('number') n: string, @ZBody(updateSchema) b: z.infer<typeof updateSchema>, @ActorCtx() a: Actor) { return this.svc.update(a, n, b); }
}
