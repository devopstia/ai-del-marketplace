import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Roles } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { AGENT_SCOPES } from '../assist/assist-context';
import { AGENT_MAX_DAYS, AgentTokensService } from './agent-tokens.service';

const issueSchema = z.object({
  instructorId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.enum(AGENT_SCOPES)).min(1).max(AGENT_SCOPES.length),
  days: z.number().int().min(1).max(AGENT_MAX_DAYS).optional(),
  reason: z.string().trim().min(1).max(500),
  code: z.string().trim().max(12).optional(),
}).strict();
const activityQuery = z.object({ tokenId: z.string().uuid().optional() });

/** Super Admin › AI agents: issue, list and revoke agent tokens; what agents did; courses waiting for approval. */
@Roles('super_admin')
@Controller('admin/agents')
export class AgentsAdminController {
  constructor(private readonly svc: AgentTokensService) {}

  @Get('scopes') scopes() { return this.svc.scopes(); }
  @Get('tokens') list() { return this.svc.list(); }
  @Post('tokens') issue(@ZBody(issueSchema) b: z.infer<typeof issueSchema>, @ActorCtx() a: Actor) { return this.svc.issue(a, b); }
  @HttpCode(200) @Post('tokens/:id/revoke') revoke(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.revoke(a, id); }
  @Get('activity') activity(@ZQuery(activityQuery) q: z.infer<typeof activityQuery>) { return this.svc.activity(q.tokenId); }
  @Get('pending') pending() { return this.svc.pending(); }
}
