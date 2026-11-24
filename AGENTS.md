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
   accessible (keyboard, focus, contrast, reduced motion). Review every changed screen in screenshots before calling it done.
6. **Dashboards are organized, not overloaded**: student (engaging learning), instructor (professional business tools), super admin
   (full operational visibility).
7. **Preserve what works**; enhance instead of rebuilding. Keep multi-instructor, Stripe Connect, enrolment, purchasing.
8. **Security is non-negotiable**: httpOnly session cookies + CSRF, ownership checks in the service layer, signed short-lived media
   URLs, verified idempotent webhooks, audit log for privileged and financial actions, secrets only in `.env` (never committed).
9. **Git**: feature branches; local commits; **no push, merge or non-local deployment without the owner's approval**.
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
