import { Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Roles } from '../common/auth-context';
import { badRequest } from '../common/errors';
import { ZBody } from '../common/zod';
import { OAuthConfigService } from './oauth-config.service';
import { REAL_PROVIDERS, type RealProvider } from './oauth.providers';

const saveSchema = z.object({ clientId: z.string().trim().min(4).max(200), clientSecret: z.string().trim().min(4).max(300), code: z.string().trim().max(12).optional() }).strict();
const codeSchema = z.object({ code: z.string().trim().max(12).optional() }).strict();
const provider = (p: string): RealProvider => { if (!(REAL_PROVIDERS as string[]).includes(p)) throw badRequest('Unknown sign-in provider', 'provider'); return p as RealProvider; };

/** Super Admin › Sign-in methods (docs/AUTH.md). */
@Controller('admin/sign-in-methods')
export class OAuthConfigController {
  constructor(private readonly svc: OAuthConfigService) {}
  @Roles('super_admin') @Get() status() { return this.svc.status(); }
  @Roles('super_admin') @Put(':provider') save(@Param('provider') p: string, @ZBody(saveSchema) b: z.infer<typeof saveSchema>, @ActorCtx() a: Actor) { return this.svc.save(a, provider(p), b); }
  @Roles('super_admin') @Delete(':provider') remove(@Param('provider') p: string, @ZBody(codeSchema) b: z.infer<typeof codeSchema>, @ActorCtx() a: Actor) { return this.svc.remove(a, provider(p), b.code); }
}
