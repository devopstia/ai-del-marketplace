# AGENTS.md: how to work on the AI Learning Marketplace

Read this first, then `docs/DECISIONS.md`, `docs/BUILD_SPEC.md` and `docs/API.md`. Everything for this marketplace (code, plans,
research, docs) lives in this repository.

## What this is
A multi-instructor AI and DevOps learning marketplace for DevOps Easy Learning (DEL): students discover, preview, buy and study
courses; independent instructors publish and are paid through Stripe Connect; a super admin runs the platform.
Stack: Next.js 16 (`apps/web`) · NestJS 12 modular monolith + BullMQ worker (`apps/api`) · PostgreSQL (Prisma migrations) · Redis ·
S3/MinIO · Stripe · Mux. Local: `./scripts/make-env.sh && docker compose up -d --build` then `docker compose exec api npm run seed`.

## Owner's standing rules
1. **Approval before major work.** Audit → research → proposal → the owner approves → implement. Present findings, a prioritized
   roadmap and reuse plan first (owner, 2026-11-24).
2. **Only use what is needed** from the reference projects (DEL website, Insurance Knowledge Hub); never copy their secrets.
3. **World-class, not a clone** (owner, 2026-11-24): benchmark Udemy, Coursera, Skillshare and others; keep what works, fix their
   weaknesses, and add genuinely useful innovations (AI learning assistant grounded in course content, AI video search to the exact
   moment, AI study materials, personalised paths, hands-on labs with an AI troubleshooting assistant, skill analytics, instructor AI
   tools, career features, community). Features are integrated thoughtfully, not added as more buttons.
4. **Every visible control works.** No button, link, menu or form that does nothing. Never present a feature as working unless it is
   implemented and tested end to end. Unfinished features are hidden, not shown as placeholders.
5. **Exceptional, premium design**: impressive from the first screen; consistent typography, colour, spacing, motion; no excess
   empty space, no repetitive rectangle grids, no generic template look; every page has a clear purpose. Light/dark, 390–1440 px,
   accessible (keyboard, focus, contrast, reduced motion). Review every changed screen in screenshots at **390, 1440 and 1920 px** (the owner works on a ~1970 px screen) before calling it done; no empty regions or stranded elements (owner, 2026-11-24: homepage hero "empty", instructor band "not good", /teach "not well design").
6. **Dashboards are organized, not overloaded**: student (engaging learning), instructor (professional business tools), super admin
   (full operational visibility).
7. **Preserve what works**; enhance instead of rebuilding. Keep multi-instructor, Stripe Connect, enrolment, purchasing.
8. **Security is non-negotiable**: httpOnly session cookies + CSRF, ownership checks in the service layer, signed short-lived media
   URLs, verified idempotent webhooks, audit log for privileged and financial actions, secrets only in `.env` (never committed).
9. **Git**: feature branches; local commits; **no push, merge or non-local deployment without the owner's approval**.
11. **Captions/transcripts OFF by default** (owner, 2026-11-24: "Turn off the transcript by default. a student can add it if they
    want"): captions are available where a video has them, but never shown until the student turns them on (CC button); the
    student's own choice may be remembered. No always-visible transcript panel.
12. **Front end: small steps, owner reviews each** (owner, 2026-11-24: "I don't like the front upgrade… reverse it… make
    modification slowly. Only front"). The big Phase 1 front-end redesign was rejected and reverted (kept only in
    `git stash` "rejected-front-upgrade-2026-11-24" for reference; don't re-apply it wholesale). Change ONE page/section at a time,
    show the owner screenshots (390/1440/1920), wait for OK, then the next. Never run a parallel bulk redesign.
13. **Always preserve the approved design before changing it** (owner, 2026-11-24, mandatory): before modifying an existing
    design, make sure the current working version is committed, mark it with an annotated tag (`design-approved-<date>`) and a
    `backup/…` branch, record the hash, and do the work on a dedicated `feat/…` branch. Never merge or deploy a redesign without the
    owner's approval. Rollback on request: `git checkout <tag> -- apps/web` (or the affected paths) on the working branch, then
    rebuild the web container; unrelated work stays. Current approved design: tag `design-approved-2026-11-24` = commit `9b0170e`.
14. **Natural, not AI-generated design** (owner, 2026-11-24): clean typography, consistent spacing, proper alignment, professional
    colour; avoid excessive gradients, glows, repetitive cards, oversized headings, needless animation and decoration. Improve the
    existing identity, don't replace it. Preserve the course listing and course detail pages (owner likes them).
15. **Permanent rules for every agent** (owner master brief, 2026-11-24; they reinforce rules 1–14):
    - Inspect the existing code, docs and running app before changing anything; never assume a feature is missing until checked.
    - Before **any** modification phase (not only redesigns): commit the working state, add an annotated `checkpoint-<date>-<topic>`
      tag and a `backup/…` branch, record the hash in `docs/DECISIONS.md`, then work on a dedicated `feat/…` branch. No
      `reset --hard`, force push or branch deletion.
    - Never rebuild what works. Preserve the course and video functionality (catalogue, course page, curriculum, player, studio uploads).
    - Research professional references before major UI changes (`docs/research/`); decisions must be evidence-based.
    - Simplicity, professionalism and usability over decoration; no generic AI-generated look.
    - Functional features only, never decorative placeholders; test before presenting anything as complete; show screenshots.
    - Never merge or deploy major changes without the owner's approval; keep docs and rollback points current.
    - Don't create duplicate instruction files: this file is the single source of agent rules.
10. **Done means tested**: `npm test -w apps/api` (unit + e2e), `./scripts/smoke-api.sh`, `npm run typecheck && npm run lint -w apps/web`,
    Playwright `npm run test:e2e -w apps/web` (wait ~60 s after the API smoke run: register is rate-limited per IP), all green on a
    fresh stack (`docker compose down -v`), then reseed for a clean demo.

## Known pitfalls
- Use `127.0.0.1`, not `localhost` (cookies are shared by host between web :3000 and api :4000).
- After sign-in/registration use a full navigation (`window.location.assign`), not `router.push`: production Next.js may serve a
  prefetched copy made while signed out (a cached redirect to /login).
- MinIO's official image is no longer published; local dev uses the pinned community build `pgsty/minio`. Production uses S3.
- Stripe and Mux code paths are untested against the real services until keys exist; local payments use the dev-only test mode.

## Where things are
`docs/ASSESSMENT.md` (original assessment) · `docs/DECISIONS.md` · `docs/BUILD_SPEC.md` · `docs/API.md` · `docs/research/` ·
`docs/ROADMAP.md` (improvement roadmap, when written) · `scripts/` (env, smoke).
