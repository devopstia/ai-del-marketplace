import { Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ActorCtx, type Actor, type AppRequest, Public, Roles } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { SUPPORT_MAX_MINUTES } from './assist-context';
import { SupportSessionService } from './support-session.service';

const startSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
  code: z.string().trim().max(12).optional(),
  minutes: z.number().int().min(5).max(SUPPORT_MAX_MINUTES).optional(),
}).strict();
const historyQuery = z.object({ userId: z.string().uuid().optional() });

/**
 * Support sessions (docs/SUPPORT_SESSIONS_AND_AGENTS.md). Paths under /support-session always run as the super admin
 * themselves (never as the user being helped), so Return and history keep working inside a session.
 */
@Controller('support-session')
export class SupportSessionController {
  constructor(private readonly svc: SupportSessionService) {}

  /** For the banner on every page. */
  @Public() @Get()
  status(@Req() req: AppRequest) { return this.svc.status(req); }

  @Roles('super_admin') @HttpCode(200) @Post('start')
  start(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response, @ZBody(startSchema) b: z.infer<typeof startSchema>) {
    return this.svc.start(req, res, b);
  }

  /** Return to the Super Admin dashboard (no new sign-in). */
  @HttpCode(200) @Post('end')
  end(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) { return this.svc.end(req, res); }

  @Roles('super_admin') @Get('history')
  history(@ZQuery(historyQuery) q: z.infer<typeof historyQuery>) { return this.svc.history(q.userId); }

  @Roles('super_admin') @HttpCode(200) @Post(':id/revoke')
  revoke(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.revoke(a, id); }
}
