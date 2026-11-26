import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Perm, Roles, Cap } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { ModerationService, REPORT_REASONS } from './moderation.service';

const listQuery = z.object({
  q: z.string().max(100).optional(), courseId: z.string().uuid().optional(), instructorId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(), status: z.enum(['visible', 'hidden']).optional(),
  reported: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const reasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) }).strict();
const statusSchema = z.object({ status: z.enum(['visible', 'hidden']), reason: z.string().trim().min(5).max(1000) }).strict();
const reportSchema = z.object({ reason: z.enum(REPORT_REASONS), details: z.string().trim().min(10).max(2000) }).strict();
const noteSchema = z.object({ note: z.string().trim().min(3).max(1000) }).strict();

@Controller()
export class ModerationController {
  constructor(private readonly svc: ModerationService) {}

  @Roles('instructor') @Cap('instructor.reviews.respond') @Post('instructor/reviews/:id/report')
  report(@Param('id') id: string, @ZBody(reportSchema) b: z.infer<typeof reportSchema>, @ActorCtx() a: Actor) { return this.svc.report(a, id, b); }

  @Roles('instructor') @Get('instructor/review-reports')
  mine(@ActorCtx() a: Actor) { return this.svc.myReports(a.user.id); }

  @Roles('admin') @Perm('reviews.moderate') @Get('admin/reviews')
  list(@ZQuery(listQuery) q: z.infer<typeof listQuery>) { return this.svc.list(q); }

  /** Options for the course and instructor filters: only courses that have reviews. */
  @Roles('admin') @Perm('reviews.moderate') @Get('admin/reviews/filters')
  filters() { return this.svc.filterOptions(); }

  @Roles('admin') @Perm('reviews.moderate') @HttpCode(200) @Post('admin/reviews/:id/status')
  status(@Param('id') id: string, @ZBody(statusSchema) b: z.infer<typeof statusSchema>, @ActorCtx() a: Actor) { return this.svc.setStatus(a, id, b.status, b.reason); }

  @Roles('super_admin') @Delete('admin/reviews/:id')
  remove(@Param('id') id: string, @ZBody(reasonSchema) b: z.infer<typeof reasonSchema>, @ActorCtx() a: Actor) { return this.svc.remove(a, id, b.reason); }

  @Roles('admin') @Perm('reviews.moderate') @HttpCode(200) @Post('admin/review-reports/:id/dismiss')
  dismiss(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.dismiss(a, id, b.note); }
}
