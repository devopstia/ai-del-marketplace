import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { ActorCtx, type Actor, Perm, Roles } from '../common/auth-context';
import { ZBody, ZQuery } from '../common/zod';
import { AdminService } from './admin.service';
import { FinanceService, REFUND_FILTERS } from './finance.service';
import { RefundPolicyService } from '../commerce/refund-policy.service';
import { PeopleService } from './people.service';
import { CourseAdminService } from './course-admin.service';
import { SystemService } from './system.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { RANGE_KEYS, type RangeKey } from '../instructor/dashboard';

const dashboardQuery = z.object({ range: z.enum(RANGE_KEYS as [RangeKey, ...RangeKey[]]).optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() });
const paging = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };
const noteSchema = z.object({ note: z.string().trim().max(4000).optional() });
const coursesQuery = z.object({ status: z.enum(['draft', 'in_review', 'changes_requested', 'published', 'unpublished', 'rejected']).optional(), view: z.enum(['active', 'archived', 'deleting', 'purged', 'all']).optional(), featured: z.coerce.boolean().optional(), q: z.string().max(100).optional(), ...paging });
const lines = z.array(z.string().trim().min(1).max(300)).max(30);
const courseEdit = z.object({
  title: z.string().trim().min(3).max(160).optional(), subtitle: z.string().trim().max(300).optional(), description: z.string().max(20000).optional(),
  objectives: lines.optional(), requirements: lines.optional(), categoryId: z.string().uuid().nullable().optional(), level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  language: z.string().trim().min(2).max(10).optional(), priceCents: z.number().int().min(0).max(100_000_00).optional(), coverTemplateId: z.string().uuid().nullable().optional(), reason: z.string().trim().max(500).optional(),
}).strict();
const featureSchema = z.object({ on: z.boolean() }).strict();
const archiveSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
const deleteCourseSchema = z.object({ reason: z.string().trim().min(3).max(500), confirmTitle: z.string().max(200), code: z.string().trim().max(12).optional() }).strict();
const usersQuery = z.object({ q: z.string().max(100).optional(), role: z.enum(['student', 'instructor', 'admin', 'super_admin']).optional(), status: z.enum(['active', 'suspended']).optional(), ...paging });
const userPatch = z
  .object({ status: z.enum(['active', 'suspended']).optional(), roles: z.array(z.enum(['student', 'instructor', 'admin', 'super_admin'])).max(4).optional(), code: z.string().trim().max(12).optional(), reason: z.string().trim().max(500).optional() })
  .refine((v) => v.status || v.roles, 'Nothing to change');
