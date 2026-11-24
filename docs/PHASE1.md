# Phase 1: make everything true and polished (approved 2026-11-24)

Scope from `docs/ROADMAP.md` Phase 1 + `docs/research/platform-audit-2026-11.md`. Decisions: single-course purchases only;
instructors keep 80% (commission 20% for independent instructors, DEL's own courses no transfer), published on /teach; labs run on
the learner's computer or VM with our lab ZIPs.

## A. API changes (apps/api; update docs/API.md for every change)
1. **Revisions for published courses** (audit P1): editing a published course (details, media, curriculum, lectures, resources,
   quiz, price) must not change the live course. Use a CourseRevision (snapshot JSON of the editable course tree, status
   draft|in_review|changes_requested|approved|rejected, reviewNote). Instructor endpoints read/write the draft revision when the course
   is published; `POST /instructor/courses/:id/submit` submits it; admin approve applies it atomically (new videos/resources become
   live), reject/request-changes keep the live version. Unpublished/draft courses keep the current direct editing. Tests.
2. **Course detail `viewer` block**: `GET /courses/:slug` returns `viewer: { enrolled, inCart, isOwner }` when a session exists, so
   the web needs one call (audit: 3× 403 per page). Add `resourceCount`, `hasCaptions`, `lastVerifiedAt` (nullable), `totals`.
3. **Featured instructors**: `GET /instructors/featured` with correct per-instructor courseCount and studentCount (audit: inflated
   home stats).
4. **Pricing rules**: free (0) or between $4.99 and $999.99; one shared constant; clear validation messages with field names.
   Commission default `commission_bps=2000`; DEL (isPlatform) never charged/transferred.
5. **Video status**: promo and lecture assets expose status; `GET /instructor/videos/:id` already exists; make sure promo returns it.
6. **Stripe status**: `GET /instructor/stripe/status` includes `stripeConfigured`; onboarding returns a clear 503 code
   `stripe_not_configured` (web shows a calm state, not a broken button).
7. **Admin lists**: `page`, `pageSize`, `total` on courses/users/instructors/orders/audit; server-side search/filter for audit.
8. **Admin order detail**: `GET /admin/orders/:id` with lines (course title, instructor, amounts, transfer status); partial refund by
   `lineIds`.
9. **Error messages**: validation errors carry `details: [{ field, message }]` in plain English.
10. **Catalogue import of the real DEL courses** (`npm run import:del` in the api container, idempotent, replaces the demo DEL
    courses; keeps Nadia's two demo courses but removes fake ratings/reviews and the invented testimonial):
    - Source (read-only): `/home/tia/work/ai-videos/projects/ai-devops/output/<NN-category>/` — `<NN>-<id>.mp4`, `-thumbnail.png`,
      `captions/<NN>-<id>.en.srt` (convert to WebVTT), `-lab.zip` (lab resources, when present). Titles/descriptions from
      `/home/tia/work/ai-videos/projects/ai-devops/branding/plan.mjs` (`PLAN` entries: category, order, id, title, short, audience,
      description). Mount the source read-only into the api container for the import (compose override or a one-off `docker run`).
    - Courses (instructor: DevOps Easy Learning): one course per category folder that has videos, e.g. "AI Foundations: the
      vocabulary of AI" (02-ai-foundations, 12 lectures), "Before AI", "By hand vs. with AI", "Agents and RAG: the ideas",
      "Building RAG", "AI in production", "Hands-on cloud AI labs" (16-cloud-labs), "Cloud AI services explained" (17-cloud-ai).
      One section per natural group, one lecture per video in plan order; the first two lectures of each course are free previews;
      course thumbnail = the first video's thumbnail; `lastVerifiedAt` = the file date; level from plan `audience`.
    - Quizzes: extract each video's 3–5 quiz questions from its tutorial source
      `/home/tia/work/ai-videos/projects/ai-devops/tutorials/<id>.mjs` (`quizSet([...])` items: q, options, correct, why) — parse
      safely (no executing arbitrary code paths that touch the network); attach as the lecture's quiz.
    - Prices (DEL can change them later): AI Foundations free; others $29.99–$59.99 by length.
    - No fake ratings: rating fields start empty; reviews only from real enrolled users.

## B. Web changes (apps/web)
1. Fix every audit P1/P2 web item: home stats (use `/instructors/featured`), studio "Save and continue" only advances on success,
   price input validation and the correct hint, promo status polling, payouts calm state when `stripeConfigured=false`,
   "Downloadable lab files" only when `resourceCount>0`, admin role change needs a confirmation dialog, empty "Add category"/"Add
   section" submits validate, pagination in admin lists, admin order detail + partial refund, friendly validation messages, toast
   de-duplication, one detail call (viewer block), captions and avatar upload, preview-modal focus trap, user menu arrow keys.
2. **Revisions UI**: in the studio a published course shows "Live" vs "Draft changes" with a diff summary and "Submit changes";
   the admin review queue shows revision reviews with what changed.
3. **/teach**: publish the terms openly: "You keep 80% of every sale", payouts through Stripe, approval process, quality bar; no
   invented testimonials.
4. **Design elevation** (premium, not generic; follow AGENTS.md rule 5 and the frontend-design guidance): homepage (real course art
   from the imported thumbnails, curated rows, learning path strip, honest numbers only), course cards and covers (real thumbnails;
   generated cover only as fallback, never with duplicated titles), course page (fix the "Preview this course" overlap, fill the
   page purposefully: what you'll build, lab files list, last verified badge, curriculum, instructor, reviews), player (mobile-first,
   no clipped Notes tab), studio and admin mobile layouts (cards instead of clipped tables), no large empty page bottoms.
5. Screenshots of every changed page at 1440/390, light/dark, reviewed before done.

## C. Done means (AGENTS.md rule 10)
API unit + e2e green, `scripts/smoke-api.sh` green (extend for revisions, pagination, order detail, featured instructors),
web typecheck/lint/build green, Playwright green (extend: revision flow, pagination, real catalogue course page), on a fresh stack,
then `npm run seed` + `npm run import:del` for the demo.
