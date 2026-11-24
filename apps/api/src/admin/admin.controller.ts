import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Roles } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { AdminService } from './admin.service';

const paging = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
const noteSchema = z.object({ note: z.string().trim().max(4000).optional() });
const coursesQuery = z.object({ status: z.enum(['draft', 'in_review', 'changes_requested', 'published', 'unpublished', 'rejected']).optional(), q: z.string().max(100).optional(), ...paging });
const usersQuery = z.object({ q: z.string().max(100).optional(), role: z.enum(['student', 'instructor', 'admin', 'super_admin']).optional(), status: z.enum(['active', 'suspended']).optional(), ...paging });
const userPatch = z
  .object({ status: z.enum(['active', 'suspended']).optional(), roles: z.array(z.enum(['student', 'instructor', 'admin', 'super_admin'])).max(4).optional() })
  .refine((v) => v.status || v.roles, 'Nothing to change');
const instructorsQuery = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), q: z.string().max(100).optional(), ...paging });
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
  icon: z.string().max(40).optional(),
  sort: z.number().int().min(0).max(1000).optional(),
});
const settingsSchema = z.object({ commission_bps: z.number().int().min(0).max(10000) });
const ordersQuery = z.object({ status: z.enum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded']).optional(), q: z.string().max(100).optional(), ...paging });
const refundSchema = z.object({ lineIds: z.array(z.string().uuid()).max(100).optional(), reason: z.string().max(500).optional() });
const auditQuery = z.object({
  action: z.string().max(80).optional(),
  actorId: z.string().uuid().optional(),
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(80).optional(),
  q: z.string().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ...paging,
});
const reviewPatch = z.object({ status: z.enum(['visible', 'hidden']) });

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly svc: AdminService) {}

  @Get('stats') stats() { return this.svc.stats(); }
  @Get('review-queue') queue() { return this.svc.reviewQueue(); }
  @Get('courses') courses(@ZQuery(coursesQuery) q: z.infer<typeof coursesQuery>) { return this.svc.courses(q); }
  @Get('courses/:id') course(@Param('id') id: string) { return this.svc.course(id); }

  @HttpCode(200) @Post('courses/:id/approve')
  approve(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'approve', b.note); }
  @HttpCode(200) @Post('courses/:id/request-changes')
  changes(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'request-changes', b.note); }
  @HttpCode(200) @Post('courses/:id/reject')
  reject(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'reject', b.note); }
  @HttpCode(200) @Post('courses/:id/unpublish')
  unpublish(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'unpublish', b.note); }

  @Get('users') users(@ZQuery(usersQuery) q: z.infer<typeof usersQuery>) { return this.svc.users(q); }
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @ZBody(userPatch) b: z.infer<typeof userPatch>, @ActorCtx() a: Actor) { return this.svc.updateUser(a, id, b); }

  @Get('instructors') instructors(@ZQuery(instructorsQuery) q: z.infer<typeof instructorsQuery>) { return this.svc.instructors(q); }
  @HttpCode(200) @Post('instructors/:id/approve')
  approveInstructor(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decideInstructor(a, id, true, b.note); }
  @HttpCode(200) @Post('instructors/:id/reject')
  rejectInstructor(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decideInstructor(a, id, false, b.note); }

  @Get('categories') categories() { return this.svc.categories(); }
  @Post('categories')
  createCategory(@ZBody(categorySchema) b: z.infer<typeof categorySchema>, @ActorCtx() a: Actor) { return this.svc.createCategory(a, b); }
  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @ZBody(categorySchema.partial()) b: Partial<z.infer<typeof categorySchema>>, @ActorCtx() a: Actor) { return this.svc.updateCategory(a, id, b); }
  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.deleteCategory(a, id); }

  @Get('settings') settings() { return this.svc.getSettings(); }
  @Put('settings')
  putSettings(@ZBody(settingsSchema) b: z.infer<typeof settingsSchema>, @ActorCtx() a: Actor) { return this.svc.putSettings(a, b); }

  @Get('orders') orders(@ZQuery(ordersQuery) q: z.infer<typeof ordersQuery>) { return this.svc.orders(q); }
  @Get('orders/:id') order(@Param('id') id: string) { return this.svc.order(id); }
  @HttpCode(200) @Post('orders/:id/refund')
  refund(@Param('id') id: string, @ZBody(refundSchema) b: z.infer<typeof refundSchema>, @ActorCtx() a: Actor) { return this.svc.refund(a, id, b); }

  @Patch('reviews/:id')
  review(@Param('id') id: string, @ZBody(reviewPatch) b: z.infer<typeof reviewPatch>, @ActorCtx() a: Actor) { return this.svc.setReviewStatus(a, id, b.status); }

  @Get('audit') audit(@ZQuery(auditQuery) q: z.infer<typeof auditQuery>) { return this.svc.auditLog(q); }
}
