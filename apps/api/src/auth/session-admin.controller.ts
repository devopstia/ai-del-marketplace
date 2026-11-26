import { Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Roles } from '../common/auth-context';
import { ZBody } from '../common/zod';
import { SessionAdminService } from './session-admin.service';

const code = z.string().trim().max(12).optional();
const saveSchema = z.object({ settings: z.unknown(), code }).strict();
const codeSchema = z.object({ code }).strict();
const endSchema = z.object({ reason: z.string().trim().max(300).optional() }).strict();

/** Super Admin › Authentication & security, and a person's sessions (docs/AUTH.md §7). */
@Controller('admin')
export class SessionAdminController {
  constructor(private readonly svc: SessionAdminService) {}

  @Roles('super_admin') @Get('auth-settings') get() { return this.svc.getSettings(); }
  @Roles('super_admin') @Put('auth-settings') save(@ZBody(saveSchema) b: z.infer<typeof saveSchema>, @ActorCtx() a: Actor) { return this.svc.saveSettings(a, b); }
  @Roles('super_admin') @HttpCode(200) @Post('auth-settings/reset') reset(@ZBody(codeSchema) b: z.infer<typeof codeSchema>, @ActorCtx() a: Actor) { return this.svc.resetSettings(a, b.code); }

  @Roles('super_admin') @Get('users/:id/sessions') sessions(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.userSessions(a, id); }
  @Roles('super_admin') @Delete('users/:id/sessions/:sid') end(@Param('id') id: string, @Param('sid') sid: string, @ZBody(endSchema) b: z.infer<typeof endSchema>, @ActorCtx() a: Actor) { return this.svc.endSession(a, id, sid, b.reason); }
  @Roles('super_admin') @HttpCode(200) @Post('users/:id/sessions/end-all') endAll(@Param('id') id: string, @ZBody(endSchema) b: z.infer<typeof endSchema>, @ActorCtx() a: Actor) { return this.svc.endAll(a, id, b.reason); }
}
