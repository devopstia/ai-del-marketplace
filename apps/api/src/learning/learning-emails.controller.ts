import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { ActorCtx, type Actor, Public, SkipCsrf } from '../common/auth-context';
import { AuditService } from '../common/audit.service';
import { forbidden } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { ZBody } from '../common/zod';
import { verifyOptOutToken } from './nudges';

const linkSchema = z.object({ u: z.string().uuid(), t: z.string().min(8).max(64), on: z.boolean() }).strict();

/**
 * Learning tips and course suggestions on/off (owner 2026-11-28). The emails carry a signed one-click link that works
 * without signing in; the signed-in student can also switch them in Account. Only these optional emails stop:
 * account, security, receipts and access notices always go out.
 */
@Controller('email/learning-emails')
export class LearningEmailsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** From the email link (the page asks for a click first, so mail scanners that open links change nothing). */
  @Public()
  @SkipCsrf()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('link')
  async viaLink(@ZBody(linkSchema) b: z.infer<typeof linkSchema>) {
    if (!verifyOptOutToken(b.u, b.t)) throw forbidden('This link is not valid. Sign in and change it in Account instead.', 'invalid_link');
    return this.set(b.u, b.on, 'link');
  }

  @Get()
  async mine(@ActorCtx() a: Actor) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: a.user.id }, select: { learningEmailsOptOutAt: true } });
    return { enabled: !u.learningEmailsOptOutAt };
  }

  @HttpCode(200)
  @Post()
  setMine(@ZBody(z.object({ on: z.boolean() }).strict()) b: { on: boolean }, @ActorCtx() a: Actor) {
    return this.set(a.user.id, b.on, 'account');
  }

  private async set(userId: string, on: boolean, via: string) {
    const r = await this.prisma.user.updateMany({ where: { id: userId }, data: { learningEmailsOptOutAt: on ? null : new Date() } });
    if (r.count) await this.audit.log({ actorId: userId, action: on ? 'email.learning_on' : 'email.learning_off', targetType: 'user', targetId: userId, meta: { via } });
    return { enabled: on };
  }
}
