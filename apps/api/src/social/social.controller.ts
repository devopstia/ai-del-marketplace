import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, Public, Roles } from '../common/auth-context';
import { badRequest, notFound } from '../common/errors';
import { StorageService } from '../common/storage.service';
import { ZBody, ZQuery } from '../common/zod';
import type { EncodedImage } from './share-render';
import { UPLOAD_RULES } from './share-render';
import { FAMILIES, SHARE_TEMPLATE_KEYS } from './share-templates';
import { SocialService } from './social.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const family = z.enum(FAMILIES);
const template = z.enum(SHARE_TEMPLATE_KEYS as [string, ...string[]]);
const line = (max: number) => z.string().trim().max(max);
const siteText = z.object({ headline: z.string().trim().min(2).max(90).refine((s) => s.split('\n').length <= 3, 'At most three lines'), subline: line(120), cta: z.string().trim().min(2).max(28) }).strict();
const settingsBody = z.object({
  title: z.string().trim().min(5).max(70),
  description: z.string().trim().min(20).max(160),
  family, courseFamily: family,
  site: z.object({ pro: siteText, marketplace: siteText, enterprise: siteText }).partial().strict(),
  panels: z.array(z.object({ template, title: z.string().trim().min(1).max(24), line: line(40) }).strict()).length(2),
  chips: z.array(z.string().trim().min(1).max(20)).max(5),
  disabledTemplates: z.array(template).max(SHARE_TEMPLATE_KEYS.length),
}).partial().strict();
/** Previews are GET (shown in <img>): the unsaved settings travel as JSON in `draft`. */
const sitePreview = z.object({ family, draft: z.string().max(6000).optional() }).strict();
const courseChoice = z.object({ family: family.nullable(), template: template.nullable(), headline: z.string().trim().max(90).nullable() }).partial().strict();
const coursePreview = z.object({ family: family.optional(), template: template.optional(), headline: z.string().max(90).optional(), w: z.string().optional() }).strict();
function draftOf(raw: string | undefined) {
  if (!raw) return {};
  let v: unknown;
  try { v = JSON.parse(raw); } catch { throw badRequest('The preview settings are not valid JSON', 'share_preview'); }
  const r = settingsBody.safeParse(v);
  if (!r.success) throw badRequest('Check the highlighted fields', 'validation_failed', { issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
  return r.data;
}
const courseOverride = (q: z.infer<typeof coursePreview>) => ({ family: q.family, template: q.template, ...(q.headline !== undefined ? { headline: q.headline.trim() || null } : {}) });

interface UploadFile { buffer: Buffer; size: number }
const uploadOpts = { limits: { fileSize: UPLOAD_RULES.maxBytes, files: 1, fields: 0 } };
function fileOf(f: UploadFile | undefined) {
  if (!f?.buffer?.length) throw badRequest('Choose an image to upload', 'share_banner_missing');
  return f.buffer;
}

function image(res: Response, img: EncodedImage) {
  res.setHeader('Content-Type', img.type);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.end(img.buf);
}

/**
 * Sharing banners (docs/SOCIAL_SHARING.md). Public: the site defaults and image. Super admin: the settings, the site
 * banner and any course's banner. Instructors: their own courses' banners (checked in the service).
 */
@Controller()
export class SocialController {
  constructor(
    private readonly social: SocialService,
    private readonly storage: StorageService,
  ) {}

  // ---------- public ----------
  @Public() @Get('social/site')
  site() { return this.social.publicSite(); }

  /** The current site banner's bytes (the web app serves it at /og/site.jpg for pages without their own image). */
  @Public() @Get('social/site-image')
  async siteImage(@Res() res: Response) {
    const img = await this.social.ensureSite();
    const obj = await this.storage.getStream(img.path.replace(/^\/media\//, ''));
    if (!obj) throw notFound('Image');
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    obj.body.pipe(res);
  }

  // ---------- super admin: Social Media & Sharing ----------
  @Roles('super_admin') @Get('admin/social')
  adminView() { return this.social.adminView(); }

  @Roles('super_admin') @Put('admin/social')
  update(@ZBody(settingsBody) b: z.infer<typeof settingsBody>, @ActorCtx() a: Actor) { return this.social.updateSettings(a, b as never); }

  @Roles('super_admin') @HttpCode(200) @Post('admin/social/restore-defaults')
  restore(@ActorCtx() a: Actor) { return this.social.restoreDefaults(a); }

  @Roles('super_admin') @Get('admin/social/preview')
  async preview(@ZQuery(sitePreview) q: z.infer<typeof sitePreview>, @Res() res: Response) { image(res, await this.social.previewSite(draftOf(q.draft) as never, q.family)); }

  @Roles('super_admin') @HttpCode(200) @Post('admin/social/site-upload') @UseInterceptors(FileInterceptor('image', uploadOpts))
  siteUpload(@UploadedFile() f: UploadFile | undefined, @ActorCtx() a: Actor) { return this.social.setSiteUpload(a, fileOf(f)); }

  @Roles('super_admin') @Delete('admin/social/site-upload')
  siteUploadRemove(@ActorCtx() a: Actor) { return this.social.setSiteUpload(a, null); }

  @Roles('super_admin') @Get('admin/courses/:id/share')
  adminCourse(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.social.courseView(a, id, true); }

  @Roles('super_admin') @Put('admin/courses/:id/share')
  adminCourseSet(@Param('id', uuid) id: string, @ZBody(courseChoice) b: z.infer<typeof courseChoice>, @ActorCtx() a: Actor) { return this.social.setCourseChoice(a, id, b, true); }

  @Roles('super_admin') @Get('admin/courses/:id/share-preview')
  async adminCoursePreview(@Param('id', uuid) id: string, @ZQuery(coursePreview) q: z.infer<typeof coursePreview>, @ActorCtx() a: Actor, @Res() res: Response) { image(res, await this.social.previewCourse(a, id, courseOverride(q), true)); }

  @Roles('super_admin') @HttpCode(200) @Post('admin/courses/:id/share-upload') @UseInterceptors(FileInterceptor('image', uploadOpts))
  adminCourseUpload(@Param('id', uuid) id: string, @UploadedFile() f: UploadFile | undefined, @ActorCtx() a: Actor) { return this.social.setCourseUpload(a, id, fileOf(f), true); }

  @Roles('super_admin') @Delete('admin/courses/:id/share-upload')
  adminCourseUploadRemove(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.social.setCourseUpload(a, id, null, true); }

  // ---------- instructor: own courses ----------
  @Roles('instructor') @Get('instructor/courses/:id/share')
  view(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.social.courseView(a, id); }

  @Roles('instructor') @Put('instructor/courses/:id/share')
  set(@Param('id', uuid) id: string, @ZBody(courseChoice) b: z.infer<typeof courseChoice>, @ActorCtx() a: Actor) { return this.social.setCourseChoice(a, id, b); }

  @Roles('instructor') @Get('instructor/courses/:id/share-preview')
  async coursePreview(@Param('id', uuid) id: string, @ZQuery(coursePreview) q: z.infer<typeof coursePreview>, @ActorCtx() a: Actor, @Res() res: Response) { image(res, await this.social.previewCourse(a, id, courseOverride(q))); }

  @Roles('instructor') @HttpCode(200) @Post('instructor/courses/:id/share-upload') @UseInterceptors(FileInterceptor('image', uploadOpts))
  upload(@Param('id', uuid) id: string, @UploadedFile() f: UploadFile | undefined, @ActorCtx() a: Actor) { return this.social.setCourseUpload(a, id, fileOf(f)); }

  @Roles('instructor') @Delete('instructor/courses/:id/share-upload')
  uploadRemove(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.social.setCourseUpload(a, id, null); }
}
