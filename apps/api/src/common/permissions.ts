import type { Role } from '../generated/prisma/enums';

/**
 * The four roles (owner, 2026-11-25; AGENTS.md rule 21):
 * - student: the default for every public sign-up, whatever the method;
 * - instructor: granted only by approving an application (or by a super admin), keeps student access;
 * - admin: operational staff with the explicit permissions below, granted by a super admin;
 * - super_admin: DEL itself, every permission, the only role that changes roles, money settings and security policy.
 */
export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  student: { label: 'Student', description: 'Browses, buys and takes courses. Every account has it.' },
  instructor: { label: 'Instructor', description: 'Builds and sells their own courses in the Instructor Studio.' },
  admin: { label: 'Admin', description: 'Helps run the marketplace with the permissions you choose.' },
  super_admin: { label: 'Super Admin', description: 'DevOps Easy Learning: everything, including roles, money and security.' },
};

/** Operational permissions a super admin can give an admin. Super admins always have every one of them. */
export const ADMIN_PERMISSIONS = {
  'users.view': 'See accounts, registrations and instructor applications',
  'users.manage': 'Suspend and reactivate student and instructor accounts',
  'instructors.review': 'Review instructor applications (approve, reject, ask for more information)',
  'courses.review': 'Review, approve and unpublish courses',
  'reviews.moderate': 'Hide or show learner reviews',
  'support.manage': 'Answer support requests',
  'enrollments.manage': 'Prepare manual enrollments (activating paid access needs a super admin)',
  'orders.view': 'See orders and receipts',
  'finance.view': 'See money reports, refunds and disputes',
  'refunds.decide': 'Approve or decline refund requests',
  'content.manage': 'Categories, help videos and video protection status',
  'promotions.view': 'See instructor sales and marketplace promotions',
  'audit.view': 'Read the audit log',
} as const;
export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;
export const ALL_ADMIN_PERMISSIONS = Object.keys(ADMIN_PERMISSIONS) as AdminPermission[];
/** Suggested starting set for a new admin (the super admin can change it). */
export const DEFAULT_ADMIN_PERMISSIONS: AdminPermission[] = ['users.view', 'instructors.review', 'courses.review', 'reviews.moderate', 'support.manage', 'enrollments.manage', 'orders.view', 'content.manage'];

/** Never grantable to an admin: these stay with super admins (listed so the UI can say so). */
export const SUPER_ADMIN_ONLY = [
  'Grant or remove the Admin and Super Admin roles',
  'Change commission percentages and instructor payment terms',
  'Change marketplace settings and security policy',
  'Run marketplace promotions and release payouts',
  'Overturn automatic refund declines',
  'Activate paid access from manual enrollments and verify external payments',
];

export const isPermission = (p: string): p is AdminPermission => p in ADMIN_PERMISSIONS;

export function can(user: { roles: Role[]; adminPermissions?: string[] } | undefined, perm: AdminPermission) {
  if (!user) return false;
  if (user.roles.includes('super_admin')) return true;
  return user.roles.includes('admin') && !!user.adminPermissions?.includes(perm);
}
