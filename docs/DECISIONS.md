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

## Open (need the owner)
- Stripe test keys (and later the live platform account) → `.env`.
- Mux account (token id/secret, signing key) → `.env`.
- Tax/accounting advice before taking live payments (merchant of record).
