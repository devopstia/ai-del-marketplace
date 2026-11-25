import { Controller, Delete, Get, HttpCode, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Public, Roles } from '../common/auth-context';
import { ZBody } from '../common/zod';
import { PaymentsConfigService } from './payments-config.service';

const saveSchema = z.object({ secretKey: z.string().trim().min(10).max(300), publishableKey: z.string().trim().min(10).max(300), webhookSecret: z.string().trim().min(10).max(300), code: z.string().trim().max(12).optional() }).strict();
const codeSchema = z.object({ code: z.string().trim().max(12).optional() }).strict();
const liveSchema = z.object({ enable: z.boolean(), confirm: z.string().max(40).optional(), code: z.string().trim().max(12).optional() }).strict();

@Controller()
export class PaymentsConfigController {
  constructor(private readonly svc: PaymentsConfigService) {}

  /** Public: whether checkout runs in Stripe test mode (shown to learners). */
  @Public() @Get('payments/mode') mode() { return this.svc.publicMode(); }

  @Roles('super_admin') @Get('admin/payments/stripe') status() { return this.svc.status(); }
  @Roles('super_admin') @Put('admin/payments/stripe') save(@ZBody(saveSchema) b: z.infer<typeof saveSchema>, @ActorCtx() a: Actor) { return this.svc.save(a, b); }
  @Roles('super_admin') @Delete('admin/payments/stripe') clear(@ZBody(codeSchema) b: z.infer<typeof codeSchema>, @ActorCtx() a: Actor) { return this.svc.clear(a, b.code); }
  @Roles('super_admin') @HttpCode(200) @Post('admin/payments/stripe/live') live(@ZBody(liveSchema) b: z.infer<typeof liveSchema>, @ActorCtx() a: Actor) { return this.svc.setLive(a, b); }
}
