import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, type AppRequest, Perm, Public, Roles } from '../common/auth-context';
import { badRequest } from '../common/errors';
import { ZBody, ZQuery } from '../common/zod';
import { CONTACT_MAX_BYTES, CONTACT_MAX_FILES, CONTACT_TOPICS, type ContactFile, ContactService } from './contact.service';

const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  topic: z.enum(CONTACT_TOPICS),
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(5000),
  /** Honeypot: people never see this field; bots fill it. */
  website: z.string().max(0).optional(),
});
const listQuery = z.object({ status: z.enum(['new', 'handled']).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) });
const statusSchema = z.object({ status: z.enum(['new', 'handled']) });

@Controller()
export class ContactController {
  constructor(private readonly svc: ContactService) {}

  /** Public (multipart: fields + up to 3 images as "images"). 5 messages per IP per 10 minutes. */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @HttpCode(200)
  @Post('contact')
  @UseInterceptors(FilesInterceptor('images', CONTACT_MAX_FILES, { limits: { fileSize: CONTACT_MAX_BYTES, files: CONTACT_MAX_FILES, fields: 10, fieldSize: 20_000 } }))
  send(@Body() raw: unknown, @UploadedFiles() files: ContactFile[] | undefined, @Req() req: AppRequest) {
    const parsed = contactSchema.safeParse(raw);
    if (!parsed.success) throw badRequest('Check the highlighted fields', 'validation_failed', { issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    const { website: _hp, ...input } = parsed.data;
    return this.svc.send(input, files ?? [], req.user, req.ip ?? null);
  }

  @Roles('admin') @Perm('support.manage') @Get('admin/contact')
  list(@ZQuery(listQuery) q: z.infer<typeof listQuery>) { return this.svc.list(q); }

  @Roles('admin') @Perm('support.manage') @Get('admin/contact/:id/files/:index')
  async file(@Param('id') id: string, @Param('index', ParseIntPipe) index: number, @Res() res: Response) {
    const f = await this.svc.file(id, index);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `inline; filename="${f.name}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    f.body.pipe(res);
  }

  @Roles('admin') @Perm('support.manage') @Patch('admin/contact/:id')
  status(@Param('id') id: string, @ZBody(statusSchema) b: z.infer<typeof statusSchema>, @ActorCtx() a: Actor) { return this.svc.setStatus(a, id, b.status); }
}
