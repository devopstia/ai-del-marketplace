# AWS operating costs (estimate, 2026-11-25)

The estimate is based on the resources actually provisioned (checked with the AWS CLI on 2026-11-25, not from a template),
priced with AWS on-demand list prices for **us-east-1** in USD. AWS changes prices from time to time, so **check the
real bill in Cost Explorer** after the first full month. All marketplace resources are tagged `App=del-marketplace`.

## What is running

| Resource | Actual configuration |
| --- | --- |
| Server (runs production **and** staging) | 1 × EC2 `t3a.medium` (2 vCPU, 4 GiB), us-east-1a, CPU credits "unlimited" |
| Server disk | 1 × EBS gp3 40 GB (3,000 IOPS / 125 MB/s, the free baseline) |
| Public address | 1 Elastic IP (public IPv4) |
| Database | RDS PostgreSQL 16 `db.t4g.micro`, single-AZ, 20 GB gp3 (autoscaling to 100 GB), 7-day backups, 1 manual snapshot |
| Files | S3: production 0 objects, staging 31 MB, Terraform state 0.2 MB |
| Container images | ECR: api 1.5 GB (4 images), web 0.5 GB; lifecycle keeps the last 20 |
| DNS | Route 53 hosted zone `ai-devopseasylearning.com` (10 records); 1 HTTPS health check (30 s) |
| Monitoring | 5 CloudWatch alarms, SNS topic `del-marketplace-alerts`; no CloudWatch Logs (container logs stay on the server) |
| Secrets | 50 SSM Parameter Store standard parameters (SecureString, AWS-managed key) |
| Email | Amazon SES, domain identity with DKIM (sandbox: 200 emails/day until production access) |
| Not used | **No** load balancer, CloudFront, NAT gateway, Secrets Manager or customer-managed KMS keys |

## Fixed monthly cost (no traffic)

| Service | Calculation | Per month |
| --- | --- | ---: |
| EC2 t3a.medium | $0.0376/h × 730 h | $27.45 |
| EBS gp3 40 GB | $0.08/GB | $3.20 |
| Public IPv4 address | $0.005/h × 730 h | $3.65 |
| RDS db.t4g.micro | $0.016/h × 730 h | $11.68 |
| RDS storage 20 GB gp3 | $0.115/GB | $2.30 |
| RDS backups / snapshots | free up to the database size (20 GB) | $0.00 |
| Route 53 hosted zone | $0.50/zone | $0.50 |
| Route 53 health check | $0.50 + $1.00 for HTTPS | $1.50 |
| CloudWatch alarms | 5 × $0.10 | $0.50 |
| ECR storage | ~2 GB now, up to ~9 GB at the 20-image limit, $0.10/GB | $0.20–0.90 |
| S3 storage + requests | well under 1 GB today | < $0.10 |
| SSM Parameter Store (standard), AWS-managed KMS key, SNS email | free tiers | $0.00 |
| Load balancer, CloudFront, NAT, Secrets Manager | not provisioned | $0.00 |
| **Total fixed** | | **≈ $51–52 / month ≈ $615–625 / year** |

Staging costs nothing extra: it shares the server and the database instance (separate database and bucket).

## Usage-dependent costs

| Item | Price | Notes |
| --- | --- | --- |
| Data sent to visitors (pages, API, video) | first 100 GB/month free **per AWS account**, then $0.09/GB | The free 100 GB is shared with Insurance Knowledge Hub (same account). |
| **Video streaming** (once videos are uploaded) | same $0.09/GB from the server/S3 | 1 hour of video ≈ 1–3 GB (720p–1080p). Examples: 100 learners × 10 h ≈ 1–3 TB ≈ **$90–270/month**; 1,000 learners × 10 h ≈ 10–30 TB ≈ **$900–2,700/month**. |
| S3 video storage | $0.023/GB-month | 100 h of course video (several renditions) ≈ 150–300 GB ≈ $3.50–7/month. |
| Email (SES) | $0.10 per 1,000 emails | 10,000 emails ≈ $1. |
| EC2 / RDS CPU above baseline | t3a/t4g "unlimited": $0.05 per vCPU-hour above the 20% baseline | Only under sustained load (the 50-user load test did not run long enough to matter). |
| Database growth | $0.115/GB-month beyond 20 GB | Storage autoscaling up to 100 GB. |
| EC2 ↔ RDS traffic | $0.01/GB each way (server in 1a, database in 1d) | Cents per month at current volume. |
| Route 53 DNS queries | $0.40 per million | Cents. |
| Stripe (not AWS) | about 2.9% + $0.30 per card payment, plus international/conversion fees and Connect payout fees | Starts only with real payments. |

## Shared with Insurance Knowledge Hub

Nothing is billed twice and no Hub resource was changed. What is shared:

- **The AWS account and bill.** Marketplace costs show up on the same invoice. To see them separately, activate the cost
  allocation tag `App` in Billing › Cost allocation tags; Cost Explorer can then filter `App = del-marketplace`.
- **Free tiers that are account-wide:** the 100 GB/month of free data transfer and the SES sending quota are shared by both sites.
- **Free building blocks:** the default VPC and the GitHub OIDC identity provider (no charge).
- Separate and not shared: server, database, buckets, images, DNS zone, health check, alarms, secrets, email identity.

## Recommended optimisations (no loss of security or reliability)

1. **Budget alert:** an AWS Budget at about $75/month that emails the owner (can be added to Terraform).
2. **Commit for a year once traffic is steady:** a 1-year Compute Savings Plan or reserved instance for the server and a
   reserved RDS instance cut those two lines by roughly 30–40% (about $39 → $25/month). Only worth it once the size is right.
3. **Serve videos through CloudFront when they go live:** CloudFront includes 1 TB/month of free data transfer out and
   offloads the server; above that it costs about the same per GB as direct transfer. Alternatively Mux, which charges for
   encoding and streaming instead. Decide before uploading videos.
4. **Keep the server size:** the t3a.medium was at about 1.5 GB memory used of 4 GB with both stacks running. If staging is
   turned off permanently, a t3a.small (~$14/month) may be enough; test under load first.
5. **Leave in place:** RDS backups and deletion protection, the health check and alarms. They cost little and prevent data loss
   or unnoticed outages.

Actual charges vary with traffic, video hours watched, storage, email volume and AWS price changes.
