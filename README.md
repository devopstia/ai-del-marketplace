# AI Learning Marketplace (DevOps Easy Learning)

A multi-instructor marketplace for AI and DevOps courses: students discover, preview, buy and study courses; instructors
publish and get paid through Stripe Connect; a super admin runs the platform.

**Status (2026-11-26):** live at https://ai-devopseasylearning.com (staging: https://staging.ai-devopseasylearning.com),
release `release-2026-11-26-final-review-r4`. Stripe in test mode without keys; no courses or videos on production yet.

Start here: [AGENTS.md](AGENTS.md) (rules) → [docs/HANDOFF.md](docs/HANDOFF.md) (current state, open owner decisions, how to
test and release) → [docs/DECISIONS.md](docs/DECISIONS.md).

Local: `./scripts/make-env.sh && docker compose up -d --build`, then `docker compose exec api npm run seed`
(web http://127.0.0.1:3000, API http://127.0.0.1:4000, email inbox http://127.0.0.1:8025).

Rules for anyone working here: everything for this marketplace lives in this repository; use only what is needed from the
reference projects; never copy secrets; no push, merge or deployment without the owner's approval.
