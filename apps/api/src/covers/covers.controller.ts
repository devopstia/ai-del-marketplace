import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, Roles } from '../common/auth-context';
import { notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { ZBody, ZQuery } from '../common/zod';
import { LAYOUTS, MOTIFS } from './cover-templates';
import { CoversService } from './covers.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour like #4f3fb0');
const palette = z.object({ bg: z.tuple([hex, hex]), ink: hex, a: hex, b: hex, tone: z.enum(['dark', 'light']) });
const spec = z.object({ layout: z.enum(LAYOUTS), motif: z.enum(MOTIFS), palette });
const templateBody = spec.extend({
  name: z.string().trim().min(2).max(60),
  topics: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  active: z.boolean().optional(),
  sort: z.number().int().min(0).max(100000).optional(),
});
const templatePatch = templateBody.partial();
const previewQuery = z.object({ title: z.string().max(200).optional(), topic: z.string().max(80).optional(), w: z.coerce.number().int().min(320).max(1280).default(640) });
const setBody = z.object({ templateId: z.string().uuid() });
const specPreview = spec.extend({ title: z.string().max(200).default(''), topic: z.string().max(80).optional(), w: z.number().int().min(320).max(1280).default(640) });

function png(res: Response, buf: Buffer) {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(buf);
}

@Controller()
export class CoversController {
  constructor(
    private readonly covers: CoversService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------- instructor (own courses only; checked in the service) ----------
  @Roles('instructor') @Get('instructor/courses/:id/cover')
  picker(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.covers.pickerFor(a.user.id, id); }

  @Roles('instructor') @Put('instructor/courses/:id/cover')
  set(@Param('id', uuid) id: string, @ZBody(setBody) b: z.infer<typeof setBody>, @ActorCtx() a: Actor) { return this.covers.setTemplate(a, id, b.templateId); }

  /** A template drawn with this course's title (or the title being typed). */
  @Roles('instructor') @Get('instructor/courses/:id/cover-preview/:templateId')
  async preview(@Param('id', uuid) id: string, @Param('templateId', uuid) templateId: string, @ZQuery(previewQuery) q: z.infer<typeof previewQuery>, @ActorCtx() a: Actor, @Res() res: Response) {
    const c = await this.prisma.course.findFirst({ where: { id, instructorId: a.user.id }, select: { title: true, category: { select: { name: true } } } });
    if (!c) throw notFound('Course');
    png(res, await this.covers.preview(templateId, q.title ?? c.title, q.topic ?? c.category?.name ?? null, q.w));
  }

  // ---------- admin: view; super admin: change ----------
  @Roles('admin') @Get('admin/cover-templates')
  list() { return this.covers.adminList(); }

  @Roles('admin') @Get('admin/cover-templates/:id/preview')
  async adminPreview(@Param('id', uuid) id: string, @ZQuery(previewQuery) q: z.infer<typeof previewQuery>, @Res() res: Response) {
    png(res, await this.covers.preview(id, q.title ?? 'Your course title goes here', q.topic ?? 'Topic', q.w));
  }

  @Roles('super_admin') @HttpCode(200) @Post('admin/cover-templates/preview')
  specPreview(@ZBody(specPreview) b: z.infer<typeof specPreview>, @Res() res: Response) {
    png(res, this.covers.previewSpec(b, b.title || 'Your course title goes here', b.topic ?? 'Topic', b.w));
  }

  @Roles('super_admin') @Post('admin/cover-templates')
  create(@ZBody(templateBody) b: z.infer<typeof templateBody>, @ActorCtx() a: Actor) { return this.covers.create(a, b); }

  @Roles('super_admin') @Patch('admin/cover-templates/:id')
  update(@Param('id', uuid) id: string, @ZBody(templatePatch) b: z.infer<typeof templatePatch>, @ActorCtx() a: Actor) { return this.covers.update(a, id, b); }
}
