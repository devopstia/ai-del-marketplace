import { Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, Public, Roles } from '../common/auth-context';
import { notFound } from '../common/errors';
import { StorageService } from '../common/storage.service';
import { ZBody } from '../common/zod';
import { MediaService } from './media.service';

const videoSchema = z.object({ filename: z.string().min(1).max(200), contentType: z.string().min(1).max(100), courseId: z.string().uuid().optional() });
const resourceSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  courseId: z.string().uuid().optional(),
});
const imageSchema = z.object({ contentType: z.string().min(1).max(100) });

@Controller()
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly storage: StorageService,
  ) {}

  @Roles('instructor')
  @Post('instructor/uploads/video')
  createVideo(@ZBody(videoSchema) body: z.infer<typeof videoSchema>, @ActorCtx() a: Actor) {
    return this.media.createVideoUpload(a, body);
  }

  @Roles('instructor')
  @Post('instructor/uploads/video/:assetId/complete')
  complete(@Param('assetId') id: string, @ActorCtx() a: Actor) {
    return this.media.completeVideoUpload(a, id);
  }

  @Roles('instructor')
  @Post('instructor/uploads/video/:assetId/captions')
  captions(@Param('assetId') id: string, @ActorCtx() a: Actor) {
    return this.media.captionsUpload(a, id);
  }

  @Roles('instructor')
  @Get('instructor/videos')
  async videos(@ActorCtx() a: Actor) {
    return { items: await this.media.listAssets(a.user.id) };
  }

  @Roles('instructor')
  @Get('instructor/videos/:assetId')
  video(@Param('assetId') id: string, @ActorCtx() a: Actor) {
    return this.media.getAsset(a.user.id, id);
  }

  /** Step 1 of a resource upload; step 2 is POST /instructor/courses/:id/lectures/:lectureId/resources. */
  @Roles('instructor')
  @Post('instructor/uploads/resource')
  resource(@ZBody(resourceSchema) body: z.infer<typeof resourceSchema>, @ActorCtx() a: Actor) {
    return this.media.resourceUpload(a.user.id, body);
  }

  @Post('instructor/uploads/image')
  image(@ZBody(imageSchema) body: z.infer<typeof imageSchema>, @ActorCtx() a: Actor) {
    return this.media.imageUpload(a.user.id, body.contentType);
  }

  /** Public, cacheable images (thumbnails, avatars). Only the images/ prefix is ever served. */
  @Public()
  @Get('media/images/:owner/:file')
  @Header('Cache-Control', 'public, max-age=86400')
  async serveImage(@Param('owner') owner: string, @Param('file') file: string, @Res() res: Response) {
    if (!/^[\w-]{1,64}$/.test(owner) || !/^[\w-]{1,64}\.(jpg|png|webp)$/.test(file)) throw notFound('Image');
    const obj = await this.storage.getStream(`images/${owner}/${file}`);
    if (!obj) throw notFound('Image');
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (obj.size) res.setHeader('Content-Length', String(obj.size));
    obj.body.pipe(res);
  }
}
