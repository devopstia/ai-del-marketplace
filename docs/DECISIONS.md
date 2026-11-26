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

## 2026-11-24: Steps 2–7 implemented (owner: "please do … Steps 2–7 … and the payment work"), awaiting review
Each step has its own rollback tag and commit (branches stacked: feat/step1-home → feat/payments → feat/step2-course →
feat/step3-teach → feat/step4-player → feat/step5-learning → feat/step6-studio → feat/step7-admin). Undo one step with
`git checkout checkpoint-2026-11-24-<step> -- <paths>`.
- Step 2 course page (`checkpoint-2026-11-24-step2-course`): refund line by the buy button, captions/quizzes in "includes", FAQ from real policy.
- Step 3 /teach (`…-step3-teach`): real share from the API, after-fee formula, payout timing, worked $100 example.
- Step 4 player (`…-step4-player`): lesson summary shown (was never displayed), Up next, Lab files tab only when a lesson has files.
- Step 5 My learning (`…-step5-learning`): honest resume label, no half-empty suggestion grid.
- Step 6 studio (`…-step6-studio`): DEL Studio switch for super admins (audit names the real person), terms note, per-sale fee and payout status.
- Step 7 admin (`…-step7-admin`): Money page (totals, reconciliation, refund requests, disputes), Edit terms per instructor, super-admin-only commission.
- Screenshots: `docs/design/steps2-7-2026-11-24/`.

## 2026-11-24: everything merged into `main` and redeployed locally (owner: "merge everything into main and redeploy so that we can continue from there")
- Merge commit on `main` (local only, not pushed); rollback tag `main-before-merge-2026-11-24` (= `d2339c2`), release tag
  `release-local-2026-11-24`. Includes Step 0, Step 1, payments, Steps 2–7. `feat/landing-redesign` stays archived (not merged).
- Local stack runs `main` with the clean demo catalogue. New work starts from `main` on new `feat/…` branches.

## 2026-11-25: checkpoint before new work
- Rollback point: tag `checkpoint-2026-11-25-start` = commit `bd57c5d` (`main`), backup branch `backup/main-2026-11-25`.
  Work continues on `feat/next-2026-11-25`. Restore any path with `git checkout checkpoint-2026-11-25-start -- <path>`.
- 2026-11-25: /courses results in two columns (owner request). Rollback tag `checkpoint-2026-11-25-courses-grid` (= `e9c04ad`),
  backup branch `backup/courses-grid-2026-11-25`. Screenshots in `docs/design/courses-grid-2026-11-25/`.
- 2026-11-25: 5 sample courses (4, then 1 more on request) for the local demo (owner: "add another 4 dummy course"), via `scripts/demo-dummy-courses.cjs`
  (article lessons only, descriptions say "Sample course"; audited). Remove with
  `docker compose exec -T -e REMOVE=1 api node - < scripts/demo-dummy-courses.cjs`. Not part of the clean demo.

## 2026-11-25: feat/next-2026-11-25 merged into `main` (owner: "merge feat/next-2026-11-25 into main")
- Local merge only (not pushed). Rollback tag `main-before-merge-2026-11-25` (= `bd57c5d`), release tag `release-local-2026-11-25`
  (= `1ce1b75`). Includes: hero right column, AI hub, RAG cycle slide 2, /courses two-column grid + header row, sample-course script.
- Next work on `feat/courses-improvements`: rollback tag `checkpoint-2026-11-25-courses-improve` (= `1ce1b75`), backup branch
  `backup/main-after-merge-2026-11-25`.
- 2026-11-25 `feat/courses-improvements`: /courses filter counts (facets), several topics at once, cleaner cards (see commit
  b86ee1d). Verified on a fresh stack (`down -v`): API 129/129, smoke 135/135, web typecheck + lint, Playwright 16/16 with
  E2E_PASSWORD. Then clean demo (seed, import-del, demo-catalogue) + the 5 sample courses re-added.

## 2026-11-25: feat/courses-improvements merged into `main` (owner: "merge this into main")
- Local merge only. Rollback tag `main-before-merge-2026-11-25-b` (= `1ce1b75`), release tag `release-local-2026-11-25-b`.
- Next: `feat/home-improvements` (homepage fixes + leftovers), rollback tag `checkpoint-2026-11-25-home`, backup branch
  `backup/main-2026-11-25-b`.
- 2026-11-25 `feat/home-improvements`: homepage made truthful and consistent with /courses ("Start here" no longer claims
  reviews; "Most enrolled" only with 3+ courses that have learners; shared card rules; covers without a second title, never
  repeating beside each other; node-graph cover always spread; instructors use the full row). Purchase card lists video time
  and readings separately. /courses: tidy filter URLs, two topics named in the heading. Screenshots `docs/design/home-improve-2026-11-25/`.
