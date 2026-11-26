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

## Refund management (owner 2026-11-26, prompts.md "Automated Refund Management")

### Audit before the work: what existed, what was missing
Existed (kept): merged playback ranges and unique seconds (`mergeRanges`), automatic decisions at request time,
`refund_requests` with the facts, human review of a decline, Super Admin exceptions, Admin › Refunds with facts, AI
summary and history, Stripe refunds with idempotency keys, access-year revocation, instructor clawback, emails.
Gaps found and built in this batch:
1. Rules were constants (`REFUND_WINDOW_DAYS`, `REFUND_MAX_WATCHED` in `money.ts`, copied into ~12 web texts) → a
   versioned policy edited by the Super Admin; constants removed; every page, email and receipt reads the policy.
2. No policy versions; purchases didn't record their rules → `refund_policies` + `orders.refundPolicyId`.
3. Free preview lessons counted toward consumption; lessons removed after purchase could raise a student's share →
   paid video only; total = max(today's paid video, `order_lines.paidVideoSecAtPurchase`).
4. Missing or inconsistent tracking could decline automatically → routed to a person ("investigation").
5. The decline didn't explain dates, period and the exact reasons (scenarios A–C) → `decisionMessage()`.
6. A refund was applied and reported as done right after the Stripe API call, even while Stripe still said `pending`,
   and a Stripe error lost the decision → payment state per request (`processing` / `succeeded` / `failed`), applied
   only on confirmation (`refund.updated`, `charge.refunded`), retry button, `refund-processing` / `refund-delayed` emails.
7. No in-platform notifications → `notifications` table and a bell in the header and studios.
8. The student couldn't see the refund position without asking → Student Studio › Learning progress (refund column)
   and the per-course report (`/student/progress/<slug>`), My courses line.
9. Study material downloads weren't recorded → `resource_downloads` (shown to the student and on refund requests;
   never part of the refund measure).
10. Admin dashboard lacked instructor, deadline, threshold, lessons completed, downloads, payment references, policy
    version, payment state and the owner's filters → added.
Not built (noted for the owner): "Switch to the student's dashboard" from a refund request waits for the support-session
feature (another batch); add the link there once `POST /admin/support-sessions` exists (no dead button now).

### Policy versions (`src/commerce/refund-policy.ts`, `refund-policy.service.ts`)
- Super Admin › Refunds › Policy settings: refund period (1–365 days), watch limit (0–100 %, one decimal), automatic
  refunds per student per year, and switches: check automatically / refund eligible at once / decline ineligible at
  once / allow exceptions; optional extra paragraph per notification. Saving needs an authenticator code, creates a new
  version (`version` n+1, `effectiveFrom` now), is audited (`refund.policy_changed` with before/after) and never edits
  an old version. Version 1 (migration) = 14 days, 25 %, automatic, 3 a year.
- Every paid order stores the version in force at payment (`orders.refundPolicyId`), its deadline
  (`refundEligibleUntil` = payment + period) and each line's paid video length. The instructor hold follows the same
  period (+2 days).
- Which rules apply to a purchase: its own version, **except** that a later version's more generous period or watch
  limit applies too (never a stricter one). How requests are handled (automatic or manual, messages, exceptions)
  follows today's switches.
- Public: `GET /refund-policy` feeds the policy page (with the version list), course page FAQ and buy box, checkout,
  /teach, purchase history; the receipt panel shows the purchase's own numbers and version; the receipt email
  includes them; refund emails carry the exact decision.

## Consumption (what "watched" means for refunds)
- The player sends `played: [[start, end], …]` with each progress save (continuous playback only; a seek starts a new
  range). The API merges ranges per lesson (`mergeRanges`, gaps under 1.5 s join, clamped to the lesson length) and
  stores `watchedRanges` + `watchedSec`. Replays never add; skipping ahead never counts; playback speed doesn't matter
  (ranges are positions in the video, not wall-clock time); "Mark as complete" alone doesn't count as watching.
  Progress is stored on the server, so every device adds to the same ranges.
- **Refund measure** (`refundConsumption`): unique seconds of **paid** (non-preview) video lessons ÷ the larger of the
  course's paid video now and at purchase (`paidVideoSecAtPurchase`), one decimal. Lessons added later lower the share;
  lessons removed later never raise it (their seconds leave both sides only if they were there at purchase time).
- The limit is inclusive: exactly the limit qualifies; 0.1 point above doesn't. The deadline is inclusive to the
  millisecond of `payment + period`.
