> Historical (2026-11-24 proposal). Much of it has since been built; current state and open items: docs/HANDOFF.md.

# Roadmap v2: discovery findings and redesign plan

**Status: proposal for the owner's approval (2026-11-24). Nothing below is implemented.** v1 of this roadmap is in git history
(commit `26be776`). Inputs: the code on `feat/phase1`, the running stack, `docs/research/platform-audit-2026-11.md`,
`docs/research/competitor-benchmark-2026-11.md` (features) and the new `docs/research/design-benchmark-2026-11.md` (visual/UX,
cited). Baseline screenshots of today's approved design: `docs/design/baseline-2026-11-24/` (390/1440/1920 px).

**Rollback point:** tag `checkpoint-2026-11-24-discovery` = `be6818c` (+ branch `backup/phase1-2026-11-24`); approved design tag
`design-approved-2026-11-24` = `9b0170e`. This plan is on `feat/redesign-plan`.

## 1. What I found

### Working well (keep, build on it)
- **Full marketplace loop**: browse → preview → cart → checkout (dev test payment; Stripe code path ready) → enrolment → player →
  progress → quiz → certificate → verify; refunds revoke access and are audited.
- **Course + video**: one structured course "AI for DevOps" (16 sections, 41 lectures, 4 h 23 min, captions, lab ZIPs, quizzes),
  signed short-lived playback URLs, resume, speed, keyboard, fullscreen, captions off by default. Course listing and detail pages
  are the owner's preferred design.
- **Instructor studio**: step editor with readiness checklist, direct uploads, worker processing, quizzes, sales/students/reviews.
- **Admin**: review queue (excellent), instructors, users, orders + refunds, categories, commission setting, audit log.
- **API Phase 1 (done, `aa2fff9`)**: published-course revisions, viewer block, featured instructors, pricing rules
  ($4.99–$999.99), admin pagination, order detail + partial refunds, plain-English validation.
- **Security**: httpOnly session + CSRF, service-layer ownership checks, idempotent verified webhooks, audit log.

### Broken or untrue today (the front-end revert also removed the Phase 1 web fixes)
| # | Problem | Where |
|---|---|---|
| 1 | **Invented testimonial** attributed to Nadia on /teach (breaks the no-fake-content rule) | `app/(site)/teach/page.tsx:44` |
| 2 | "Downloadable lab files" claimed on every course, even with none | `components/PurchaseCard.tsx:93` |
| 3 | Home instructor stats double-counted ("3 courses, 1 learners"; DEL has 1 course) and "1 learners" plural | `app/(site)/page.tsx:99` |
| 4 | **Instructors cannot submit changes to a published course**: the API stores them as a draft revision, but the studio has no "Submit changes" and the admin queue doesn't show revisions | `components/studio/SubmitStep.tsx:36`, `app/admin/review` |
| 5 | "Save and continue" advances after a failed save | `components/studio/CourseEditor.tsx:149` |
| 6 | Promo video status hard-coded "Processing" | `components/studio/MediaStep.tsx:38` |
| 7 | "Set up payouts with Stripe" shown while Stripe isn't configured (503) | `app/studio/payouts` |
| 8 | One-click admin/super-admin role grants, no confirmation | `app/admin/users/page.tsx` |
| 9 | "Preview this course" label overlaps the cover's own title | course detail header |
| 10 | Admin lists/audit not using the new pagination; orders without detail view or partial refunds in the UI | `app/admin/*` |

### Why the design feels weak (screenshots in `docs/design/baseline-2026-11-24/`)
The visual system itself is clean and consistent. The problem is that **the homepage is built for a large catalogue and we have one
course**: the same course appears 3 times ("Start here", "Most enrolled" with a lone row, "New on DEL" with one small card and
a wide empty area), the category strip lists 6 categories although 5 are empty, and "Taught by practitioners" is one quote in a
third of the width. At 1920 px this reads as empty; at 390 px as repetitive. The course thumbnail is a single lecture slide
("How computers solved problems before AI"), not course art.

### Marketplace gaps (vs. your brief)
| Area | Today | Missing |
|---|---|---|
| Commission | One global `commission_bps` (20%); DEL courses 100% platform | Per-instructor override; documented treatment of Stripe fees |
| Payouts | Transfer per line right after payment; refunds reverse transfers | **Payout hold** for the refund window; retry of failed transfers; admin payouts view |
| Disputes | Webhook only writes an audit entry | Dispute record, admin queue, transfer reversal/access decision |
| Reconciliation | none | Monthly report: orders vs Stripe balance transactions, commission, transfers, refunds |
| Discounts | none | Honest coupons (instructor + platform), real end dates, no fake strike-through |
| Student | notes browser-only; no bookmarks/wishlist/Q&A/announcements | Synced notes + bookmarks, wishlist, course Q&A, announcements, instructor↔student messages |
| CI/CD | none (`.github` absent) | Local CI workflow file (lint, typecheck, tests) ready for when you approve a remote |

