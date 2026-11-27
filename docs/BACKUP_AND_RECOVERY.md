# Media backup and recovery (owner 2026-11-28)

Every file the platform stores (videos and their HLS segments, PDFs, lab ZIPs, covers, images, captions, receipts…) is
copied to a separate backup bucket. Terraform: `infra/terraform/backup.tf`.

| | Primary (website) | Backup |
|---|---|---|
| Bucket | `del-marketplace-production-788210522308` | `del-marketplace-backup-788210522308` |
| Region | us-east-1 | **us-west-2** (survives a regional outage) |
| Used by the website | yes | **never** (the app role is explicitly denied every action) |
| Versioning | on | on |
| Encryption | SSE-S3 | SSE-S3 (bucket key) |
| Delete protection | – | **Object Lock GOVERNANCE, 30 days** on every version; deletes in the primary are **not** replicated |
| Storage | Standard | Standard, then Standard-IA after 30 days; old versions kept 365 days |

## How copies happen
- **New and changed files:** S3 Replication rule `media-to-backup` on the primary (one way, primary → backup), with
  Replication Time Control (most objects within 15 minutes). Delete-marker replication is **off**, so deleting or
  overwriting a file in the primary never removes the backup copy (the old version stays in the backup).
- **Existing files at go-live (2026-11-28):** copied once with `aws s3 sync` (server-side copy).
- **Role:** `del-marketplace-media-backup-replication`, assumed only by S3; it can read primary versions and write
  replicas, and cannot delete anything in the backup. The deploy role and the replication role are explicitly denied
  deletes, lifecycle and versioning changes on the backup.

## Monitoring
- CloudWatch alarm `del-marketplace-media-backup-failed-replication`: any failed replication in 5 minutes.
- CloudWatch alarm `del-marketplace-media-backup-replication-lag`: replication more than 30 minutes behind.
- Both notify the SNS topic `del-marketplace-alerts` (subscribe the owner's email there if not yet done).
- Spot check: `aws s3api head-object --bucket del-marketplace-production-788210522308 --key <key> --query ReplicationStatus` → `COMPLETED`.

## Recovery (tested 2026-11-28)
Use an admin profile; the website's role cannot read the backup.

**One file deleted or damaged in the primary**
```bash
aws s3 cp "s3://del-marketplace-backup-788210522308/<key>" "s3://del-marketplace-production-788210522308/<key>" \
  --source-region us-west-2 --region us-east-1
```
**An earlier version of a file** (e.g. overwritten by mistake)
```bash
aws s3api list-object-versions --bucket del-marketplace-backup-788210522308 --prefix "<key>" --region us-west-2
aws s3api copy-object --copy-source "del-marketplace-backup-788210522308/<key>?versionId=<id>" \
  --bucket del-marketplace-production-788210522308 --key "<key>"
```
**A folder (a course, an instructor)**
```bash
aws s3 sync "s3://del-marketplace-backup-788210522308/instructors/<id>/courses/<courseId>/" \
  "s3://del-marketplace-production-788210522308/instructors/<id>/courses/<courseId>/" --source-region us-west-2 --region us-east-1
```
**Everything (primary bucket lost)**
1. Recreate the primary with Terraform (`terraform apply` in `infra/terraform`; the bucket name is fixed).
2. `aws s3 sync s3://del-marketplace-backup-788210522308 s3://del-marketplace-production-788210522308 --source-region us-west-2 --region us-east-1`
3. Check: open a course, play a video, download a PDF and a ZIP, open a certificate.
The database (RDS, with its own snapshots) holds the storage keys, so restored files are found again without changes.

## Rules
- Never point the application at the backup bucket. Never give the app role access.
- Deleting a backup early needs `s3:BypassGovernanceRetention` by an account admin and a written reason.
- Changes to `backup.tf` are reviewed like any other infrastructure change.
