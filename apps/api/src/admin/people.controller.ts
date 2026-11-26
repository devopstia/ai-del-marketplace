import { Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Perm, Roles } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { PeopleService } from './people.service';
import { UserAdminService } from './user-admin.service';

const paging = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
const role = z.enum(['student', 'instructor', 'admin', 'super_admin']);
const listQuery = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(['student', 'student_only', 'instructor', 'admin', 'super_admin']).optional(),
  status: z.enum(['active', 'suspended', 'disabled', 'deleted']).optional(),
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
const statusSchema = z.object({ status: z.enum(['active', 'suspended', 'disabled']), reason: z.string().trim().max(500).optional(), until: z.coerce.date().nullable().optional() }).strict();
const code = z.string().trim().max(12).optional();
const reasonReq = z.string().trim().min(3).max(500);
const rolesSchema = z.object({ adminAllowed: z.array(z.string().max(40)).max(40), adminDefaults: z.array(z.string().max(40)).max(40), disabled: z.array(z.string().max(60)).max(40), code, reason: z.string().trim().max(500).optional() }).strict();
const profileSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict();
const emailSchema = z.object({ email: z.string().trim().email().max(254), code, reason: z.string().trim().max(500).optional() }).strict();
const helpSchema = z.object({ code, reason: reasonReq }).strict();
const deleteSchema = z.object({ code, reason: reasonReq, confirmEmail: z.string().trim().max(254) }).strict();
const appQuery = z.object({ status: z.enum(['open', 'pending', 'under_review', 'needs_info', 'approved', 'rejected']).optional(), q: z.string().max(100).optional(), ...paging });
const decideSchema = z.object({ decision: z.enum(['under_review', 'needs_info', 'approved', 'rejected']), note: z.string().trim().max(4000).optional() }).strict();

/** Super Admin Studio › User management: users & roles, instructor applications. */
@Roles('admin')
@Controller('admin/people')
export class PeopleController {
  constructor(private readonly svc: PeopleService, private readonly users: UserAdminService) {}

  @Perm('users.view') @Get('catalogue') catalogue() { return this.svc.catalogue(); }
  @Perm('users.view') @Get('summary') summary() { return this.svc.summary(); }
  @Perm('users.view') @Get('users') list(@ZQuery(listQuery) q: z.infer<typeof listQuery>) { return this.svc.list(q); }
  @Perm('users.view') @Get('users/:id') detail(@Param('id') id: string) { return this.svc.detail(id); }

  @Roles('super_admin') @Put('users/:id/access')
  access(@Param('id') id: string, @ZBody(accessSchema) b: z.infer<typeof accessSchema>, @ActorCtx() a: Actor) { return this.svc.setAccess(a, id, b); }

  @Perm('users.manage') @HttpCode(200) @Post('users/:id/status')
  status(@Param('id') id: string, @ZBody(statusSchema) b: z.infer<typeof statusSchema>, @ActorCtx() a: Actor) { return this.svc.setStatus(a, id, b.status, b.reason, b.until ?? null); }

  // Role Management: what Admin, Instructor and Student may do (Super Admin is a locked system role).
  @Perm('users.view') @Get('roles') roles() { return this.svc.roles(); }
  @Roles('super_admin') @Put('roles')
  saveRoles(@ZBody(rolesSchema) b: z.infer<typeof rolesSchema>, @ActorCtx() a: Actor) { return this.svc.saveRoles(a, b); }

  // Account help (docs/SUPER_ADMIN.md): nothing here shows or emails an existing password.
  @Perm('users.manage') @Patch('users/:id/profile')
  profile(@Param('id') id: string, @ZBody(profileSchema) b: z.infer<typeof profileSchema>, @ActorCtx() a: Actor) { return this.users.updateProfile(a, id, b); }
  @Roles('super_admin') @Put('users/:id/email')
  email(@Param('id') id: string, @ZBody(emailSchema) b: z.infer<typeof emailSchema>, @ActorCtx() a: Actor) { return this.users.changeEmail(a, id, b); }
  @Perm('users.manage') @HttpCode(200) @Post('users/:id/password-reset')
  passwordReset(@Param('id') id: string, @ActorCtx() a: Actor) { return this.users.sendPasswordReset(a, id); }
  @Perm('users.manage') @HttpCode(200) @Post('users/:id/verification')
  verification(@Param('id') id: string, @ActorCtx() a: Actor) { return this.users.resendVerification(a, id); }
  @Roles('super_admin') @HttpCode(200) @Post('users/:id/recovery-link')
  recoveryLink(@Param('id') id: string, @ZBody(helpSchema) b: z.infer<typeof helpSchema>, @ActorCtx() a: Actor) { return this.users.recoveryLink(a, id, b); }
  @Roles('super_admin') @HttpCode(200) @Post('users/:id/temporary-password')
  tempPassword(@Param('id') id: string, @ZBody(helpSchema) b: z.infer<typeof helpSchema>, @ActorCtx() a: Actor) { return this.users.temporaryPassword(a, id, b); }
  @Perm('users.manage') @HttpCode(200) @Post('users/:id/sessions/revoke')
  revokeSessions(@Param('id') id: string, @ActorCtx() a: Actor) { return this.users.revokeSessions(a, id); }
  @Roles('super_admin') @HttpCode(200) @Post('users/:id/delete')
  remove(@Param('id') id: string, @ZBody(deleteSchema) b: z.infer<typeof deleteSchema>, @ActorCtx() a: Actor) { return this.users.deleteUser(a, id, b); }

  @Perm('users.view') @Get('applications') applications(@ZQuery(appQuery) q: z.infer<typeof appQuery>) { return this.svc.applications(q); }

  @Perm('instructors.review') @HttpCode(200) @Post('applications/:userId/decision')
  decide(@Param('userId') id: string, @ZBody(decideSchema) b: z.infer<typeof decideSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, b.decision, b.note); }
}
