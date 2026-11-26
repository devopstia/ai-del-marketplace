# Manual enrollment and invitations

Owner, 2026-11-25: serve students who can't complete the online checkout (especially in Africa, but worldwide)
while DevOps Easy Learning keeps control of payment verification, approval, commissions and access. No African
payment gateway is integrated; Stripe checkout is unchanged.

Code: `apps/api/src/enrollments/` (service, controller), web `components/enrollments/*`,
`app/studio/enrollments`, `app/admin/enrollments`, `app/(site)/invite/[token]`. Tables: `manual_enrollments`,
`manual_enrollment_items`, `external_payments`, `external_payment_allocations`, `invitations`
(migration `20261126050000_manual_enrollment`). Tests: `apps/api/test/app.e2e-spec.ts` › "manual enrollment".

## Two workflows, one system

- **Super admin (DEL)**: Super Admin Studio › People › Manual enrollments › *Enroll a student*. Any published
  courses from any instructors, a date per course, then either the **verified external payment** or
  **complimentary with a reason**. Activates immediately (no request to themselves). All or nothing: if anything
  fails, no half-made request remains.
- **Instructor**: Instructor Studio › Manual enrollments › *New enrollment request*. Only their own published
  courses (checked in the API, whatever the request says), up to 12 months, a note. Status: pending → approved /
  rejected / needs information (they answer and it returns to pending). They never activate access.
- **Finding a request** (both studios): status tabs, search (student, email or ME-number), and filters for course,
  created between two days and, for DEL, instructor. Filters are applied by the API and kept in the page URL.

## Rules (enforced in `ManualEnrollmentService`)

- One or many courses per request; each course has its own expiry (default 12 months, "same date for all").
- The student's email decides: an existing account gets the courses on approval (no new account, no password
  change, sign-in method untouched); a new address gets an invitation.
- No duplicates: refused if the student already has active access to a course, or an open request already
  contains it. An expired course can be granted again; progress is never deleted.
- Approval requires every course line to be covered by a **verified** payment, or `complimentary` + reason.
  A screenshot or the instructor's word is not verification: only a super admin records and verifies.
- Payment record: method, transaction reference (unique per method: the same money can't be recorded twice),
  currency and amount as received, the documented USD rate, actual fees in USD (zero allowed, never invented),
  and the super admin's **allocation per course** (must add up exactly). USD is the reporting currency; the
  original currency, amount and rate are kept.
- Commission per course line, like checkout: fee shared in proportion, net = gross − fee, instructor 80% of the
  net (or their agreed rate; DEL's own courses 100% to DEL), platform the rest.
- Financial statuses: payment pending → payment verified → earnings recorded → payout pending → payout
  completed (reference required). **Manual enrollments never charge or pay out through Stripe**, and nothing
  says an instructor was paid until a super admin records the payout.
- Expiry changes and revocations: super admin only, with a reason, audited, emailed when extended; revoking keeps
  any other access period (a purchase) and the progress.
- Every step is in the audit log (`targetType: manual_enrollment`) and shown as the request history.

## Invitations

- Token: 32 random bytes, only its SHA-256 stored, valid 7 days, single use, bound to the invited email.
- *Copy invitation link* (for WhatsApp/SMS) and *Resend invitation* both create a **new** link; earlier links stop
  working. Status: pending, accepted, expired, revoked (super admin can revoke).
- Instructors can copy/resend only for their own **approved** requests; before approval there is no link.
- Opening the link changes nothing. The student asks for a six-digit code sent to the invited address (15 min,
  5 tries, 3 per hour) — the ownership check — then sets their own password (the normal password rules) and is
  sent to the same Google Authenticator setup as every sign-up. Nobody else ever knows the password.
- If the address already has an account, the page asks them to sign in with their usual method and *Add to my
  account* (only the account with the invited email can).
- Manual enrollment never grants Instructor or Admin roles.

## Emails

`manual-enrollment-request-received`, `manual-enrollment-submitted` (super admins), `-approved`, `-rejected`,
`-needs-info`, `student-invitation`, `invitation-code`, `course-access-activated` / `courses-assigned`,
`course-access-extended`, and the normal expiry reminders. See docs/EMAIL.md.
