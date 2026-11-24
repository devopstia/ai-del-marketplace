# Review: existing DEL platform (`devops-work/org/del/del-website`), 2026-11-24

Read-only review; critical findings spot-checked in the code by the main session.
Stack: Next.js 14 (web) · Go reverse-proxy gateway (no auth) · NestJS/TypeORM: iam, user, course, commerce (Stripe), community,
platform · FastAPI: ai, tts · Postgres (database per service) · Redis · Docker Compose. No tests, no CI, no migrations.

Keep (as reference or concept): Tailwind design + catalogue/course page layouts; enrolment/entitlement/audit concepts in
`commerce-service/src/access/access.service.ts`; S3 presign pattern; database-per-domain idea (as modules).
Redesign: curriculum (JSONB → tables with versions + review status); IAM (roles in session, guards everywhere, ownership checks);
orders with per-instructor lines and a commission ledger; progress with position + captions.
Replace: client-side cart/purchase and raw card form → Stripe Checkout + Connect with verified idempotent webhooks; public S3
playback → signed playback; file-based JSON stores; hardcoded catalogue and coupons (`web/lib/course-marketplace.ts`).
Drop for the marketplace: tts-service, ai-service (unless needed later), community chat/gamification, bootcamp cohorts, it-tools.

Verified critical issues: `web/lib/auth.ts` `validateAdmin` accepts any `Bearer` token; `web/app/checkout/page.tsx` collects card
number/CVC in plain inputs; only `iam-service/src/auth/auth.controller.ts` uses guards; `web/lib/s3.ts` returns public S3 URLs;
no Stripe Connect calls anywhere.
