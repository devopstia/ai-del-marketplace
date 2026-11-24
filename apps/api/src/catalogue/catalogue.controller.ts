import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/auth-context';
import { ZQuery } from '../common/zod';
import { CatalogueService } from './catalogue.service';

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().max(80).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  price: z.enum(['free', 'paid']).optional(),
  sort: z.enum(['popular', 'newest', 'rating', 'price_asc', 'price_desc']).default('popular'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
});
const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10) });

@Public()
@Controller()
export class CatalogueController {
  constructor(private readonly svc: CatalogueService) {}

  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('categories')
  async categories() {
    return { items: await this.svc.categories() };
  }

  @Get('courses')
  courses(@ZQuery(listSchema) q: z.infer<typeof listSchema>) {
    return this.svc.listCourses(q);
  }

  @Get('courses/:slug')
  course(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.svc.courseDetail(slug, user);
  }

  @Get('courses/:slug/reviews')
  reviews(@Param('slug') slug: string, @ZQuery(pageSchema) q: z.infer<typeof pageSchema>) {
    return this.svc.courseReviews(slug, q.page, q.pageSize);
  }

  @Get('instructors/:id')
  instructor(@Param('id') id: string) {
    return this.svc.instructor(id);
  }

  @HttpCode(200)
  @Post('lectures/:id/preview-playback')
  preview(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.svc.previewPlayback(id, user);
  }

  @HttpCode(200)
  @Post('courses/:slug/promo-playback')
  promo(@Param('slug') slug: string, @CurrentUser() user?: AuthUser) {
    return this.svc.promoPlayback(slug, user);
  }

  @Get('certificates/:code')
  certificate(@Param('code') code: string) {
    return this.svc.verifyCertificate(code);
  }
}
