# Super Admin portal (owner 2026-11-26, prompts.md "Enhance Super Admin Capabilities")

Goal: the super admin runs the marketplace from the Super Admin Studio without touching the database. This page records
what existed before, what was added, how each part works and what is deferred. Rules: AGENTS.md 8, 19, 20, 21.
Code: `apps/api/src/admin/` (people, user-admin, course-admin, course-lifecycle, system), `src/common/permissions.ts`,
`role-config.service.ts`, `auth.guard.ts`; web `apps/web/src/app/admin/{roles,users,courses,system}`,
`components/admin/UserAccountTools.tsx`. Migration `20261127080000_admin_portal`. Tests: `src/admin/admin-portal.spec.ts`,
`src/common/guards.spec.ts`, `test/admin-portal.e2e-spec.ts`.

## 1. Audit of the portal before this work (gap list)

| Area | Before | Now |
| --- | --- | --- |
| Roles | 4 roles in code; admin permissions per admin; role assignment with step-up code, last super admin protected | **Added** Role management page: Super Admin locked system role; Admin permission ceiling + defaults; Student and Instructor capabilities, enforced by the API guard |
| Users | list, filters, detail + history, roles, suspend/reactivate, reset 2-step | **Added** edit name, change email (step-up, both addresses told), disable, suspension with an end date, password reset email, resend verification, single-use recovery link, temporary password with forced change, sign out everywhere, delete (soft, records kept), last sign-in, active sessions |
| Courses | list, review queue, approve/reject/request changes, unpublish | **Added** course page for any course: preview (watch every video), edit information, publish directly, feature, archive/restore, 30-day deletion, history; Archived courses section |
| Course deletion | instructors could delete only empty drafts | **Added** soft deletion (archive now, content removed after ≥ 30 days and after the last paid year ends), hourly purge |
| Audit | every privileged action logged; Audit log page | **Reused**; new actions listed in §5 |
| Instructors | applications (approve, reject, ask for info), commission terms | Reused (no gap found) |
| Enrollments | manual enrollments with filters | Reused |
| Subscriptions | none: the marketplace sells courses with 12-month access (rule 20) | Not applicable |
| Payments | orders, money, refunds, disputes, Payments & Stripe | Reused (refund policy settings are another fork's scope) |
| Reviews | moderation (hide/restore, super admin delete, reports) | Reused |
| Notifications | staff email switches in Settings | Reused; in-platform notifications deferred (§7) |
| Cover templates | Cover templates page (view; super admin create/edit) | Reused; templates are now also chosen per course from the course page |
| Platform settings | commission, staff emails, payments, sign-in methods | Reused (authentication/session settings: other fork) |
| Support | support requests, contact messages | Reused |
| System health | only `/api/health` (no admin page) | **Added** System health page: database, Redis, storage, email mode, each job queue (workers, waiting, failed), things needing attention |

## 2. Role management (`/admin/roles`, `GET/PUT /api/admin/people/roles`)

- **Super Admin** is a system role: shown greyed and locked, no settings, can't be removed from the last active holder.
- **Admin**: each admin still gets their own permissions (Users and roles). The role page sets the **ceiling**: a permission
  turned off is withheld from every admin at once (their grant is kept, so allowing it again restores it), and
  **defaults** for a new admin. The guard checks `canWithConfig` on every `@Perm` route; `/auth/me` returns only effective
  permissions so menus follow.
- **Instructor / Student capabilities** (`ROLE_CAPABILITIES`): reviews, refund requests, AI assistant, support requests,
  career paths; creating courses, submitting for review, sales, manual enrollment requests, replying to reviews. Each
  guards real routes with `@Cap(...)`; error `capability_disabled`. The basics are not configurable (sign in, account,
  watching owned courses, buying, editing own courses). Super admins are never limited.
- Saved in `platform_settings.role_permissions`; cached 10 s per process (cleared at once in the process that saved).
  Saving needs the authenticator code and is audited (`roles.permissions_changed` with before/after).

## 3. Users (`/admin/users` → an account)

| Action | Who | Notes |
| --- | --- | --- |
| Edit name | `users.manage` (super admin for admins) | audited `user.updated` |
| Change email | super admin + code | new address unverified, verification link sent there; old address gets `security-email-changed`; provider sign-in unaffected |
| Suspend (optional end date) / Disable / Reactivate | `users.manage`; super admin for admins | reason required; signs out everywhere; a dated suspension ends by itself at the next sign-in after it; last super admin can't be suspended/disabled |
| Send password reset email | `users.manage` | same 1-hour single-use link as "Forgot password"; max 3/hour |
| Resend verification email | `users.manage` | |
| Recovery link | super admin + code + how identity was confirmed | single use, 30 minutes, shown once in the dialog, earlier links stop working; nothing emailed |
| Temporary password | super admin + code + reason | shown once, never emailed or logged; all sessions end; `mustChangePassword`: the API refuses every route except `/auth/me`, `/auth/password`, `/auth/logout` (and csrf/security/policy) with `password_change_required`; the web sends them to `/change-password`; 2-step is still asked at sign-in |
| Sign out everywhere | `users.manage` | sessions and trusted devices end |
| Delete | super admin + code + email typed back + reason | `status=deleted`: name/email/password/2-step/sign-in methods removed, email becomes `deleted-<id>@deleted.invalid`; orders, refunds, enrolments, certificates, reviews and audit kept; refused for the last super admin and for instructors with published or in-review courses (archive them first); audit keeps a fingerprint of the old email, not the address |

Existing passwords are never visible to anyone. Deleted accounts are hidden from the default list (filter "Deleted").
Session-security features (inactivity timeout, single session, device list) belong to the auth/session work.

## 4. Courses (`/admin/courses`, `/admin/courses/<id>`, `/admin/courses/archived`)

- Any course, whoever teaches it; the **instructor always stays the owner** (`instructorId` never changes here).
- **Preview**: every lesson, videos playable (`POST /admin/videos/:assetId/playback`, audited).
- **Edit** (super admin): title, subtitle, description, objectives, requirements, category, level, language, price, cover
  template. Live at once (no review), cover regenerated, audited with before/after (`course.admin_edited`). Lessons and
  videos are still edited in the instructor studio (or by the super admin in "DEL Studio" for DEL's courses).
- **Publish now** (super admin, any non-archived course with ≥ 1 lesson, bypasses the queue), **Unpublish** (note),
  **Feature**: featured courses lead the "popular" order on the homepage and catalogue (`featuredAt`).
- **Archive** (reason): status → unpublished (draft stays draft), off the catalogue, removed from carts, open revisions
  closed, never deleted automatically. Enrolled learners **keep their access until it ends** (rule 20). Instructors can't
  resubmit an archived course (`course_archived`). **Restore** returns the previous status (in-review → draft).
- **Delete** (super admin + code + title typed back + reason): archives now, `deleteAfter = now + 30 days`. Shown in
  Archived courses › Deletion scheduled with request date, deletion date and days left; **Restore** or **Keep archived**
  until then. The hourly job (`course-purge` on the payments queue, `purgeDueCourses`) removes the content only when the
  date has passed **and no paid year of access is still running**; otherwise it waits (shown in System health). Access
  without an end date (free courses, grants) doesn't hold it back; the delete box says how many learners that affects.
- **Purge** removes videos (files, captions, encrypted segments), lesson files, package files, sections/lessons/quizzes and
  their progress, revisions, cart items and career-path steps. It keeps the course row (title for receipts and
  certificates), orders and order lines, refunds, enrolment rows, certificates, reviews and the audit log. A purged course
  can't be restored or edited.

## 5. Audit actions added

`roles.permissions_changed`, `user.updated` (name), `user.email_changed`, `user.disabled`, `user.suspended` (with `until`),
`user.reactivated` (also automatic when a dated suspension ends), `user.password_reset_sent`, `user.verification_sent`,
`user.recovery_link_created`, `user.temporary_password_set`, `user.sessions_revoked`, `user.deleted`,
`course.admin_edited`, `course.published_by_admin`, `course.featured`, `course.unfeatured`, `course.archived`,
`course.restored`, `course.deletion_requested`, `course.deletion_cancelled`, `course.purged`. Each records who, what,
when, IP and the reason.

## 6. System health (`/admin/system`, `GET /api/admin/system`, super admin)

Live: database round trip, Redis, file storage, email mode (console vs SES/SMTP), each queue's workers and
waiting/running/scheduled/failed jobs, plus failed videos, failed packaging, deletions waiting for access to end and failed
sign-ins in the last 24 hours. No secrets or connection strings are returned.

## 7. Deferred (not built here)

- In-platform notification centre (emails cover every event today).
- Editing lessons/videos of another instructor's course from the admin page (use the instructor studio; impersonation is a
  separate piece of work).
- Bulk actions on users and courses; CSV export of users.
- Moving a course to another instructor (ownership changes are deliberately not possible).
