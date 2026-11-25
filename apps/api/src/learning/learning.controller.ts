import type { Request } from 'express';
import { Controller, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../common/auth-context';
import { ZBody } from '../common/zod';
import { LearningService } from './learning.service';

/** `played`: [start, end] seconds actually played since the last save (unique-viewing tracking for the refund rule). */
const progressSchema = z.object({ positionSec: z.number().int().min(0).max(24 * 3600), completed: z.boolean().optional(), played: z.array(z.tuple([z.number().min(0).max(24 * 3600), z.number().min(0).max(24 * 3600)])).max(200).optional() });
const quizSchema = z.object({ answers: z.array(z.number().int().min(0).max(9)).min(1).max(50) });
const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), body: z.string().trim().max(4000).default('') });

@Controller()
export class LearningController {
  constructor(private readonly svc: LearningService) {}

  @Get('me/learning')
  learning(@CurrentUser() u: AuthUser) {
    return this.svc.myLearning(u.id);
  }

  @Get('me/courses/:slug')
  course(@Param('slug') slug: string, @CurrentUser() u: AuthUser) {
    return this.svc.courseForLearner(u, slug);
  }

  @Get('me/certificates')
  certificates(@CurrentUser() u: AuthUser) {
    return this.svc.myCertificates(u.id);
  }

  @HttpCode(200)
  @Post('lectures/:id/playback')
  playback(@Param('id') id: string, @CurrentUser() u: AuthUser, @Req() req: Request) {
    return this.svc.playback(u, id, { ip: req.ip ?? null, userAgent: req.headers['user-agent'] ?? null });
  }

  @Put('lectures/:id/progress')
  progress(@Param('id') id: string, @ZBody(progressSchema) body: z.infer<typeof progressSchema>, @CurrentUser() u: AuthUser) {
    return this.svc.saveProgress(u, id, body);
  }

  @Get('lectures/:id/resources')
  resources(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.svc.resources(u, id);
  }

  @HttpCode(200)
  @Post('resources/:id/download')
  download(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.svc.download(u, id);
  }

  @Get('lectures/:id/quiz')
  quiz(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.svc.getQuiz(u, id);
  }

  @HttpCode(200)
  @Post('lectures/:id/quiz')
  submit(@Param('id') id: string, @ZBody(quizSchema) body: z.infer<typeof quizSchema>, @CurrentUser() u: AuthUser) {
    return this.svc.submitQuiz(u, id, body.answers);
  }

  @Post('courses/:slug/reviews')
  review(@Param('slug') slug: string, @ZBody(reviewSchema) body: z.infer<typeof reviewSchema>, @CurrentUser() u: AuthUser) {
    return this.svc.review(u, slug, body);
  }

  @HttpCode(200)
  @Post('courses/:slug/certificate')
  certificate(@Param('slug') slug: string, @CurrentUser() u: AuthUser) {
    return this.svc.certificate(u, slug);
  }
}
