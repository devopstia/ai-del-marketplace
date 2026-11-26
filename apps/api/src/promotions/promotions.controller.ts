import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Roles, Perm, Cap } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { PromotionsService } from './promotions.service';

const when = z.coerce.date();
const saleSchema = z.object({
  salePriceCents: z.number().int(),
  startsAt: when.optional(),
  endsAt: when,
});
const optOutSchema = z.object({ promoOptOut: z.boolean() });
const promotionSchema = z.object({
  name: z.string().trim().min(3).max(80),
  percentOff: z.number().int(),
  startsAt: when.optional(),
  endsAt: when,
  scope: z.enum(['all', 'categories', 'courses']),
  categoryIds: z.array(z.string().uuid()).max(50).optional(),
  courseIds: z.array(z.string().uuid()).max(500).optional(),
});
const salesQuery = z.object({ status: z.enum(['open', 'all']).default('open') });
const cancelSchema = z.object({ note: z.string().trim().min(5).max(1000) });
const uuid = new ParseUUIDPipe({ version: '4' });

/** Instructors (and the DEL studio) manage sales on their own courses. Ownership is checked in the service. */
@Roles('instructor')
@Controller('instructor')
export class InstructorPromotionsController {
  constructor(private readonly svc: PromotionsService) {}

  @Get('promotions')
  overview(@ActorCtx() a: Actor) { return this.svc.instructorOverview(a.user.id); }

  @Get('courses/:id/sales')
  list(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.svc.listSales(a.user.id, id); }

  @Cap('instructor.sales.manage')
  @Post('courses/:id/sales')
  create(@Param('id', uuid) id: string, @ZBody(saleSchema) b: z.infer<typeof saleSchema>, @ActorCtx() a: Actor) { return this.svc.createSale(a, id, b); }

  @Cap('instructor.sales.manage')
  @Patch('courses/:id/sales/:saleId')
  update(@Param('id', uuid) id: string, @Param('saleId', uuid) saleId: string, @ZBody(saleSchema) b: z.infer<typeof saleSchema>, @ActorCtx() a: Actor) {
    return this.svc.updateSale(a, id, saleId, b);
  }

  @HttpCode(200) @Post('courses/:id/sales/:saleId/cancel')
  cancel(@Param('id', uuid) id: string, @Param('saleId', uuid) saleId: string, @ActorCtx() a: Actor) { return this.svc.cancelSale(a, id, saleId); }

  @Put('courses/:id/promotions')
  optOut(@Param('id', uuid) id: string, @ZBody(optOutSchema) b: z.infer<typeof optOutSchema>, @ActorCtx() a: Actor) { return this.svc.setOptOut(a, id, b.promoOptOut); }
}

/** Admins see promotions and instructor sales; only a super admin changes them. */
@Roles('admin')
@Controller('admin')
export class AdminPromotionsController {
  constructor(private readonly svc: PromotionsService) {}

  @Perm('promotions.view') @Get('promotions') list() { return this.svc.listPromotions(); }

  @Roles('super_admin') @Post('promotions')
  create(@ZBody(promotionSchema) b: z.infer<typeof promotionSchema>, @ActorCtx() a: Actor) { return this.svc.createPromotion(a, b); }

  @Roles('super_admin') @Patch('promotions/:id')
  update(@Param('id', uuid) id: string, @ZBody(promotionSchema) b: z.infer<typeof promotionSchema>, @ActorCtx() a: Actor) { return this.svc.updatePromotion(a, id, b); }

  @Roles('super_admin') @HttpCode(200) @Post('promotions/:id/cancel')
  cancel(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.svc.cancelPromotion(a, id); }

  @Perm('promotions.view') @Get('course-sales')
  sales(@ZQuery(salesQuery) q: z.infer<typeof salesQuery>) { return this.svc.listCourseSales(q.status); }

  @Roles('super_admin') @HttpCode(200) @Post('course-sales/:id/cancel')
  cancelSale(@Param('id', uuid) id: string, @ZBody(cancelSchema) b: z.infer<typeof cancelSchema>, @ActorCtx() a: Actor) { return this.svc.adminCancelSale(a, id, b.note); }
}
