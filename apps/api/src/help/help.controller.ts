import { Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Public, Perm } from '../common/auth-context';
import { ZBody } from '../common/zod';
import { MediaService } from '../media/media.service';
import { HELP_AUDIENCES, HELP_CATEGORY_KEYS, HelpService } from './help.service';

const saveSchema = z.object({
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().min(3).max(400),
  audience: z.enum(HELP_AUDIENCES),
  category: z.enum(HELP_CATEGORY_KEYS),
  sort: z.number().int().min(0).max(999).optional(),
  videoAssetId: z.string().uuid().nullable().optional(),
  coverKey: z.string().max(200).nullable().optional(),
  chapters: z.array(z.object({ t: z.number().min(0).max(36_000), title: z.string().trim().min(1).max(80) })).max(40).nullable().optional(),
  published: z.boolean().optional(),
});
const videoSchema = z.object({ filename: z.string().min(1).max(200), contentType: z.string().regex(/^video\//).max(100) });
const imageSchema = z.object({ contentType: z.string().max(60) });
const publishSchema = z.object({ published: z.boolean() });

@Controller()
export class HelpController {
  constructor(private readonly svc: HelpService, private readonly media: MediaService) {}

  @Public() @Get('help/videos')
  list() { return this.svc.list(); }

  @Public() @Get('help/videos/:slug')
  one(@Param('slug') slug: string) { return this.svc.one(slug); }

  @Perm('content.manage') @Get('admin/help/videos')
  adminList() { return this.svc.adminList(); }

  @Perm('content.manage') @Get('admin/help/videos/:slug/preview')
  preview(@Param('slug') slug: string) { return this.svc.adminPreview(slug); }

  @Perm('content.manage') @Put('admin/help/videos/:slug')
  save(@Param('slug') slug: string, @ZBody(saveSchema) body: z.infer<typeof saveSchema>, @ActorCtx() a: Actor) { return this.svc.upsert(a, slug, body); }

  @Perm('content.manage') @HttpCode(200) @Post('admin/help/videos/:slug/publish')
  publish(@Param('slug') slug: string, @ZBody(publishSchema) body: z.infer<typeof publishSchema>, @ActorCtx() a: Actor) { return this.svc.setPublished(a, slug, body.published); }

  @Perm('content.manage') @Delete('admin/help/videos/:slug')
  remove(@Param('slug') slug: string, @ActorCtx() a: Actor) { return this.svc.remove(a, slug); }

  // Uploads reuse the studio's video pipeline (the admin owns the asset).
  @Perm('content.manage') @Post('admin/help/uploads/video')
  createVideo(@ZBody(videoSchema) body: z.infer<typeof videoSchema>, @ActorCtx() a: Actor) { return this.media.createVideoUpload(a, body); }

  @Perm('content.manage') @HttpCode(200) @Post('admin/help/uploads/video/:assetId/complete')
  complete(@Param('assetId') id: string, @ActorCtx() a: Actor) { return this.media.completeVideoUpload(a, id); }

  @Perm('content.manage') @HttpCode(200) @Post('admin/help/uploads/video/:assetId/captions')
  captions(@Param('assetId') id: string, @ActorCtx() a: Actor) { return this.media.captionsUpload(a, id); }

  @Perm('content.manage') @Get('admin/help/uploads/video/:assetId')
  asset(@Param('assetId') id: string, @ActorCtx() a: Actor) { return this.media.getAsset(a.user.id, id); }

  @Perm('content.manage') @Post('admin/help/uploads/image')
  image(@ZBody(imageSchema) body: z.infer<typeof imageSchema>, @ActorCtx() a: Actor) { return this.media.imageUpload(a.user.id, body.contentType); }
}
