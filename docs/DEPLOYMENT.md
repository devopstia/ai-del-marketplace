# Production deployment (prepared, not deployed)

Owner, 2026-11-25: deploy the marketplace like Insurance Hub, in **the same AWS account**, with **its own
resources and secrets**, **globally accessible (no geographic blocking, Africa included)**, and **nothing created
or deployed until the owner authorises it and gives the domain**.

Status: pipeline, production compose file, proxy and release script are in the repository. **No AWS resource
exists for the marketplace and nothing has been deployed.** `release.yml` cannot run until the repository variable
`PRODUCTION_ENABLED` is `true`.

## 1. What Insurance Hub does (inspected 2026-11-25)

Repository `/home/tia/work/insurance-knowledge-hub` (read without opening `.env`, `.deploy-secrets.env` or `keys/`).

| Area | Insurance Hub | Files |
| --- | --- | --- |
| CI | GitHub Actions `ci.yml`: path filter, tests per service, frontend, compose check | `.github/workflows/ci.yml` |
| Images | `images.yml`: tag = 12-char SHA, native arm64 build (`ubuntu-24.04-arm`), push to ECR `insuranceprep/*` | `.github/workflows/images.yml` |
| Release | `release.yml` on push to `main`: full CI → images → `production` environment → RDS snapshot → open SSH for the runner → server pulls images → verify → close SSH → keep 5 snapshots; rollback by `commit` input | `.github/workflows/release.yml` |
| AWS access from CI | GitHub OIDC roles (`insuranceprep-gh-images`, `insuranceprep-gh-deploy`), no stored AWS keys | `scripts/deploy-aws.sh cicd` |
| Infrastructure | Imperative AWS CLI script with idempotent phases: one EC2 m6g.medium (arm64) + Elastic IP, RDS PostgreSQL, S3, SES identity, Route 53, CloudWatch alarms + SNS, ECR | `scripts/deploy-aws.sh`, `DEPLOYMENT-STATUS.md` |
| TLS / proxy | Caddy (Let's Encrypt) in front of nginx | `docker-compose.prod.yml` |
| Secrets | A generated secrets file in the repo, written to the server's `.env` over SSH; email keys in DB settings | `scripts/deploy-aws.sh` |
| Email | notification-service: outbox → Jinja templates (`_base.html`) → Resend in production (SMTP/SES/console selectable) | `services/notification-service/app/` |
| Monitoring | `/health` per service, compose healthchecks, Route 53 health check, 6 CloudWatch alarms | `docs/RUNBOOK.md` |
| **Geo restriction** | **nginx `geo` allowlist (US and Canada only), 403 page, weekly DB-IP refresh** | `nginx/nginx.conf` lines 67–147, `nginx/geo/*`, `docs/GEO_ACCESS.md` |

## 2. The marketplace version

Same proven shape, improved where the Hub had a weakness:

| | Marketplace | Why it differs |
| --- | --- | --- |
| Compute | One EC2 **t4g.medium** (arm64), tag `App=del-marketplace` | Same pattern; separate instance so a deploy of one app never touches the other |
| Database | RDS PostgreSQL 16 `del-marketplace-rds` (encrypted, 7-day backups, snapshot before every release) | Own instance; never shares the Hub database |
| Files / video | S3 `del-marketplace-media-<account>`, private, presigned links; the server signs with its **IAM role** (`S3_ENDPOINT=aws`, no keys) | Workload authentication instead of keys |
| Images | ECR `del-marketplace/api`, `del-marketplace/web` | Own repositories |
| Proxy | Caddy only (`deploy/Caddyfile`): HTTPS, HTTP/3, HSTS | **No geo rules** |
| Secrets | SSM Parameter Store SecureString under `/del-marketplace/prod/*`, read by the instance role at each release into a root-only `.env` | No secrets file in git, no SSH key in the repo (the Hub commits both) |
| Deploy access | SSM Run Command from the pipeline (no SSH port open at all) | Smaller attack surface than opening port 22 per release |
| Email | Resend (same provider as the Hub), own sending domain and API key | Own credentials |
| CI auth | GitHub OIDC roles `del-marketplace-gh-images`, `del-marketplace-gh-deploy` | Same as the Hub, own roles limited to marketplace resources |

### Global access (owner rule, AGENTS.md rule 23)

- **Never** copy the Hub's `nginx/geo` allowlist, `GEO_ALLOWED_COUNTRIES`, `geo-blocked.html`, or any CloudFront
  geo restriction or WAF geo-match rule.
- Abuse protection without geography: API rate limits (sign-in, registration, contact, invitations, refunds),
  Google Authenticator for every account, Stripe Radar for card fraud, Caddy request logs, CloudWatch alarms.
- Video and downloads are presigned S3 links that work from every country. If video traffic grows, add
  CloudFront **without** `GeoRestriction` (signed URLs or a key group), not a regional block.
- Payments: Stripe availability differs by country; learners who can't pay by card use **manual enrollment**
  (docs/MANUAL_ENROLLMENT.md), which is exactly why that feature exists.

## 3. Pipeline (in this repository)

| Workflow | When | What |
| --- | --- | --- |
| `.github/workflows/ci.yml` | every pull request, pushes to `main`/`develop` (not docs-only) | API typecheck, unit tests, end-to-end tests with Postgres, Redis and MinIO containers; web typecheck, lint, build; both Docker images build |
| `.github/workflows/images.yml` | called by release (or by hand) | arm64 build, push to ECR with the 12-char SHA tag; **skipped unless `PRODUCTION_ENABLED=true`** |
| `.github/workflows/release.yml` | **by hand only** | CI → images → approval in the `production` environment → RDS snapshot → `scripts/deploy-aws.sh release` (SSM) → `verify` → keep 5 snapshots; rollback with the `commit` input. **Every job skipped unless `PRODUCTION_ENABLED=true`** |

Branching (as in the Hub): feature branches → pull request → `main`. `main` protected (required CI). Releases are
started by the owner (or on push once the owner chooses so; change `on:` in `release.yml`).

## 4. Before the first release (only after the owner's authorisation and domain)

1. Owner: authorise production in writing and give the domain (`PUBLIC_HOST`, e.g. `learn.example.com`).
2. Present the plan: `./scripts/deploy-aws.sh plan` (read-only) prints what exists and what would be created, with
   rough cost (~40 USD/month before video traffic). Confirm it shows no change to `insuranceprep-*` resources.
3. After approval, create (all tagged `App=del-marketplace`): ECR repositories; S3 bucket (private, SSE, CORS for
   the domain); RDS instance in private subnets with its own security group; EC2 instance with the instance role
   (S3 bucket, `ssm:GetParametersByPath` on `/del-marketplace/prod/*`, ECR pull, SSM managed instance) and a security
   group open on 80/443 only; GitHub OIDC roles; DNS A record; Resend domain (SPF, DKIM, DMARC).
4. Put the secrets in SSM (SecureString), one parameter per variable from `.env.example`, including
   `PUBLIC_HOST`, `ACME_EMAIL`, `ECR_REGISTRY`, `DATABASE_URL`, `SESSION_SECRET` (new, 64 random bytes),
   `S3_BUCKET`, `S3_REGION`, `WEB_URL=https://<domain>`, `API_URL=https://<domain>`, `STRIPE_*`, `MUX_*`,
   OAuth client ids/secrets, `RESEND_API_KEY`, `EMAIL_FROM`, `ANTHROPIC_API_KEY` (optional), `SEED_PASSWORD` unset.
   Never reuse an Insurance Hub value.
5. GitHub: repository variables `PRODUCTION_ENABLED=true`, `AWS_ACCOUNT_ID`, `AWS_REGION`, `PUBLIC_HOST`;
   environment `production` with the owner as required reviewer.
6. Run `release` by hand. Then `npm run seed` is **not** run in production; create the super admin with
   `node dist/auth/mfa-admin.js` style tooling on the server (docs/AUTH.md) and set up Google Authenticator.
7. Stripe live webhook `https://<domain>/api/webhooks/stripe`; Mux webhook; OAuth redirect URIs
   `https://<domain>/api/auth/oauth/<provider>/callback` (docs/AUTH.md).
8. Monitoring: Route 53 health check on `/api/health`, CloudWatch alarms (instance status, CPU, RDS storage/CPU/
   connections) to an SNS topic with the owner's email, like the Hub.

## 5. QA before release (staging or local)

Local stack = the production containers with MinIO and Mailpit instead of S3 and Resend:
`docker compose up -d --build`. Check: CI green on the branch; every email in Mailpit (http://127.0.0.1:8025) in
light and dark; sign-up, sign-in with the code, purchase, refund, manual enrollment and invitation; videos and
lesson files play/download; `node scripts/qa-dark.mjs` clean; no request is refused by country (there is no code
path that reads a country).
