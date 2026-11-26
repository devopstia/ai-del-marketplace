import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { ActorCtx, CurrentUser, Roles, type Actor, type AuthUser, Cap } from '../common/auth-context';
import { ZBody } from '../common/zod';
import { StudyService } from './study.service';

const askSchema = z
  .object({
    question: z.string().trim().min(3).max(500),
    lectureId: z.string().min(1).max(64).optional(),
    /** The conversation so far, kept only in the learner's browser (never stored on the server). */
    history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(2000) }).strict()).max(6).optional(),
  })
  .strict();

/** docs/AI_LEARNING.md. Access is checked in StudyService (enrolled with active access, course owner, admin). */
@Controller()
export class StudyController {
  constructor(private readonly svc: StudyService) {}

  /** Search the spoken content of a course's videos; each result jumps to its moment. No AI key needed. */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('me/courses/:slug/search')
  search(@Param('slug') slug: string, @Query('q') q: string | undefined, @CurrentUser() u: AuthUser) {
    return this.svc.search(u, slug, typeof q === 'string' ? q : '');
  }

  /** "Ask about this course": answered only from this course's lessons, with timestamp citations. 404 without a key. */
  @HttpCode(200)
  @Cap('student.ai.ask')
  @Post('me/courses/:slug/ask')
  ask(@Param('slug') slug: string, @ZBody(askSchema) body: z.infer<typeof askSchema>, @CurrentUser() u: AuthUser) {
    return this.svc.ask(u, slug, body);
  }

  /** AI study notes of a lesson (shared, generated once per caption version). 404 without a key. */
  @Get('lectures/:id/study-notes')
  notes(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.svc.lessonNotes(u, id);
  }

  @Roles('instructor', 'admin')
  @Get('instructor/lectures/:id/study-notes')
  instructorNotes(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.svc.instructorNotes(a, id);
  }

  @Roles('instructor', 'admin')
  @HttpCode(200)
  @Post('instructor/lectures/:id/study-notes/regenerate')
  regenerate(@Param('id') id: string, @ActorCtx() a: Actor) {
    return this.svc.instructorNotes(a, id, true);
  }
}
