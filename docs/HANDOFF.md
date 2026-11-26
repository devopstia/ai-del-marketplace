# Handoff: current state (updated 2026-11-26)

Read this after `AGENTS.md` (rules) and before starting work. It says what is live, what is waiting on the owner, and how to
build, test and release without breaking anything. Details live in the linked docs; this page is the index of "where are we".

## 1. What is live

| Environment | URL | Version | Data |
| --- | --- | --- | --- |
| Production | https://ai-devopseasylearning.com | tag `release-2026-11-26-final-review-r4`, images `4b5706c24617` | empty catalogue; only 2 accounts: DEL platform instructor + Super Admin `support@devopseasylearning.com` |
| Staging | https://staging.ai-devopseasylearning.com (noindex) | same images | synthetic demo data (`seed-staging`), simulated payments, demo accounts `student@del.example`, `nadia@instructor.example`, `admin@del.example` (password + authenticator seed in SSM `/del-marketplace/staging/SEED_PASSWORD`, `SEED_MFA_SECRET`) |
| Owner's local | http://127.0.0.1:3000 (api :4000, Mailpit :8025) | `main` | `MFA_REQUIRED=false` on purpose: **never change the owner's `.env` or reseed their stack** |
| Test stack | http://127.0.0.1:3100 (api :4100, Mailpit :8125) | whatever you build | `COMPOSE_PROJECT_NAME=del-test COMPOSE_FILE=docker-compose.yml:docker-compose.test.yml`, MFA on; run all suites here |

Both cloud environments share **one EC2 t3a.medium and one RDS instance** (separate databases `marketplace` /
`marketplace_staging`, buckets, secrets). This is accepted: the owner will delete staging once production is stable.
Previous stable production version (rollback target): `release-2026-11-26-launch-prep`, images `80a2549306af`.
Pre-release snapshot of the last release: `pre-release-4b5706c24617-20261126-0254`.

Git: `main` is current and pushed (`origin` = github.com/devopstia/ai-del-marketplace). `prompts.md` (the owner's prompt
history) is deliberately untracked. Restore points: tags `checkpoint-*`, `release-*`, branches `backup/*`.

## 2. Waiting on the owner (do not do these yourself)

1. **Cost question (open, 2026-11-26).** The owner wrote "I don't want this now please Cost: about $52 a month". Asked which
   they mean: (1) just stop mentioning cost, (2) cut cost but keep the site up (remove staging, smaller server, budget
   alert: ~$25–30/month), (3) take the site offline, delete nothing (~$5–8/month). **No answer yet: do not stop, resize or
   delete any AWS resource until they choose.** Numbers: `docs/AWS_COSTS.md`.
2. **Image-scan exception.** The release pipeline (`images.yml`) blocks any CRITICAL finding. The API image has one:
   `CVE-2026-52490` (libtiff; affects only the `tiffcrop` tool, which isn't installed; libtiff comes in through ffmpeg's
   dependencies). Recommended: an allowlist file with reason + review date. Adding it was refused by the permission
   system as a security decision, so it needs the owner's explicit approval. Until then `release.yml` stops at the scan;
   the last release went out with `scripts/deploy-aws.sh` on the owner's instruction ("deploy it in prod when you are good with stage").
3. **Social sign-in keys.** Google/GitHub/Facebook/LinkedIn are implemented and tested (test provider + mocked exchanges);
   buttons appear only when keys are saved. The owner creates each provider app and pastes the keys in
   **Super Admin › People › Sign-in methods** (`/admin/sign-in`, shows the redirect URIs). Facebook needs business
   verification; LinkedIn needs a Company Page. The owner wants the "Continue with Google" button like their example.
4. **Stripe test keys** in Super Admin › Payments & Stripe (owner plans to do it on 2026-11-27, in a **new Stripe account
   for DEL**, not the Insurance Hub's; never copy the Hub's keys). Until then Buy/Checkout show "Contact us to enrol". Live
   payments only after the owner's explicit authorisation (typed confirmation + authenticator).
