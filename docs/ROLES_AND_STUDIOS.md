# Roles, permissions and studios

Owner, 2026-11-25. Code: `apps/api/src/common/permissions.ts` (the definitions), `common/auth.guard.ts`
(enforcement on every request), `admin/people.service.ts` (users, roles, applications), web `lib/studios.ts`,
`components/shell/AppShell.tsx`.

## The four roles

| Role | Who | Can |
| --- | --- | --- |
| Student | every account (default for every public sign-up, any method) | buy and take courses, reviews, progress, purchases, account, apply to teach |
| Instructor | approved applicants (or a super admin grant with a reason) | Instructor Studio: own courses, students, earnings, promotions, manual enrollment requests for own courses |
| Admin | staff chosen by a super admin | only the **permissions** a super admin ticks (below) |
| Super Admin | DevOps Easy Learning | everything, including roles, money settings, security policy, payment verification |

Roles add up on one account (owner = Super Admin + Student, optionally Instructor). Becoming an instructor never
removes student access.

### Admin permissions (`ADMIN_PERMISSIONS`)
`users.view`, `users.manage`, `instructors.review`, `courses.review`, `reviews.moderate`, `support.manage`,
`enrollments.manage`, `orders.view`, `finance.view`, `refunds.decide`, `content.manage`, `promotions.view`,
`audit.view`. Routes declare them with `@Perm('…')`; super admins pass every check. Never grantable to an admin:
role changes, commission and payment terms, marketplace settings, promotions and payouts, overturning automatic
refund declines, activating manual enrollments and verifying external payments.

## Security rules

- Public registration schemas are `.strict()`: a request that sends roles or anything extra is refused (400).
- Roles and permissions are read from the database on **every** request: a grant or a revocation applies to open
  sessions at once; losing Admin/Super Admin also ends that person's sessions.
- Only super admins change roles; nobody changes their own; granting or removing Admin/Super Admin or changing
  admin permissions needs a **fresh Google Authenticator code** (step-up); the last active super admin can't be
  removed or suspended; suspensions need a reason.
- Every change is audited with before/after and shown in the user's history (Users and roles › Manage).

## Instructor applications

Student Studio › Become an instructor (or `/teach`): headline, expertise, background, teaching experience,
planned courses, portfolio, extra information. Statuses: pending → under review → needs information (applicant
updates and resubmits) → approved / rejected. One open application at a time. Approval adds the Instructor role
and emails the applicant; rejection keeps them a student. Option B (they contact DEL): a super admin opens the
account in Users and roles and ticks Instructor with a reason.

## Registration monitoring

Users and roles shows every account with registration date, method (email, Google, GitHub, Facebook, LinkedIn,
invitation, created by DEL), roles, status, email verification and two-step status; filters and "new this week".
Optional emails to super admins (Settings): new registrations (off), instructor applications (on).

## Studios and navigation

One layout for all studios (`AppShell`): collapsible sidebar (remembered per device; icons only when collapsed),
grouped menu, **studio switcher** listing only the studios the account may open (Student Studio, Instructor
Studio, DEL Studio for super admins, Admin/Super Admin Studio), an always-visible **Back to marketplace** (sidebar
and top bar, also on phones), a **back button** to the parent page, and **breadcrumbs** (pages can name the last
step with `useCrumb`, e.g. the course title). Switching studios never changes permissions.

Student Studio (`/student`): Dashboard (real counts, continue learning, needs-attention list), My courses,
Learning progress, Course reviews, Purchase history, Account settings, Become an instructor, Platform videos,
Help and support, Contact. Old links `/my-learning`, `/orders`, `/account` redirect there.