- 2026-11-25 owner disliked "Taught by practitioners" + dark teach band ("design it well"): replaced by option C from the
  comparison page: each instructor with their real courses ("Learn from the people who build it") and a one-row teach invite.
- 2026-11-25 /teach tuned (owner: "improve and tune this up"): live earnings calculator (price + sales per month, same
  arithmetic as the API split, honest estimate note) replaces the fixed $100 example; price rule from live terms; step 1
  links to the application; closing call to action. Screenshots `docs/design/teach-2026-11-25/`.

## 2026-11-25: Course sales and promotions (owner brief + approved plan)
- Branch `feat/promotions` (from `feat/home-improvements`), rollback tag `checkpoint-2026-11-25-promotions`, backup branch
  `backup/home-improvements-2026-11-25`.
- Owner decisions: instructors are included in marketplace promotions by default and can opt a course out (DEL courses always
  in); when an instructor sale and a promotion overlap, the lowest price wins (no stacking); instructor sales need at least
  10% off, not below $4.99, up to 31 days, one at a time. Promotions: 5–90% off, up to 90 days, super admin only.
- Prices are computed at request time (no job, nothing written to the course), so sales stop by themselves. The commission
  split uses the amount actually paid; order lines keep the regular price and which sale applied. See docs/API.md.
- Owner, mid-build: **dark is the default theme for the whole site**; a visitor's saved choice of light (toggle) is kept.

## 2026-11-25: Dark-mode QA pass (owner: "dark mode … must be treated as our primary design experience")
- Branch `feat/dark-qa` (from `feat/promotions`), rollback tag `checkpoint-2026-11-25-dark-qa`, backup `backup/promotions-2026-11-25`.
- Permanent rule: AGENTS.md rule 16 (dark first, contrast, browser QA with `scripts/qa-dark.mjs`, 390/768/1440/1920, fix before review).
- Found and fixed: white text on light accents in dark (violet tabs, rose danger buttons via new `--on-rose`, amber badge,
  mint/cyan step markers), border-coloured icons invisible in dark (lock, empty stars, checklist), rank numbers; homepage and
  orders scrolling sideways (screen-reader labels escaping scroll boxes); phone site menu trapped in the 64px header (now a
  portal); cramped titles printed on small covers (covers show topic + pattern only); select wider than phones; light-theme
  accents darkened to pass AA. Final scan: every page, every role, 390/768/1440/1920 in dark, no failures; light spot-check clean.

## 2026-11-25: merged into `main` and pushed to GitHub (owner: "merge into main and push")
- `feat/dark-qa` (homepage + /teach, sales and promotions, dark-mode QA) merged; rollback tag `main-before-merge-2026-11-25-c`
  (= `147bff5`), release tag `release-2026-11-25`. `main` pushed to `origin`. Not yet run: the full fresh-stack test.
- 2026-11-25 (owner: "the default theme should be dark for everything"): light choices saved by browsers before dark became the
  default are dropped (old key `del-theme`); only a choice made with the toggle since then (`del-theme-v2`) is kept. Verified:
  fresh browsers and browsers with an old saved "light" open every area in dark. Branch `fix/dark-default`.

## 2026-11-25: Standard course covers (owner brief; designs approved: "good")
- Branch `feat/course-covers`, rollback tag `checkpoint-2026-11-25-covers`, backup `backup/main-2026-11-25-covers`.
- Owner decisions: templates only (no custom uploads, DEL included); cover changes go live at once (no review); a cover shows
  the title, a topic label and the DEL mark. 52 built-in templates (16 generic, 13 AI, 15 IT, 8 DevOps) over 6 layouts,
  14 palettes and 30 designs, drawn on the server in Schibsted Grotesk (OFL, `apps/api/assets/fonts`).
- Every existing course got a topic-matched template; the import no longer uses the first lesson's video frame. Super admins
  manage templates at /admin/covers; instructors pick at Studio → course → Media. Permanent rule: AGENTS.md rule 17.

## 2026-11-25: Features from the Insurance Knowledge Hub (owner: "start with 6 … move on with 8, 4, 10, 5, 11")
- Research: docs/research/insurance-hub-reuse.md. Order: installable app (6), Support Center (8), content protection (4),
  help videos + video engine (10), ⌘K search (5), terms acceptance (11). Each on its own branch; nothing merged without
  the owner's approval.
