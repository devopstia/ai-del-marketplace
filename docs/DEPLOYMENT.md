# Production deployment

Owner, 2026-11-25: launch on **https://ai-devopseasylearning.com** in the same AWS account as Insurance Hub, with its
own resources and secrets, globally accessible (no geographic blocking, Africa included), **Stripe in test mode until
the owner authorises live payments**, and **no training videos or unfinished courses uploaded**.

## 1. Insurance Hub, the reference (inspected 2026-11-25)

Repository `/home/tia/work/insurance-knowledge-hub` (read without opening `.env`, `.deploy-secrets.env` or `keys/`).

| Area | Insurance Hub | Marketplace (what we did differently and why) |
| --- | --- | --- |
| Compute | one EC2 m6g.medium (arm64) + Elastic IP, default VPC, us-east-1 | one EC2 **t3a.medium** (x86, images build natively here and in CI), Elastic IP, default VPC |
| Database | RDS PostgreSQL `insuranceprep-rds` (db.t4g.micro) | own RDS PostgreSQL 16 `del-marketplace-rds` (db.t4g.micro, encrypted, 7-day backups, deletion protection), private, reachable only from the marketplace server's security group |
| Files | S3 + instance role | S3 `del-marketplace-production-<account>` and `del-marketplace-staging-<account>`: private, Block Public Access, SSE, versioning (production), CORS for the site, lifecycle; signed with the **instance role** (`S3_ENDPOINT=aws`, no keys) |
| Images | ECR `insuranceprep/*`, arm64 | ECR `del-marketplace/api`, `del-marketplace/web` (scan on push, keep 20) |
| TLS / proxy | Caddy (Let's Encrypt) → nginx | Caddy only (`deploy/Caddyfile`): HTTPS, HTTP/3, HSTS, HTTP→HTTPS |
| **Geo** | **nginx geo allowlist, US and Canada only** | **none**: no country rules anywhere (rule 23) |
| Secrets | generated file committed to the repo, `.env` written over SSH; an SSH key in the repo | **SSM Parameter Store SecureString** `/del-marketplace/<stack>/*` (Terraform), read by the instance role into a root-only `.env` at each release; no secrets in git, images or workflows; **no SSH at all** (SSM Run Command) |
| Infra as code | AWS CLI script | **Terraform** `infra/terraform/` (state in the private, versioned bucket `del-marketplace-tfstate-<account>`, S3 lock file) |
| CI/CD | GitHub Actions ci → images → deploy (OIDC roles) | same shape: `ci.yml` → `images.yml` → `release.yml` (staging, approval, production), OIDC role `del-marketplace-gh-deploy` |
| Email | Resend | **Amazon SES** for `ai-devopseasylearning.com` (DKIM, SPF, DMARC in Route 53) through the instance role |
| Monitoring | Route 53 health check, CloudWatch alarms, SNS | Route 53 health check on `/api/health`, alarms (site down, instance status with auto-recovery, CPU, RDS storage and CPU) → SNS topic `del-marketplace-alerts` |

Shared with the Hub: only the AWS account, the default VPC and the account's GitHub OIDC provider (read, not changed).
Terraform names every resource `del-marketplace-*` and tags them `App=del-marketplace`.

## 2. Layout on the server

```
/srv/del-marketplace/
  edge/        Caddy (project del-edge): ports 80/443, routes by host to the stacks on the docker network "edge"
  production/  project del-production: api, worker, web, redis  →  https://ai-devopseasylearning.com
  staging/     project del-staging:    api, worker, web, redis  →  https://staging.ai-devopseasylearning.com
```

Both stacks use the same RDS instance with separate databases (`marketplace`, `marketplace_staging`) and separate S3
buckets. Staging uses synthetic demo data only (`seed-staging`), simulated payments (`DEPLOY_ENV=staging`) and is
marked `noindex`. Production starts empty: the DEL platform instructor and one super admin (`bootstrap-production`).

## 3. Commands (`scripts/deploy-aws.sh`)

| Command | What it does |
| --- | --- |
| `plan` | `terraform plan` (read-only) |
| `build [TAG]` | builds the API image and one web image per stack, pushes to ECR (tag = 12-char commit) |
| `release staging\|production [TAG]` | writes the compose files and the `.env` from SSM on the server, creates the staging database if missing, pulls the images, starts the stack, waits for the API health check, reloads Caddy |
| `verify staging\|production` | HTTPS and health checks |
| `seed-staging` | demo data on staging only |
| `bootstrap-production` | DEL platform instructor + super admin `support@devopseasylearning.com` (password generated into SSM `/del-marketplace/bootstrap/ADMIN_PASSWORD`; Google Authenticator at the first sign-in) |

Infrastructure: `cd infra/terraform && terraform init -backend-config=bucket=del-marketplace-tfstate-<account> && terraform plan`.

## 4. Release pipeline

`ci.yml` (every PR and push): API typecheck, unit and end-to-end tests with Postgres/Redis/MinIO, web typecheck, lint,
build, Docker builds. `release.yml` (by hand, `PRODUCTION_ENABLED=true`): CI → images (ECR scan, CRITICAL blocks) →
staging release + checks → `production` environment approval → RDS snapshot → production release → health check →
keep 5 snapshots. Rollback: run `release` with `commit` = an earlier release (its images stay in ECR); data rollback =
restore the pre-release snapshot.

Repository settings used by the workflows (variables, not secrets): `PRODUCTION_ENABLED`, `AWS_ACCOUNT_ID`,
`AWS_REGION`; environments `staging` and `production` (owner as required reviewer).

## 5. Payments and email at launch

- Stripe: **test mode**. A super admin enters test keys in Super Admin › Payments & Stripe (checked with Stripe,
  stored sealed). Live keys stay inactive until a super admin authorises live payments with a typed confirmation and
  an authenticator code (owner's explicit instruction). Webhook endpoint: `https://ai-devopseasylearning.com/api/webhooks/stripe`.
- Email: SES for `ai-devopseasylearning.com`. While the account's SES is in the sandbox, only verified addresses
  receive email; production access must be requested by the owner (console: SES › Account dashboard › Request
  production access).

## 6. Not uploaded

No local training videos, video-academy output, unpublished courses or the local database were copied to AWS. The
pipeline has no step that syncs media. When the owner releases videos, it is a separate, explicit operation.
