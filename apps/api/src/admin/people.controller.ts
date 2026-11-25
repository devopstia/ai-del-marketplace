import { Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Perm, Roles } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { PeopleService } from './people.service';

const paging = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
const role = z.enum(['student', 'instructor', 'admin', 'super_admin']);
const listQuery = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(['student', 'student_only', 'instructor', 'admin', 'super_admin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  method: z.enum(['email', 'google', 'github', 'facebook', 'linkedin', 'invitation', 'seed']).optional(),
  since: z.coerce.date().optional(),
  ...paging,
});
const accessSchema = z.object({
  roles: z.array(role).max(4),
  adminPermissions: z.array(z.string().max(40)).max(40).optional(),
  code: z.string().trim().max(12).optional(),
  reason: z.string().trim().max(500).optional(),
}).strict();
const statusSchema = z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().max(500).optional() }).strict();
const appQuery = z.object({ status: z.enum(['open', 'pending', 'under_review', 'needs_info', 'approved', 'rejected']).optional(), q: z.string().max(100).optional(), ...paging });
const decideSchema = z.object({ decision: z.enum(['under_review', 'needs_info', 'approved', 'rejected']), note: z.string().trim().max(4000).optional() }).strict();

/** Super Admin Studio › User management: users & roles, instructor applications. */
@Roles('admin')
@Controller('admin/people')
export class PeopleController {
  constructor(private readonly svc: PeopleService) {}

  @Perm('users.view') @Get('catalogue') catalogue() { return this.svc.catalogue(); }
  @Perm('users.view') @Get('summary') summary() { return this.svc.summary(); }
  @Perm('users.view') @Get('users') list(@ZQuery(listQuery) q: z.infer<typeof listQuery>) { return this.svc.list(q); }
  @Perm('users.view') @Get('users/:id') detail(@Param('id') id: string) { return this.svc.detail(id); }

  @Roles('super_admin') @Put('users/:id/access')
  access(@Param('id') id: string, @ZBody(accessSchema) b: z.infer<typeof accessSchema>, @ActorCtx() a: Actor) { return this.svc.setAccess(a, id, b); }

  @Perm('users.manage') @HttpCode(200) @Post('users/:id/status')
  status(@Param('id') id: string, @ZBody(statusSchema) b: z.infer<typeof statusSchema>, @ActorCtx() a: Actor) { return this.svc.setStatus(a, id, b.status, b.reason); }

  @Perm('users.view') @Get('applications') applications(@ZQuery(appQuery) q: z.infer<typeof appQuery>) { return this.svc.applications(q); }

  @Perm('instructors.review') @HttpCode(200) @Post('applications/:userId/decision')
  decide(@Param('userId') id: string, @ZBody(decideSchema) b: z.infer<typeof decideSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, b.decision, b.note); }
}
