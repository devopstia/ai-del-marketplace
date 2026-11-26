# One-year access, renewal and refunds (owner 2026-11-25)

Owner: "I do not want our platform to offer lifetime access." Decisions: existing enrolments got 12 months from
2026-11-25; renewal = buying again at the current price (sales apply, never automatic); eligible refunds are automatic
(3 per student per 12 months, then a Super Admin); AI summaries with Claude, hidden until `ANTHROPIC_API_KEY` is set.
Student-facing wording: `/policies/access-and-refunds`.

## Access
- A paid order line grants **12 calendar months** from payment (`access_periods` row; `enrollments.accessExpiresAt` =
  latest end in force). Free courses, admin grants and the instructor's own course: no end date (`accessExpiresAt` null).
- **Enforced on the server** in `LearningService.access()` (`hasAccess`): lectures, playback (incl. encrypted HLS
  sessions), resources, quizzes, progress, the learner course view. Expired → 403; the web shows "renew".
- **Renewal**: the cart accepts a course again in its **last 30 days** or after expiry (`blockingEnrollmentWhere`).
  In the last 30 days the new year starts at the current end; after expiry, at payment. Progress, notes, reviews and
  certificates are kept. A refunded renewal removes only its year (`revokeYear`); the earlier end comes back.
- **Shown**: My learning (bought, access until, live days-left countdown, Renew in the last 30 days, Expired courses
  section), the player (banner in the last 30 days; renew screen when expired), the course page (access until /
  expired + Renew), cart, checkout (`access-terms`, before paying), purchase confirmation, receipt, footer, policy page.
- **Reminders** (`src/access/reminders.ts`, hourly job `access-reminders`): 30, 7 and 1 days before, and on expiry;
  each once per year of access (`remindersSent`, reset on renewal). Templates `access-expiring`, `access-expired`.

## Terms acceptance at purchase (owner 2026-11-26)
- Checkout shows one box: "I accept the Terms of use and the Access and refunds policy" (paid carts add the
  immediate-access consent for the 14-day withdrawal right). The button stays disabled until it is ticked, free
  enrolments included.
- **Enforced in the API** (`CommerceService.checkout`): `POST /checkout` needs `acceptTerms: true` and
  `termsVersion` equal to `TERMS_VERSION` (`src/commerce/terms.ts`, today `2026-11-25` = the "Last updated" date of
  /policies/terms and /policies/privacy). Missing or false → 400 `terms_required`; an older version → 400
  `terms_outdated` (both with `details.currentVersion`). No order is created in either case.
- **Recorded on the order**: `orders.termsVersion`, `termsAcceptedAt`, `termsAcceptedIp` (migration
  `20261127020000_terms_acceptance`; null for older orders). The learner's receipt (`GET /orders/:id` › `terms:
  { version, acceptedAt }`, Student Studio › Purchase history › receipt) shows version and time; the admin order
  detail (`GET /admin/orders/:id` › `terms: { version, acceptedAt, ip }`) also shows the IP.
- **Changing the policies**: update the pages, then bump `TERMS_VERSION` in `apps/api/src/commerce/terms.ts` **and**
  `TERMS_VERSION` / `TERMS_UPDATED` in `apps/web/src/lib/terms.ts` together (the policy pages read the date from there).
- Tests: `checkout.spec.ts` (unit), e2e "terms acceptance at purchase", Playwright "checkout needs the terms box".

## Consumption (what "25% watched" means)
- The player sends `played: [[start, end], …]` with each progress save (continuous playback only; a seek starts a new
  range). The API merges ranges per lesson (`mergeRanges`, gaps under 1.5 s join, clamped to the lesson length) and
  stores `watchedRanges` + `watchedSec`. Replays never add; skipping ahead never counts; "Mark as complete" alone
  doesn't count as watching.
- Course consumption = unique watched seconds / total length of the course's **current** video lessons
  (`courseConsumption`), one decimal. Exactly 25.0 % qualifies; 25.1 % doesn't. Courses with no video measure 0 %.
- Migration 2026-11-25: existing progress counted as watched up to the saved position (completed = whole lesson).
- Limit: a client can under-report playback (e.g. blocking requests). The decision is still recorded, and admins see
  lessons started; encrypted segment fetches are not yet cross-checked.

## Refunds
- **Rule** (`RefundsService.lineFacts`): within 14 days of the payment (`orders.refundEligibleUntil`) **and** watched
  ≤ 25 %; not for free courses, disputed payments or an issued certificate.
- **Every request is recorded** (`refund_requests` with `analysis` = the facts at request time) and decided at once:
  eligible → refunded through Stripe now (`auto_approved`, instructor share cancelled or clawed back via Stripe Connect,
  access year revoked), or `pending` for a Super Admin when over 3 a year; not eligible → `auto_declined` with the
  email `refund-declined` (watched %, threshold, window). Legal rights, billing errors and exceptions are never
  final: the student can **ask for a review** (`POST /refund-requests/:id/review`), which puts it in *Needs action*.
- **Admin › Refunds** (`/admin/refunds`): every request with student, course, purchase date and amount, request date,
  course length, unique minutes watched, %, eligibility, AI summary, decision, processing (refunded, instructor share
  status) and history (audit log). Pending: any admin decides. Overturning an automatic decline: **Super Admin only,
  with a note**; audited `refund.exception_approved`; the student is emailed.
- **AI** (`src/commerce/refund-ai.ts`): Claude (`REFUND_AI_MODEL`, default `claude-opus-5-5`, low effort, server-side
  fallback) receives only the computed facts (no names, emails or free text) and writes a short explanation for the
  admin. It never decides or changes a number; failures and a missing key change nothing.
- Emails queued: `refund-approved`, `refund-declined`, `refund-received`, `refund-review-received`,
  `refund-declined-after-review` (templates arrive with the email work, prompts.md task 5).

## Tests
`apps/api/test/app.e2e-spec.ts` › "one-year access and the 25% refund rule": 12 months exactly, expiry enforced on the
server, progress kept, renewal and early renewal, refund of a renewal, unique-seconds tracking, refunds at 20 / 25 /
30 %, the 14-day window, review, Super Admin exception, reminders once each.
