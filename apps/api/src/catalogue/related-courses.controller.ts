import { Controller, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, CurrentUser, Roles, type Actor, type AuthUser } from '../common/auth-context';
import { ZBody } from '../common/zod';
import { REASON_MAX, RELATED_MAX, RelatedCoursesService } from './related-courses.service';

/** `PUT …/related` body: the full ordered list (an empty list clears it). Shared with the agent API. */
export const relatedSchema = z.object({
  items: z.array(z.object({ courseId: z.string().uuid(), reason: z.string().trim().max(REASON_MAX).optional() }).strict()).max(RELATED_MAX),
}).strict();

/**
 * "Continue your learning journey" (owner 2026-11-28). Studio routes live under /instructor so DEL Studio (act_as)
 * applies; the student route powers the Student Studio panel. The public course page gets `related` from
 * GET /courses/:slug.
 */
@Controller()
export class RelatedCoursesController {
  constructor(private readonly svc: RelatedCoursesService) {}

  @Roles('instructor') @Get('instructor/courses/:id/related')
  list(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.list(a.user.id, id); }

  @Roles('instructor') @Get('instructor/courses/:id/related/candidates')
  candidates(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.candidates(a.user.id, id); }

  @Roles('instructor') @Put('instructor/courses/:id/related')
  set(@Param('id') id: string, @ZBody(relatedSchema) b: z.infer<typeof relatedSchema>, @ActorCtx() a: Actor) { return this.svc.set(a, id, b.items); }

  @Get('me/related-courses')
  async mine(@CurrentUser() user: AuthUser) { return { items: await this.svc.forStudent(user.id) }; }
}