- Tracking `missing` (a paid video lesson without a length, or no measurable paid video) or `inconsistent` (stored
  seconds that don't match the stored ranges or exceed the lesson) → the request waits for a person
  (`investigation = true`), never an automatic decline. An expired period is still decided automatically.
- Downloads, quizzes and lesson completion are recorded and shown, but don't change the refund measure (the published
  policy doesn't use them).
- Reviews ("watched N % of the course", docs/TRUST.md) use the whole course's video, previews included; the refund
  measure is paid video only. The two are labelled differently.
- Limit: a client can under-report playback (e.g. blocking requests). Encrypted segment fetches are not yet
  cross-checked.

## Refunds: how a request is decided (`evaluate()` in `refund-policy.ts`)
- Not applicable (no request recorded): already refunded, free course, not paid.
- Blocks: payment disputed, refund period ended, over the watch limit, certificate issued.
- Outcome: automatic checks off → a person; tracking unreliable → a person (investigation); blocks → declined at once
  if "decline at once" is on, else a person; eligible → refunded at once if "refund at once" is on and the student has
  automatic refunds left this year, else a person.
- Messages: scenario A (period expired: purchase date, deadline, period), B (consumption: share and limit), C (both,
  both reasons), D (eligible). Each ends with the policy link and how to contact support. Stored on the request
  (`message`), shown on the receipt, emailed, and shown to admins exactly as the student saw it.
- One open request per order (`409 request_pending`) while one waits for a person or a payment is processing.

## Refunds: payment (`RefundsService.refund` / `pay`)
- Stripe orders: `refunds.create` with an idempotency key per order + lines (retries add a suffix after a failure).
  `succeeded` → lines refunded now; `pending` → request `processing`, the lines are refunded when Stripe confirms
  (`refund.updated` / `charge.refund.updated` / `charge.refunded`, which also re-checks processing refunds);
  `failed`, `canceled` or an API error → request `failed` with a safe error text (no keys), nothing refunded, the
  student is told it's delayed, admins see it under *Failed refunds* / *Needs action* and can **Retry the payment**.
- Dev test payments and free orders: no provider, so confirmed at once.
- On confirmation: lines refunded, the access year revoked (an earlier year comes back for renewals), certificate
  removed, instructor share cancelled or clawed back (ledger), order status updated, student emailed
  (`refund-approved` = complete) and notified in the bell. Payment and audit history are kept.

## Admin › Refunds (`/admin/refunds`)
- **Requests**: filters All, Needs action, Pending, Needs investigation, Automatically rejected / approved, Manually
  approved / rejected, Refunded, Processing, Failed refunds (counts on each). Each request shows student, course,
  instructor, amount, purchase and request dates, days since purchase, deadline and period, paid video and unique
  seconds watched, consumption against the limit, lessons completed, downloads (and their history), tracking quality,
  eligibility and reasons, the automatic decision text, payment state, Stripe payment and refund references, policy
  version (and whether a more generous later version applied), AI summary, history.
- Decisions: requests waiting for a person — any admin with `refunds.decide` (a note is needed to reject). An automatic
  decline — only a Super Admin can override it, only while exceptions are allowed, always with a reason (duplicate
  payment, technical problem, missing content, wrong records, unauthorised payment, instructor issue, legal right);
  audited `refund.exception_approved`, `override = true`. A student's review request can also be closed by keeping
  the decline (with a note).
- **Policy settings**: the form and the version list (see above). Admins without Super Admin see it read-only.
- **AI** (`src/commerce/refund-ai.ts`): Claude (`REFUND_AI_MODEL`, default `claude-opus-5-5`) receives only the computed
  facts (no names, emails or free text) and writes a short explanation for the admin. It never decides or changes a
  number; failures and a missing key change nothing.

## Student Studio
- My courses: each bought course shows "Refund available until … (N days left) · X% of Y% watched", or why not.
- Learning progress: a Refund column and a per-course report (`/student/progress/<slug>`, API
  `GET /me/courses/:slug/report`): purchase and enrolment dates, completion (loop meter), lessons done/total, total
  video, unique time watched, the refund measure against the limit (bar with the limit marker), deadline and days
  left, policy version, last studied, study material download history.
- Receipt (`/student/purchases/<id>`): the purchase's numbers and version, days left, each course's position, the
  request button, decisions with the exact text and payment state, "ask a person to review".
- Notifications: the bell in the header and studios (submitted, approved and processing, complete, delayed, declined,
  review requested); `GET /me/notifications`, `POST /me/notifications/read`.

## Tests
- `src/commerce/refund-policy.spec.ts`: the decision engine (scenarios A–D, exact-limit and exact-deadline boundaries,
  unreliable tracking, the Super Admin switches, more generous later versions, days left, validation) and the paid
  video measure (previews out, purchase-time length, missing/inconsistent data).
- `src/commerce/refunds.service.spec.ts`: payment states (succeeded, pending then confirmed by webhook, provider error,
  failed refund event). `webhooks.spec.ts`: refund events routed to settlement.
- `test/refunds.e2e-spec.ts`: the 14 scenarios of the owner's brief (eligible, after deadline, over the limit, both,
  exactly the limit, exact expiry, policy change with step-up and audit, earlier purchases keep their version, two
  devices, rewatch and skip, incomplete tracking → investigation, Super Admin exception, provider failure and retry,
  duplicate request), plus the student report, notifications and admin dashboard fields.
- `apps/api/test/app.e2e-spec.ts` › "one-year access and the 25% refund rule": 12 months exactly, expiry enforced on the
server, progress kept, renewal and early renewal, refund of a renewal, unique-seconds tracking, refunds at 20 / 25 /
30 %, the 14-day window, review, Super Admin exception, reminders once each.
