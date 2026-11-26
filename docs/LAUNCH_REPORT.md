> Historical (first launch, release `release-2026-11-26-launch-prep`). Current state: docs/HANDOFF.md; latest release: docs/FINAL_REVIEW_2026-11-26.md.

# Launch report (2026-11-25)

**Production:** https://ai-devopseasylearning.com (www and http redirect to it; Let's Encrypt TLS, HSTS).
**Staging:** https://staging.ai-devopseasylearning.com (noindex, synthetic demo data, simulated payments).
Release deployed to both: commit `80a2549306af`. Pre-release RDS snapshot: `pre-release-80a2549306af-20261125-2334`.

## Tests (all green)
| Suite | Result |
| --- | --- |
| API unit | 187 / 187 |
| API end to end (Postgres, Redis, MinIO) | 30 / 30, also green in GitHub CI |
| API smoke script | 147 / 147 |
| Playwright, local test stack | full suite green |
| Playwright **against staging on AWS** | 43 passed, 1 skipped (real Stripe checkout: no Stripe keys yet) |
| Dark-mode contrast scan (390–1920 px) | clean |
| Production smoke (synthetic account, then deleted) | register 201, extra roles refused 400, Google Authenticator required before a session, student refused on admin API 403, cart, logout |
| Production pages | /, /courses, /help, /contact, /install, /login, /register, /cart, /teach, policies: 200, no sideways scroll at 390/1440 |

Load test (k6, 50 users, 2 min) against staging on the shared t3a.medium: 5,106 requests, **0 failed**; API p95 518 ms,
page p95 2.1 s (server-rendered pages under load). Locally: API p95 41 ms, pages 145 ms. The page threshold (1.5 s)
was crossed under 50 simultaneous users on the small instance; for launch traffic it is fine, the next step if
traffic grows is a larger instance or CloudFront in front of the pages.

## Infrastructure (Terraform, `infra/terraform`)
EC2 t3a.medium + Elastic IP, RDS PostgreSQL 16 (encrypted, TLS verified with the RDS CA bundle, 7-day backups,
deletion protection), private S3 buckets per stack (`instructors/<id>/courses/<id>/…`), ECR with scan on push,
SSM Parameter Store secrets, SES domain identity with DKIM/SPF/DMARC, Route 53 records, health check and alarms →
SNS `del-marketplace-alerts`, GitHub OIDC deploy role. No geographic blocking anywhere. No Insurance Hub resource
was read for secrets, changed or deleted.

## CI/CD
`ci.yml` green on main. `release.yml`: CI → images (scan gate) → staging → **production environment approval
(owner)** → snapshot → production. Repository variables `AWS_ACCOUNT_ID`, `AWS_REGION`, `PRODUCTION_ENABLED` set.

## Confirmed
- **Stripe is in test mode** and has no keys yet (`/api/payments/mode` = off): no charge is possible. Live payments
  stay off until the owner authorises them (typed confirmation + authenticator).
- **No training videos, no courses and no local data uploaded.** Production catalogue is empty; only the DEL
  platform instructor and the super admin exist.

## Owner actions (blocked for me, by design)
1. **Sign in as Super Admin:** `support@devopseasylearning.com`, password in SSM
   `/del-marketplace/bootstrap/ADMIN_PASSWORD`; Google Authenticator is set up at the first sign-in.
2. **SES production access** (AWS console › SES › Account dashboard › Request production access). Until then emails
   reach only verified addresses. My request was refused by the permission policy.
3. **Stripe test keys:** Super Admin › Payments & Stripe; webhook `https://ai-devopseasylearning.com/api/webhooks/stripe`.
4. **Alerts:** subscribe your email to SNS topic `del-marketplace-alerts`.
5. Decide when to upload videos / publish courses on production (a separate, explicit step).
