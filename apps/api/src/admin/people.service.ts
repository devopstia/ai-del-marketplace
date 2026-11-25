import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { InstructorStatus, Role, UserStatus } from '../generated/prisma/enums';
import { AuditService } from '../common/audit.service';
import type { Actor } from '../common/auth-context';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { JobsService } from '../common/jobs';
import { ADMIN_PERMISSIONS, ALL_ADMIN_PERMISSIONS, can, DEFAULT_ADMIN_PERMISSIONS, isPermission, ROLE_INFO, SUPER_ADMIN_ONLY } from '../common/permissions';
import { PrismaService } from '../common/prisma.service';
import { page, paged } from '../common/util';
import { env, isProd } from '../config/env';
import { SignInService } from '../auth/signin.service';

const PRIVILEGED: Role[] = ['admin', 'super_admin'];
const OPEN_APPLICATION: InstructorStatus[] = ['pending', 'under_review', 'needs_info'];

/**
 * Users & roles (owner 2026-11-25, AGENTS.md rule 21). Roles are read from the database on every request (AuthGuard),
 * so a change applies to signed-in people at once; nothing here trusts what the browser says about roles.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: JobsService,
    private readonly signIn: SignInService,
  ) {}

  catalogue() {
    return {
      roles: (Object.keys(ROLE_INFO) as Role[]).map((r) => ({ key: r, ...ROLE_INFO[r] })),
      permissions: ALL_ADMIN_PERMISSIONS.map((k) => ({ key: k, description: ADMIN_PERMISSIONS[k] })),
      defaultAdminPermissions: DEFAULT_ADMIN_PERMISSIONS,
      superAdminOnly: SUPER_ADMIN_ONLY,
    };
  }

  async summary() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const [total, students, instructors, admins, superAdmins, suspended, newWeek, applications] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { NOT: { roles: { hasSome: ['instructor', 'admin', 'super_admin'] } } } }),
      this.prisma.user.count({ where: { roles: { has: 'instructor' } } }),
      this.prisma.user.count({ where: { roles: { has: 'admin' }, NOT: { roles: { has: 'super_admin' } } } }),
      this.prisma.user.count({ where: { roles: { has: 'super_admin' } } }),
      this.prisma.user.count({ where: { status: 'suspended' } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.instructorProfile.count({ where: { status: { in: OPEN_APPLICATION } } }),
    ]);
    return { total, students, instructors, admins, superAdmins, suspended, newThisWeek: newWeek, pendingApplications: applications };
  }

  async list(q: { q?: string; role?: Role | 'student_only'; status?: UserStatus; method?: string; since?: Date; page: number; pageSize: number }) {
    const role: Prisma.UserWhereInput =
      q.role === 'student_only' ? { NOT: { roles: { hasSome: ['instructor', 'admin', 'super_admin'] } } }
      : q.role === 'admin' ? { roles: { has: 'admin' }, NOT: { roles: { has: 'super_admin' } } }
      : q.role ? { roles: { has: q.role } } : {};
    const where: Prisma.UserWhereInput = {
      ...role,
      status: q.status,
      ...(q.method ? { signupMethod: q.method } : {}),
      ...(q.since ? { createdAt: { gte: q.since } } : {}),
      ...(q.q ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...page(q.page, q.pageSize),
        select: {
          id: true, email: true, name: true, roles: true, status: true, createdAt: true, signupMethod: true, emailVerifiedAt: true, mfaEnabledAt: true, adminPermissions: true,
          instructorProfile: { select: { status: true } }, _count: { select: { enrollments: true, orders: true } },
        },
      }),
    ]);
    return paged(rows.map(({ mfaEnabledAt, ...u }) => ({ ...u, mfaEnabled: !!mfaEnabledAt, emailVerified: !!u.emailVerifiedAt })), total, q);
  }

  async detail(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, roles: true, status: true, createdAt: true, signupMethod: true, emailVerifiedAt: true, mfaEnabledAt: true, adminPermissions: true,
        identities: { select: { provider: true, createdAt: true } },
        instructorProfile: { select: { status: true, headline: true, submittedAt: true, reviewNote: true } },
        _count: { select: { enrollments: true, orders: true, courses: true } },
      },
    });
    if (!u) throw notFound('User');
    const history = await this.prisma.auditLog.findMany({
      where: { targetId: userId, action: { in: ['user.updated', 'user.access_changed', 'user.suspended', 'user.reactivated', 'instructor.approved', 'instructor.rejected', 'instructor.applied', 'instructor.needs_info', 'instructor.under_review', 'instructor.revoked', 'auth.register', 'auth.mfa_reset'] } },
      orderBy: { at: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, name: true } } },
    });
    const { mfaEnabledAt, ...rest } = u;
    return {
      ...rest,
      mfaEnabled: !!mfaEnabledAt,
      history: history.map((h) => ({ id: h.id, action: h.action, at: h.at, actor: h.actor, meta: h.meta })),
    };
  }

  /**
   * Super admin only. Granting or removing Admin / Super Admin needs a fresh Google Authenticator code from the super
   * admin (step-up), nobody changes their own roles, and the last active super admin can't be removed or suspended.
   */
  async setAccess(a: Actor, userId: string, input: { roles: Role[]; adminPermissions?: string[]; code?: string; reason?: string }) {
    if (!a.user.roles.includes('super_admin')) throw forbidden('Only a super admin can change roles', 'super_admin_required');
    if (userId === a.user.id) throw forbidden('You cannot change your own roles. Ask another super admin.', 'self_change');
    const target = await this.prisma.user.findUnique({ where: { id: userId }, include: { instructorProfile: true } });
    if (!target) throw notFound('User');
    const roles = Array.from(new Set<Role>(['student', ...input.roles]));
    const perms = roles.includes('admin') && !roles.includes('super_admin')
      ? Array.from(new Set((input.adminPermissions ?? target.adminPermissions).filter(isPermission)))
      : [];
    const added = roles.filter((r) => !target.roles.includes(r));
    const removed = target.roles.filter((r) => !roles.includes(r));
    const permsChanged = perms.join(',') !== [...target.adminPermissions].filter(isPermission).join(',') && roles.includes('admin');
    if (!added.length && !removed.length && !permsChanged) return this.detail(userId);

    const privileged = [...added, ...removed].some((r) => PRIVILEGED.includes(r)) || permsChanged;
    if (privileged) await this.stepUp(a, input.code);
    if (removed.includes('super_admin')) await this.assertNotLastSuperAdmin(userId);
    if (added.includes('instructor') && !removed.length && !target.instructorProfile && !input.reason?.trim()) {
      throw badRequest('Add a short reason when making someone an instructor without an application (for example how DEL verified them).', 'reason_required');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { roles, adminPermissions: perms } });
      if (added.includes('instructor')) {
        await tx.instructorProfile.upsert({
          where: { userId },
          create: { userId, status: 'approved', reviewedById: a.user.id, reviewedAt: new Date(), reviewNote: input.reason?.trim() || null, submittedAt: new Date() },
          update: { status: 'approved', reviewedById: a.user.id, reviewedAt: new Date() },
        });
      }
      if (removed.includes('instructor') && target.instructorProfile) {
        await tx.instructorProfile.update({ where: { userId }, data: { status: 'rejected', reviewNote: input.reason?.trim() || 'Instructor access removed by DEL', reviewedById: a.user.id, reviewedAt: new Date() } });
      }
      // Losing a privileged role ends that person's sessions, so nothing cached in an open tab outlives it.
      if (removed.some((r) => PRIVILEGED.includes(r))) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    await this.audit.log({
      actorId: a.user.id, action: 'user.access_changed', targetType: 'user', targetId: userId, ip: a.ip,
      meta: { before: { roles: target.roles, adminPermissions: target.adminPermissions }, after: { roles, adminPermissions: perms }, added, removed, reason: input.reason?.trim() || null, stepUp: privileged },
    });
    const web = env().WEB_URL;
    if (added.includes('instructor')) await this.jobs.sendEmail({ to: target.email, template: 'instructor-approved', data: { name: target.name, link: `${web}/studio` } });
    if (added.some((r) => PRIVILEGED.includes(r)) || removed.some((r) => PRIVILEGED.includes(r))) {
      await this.jobs.sendEmail({ to: target.email, template: 'security-role-changed', data: { name: target.name, added, removed, link: `${web}/student/account` } });
    }
    return this.detail(userId);
  }

  async setStatus(a: Actor, userId: string, status: UserStatus, reason?: string) {
    if (userId === a.user.id) throw forbidden('You cannot suspend your own account', 'self_change');
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw notFound('User');
    const isSuper = a.user.roles.includes('super_admin');
    if (!isSuper && target.roles.some((r) => PRIVILEGED.includes(r))) throw forbidden('Only a super admin can suspend another admin', 'super_admin_required');
    if (status === 'suspended' && target.roles.includes('super_admin')) await this.assertNotLastSuperAdmin(userId);
    if (target.status === status) return this.detail(userId);
    if (status === 'suspended' && !reason?.trim()) throw badRequest('Add a reason for the suspension (it is kept in the account history).', 'reason_required');
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
    if (status === 'suspended') await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorId: a.user.id, action: status === 'suspended' ? 'user.suspended' : 'user.reactivated', targetType: 'user', targetId: userId, ip: a.ip, meta: { reason: reason?.trim() || null } });
    return this.detail(userId);
  }

  private async stepUp(a: Actor, code?: string) {
    const me = await this.prisma.user.findUnique({ where: { id: a.user.id }, select: { mfaEnabledAt: true } });
    // Local development with MFA_REQUIRED=false and no authenticator set up: nothing to ask (never in production).
    if (!me?.mfaEnabledAt && !env().MFA_REQUIRED && !isProd()) return;
    if (!code) throw badRequest('Enter the six-digit code from your Google Authenticator app to confirm this change.', 'step_up_required');
    await this.signIn.checkCode(a.user.id, code, a.ip);
  }

  private async assertNotLastSuperAdmin(userId: string) {
    const others = await this.prisma.user.count({ where: { id: { not: userId }, roles: { has: 'super_admin' }, status: 'active' } });
    if (!others) throw conflict('This is the last active super admin. Make someone else a super admin first.', 'last_super_admin');
  }

  // ---------- instructor applications ----------
  async applications(q: { status?: InstructorStatus | 'open'; q?: string; page: number; pageSize: number }) {
    const where: Prisma.InstructorProfileWhereInput = {
      isPlatform: false,
      ...(q.status === 'open' ? { status: { in: OPEN_APPLICATION } } : q.status ? { status: q.status } : {}),
      ...(q.q ? { OR: [{ user: { name: { contains: q.q, mode: 'insensitive' } } }, { user: { email: { contains: q.q, mode: 'insensitive' } } }, { headline: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows, counts] = await Promise.all([
      this.prisma.instructorProfile.count({ where }),
      this.prisma.instructorProfile.findMany({
        where, orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], ...page(q.page, q.pageSize),
        include: { user: { select: { id: true, name: true, email: true, createdAt: true, _count: { select: { courses: true } } } } },
      }),
      this.prisma.instructorProfile.groupBy({ by: ['status'], where: { isPlatform: false }, _count: true }),
    ]);
    const reviewers = await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.reviewedById).filter((x): x is string => !!x) } }, select: { id: true, name: true } });
    const out = paged(
      rows.map((p) => ({
        userId: p.userId, name: p.user.name, email: p.user.email, memberSince: p.user.createdAt, headline: p.headline, bio: p.bio, website: p.website,
        expertise: p.expertise, experience: p.experience, plannedCourses: p.plannedCourses, extraInfo: p.extraInfo,
        status: p.status, reviewNote: p.reviewNote, appliedAt: p.submittedAt ?? p.createdAt, reviewedAt: p.reviewedAt,
        reviewedBy: reviewers.find((r) => r.id === p.reviewedById) ?? null, courses: p.user._count.courses,
        commissionBps: p.commissionBps, payToPlatform: p.payToPlatform, stripeConnected: !!p.stripeAccountId, payoutsEnabled: p.payoutsEnabled,
      })),
      total, q,
    );
    return { ...out, counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) };
  }

  /** under_review: claim it · needs_info: ask the applicant (note required) · approved · rejected (note required). */
  async decide(a: Actor, userId: string, decision: 'under_review' | 'needs_info' | 'approved' | 'rejected', note?: string) {
    if (!can(a.user, 'instructors.review')) throw forbidden();
    const p = await this.prisma.instructorProfile.findUnique({ where: { userId }, include: { user: true } });
    if (!p || p.isPlatform) throw notFound('Instructor application');
    if ((decision === 'needs_info' || decision === 'rejected') && !note?.trim()) throw badRequest('Add a note for the applicant', 'note_required');
    if (decision === 'approved' && p.status === 'approved') throw conflict('Already approved', 'already_approved');
    await this.prisma.$transaction(async (tx) => {
      await tx.instructorProfile.update({ where: { userId }, data: { status: decision, reviewNote: note?.trim() || (decision === 'under_review' ? p.reviewNote : null), reviewedById: a.user.id, reviewedAt: new Date() } });
      if (decision === 'approved' && !p.user.roles.includes('instructor')) await tx.user.update({ where: { id: userId }, data: { roles: Array.from(new Set<Role>([...p.user.roles, 'student', 'instructor'])) } });
      // A rejected applicant stays a student (and a former instructor loses only the instructor role).
      if (decision === 'rejected' && p.user.roles.includes('instructor')) await tx.user.update({ where: { id: userId }, data: { roles: p.user.roles.filter((r) => r !== 'instructor') } });
    });
    await this.audit.log({ actorId: a.user.id, action: `instructor.${decision}`, targetType: 'instructor', targetId: userId, ip: a.ip, meta: { note: note?.trim() || null, before: p.status } });
    const web = env().WEB_URL;
    const tpl = { approved: 'instructor-approved', rejected: 'instructor-rejected', needs_info: 'instructor-needs-info', under_review: null }[decision];
    if (tpl) await this.jobs.sendEmail({ to: p.user.email, template: tpl, data: { name: p.user.name, note: note?.trim() || null, link: decision === 'approved' ? `${web}/studio` : `${web}/student/teach` } });
    return { userId, status: decision };
  }
}
