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

// ---------- Role Management (owner 2026-11-26, Super Admin › Role management; docs/SUPER_ADMIN.md) ----------
/**
 * What the Student and Instructor roles may do beyond the basics. Each one guards real API routes (`@Cap`), so turning
 * one off takes effect on the next request. The basics are never configurable (signing in, account settings, watching
 * purchased courses, buying, building and editing one's own courses): switching those off would break the platform.
 * Super admins are never limited by these switches.
 */
export const ROLE_CAPABILITIES = {
  student: {
    'student.reviews.write': 'Write and edit reviews of courses they are enrolled in',
    'student.refunds.request': 'Request refunds (the refund rules still apply)',
    'student.ai.ask': 'Ask the AI course assistant',
    'student.support.create': 'Open support requests',
    'student.paths.follow': 'Follow career paths',
  },
  instructor: {
    'instructor.courses.create': 'Create new courses',
    'instructor.courses.submit': 'Submit courses and changes for review',
    'instructor.sales.manage': 'Run sales on their own courses',
    'instructor.enrollments.request': 'Ask DEL to enroll students manually',
    'instructor.reviews.respond': 'Reply to and report reviews of their courses',
  },
} as const;
export type Capability = keyof (typeof ROLE_CAPABILITIES)['student'] | keyof (typeof ROLE_CAPABILITIES)['instructor'];
export const ALL_CAPABILITIES = [...Object.keys(ROLE_CAPABILITIES.student), ...Object.keys(ROLE_CAPABILITIES.instructor)] as Capability[];
export const isCapability = (c: string): c is Capability => (ALL_CAPABILITIES as string[]).includes(c);

/**
 * Saved in platform_settings `role_permissions`. Missing keys mean "on" (the defaults), so a capability added in code
 * later is on until a super admin turns it off.
 * - adminAllowed: the permissions any admin may hold. One left out is withheld from every admin at once (their own
 *   grants are kept, so allowing it again restores them).
 * - adminDefaults: what a newly made admin starts with.
 * - disabled: capabilities turned off for their role.
 */
export interface RolePermissionConfig {
  adminAllowed: AdminPermission[];
  adminDefaults: AdminPermission[];
  disabled: Capability[];
}
export const DEFAULT_ROLE_CONFIG: RolePermissionConfig = { adminAllowed: ALL_ADMIN_PERMISSIONS, adminDefaults: DEFAULT_ADMIN_PERMISSIONS, disabled: [] };

/** Reads a saved config defensively (unknown keys dropped, defaults filled in). */
export function parseRoleConfig(v: unknown): RolePermissionConfig {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const arr = (x: unknown) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : null);
  const allowed = arr(o.adminAllowed);
  const defaults = arr(o.adminDefaults);
  const disabled = arr(o.disabled);
  const adminAllowed = allowed ? allowed.filter(isPermission) : DEFAULT_ROLE_CONFIG.adminAllowed;
  return {
    adminAllowed,
    adminDefaults: (defaults ? defaults.filter(isPermission) : DEFAULT_ROLE_CONFIG.adminDefaults).filter((p) => adminAllowed.includes(p)),
    disabled: disabled ? disabled.filter(isCapability) : [],
  };
}

/** `can` plus the role-wide ceiling: an admin needs the permission granted to them AND allowed for admins. */
export function canWithConfig(user: { roles: Role[]; adminPermissions?: string[] } | undefined, perm: AdminPermission, cfg: RolePermissionConfig) {
  if (!user) return false;
  if (user.roles.includes('super_admin')) return true;
  return can(user, perm) && cfg.adminAllowed.includes(perm);
}

/** A capability limits everyone except super admins. */
export function hasCapability(user: { roles: Role[] } | undefined, cap: Capability, cfg: RolePermissionConfig) {
  if (!user) return false;
  if (user.roles.includes('super_admin')) return true;
  return !cfg.disabled.includes(cap);
}
