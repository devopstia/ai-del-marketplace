import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, CurrentUser, type AuthUser, Perm, Public, Roles, Cap } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { MAX_HOURS_PER_WEEK, MIN_HOURS_PER_WEEK } from './plan';
import { MAX_STEPS, PathsService } from './paths.service';

const slug = z.string().trim().toLowerCase().min(3).max(80);
const pathSchema = z.object({
  title: z.string().trim().min(3).max(80),
  slug,
  summary: z.string().trim().max(280).default(''),
  description: z.string().trim().max(5000).default(''),
  steps: z.array(z.object({
    courseId: z.string().uuid(),
    skills: z.array(z.string().max(60)).max(20).default([]),
    note: z.string().trim().max(300).default(''),
  }).strict()).max(MAX_STEPS),
}).strict();
const followSchema = z.object({ hoursPerWeek: z.number().int().min(MIN_HOURS_PER_WEEK).max(MAX_HOURS_PER_WEEK).optional() }).strict();
const optionsQuery = z.object({ q: z.string().trim().max(80).optional() });
const uuid = new ParseUUIDPipe({ version: '4' });

/** Published career paths, for everyone (docs/CAREER_PATHS.md). */
@Public()
@Controller('paths')
export class PathsController {
  constructor(private readonly svc: PathsService) {}

  @Get() list() { return this.svc.listPublished(); }

  @Get(':slug') one(@Param('slug') s: string) { return this.svc.publicPath(s); }
}

/** The signed-in student's paths: follow, study time per week, progress. Always the caller's own rows. */
@Controller('me/paths')
export class MyPathsController {
  constructor(private readonly svc: PathsService) {}

  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.myPaths(u.id); }

  /** Light check for the Student Studio menu: is any path published, does this student follow one. */
  @Get('summary') summary(@CurrentUser() u: AuthUser) { return this.svc.mySummary(u.id); }

  @Get(':slug') one(@Param('slug') s: string, @CurrentUser() u: AuthUser) { return this.svc.myPath(u.id, s); }

  /** Follow a path, or change the hours per week of one already followed. */
  @Cap('student.paths.follow') @Put(':slug') follow(@Param('slug') s: string, @ZBody(followSchema) b: z.infer<typeof followSchema>, @CurrentUser() u: AuthUser) {
    return this.svc.follow(u.id, s, b.hoursPerWeek);
  }

  @Delete(':slug') unfollow(@Param('slug') s: string, @CurrentUser() u: AuthUser) { return this.svc.unfollow(u.id, s); }
}

/** Admins with content.manage can look; only a super admin writes, publishes or deletes a path (audited). */
@Roles('admin')
@Controller('admin/paths')
export class AdminPathsController {
  constructor(private readonly svc: PathsService) {}

  @Perm('content.manage') @Get() list() { return this.svc.adminList(); }

  @Perm('content.manage') @Get('course-options') options(@ZQuery(optionsQuery) q: z.infer<typeof optionsQuery>) { return this.svc.courseOptions(q.q); }

  @Perm('content.manage') @Get(':id') one(@Param('id', uuid) id: string) { return this.svc.adminGet(id); }

  @Roles('super_admin') @Post()
  create(@ZBody(pathSchema) b: z.infer<typeof pathSchema>, @ActorCtx() a: Actor) { return this.svc.create(a, b); }

  @Roles('super_admin') @Put(':id')
  update(@Param('id', uuid) id: string, @ZBody(pathSchema) b: z.infer<typeof pathSchema>, @ActorCtx() a: Actor) { return this.svc.update(a, id, b); }

  @Roles('super_admin') @HttpCode(200) @Post(':id/publish')
  publish(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.svc.publish(a, id); }

  @Roles('super_admin') @HttpCode(200) @Post(':id/unpublish')
  unpublish(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.svc.unpublish(a, id); }

  @Roles('super_admin') @Delete(':id')
  remove(@Param('id', uuid) id: string, @ActorCtx() a: Actor) { return this.svc.remove(a, id); }
}