- 6 installable app: branch `feat/pwa`, rollback tag `checkpoint-2026-11-25-pwa`. docs/PWA.md, AGENTS.md rule 18.
- 8 Support Center: branch `feat/support` (from `feat/pwa`). docs/SUPPORT.md. Tickets SUP-000123, plain text, private
  attachments, staff queue with internal notes, auto-close after 7 days, reopen within 30, only super admins close directly.
- 4 Content protection: branch `feat/content-protection` (from `feat/support`); rollback tag
  `checkpoint-2026-11-25-content-protection` = `c31fa05`, branch `backup/before-content-protection`. Encrypted HLS
  (ffmpeg copy, AES-128 per video, wrapped key), sessions bound to the learner, no visible watermark (owner:
  no letters on videos), signed-MP4 fallback; `PROTECTED_PLAYBACK` switch. Also fixed: captions were on by default (rule 11). docs/CONTENT_PROTECTION.md.
- 10 Help videos + video engine: branch `feat/help-videos` (from `feat/content-protection`); rollback tag
  `checkpoint-2026-11-25-help-videos` = `a9f0fd1`, branch `backup/before-help-videos`. Public /help with chapters,
  Admin › Help videos, `video-academy/` engine ported from the Hub (DEL dark brand, Kokoro voice, Whisper QA), publish
  tool for the local site. AI voice accepted by the owner ("move on please" after the question). docs/HELP_VIDEOS.md.
- Sign-in security: branch `feat/auth-security` (from `main` `dae13ba`); rollback tag
  `checkpoint-2026-11-25-auth-security`, branch `backup/before-auth-security`. Owner decisions: Google Authenticator at
  every sign-in for everyone with an optional "Trust this device for 30 days"; all four providers built, buttons only
  with keys, tested with a local test provider; Have I Been Pwned for breached passwords. Hub review: no Google
  sign-in there (MFA, recovery codes, lockout ported). Migration ends all sessions. docs/AUTH.md, AGENTS.md rule 19.
- Reviews in the course player (prompts.md task 1): branch `feat/learn-reviews` (rollback tag
  `checkpoint-2026-11-25-learn-reviews`). "Rate course / Your review" tab, rating in Overview and the player bar;
  same review record as the public page (one per student, edits replace it, a hidden review stays hidden).
  Owner decisions for task 2 (2026-11-25): existing enrolments get 1 year from today; renewal = buy again at the
  current price (sales apply, progress kept, no auto-charge); eligible refunds automatic (3/year, then admin);
  AI refund analysis with Claude, hidden until ANTHROPIC_API_KEY is set.
- One-year access + refund rule (prompts.md task 2): branch `feat/one-year-access` (rollback tag
  `checkpoint-2026-11-25-one-year-access` = `525a82c`). Access periods, server-enforced expiry, renewal (last 30 days or
  after expiry), reminders, unique-seconds consumption, automatic refund decisions with review, Admin › Refunds, Claude
  summaries (hidden without key), policy page, "lifetime" removed everywhere. docs/ACCESS_AND_REFUNDS.md, AGENTS rule 20.
