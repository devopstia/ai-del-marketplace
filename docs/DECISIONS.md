# Decisions

| Date | Decision | Source |
|---|---|---|
| 2026-11-24 | Build a lean new codebase in this repo; reuse designs/patterns from DEL and IKH, not their code wholesale ("only use what is needed") | Owner approved the recommendations in ASSESSMENT.md |
| 2026-11-24 | TypeScript end to end: Next.js (web) + NestJS (API, modular monolith) + BullMQ worker; PostgreSQL via Prisma with migrations; Redis | Owner approval |
| 2026-11-24 | Payments: Stripe Checkout, one session per cart, then one transfer per instructor ("separate charges and transfers"); platform is merchant of record; DEL's courses need no transfer | Owner approval |
| 2026-11-24 | Commission: configurable platform fee, default 0% | Owner approval |
| 2026-11-24 | Video: Mux behind a provider interface; a local provider (private MinIO + short-lived signed URLs) for local development until Mux keys exist | Owner approval |
| 2026-11-24 | Local deployment with Docker Compose. Until Stripe test keys exist, a development-only "test payment" mode runs the same fulfilment code (refused when NODE_ENV=production) | Main session (no keys yet) |
| 2026-11-24 | No push, merge or non-local deployment without the owner's approval; work on feature branches | Owner |
| 2026-11-24 | Phase 1 of docs/ROADMAP.md approved (fixes, real DEL catalogue import, design elevation) | Owner: "good to go" |
| 2026-11-24 | Pricing: **single course purchases only** (like Udemy): no subscription, no bundles for now | Owner |
| 2026-11-24 | **Revenue share 80/20**: independent instructors keep 80%, the platform keeps 20% (commission_bps = 2000), published openly on /teach. DEL's own courses: no transfer | Owner |
| 2026-11-24 | **Labs**: students run labs on their own computer or a cheap cloud VM using our lab ZIPs; no hosted sandboxes for now | Owner |
| 2026-11-24 | AI provider/budget (Phase 3): skipped for now | Owner |
| 2026-11-24 | **Captions available but OFF by default**; the student can turn them on | Owner: "Turn off the transcript by default. a student can add it if they want" (refines "no transcript on the video") |
| 2026-11-24 | Phase 1 front-end redesign **rejected and reverted**; front-end changes from now on one small step at a time, each reviewed by the owner. Back-end Phase 1 kept | Owner |
| 2026-11-24 | **One course: "AI for DevOps"** with all DEL videos as a structured learning path (14 sections); the 8 per-folder courses removed; default price $89.99 (changeable); Nadia's demo courses unpublished so only this course is listed | Owner: "just one well structure course… AI for DevOps" |
| 2026-11-24 | Approved design preserved: tag `design-approved-2026-11-24` (commit `9b0170e`) + branch `backup/design-approved-2026-11-24`; landing-page redesign on `feat/landing-redesign`, not merged without approval. Course listing + detail pages preserved | Owner (mandatory rollback rule) |

## Open (need the owner)
- AI provider and monthly cap for Phase 3 (owner: skip for now).
- Stripe test keys (and later the live platform account) → `.env`.
- Mux account (token id/secret, signing key) → `.env`.
- Tax/accounting advice before taking live payments (merchant of record).

## 2026-11-24: landing redesign not adopted
- Owner: "please keep the original design and move on with the video generation".
- The approved design (tag `design-approved-2026-11-24`, branch `feat/phase1`) stays as is.
- The proposed redesign is archived on branch `feat/landing-redesign` (screenshots and notes in `docs/design/landing-redesign-2026-11/` on that branch). It is not merged and not deployed.
- Marketplace front-end work is paused; video generation has priority.

## 2026-11-24: checkpoint before discovery and redesign plan (owner master brief)
- Rollback point: tag `checkpoint-2026-11-24-discovery` = commit `be6818c` (branch `feat/phase1`), backup branch
  `backup/phase1-2026-11-24`. Work continues on `feat/redesign-plan`. Restore any path with
  `git checkout checkpoint-2026-11-24-discovery -- <path>`.
- Approved design still `design-approved-2026-11-24` (`9b0170e`). No code changes until the owner approves `docs/ROADMAP.md` v2.