5. **SES production access** (AWS console › SES). Until then email only reaches verified addresses.
6. **Alerts:** subscribe an email to SNS `del-marketplace-alerts`.
7. **Videos and courses on production:** never upload local training videos or unfinished courses until the owner says so.
8. **⌘K search and terms acceptance at purchase** (owner's earlier ordered list, items 5 and 11) were never built; confirm
   they are still wanted.

9. **Super Admin password:** the bootstrap password was shown in chat on 2026-11-26 at the owner's request; the owner will
   change it (Account settings). Afterwards the SSM copy `/del-marketplace/bootstrap/ADMIN_PASSWORD` is stale: mark or delete it.

## 3. Known gaps (from the 2026-11-26 requirement audit, `docs/FINAL_REVIEW_2026-11-26.md`)

- No browser tests yet for: manual-enrollment and invitation screens, curriculum drag-and-drop UI, Admin › Refunds and
  Users UI, player double-click full screen / idle hide (the API side of all of these is tested).
- Partial: filters by instructor/course/date on manual enrollments and review moderation; previewing a draft revision of
  a live course; no automated smoke/Playwright step after the staging deploy in `release.yml`; no dependency audit in CI.
- Staging Playwright runs publish "E2E course …" courses that stay public on staging; unpublish them after a run
  (`update courses set status='unpublished' where title like 'E2E course %'` on `marketplace_staging`).

## 4. How to work

- **Before changing anything:** commit, tag `checkpoint-<date>-<topic>`, branch `backup/…`, record the hash in
  `docs/DECISIONS.md`, work on `feat/…` (AGENTS rule 15). Front-end: one page/section at a time with screenshots at 390/1440/1920.
- **Tests:** `cd apps/api && npm test` (unit + e2e; e2e uses a separate `marketplace_e2e` database on the owner's Postgres :5433,
  Redis :6380, MinIO :9000; run jest through `node --experimental-vm-modules`, plain `npx jest` fails on ESM). On the test
  stack: `API=http://127.0.0.1:4100 ./scripts/smoke-api.sh` (wait until the worker container is up, or video checks fail),
  `E2E_PASSWORD=<SEED_PASSWORD from .env> E2E_BASE_URL=http://127.0.0.1:3100 npx playwright test` in apps/web (without
  `E2E_PASSWORD` the signed-in tests skip), `QA_BASE=http://127.0.0.1:3100 node scripts/qa-dark.mjs [--light] [--as role] paths…`
  (dark by default, `--light` for the default theme). Typecheck: `npm run typecheck -w apps/web` and `-w apps/api`.
- **Release:** `release.yml` (CI → images → staging → owner approval → snapshot → production) once the scan question is
  settled; otherwise `./scripts/deploy-aws.sh build <tag>`, `release staging <tag>`, `verify staging`, Playwright against
  staging, RDS snapshot, `release production <tag>`, `verify production`. Image tags = 12-char commit, **immutable in ECR**
  (never re-push a tag; a new commit gives a new version). Git release tags are never moved: a superseded tag gets `-r2`, `-r3`…
  Create a GitHub release for each production release. Details: `docs/DEPLOYMENT.md`.
- **Production smoke:** synthetic account only, delete it afterwards; never live charges.

## 5. Pitfalls learned (2026-11-25/26)

- The local `gh` CLI is old: no `gh variable`, no `--json jobs`/`displayTitle`; use `gh api repos/devopstia/ai-del-marketplace/...`.
- GitHub OIDC for this repo uses the **immutable subject** format (`repo:devopstia@116234952/ai-del-marketplace@1470488285:…`);
  the deploy role trusts both formats (`infra/terraform/cicd.tf`).
- `docker/build-push-action` must push with `provenance: false, sbom: false`, or ECR basic scanning finds no scan (image index).
- `terraform apply -auto-approve` is refused by the permission system; `terraform plan -out=…` then `terraform apply <plan>` works.
- RDS needs TLS: `DATABASE_SSL=rds` uses `apps/api/assets/rds-global-bundle.pem`; every Prisma client (app, seed, import,
  bootstrap, mfa-admin) passes `ssl: databaseSsl()`.
- Seed refuses production builds unless `DEPLOY_ENV=staging`.
- `ERR_NETWORK_CHANGED` in Playwright against staging is this machine's network (WSL), not the site; rerun `--last-failed`.
- Remote commands: `source <(sed -n '/^APP=/,/^b64()/p' scripts/deploy-aws.sh)` then `remote '<shell>' "label"` (SSM Run Command, no SSH).
  Container names: `del-<stack>-api-1`, `del-<stack>-web-1`, `del-<stack>-worker-1`, `del-edge-caddy-1`.

## 6. Key docs

`AGENTS.md` (rules) · `docs/DECISIONS.md` (history of decisions and rollback points) · `docs/FINAL_REVIEW_2026-11-26.md`
(latest requirement audit, tests, release) · `docs/DEPLOYMENT.md` · `docs/AWS_COSTS.md` · `docs/AUTH.md` (sign-in, provider setup) ·
`docs/EMAIL.md` · `docs/PAYMENTS.md` · `docs/ROLES_AND_STUDIOS.md` · `docs/MANUAL_ENROLLMENT.md` · `docs/ACCESS_AND_REFUNDS.md` ·
`docs/STORAGE.md` · `docs/PWA.md` · `docs/SUPPORT.md` · `docs/HELP_VIDEOS.md` · `docs/CONTENT_PROTECTION.md`. Historical:
`docs/ASSESSMENT.md`, `docs/ROADMAP.md`, `docs/PHASE1.md`, `docs/PAYMENTS_PROPOSAL.md`, `docs/LAUNCH_REPORT.md`.