## 2. What the research says (short; details and sources in the research files)
1. **Simple and familiar beats novel** (Google/Tuch et al. 2012): keep conventional layouts, spend originality on content.
2. **Credibility comes from specifics**: real instructor photo + role, concrete numbers (lessons, hours, last updated), real
   reviews only. Template tells: gradients/glows, repeated icon-card grids, vague claims, oversized headings, zero-value stats.
3. **A small catalogue looks full through depth, not breadth** (Epic React, CSS for JS Devs, Master.dev, Maven): a numbered
   learning path with hours, free previews up front, "who it's for / not for", instructor story, refund promise, FAQ. Never one
   card in a 4-up grid.
4. **Lists for comparable items, tables for data, cards only for mixed content** (NN/g).
5. **No fake urgency or reference prices** (FTC 2022, UK CMA; Udemy class action).
6. **Checkout**: whole cost + refund terms next to the pay button, short form, Buy now for single courses (Baymard).
7. **Dashboards lead with the next action**; admin follows Stripe's Home → List → Detail model with an attention queue.
8. **Player**: one collapsible right panel with tabs (Curriculum · Notes · later AI/Transcript); captions off by default holds.

## 3. Design direction
**Keep the approved identity** (DEL colours, type, loop motif, course listing, course detail, player). Improve by
**content and structure, not decoration**: one accent colour for actions, ~6 type sizes, 8 px rhythm, sections that render only
when they have real data, and layouts that adapt as the catalogue grows (a rail appears at ≥4 courses, never before).

## 4. Plan: one reviewed step at a time (AGENTS.md rule 12)
Each step: checkpoint tag → small change on `feat/…` → tests → screenshots at 390/1440/1920 light+dark → **your OK** → next step.

| Step | Scope | Visible change | Files (main) |
|---|---|---|---|
| **0. Make it true** | Fix table items 1–10 above (no restyling) | Small: remove fake quote, correct stats/claims, studio "Submit changes", admin confirm dialogs, pagination, order detail | `teach`, `PurchaseCard`, `(site)/page.tsx`, `components/studio/*`, `app/admin/*` |
| 1. Homepage | Replace the 3 repeated course sections with **one flagship block**: the course as a numbered 14/16-section path with hours, free previews, last updated; hide empty categories; instructor band only with real profiles, otherwise the "Teach on DEL" invitation. Hero stays | Medium, one page | `(site)/page.tsx`, home components |
| 2. Course detail | Keep layout. Add "Who it's for / not for", FAQ + refund terms near the buy box, fix preview overlap, proper course cover art | Small | `courses/[slug]`, `PurchaseCard` |
| 3. /teach | Honest terms (80/20, payouts, review process, quality bar), real steps; no invented quotes | Small–medium | `teach/page.tsx` |
| 4. Player | Single right panel with tabs; mobile tabs fit at 390 px; Overview shows lecture summary + resources | Small | `learn/*` |
| 5. My learning | Resume-first, sections hidden until relevant, fix "Next up" | Small | `my-learning` |
| 6. Studio dashboard | KPIs with comparison, separate pages kept; mobile editor fixes | Medium | `studio/*` |
| 7. Admin | Attention queue (reviews, revisions, disputes, failed transfers), tables with detail pages | Medium | `admin/*` |

**Marketplace (Phase 6, after the front-end steps or in parallel on a separate API branch, no UI until each piece is complete):**
per-instructor commission (admin, audited) → payout hold + transfer retry job + admin payouts view → disputes → reconciliation
report → honest coupons → wishlist → synced notes/bookmarks → course Q&A + announcements → instructor↔student messages.

**AI (Phase 7, needs your provider/budget decision):** transcript search that jumps to the exact second (our captions already
exist) → course assistant that cites timestamps → instructor-reviewed study notes/quizzes → "Fix my lab" helper.
**Later:** learning paths/skills, interview & certification prep, team accounts, subscriptions/bundles (currently declined).

## 5. How existing work is preserved and reverted
- No step touches the course/video pipeline, player internals or payment code unless the step says so; API changes come with
  tests (`npm test -w apps/api`, smoke, Playwright) per rule 10.
- Each step gets its own tag (`checkpoint-<date>-<step>`) before work and a commit after. Revert one step:
  `git checkout <tag> -- <paths>` then `docker compose up -d --build web`. Nothing is merged to `main` or pushed without you.

## 6. Decisions I need from you
1. **Approve the step order**, starting with Step 0 (truthfulness fixes, almost no visual change).
2. **DEL's revenue**: is DEL the platform's own Stripe account (current design: DEL sales stay with the platform, no transfer),
   or a separate business that needs its own connected account?
3. **Stripe fees and refunds**: instructors' 80% of the gross price (platform absorbs fees, current code) or of the net? Refund
   window (e.g. 30 days) and matching payout hold?
4. **Per-instructor commission overrides**: wanted?
5. **AI provider and monthly cap** for Phase 7 (still open since v1).