## 2026-11-24: owner approval of roadmap v2 and payment/AI decisions
- Roadmap v2 order approved; Step 0 (truthfulness fixes) starts now; one phase at a time, screenshots at 390/1440/1920, owner OK before the next.
- **DEL owns and operates the marketplace**, has its own Stripe (platform) account and is the super admin organisation. The owner must be able to switch between the super admin dashboard (whole marketplace) and the DEL instructor dashboard (DEL's own courses).
- Independent instructors connect their own Stripe accounts (Connect). Super admin may configure an authorised arrangement so an instructor's revenue is paid to DEL instead (instructor's agreement required, within Stripe's supported models).
- **Commission: 80% instructor / 20% platform, calculated on the amount after Stripe processing fees** (e.g. $100, $3 fee → $97 → $77.60 / $19.40), with taxes, refunds and adjustments accounted for; documented formula. DEL courses: revenue attributed to DEL, no self-transfer.
- **Per-instructor commission overrides**: super admin only, audited; instructors see their rate and how earnings are calculated.
- **Refunds**: start from a 14-day policy for eligible purchases; research and recommend; define eligibility, instructor responsibilities, commission reversals, disputes; do not assume refunds only before payouts.
- **No AI integration at this stage** (Phase 7 deferred).
- The Stripe Connect flow, commission calculation and refund handling must be presented for approval **before** any payment code changes.

## 2026-11-24: Step 0 (make it true) implemented, awaiting the owner's review
- Branch `feat/step0-truth` (rollback tag `checkpoint-2026-11-24-step0`). No visual redesign; fixes only.
- Removed invented quotes (/teach "Nadia", /login "Priya"); home instructor stats from `/instructors/featured`; bios no longer shown
  as quotations; "Downloadable lab files" only when the course has files; readable "Preview this course" label.
- Studio: changes to a live course can be reviewed, submitted or discarded (the API already kept them as a draft revision);
  "Save and continue" stays on the step when saving fails; price validated against `/platform/terms`; real promo video status;
  calm "Payouts open soon" when Stripe isn't configured.
- Admin: review queue shows changes to live courses (what changes + proposed curriculum; reviewers can watch new videos via
  `POST /admin/videos/:assetId/playback`, audited); role and suspend changes need confirmation; server-side search and pagination
  for users, courses, instructors, orders and audit; order detail with per-course split and partial refunds.
- Search now matches every word across course text and curriculum; the home "Popular" chips are topics the catalogue really
  covers (Playwright checks each returns a course).
- Tests: smoke script updated to the one-course catalogue (it still expected the old 8 courses); new Playwright tests for the
  revision flow, role confirmation and popular searches; `scripts/demo-catalogue.sh` reproduces the owner's demo catalogue.

## 2026-11-24: Step 1 (homepage) proposed, awaiting the owner's review
- Branch `feat/step1-home` (rollback tag `checkpoint-2026-11-24-step1-home`, backup branch `backup/step0-2026-11-24`).
- Hero and "Teach it here" band unchanged (owner kept them). Below the hero: with fewer than 4 courses, the single course is
  shown in depth as a route (Understand → Build in labs → Automate, derived from the real curriculum), with real facts, price,
  "View the course" and a working free-lesson player; the three rails that repeated the same course return automatically at
  4+ courses. Category strip only lists categories with courses (hidden below 3); "Taught by practitioners" shown from 2
  instructors. Screenshots: `docs/design/step1-home-2026-11-24/` (390/1440/1920 light, 390/1440 dark).
- Not yet run on a fresh stack (the owner paused the machine): full rule-10 test cycle pending.

## 2026-11-24: payments proposal approved by the owner ("please do … the payment work"); implemented on `feat/payments`
- Rollback tag `checkpoint-2026-11-24-payments`. After-fee 80/20 split, 16-day hold + hourly transfer release, ledger netting,
  learner self-service refunds (14 days, < 25 % watched, no certificate, 3 a year, then admin review), disputes (freeze /
  recover), per-instructor terms and "pay to DEL" (super admin only, audited), commission setting super-admin only, finance
  overview with reconciliation checks, immediate-access consent at checkout. Stripe calls are tested with a fake client;
  real Stripe test-mode runs need the owner's test keys.