const instructorsQuery = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional(), kind: z.enum(['official', 'independent']).optional(), q: z.string().max(100).optional(), ...paging });
const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]{2,80}$/).optional(),
  icon: z.string().max(40).optional(),
  sort: z.number().int().min(0).max(1000).optional(),
});
const settingsSchema = z.object({ commission_bps: z.number().int().min(0).max(10000).optional(), notify_new_registrations: z.boolean().optional(), notify_instructor_applications: z.boolean().optional() }).strict();
const ordersQuery = z.object({ status: z.enum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded']).optional(), q: z.string().max(100).optional(), ...paging });
const refundSchema = z.object({ lineIds: z.array(z.string().uuid()).max(100).optional(), reason: z.string().max(500).optional() });
const auditQuery = z.object({
  action: z.string().max(80).optional(),
  actorId: z.string().uuid().optional(),
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(80).optional(),
  q: z.string().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  ...paging,
});
const refundReqQuery = z.object({ status: z.enum(REFUND_FILTERS).optional() });
/** A new refund policy version (Super Admin › Refunds › Policy; src/commerce/refund-policy.ts validates the rules). */
const refundPolicySchema = z.object({
  windowDays: z.number().int().min(1).max(365),
  maxWatchedPercent: z.number().min(0).max(100),
  autoCheck: z.boolean(),
  autoReject: z.boolean(),
  autoApprove: z.boolean(),
  allowExceptions: z.boolean(),
  selfServicePerYear: z.number().int().min(0).max(100),
  messages: z.object({ submitted: z.string().max(1000).optional(), approved: z.string().max(1000).optional(), declined: z.string().max(1000).optional(), processed: z.string().max(1000).optional() }).strict().optional(),
  note: z.string().trim().max(500).optional(),
  code: z.string().trim().max(12).optional(),
}).strict();
/** commissionBps = the platform's share of the net (2000 → instructor keeps 80%); null returns to the default. */
const termsSchema = z.object({ commissionBps: z.number().int().min(0).max(10000).nullable().optional(), payToPlatform: z.boolean().optional(), official: z.boolean().optional(), note: z.string().trim().min(5).max(1000) });
const reviewPatch = z.object({ status: z.enum(['visible', 'hidden']) });

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly svc: AdminService,
    private readonly finance: FinanceService,
    private readonly people: PeopleService,
    private readonly courseAdmin: CourseAdminService,
    private readonly system: SystemService,
    private readonly refundPolicy: RefundPolicyService,
    private readonly dashboard: AdminDashboardService,
  ) {}

  @Get('stats') stats() { return this.svc.stats(); }
  /** Admin / Super Admin overview (Option A phase 3; docs/DASHBOARD_DESIGN.md): each block only for admins with its permission. */
  @Get('dashboard') overview(@ZQuery(dashboardQuery) q: z.infer<typeof dashboardQuery>, @ActorCtx() a: Actor) { return this.dashboard.overview(a.user, q); }
  @Perm('courses.review') @Get('review-queue') queue() { return this.svc.reviewQueue(); }
  @Perm('courses.review') @Get('courses') courses(@ZQuery(coursesQuery) q: z.infer<typeof coursesQuery>) { return this.svc.courses(q); }
  @Perm('courses.review') @Get('courses/:id') course(@Param('id') id: string) { return this.svc.course(id); }
  // Super Admin › Courses: any course, whoever teaches it (docs/SUPER_ADMIN.md).
  @Perm('courses.review') @Get('courses/:id/state') courseState(@Param('id') id: string) { return this.courseAdmin.state(id); }
  @Roles('super_admin') @Patch('courses/:id')
  editCourse(@Param('id') id: string, @ZBody(courseEdit) b: z.infer<typeof courseEdit>, @ActorCtx() a: Actor) { return this.courseAdmin.edit(a, id, b); }
  @Roles('super_admin') @HttpCode(200) @Post('courses/:id/publish')
  publish(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.courseAdmin.publish(a, id, b.note); }
  @Roles('super_admin') @HttpCode(200) @Post('courses/:id/feature')
  feature(@Param('id') id: string, @ZBody(featureSchema) b: z.infer<typeof featureSchema>, @ActorCtx() a: Actor) { return this.courseAdmin.feature(a, id, b.on); }
  @Roles('super_admin') @HttpCode(200) @Post('courses/:id/archive')
  archive(@Param('id') id: string, @ZBody(archiveSchema) b: z.infer<typeof archiveSchema>, @ActorCtx() a: Actor) { return this.courseAdmin.archive(a, id, b.reason); }
  @Roles('super_admin') @HttpCode(200) @Post('courses/:id/restore')
  restore(@Param('id') id: string, @ActorCtx() a: Actor) { return this.courseAdmin.restore(a, id); }
  @Roles('super_admin') @HttpCode(200) @Post('courses/:id/delete')
  deleteCourse(@Param('id') id: string, @ZBody(deleteCourseSchema) b: z.infer<typeof deleteCourseSchema>, @ActorCtx() a: Actor) { return this.courseAdmin.requestDeletion(a, id, b); }
  @Roles('super_admin') @HttpCode(200) @Post('courses/:id/cancel-deletion')
  cancelDeletion(@Param('id') id: string, @ActorCtx() a: Actor) { return this.courseAdmin.cancelDeletion(a, id); }

  /** Reviewers watch any video asset (e.g. a new video in a revision that is not live yet). Audited. */
  @Perm('courses.review') @HttpCode(200) @Post('videos/:assetId/playback')
  videoPlayback(@Param('assetId') assetId: string, @ActorCtx() a: Actor) { return this.svc.videoPlayback(a, assetId); }

  @Perm('courses.review') @HttpCode(200) @Post('courses/:id/approve')
  approve(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'approve', b.note); }
  @Perm('courses.review') @HttpCode(200) @Post('courses/:id/request-changes')
  changes(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'request-changes', b.note); }
  @Perm('courses.review') @HttpCode(200) @Post('courses/:id/reject')
  reject(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'reject', b.note); }
  @Perm('courses.review') @HttpCode(200) @Post('courses/:id/unpublish')
  unpublish(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.svc.decide(a, id, 'unpublish', b.note); }

  @Perm('users.view') @Get('users') users(@ZQuery(usersQuery) q: z.infer<typeof usersQuery>) { return this.svc.users(q); }
  @Perm('users.manage') @Patch('users/:id')
  async updateUser(@Param('id') id: string, @ZBody(userPatch) b: z.infer<typeof userPatch>, @ActorCtx() a: Actor) {
    // Kept for older clients: the same rules as Users & roles (step-up code, last super admin, audit).
    if (b.roles) await this.people.setAccess(a, id, { roles: b.roles, code: b.code, reason: b.reason });
    return b.status ? this.people.setStatus(a, id, b.status, b.reason) : this.people.detail(id);
  }

  @Perm('users.view') @Get('instructors') instructors(@ZQuery(instructorsQuery) q: z.infer<typeof instructorsQuery>) { return this.svc.instructors(q); }
  @Perm('instructors.review') @HttpCode(200) @Post('instructors/:id/approve')
  approveInstructor(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.people.decide(a, id, 'approved', b.note); }
  @Perm('instructors.review') @HttpCode(200) @Post('instructors/:id/reject')
  rejectInstructor(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.people.decide(a, id, 'rejected', b.note); }

  @Perm('content.manage') @Get('categories') categories() { return this.svc.categories(); }
  @Perm('content.manage') @Post('categories')
  createCategory(@ZBody(categorySchema) b: z.infer<typeof categorySchema>, @ActorCtx() a: Actor) { return this.svc.createCategory(a, b); }
  @Perm('content.manage') @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @ZBody(categorySchema.partial()) b: Partial<z.infer<typeof categorySchema>>, @ActorCtx() a: Actor) { return this.svc.updateCategory(a, id, b); }
  @Perm('content.manage') @Delete('categories/:id')
  deleteCategory(@Param('id') id: string, @ActorCtx() a: Actor) { return this.svc.deleteCategory(a, id); }

  // ---------- money ----------
  @Perm('finance.view') @Get('finance') finance_() { return this.finance.overview(); }
  @Perm('finance.view') @Get('finance/waiting-for-onboarding') waiting() { return this.finance.waitingForOnboarding(); }
  @Roles('super_admin') @HttpCode(200) @Post('finance/release-transfers') release(@ActorCtx() a: Actor) { return this.finance.releaseNow(a); }
  @Perm('finance.view') @Get('disputes') disputes() { return this.finance.disputes(); }
  @Perm('finance.view') @Get('refund-requests') refundRequests(@ZQuery(refundReqQuery) q: z.infer<typeof refundReqQuery>) { return this.finance.refundRequests(q.status); }
  @Perm('refunds.decide') @HttpCode(200) @Post('refund-requests/:id/approve')
  approveRefund(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.finance.decideRefundRequest(a, id, true, b.note); }
  @Perm('refunds.decide') @HttpCode(200) @Post('refund-requests/:id/retry-payment')
  retryRefund(@Param('id') id: string, @ActorCtx() a: Actor) { return this.finance.retryRefundPayment(a, id); }
  @Perm('finance.view') @Get('refund-policy') refundPolicyVersions() { return this.refundPolicy.versions(); }
  @Roles('super_admin') @Put('refund-policy')
  saveRefundPolicy(@ZBody(refundPolicySchema) b: z.infer<typeof refundPolicySchema>, @ActorCtx() a: Actor) { return this.refundPolicy.save(a, b); }
  @Perm('refunds.decide') @HttpCode(200) @Post('refund-requests/:id/decline')
  declineRefund(@Param('id') id: string, @ZBody(noteSchema) b: z.infer<typeof noteSchema>, @ActorCtx() a: Actor) { return this.finance.decideRefundRequest(a, id, false, b.note); }
  @Perm('finance.view') @Get('instructors/:id/terms') instructorTerms(@Param('id') id: string) { return this.finance.terms(id); }
  /** Super admin only (checked in the service): per-instructor rate and the "pay to DEL" agreement. Audited. */
  @Roles('super_admin') @Put('instructors/:id/terms')
  setTerms(@Param('id') id: string, @ZBody(termsSchema) b: z.infer<typeof termsSchema>, @ActorCtx() a: Actor) { return this.finance.setInstructorTerms(a, id, b); }

  @Get('settings') settings() { return this.svc.getSettings(); }
  @Roles('super_admin') @Put('settings')
  putSettings(@ZBody(settingsSchema) b: z.infer<typeof settingsSchema>, @ActorCtx() a: Actor) { return this.svc.putSettings(a, b); }

  @Perm('orders.view') @Get('orders') orders(@ZQuery(ordersQuery) q: z.infer<typeof ordersQuery>) { return this.svc.orders(q); }
  @Perm('orders.view') @Get('orders/:id') order(@Param('id') id: string) { return this.svc.order(id); }
  @Perm('refunds.decide') @HttpCode(200) @Post('orders/:id/refund')
  refund(@Param('id') id: string, @ZBody(refundSchema) b: z.infer<typeof refundSchema>, @ActorCtx() a: Actor) { return this.svc.refund(a, id, b); }

  @Perm('reviews.moderate') @Patch('reviews/:id')
  review(@Param('id') id: string, @ZBody(reviewPatch) b: z.infer<typeof reviewPatch>, @ActorCtx() a: Actor) { return this.svc.setReviewStatus(a, id, b.status); }

  // Super Admin › System health: database, queues, storage, email, things waiting (no secrets).
  @Roles('super_admin') @Get('system') systemHealth() { return this.system.health(); }

  @Perm('audit.view') @Get('audit') audit(@ZQuery(auditQuery) q: z.infer<typeof auditQuery>) { return this.svc.auditLog(q); }
}