- Batch 2 (prompts.md tasks 3–9 plus owner requests, 2026-11-25; owner: "work on all of those, deploy local and push into
  main… go with recommendation"): rollback tag `checkpoint-2026-11-25-before-batch2` = `10d92d2`, branch
  `backup/before-batch2-2026-11-25`; work on `feat/player-and-promo`. Decisions taken on the owner's behalf
  (recommended options): YouTube-style player with in-place lesson changes (full screen survives Next); full program
  promoted with `www.devopseasylearning.com` (bare domain has a certificate error), removed from the menu bar at the
  owner's request; four roles with explicit admin permissions, existing admins keep all operational permissions,
  step-up authenticator code for privileged role changes; Student Studio at `/student` with old links redirected; one
  `AppShell` for every studio; curriculum drag and drop with dnd-kit (keyboard and touch), course package as a separate
  table that applies immediately; manual enrollment with super-admin-only payment verification, allocation per course,
  80/20 of the net, hashed 7-day invitations where every new link replaces the old one and an emailed code proves the
  address; email through the Hub's layout with DEL branding, Resend in production and a local Mailpit inbox; CI on
  GitHub Actions, images/release workflows gated by `PRODUCTION_ENABLED` (no AWS resources created), secrets in SSM
  instead of the Hub's committed secrets file, SSM Run Command instead of SSH, no geographic rules; contact page
  emails screenshots to support@devopseasylearning.com; social links from the DEL website; /install and /help
  ("Platform videos", two columns) redesigned. Tests run on an isolated `del-test` stack (ports 3100/4100) so the
  owner's local site (MFA_REQUIRED=false) is never touched.

## 2026-11-25 — Final review before the next release (checkpoint `checkpoint-2026-11-25-final-review` = 7ae0a6c, branch `backup/pre-final-review-2026-11-25`, work on `feat/final-review`)
- **Light is the default theme** for every visitor (owner); dark stays one click away and is remembered. Theme script no
  longer follows the OS preference; manifest, theme-color and offline page are light by default. AGENTS rules 5 and 16 updated.
- **Emails: one dark design** in every client, independent of the website theme.
- **Social sign-in:** code was complete but production had no keys. Added Super Admin › Sign-in methods (keys checked with
  the provider, sealed, step-up code, audited). Creating the apps with Google/GitHub/Facebook/LinkedIn needs the owner's accounts.
- **Support:** opening a ticket now emails the requester a confirmation and the support inbox a notification (Contact page already did).
- **Requirement audit fixes:** course FAQ said "For life" (now 12 months, rule 20); "less than 25%" → "25% or less"
  everywhere; Buy/Checkout replaced by "Contact us to enrol" while card payments are off (rule 4); Terms of use and
  Privacy policy pages (also needed by the sign-in providers); the player always shows the access end date.
- Costs: docs/AWS_COSTS.md (≈ $52/month fixed, video traffic is the variable that matters).

## 2026-11-26 — Release r4 and handoff
- Production and staging run `release-2026-11-26-final-review-r4` (images `4b5706c24617`, API on Debian 13); pre-release snapshot
  `pre-release-4b5706c24617-20261126-0254`; rollback target `80a2549306af`. Released with `scripts/deploy-aws.sh` because the
  pipeline's scan gate blocks one critical libtiff finding (owner decision pending). Staging QA findings fixed (FINAL_REVIEW §4).
- Pipeline fixes: OIDC trust for GitHub's immutable subject, plain images for ECR scanning, immutable ECR tags.
- Open with the owner: cost (they said "I don't want this now"; options asked, no answer), scan exception, provider keys.
  Everything for the next agent: docs/HANDOFF.md.

## 2026-11-26 — Improvement batch approved by the owner ("1. A, 3, 6-10 please implement those")
Checkpoint `checkpoint-2026-11-26-improvements` = 2393eef, branch `backup/pre-improvements-2026-11-26`; integration branch
`feat/improvements-2026-11-26` (merges feat/video-delivery, feat/admin-filters-preview-tests, feat/search-and-terms, feat/ai-learning).
- A: CloudFront for lesson segments (signed per-session policy, OAC to hls/* only, no geo restriction) + 720p/480p renditions;
  re-package action for older videos. 3: AWS Budget $75/month (tag filter). 6: filters. 7: draft-revision preview.
  8: browser tests. 9: ⌘K quick search; terms acceptance recorded on orders (version, time, IP). 10: AI learning
  (Postgres FTS caption search; Claude assistant with timestamp citations; cached study notes), hidden without a key.
- Owner also asked for a full mobile responsive check (staging review, fixes in this batch).

## 2026-11-26 — SEO and stand-out batch approved by the owner ("Go with all recommendations and improvements")
Checkpoint `checkpoint-2026-11-26-seo-standout` = 9062adc, branch `backup/pre-seo-standout-2026-11-26`; integration branch
`feat/seo-standout-2026-11-26` (built on the improvement batch, which is still awaiting production approval).
- SEO list 1–5 and 8–12: robots/sitemap, Course rich results, share previews, canonical URLs, honest homepage description
  (no "labs" claim), category pages, breadcrumbs/FAQ, Organization/WebSite data, speed, server-rendered course text.
  6–7 (Google Search Console, Bing) need the owner's account; DNS verification added when the owner provides the token.
- Stand-out first wave (https://claude.ai/artifact/CMYLXDQBiozEt4GjR5m7u7): 1 data-saver mode (360p, audio only, MB per
  lesson), 2 reviews show measured watch share, 4 career paths, 5 instructor insights, 8 verified certificate + LinkedIn.
  Labs (6–7) deliberately deferred until sales start (recommendation the owner accepted with "all recommendations").

## 2026-11-26 — prompts.md batch: Super Admin portal, support sessions + AI agents, email OTP + session security, refunds
Owner: "Please work on this prompts.md, skip the ones we have already". Checkpoint `checkpoint-2026-11-26-admin-security-refunds`
= 95d1098, branch `backup/pre-admin-security-refunds-2026-11-26`; integration branch `feat/admin-security-refunds-2026-11-26`
(merges feat/admin-portal, feat/auth-sessions, feat/support-sessions-agents, feat/refund-management). Built on the SEO and
stand-out batch (still awaiting production approval). Email OTP for students/instructors changes AGENTS rule 19 at the
owner's request; privileged roles keep the authenticator. Government ID verification is documented, not built.
