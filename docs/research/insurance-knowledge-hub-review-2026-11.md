# Review: Insurance Knowledge Hub ("Agent Connect"), what to reuse (2026-11-24)

Read-only review of `~/work/insurance-knowledge-hub`. Stack: Next.js 15 + React 18 + Tailwind (hand-built UI kit), 11 FastAPI
services on one PostgreSQL 16, Redis, S3, one EC2 box + RDS, GitHub Actions (OIDC → ECR, snapshot, deploy, e2e).

## Reuse (ranked, adapt as noted)
1. **Video review / approval workflow** (`academy_review`, `storage-service/app/academy_access.py`, `components/academy/review.tsx`):
   draft → pending_review → changes_requested/rejected/published/unpublished, revisions keep the live file until approved, audit
   events. → course submission and approval.
2. **Watch player** (`frontend/components/academy/watch.tsx`, `player-parts.tsx`): autoplay + "Up next", resume, speed, chapters,
   captions, theater/fullscreen, keyboard. → lecture player with the course outline as playlist.
3. **Direct multipart S3 upload** (`frontend/lib/direct-upload.ts`, `routers/uploads.py`): resumable 16 MB parts. → instructor
   uploads (resources; videos if self-hosted).
4. **HLS packaging + playback sessions + watermark/trace** (`hls_packager.py`, `protected_media.py`, `components/media/watermark.tsx`):
   only if videos are self-hosted; prod currently runs with protection off because there's no CDN.
5. **Stripe gateway, signed webhooks, reconcile job** (payment-service): pattern for webhooks and reconciliation. No Connect today.
6. **RBAC engine** (`auth-service/app/{permissions,rbac}.py`, `/admin/roles`): code-defined permissions, DB-defined roles, rank
   rule, sidebar from `<module>.view`. → add instructor role + per-course ownership checks.
7. **Auth hardening ideas**: RS256 tokens signed by one service, session revocation, MFA/passkeys. (Don't copy localStorage tokens.)
8. **Captions pipeline** (`storage-service/app/captions.py`).
9. **Lesson extras** (quiz, resources, certificate) as patterns.
10. **Admin UI kit**: users side panel, table kit, KPI cards, analytics pages, audit log viewer; theme engine with WCAG contrast check.
11. **CI/CD shape**: path-filtered tests, OIDC to AWS, pre-deploy DB snapshot, post-deploy e2e.

## Don't reuse
Insurance content (exams, knowledge base, licences, commissions ladder, compliance, US/CA geo allowlist); team/sponsorship and
Brand Studio; 11 copied `security.py` files; `create_all()` + `ensure_columns()` instead of migrations; tokens in localStorage;
in-process threads instead of a job queue; role-flip membership (marketplace needs per-course enrolments); the 333 KB CLAUDE.md
style.

## Security note
That repo deliberately commits `.env`, `.deploy-secrets.env` and an SSH key (`keys/*.pem`). **Nothing from those files may be
copied into this repo**; this repo commits `.env.example` files only.
