# Media backup (owner 2026-11-28; docs/BACKUP_AND_RECOVERY.md).
# Every object written to the production media bucket is replicated to a separate, locked-down bucket in another region.
# The backup bucket is never used by the application: the app's role is explicitly denied, nothing reads it at runtime.
# Deletes are NOT replicated (delete markers stay in the primary only), versioning + Object Lock keep old copies,
# and a CloudWatch alarm on failed replication notifies the existing alerts topic.

variable "backup_region" { default = "us-west-2" }

provider "aws" {
  alias  = "backup"
  region = var.backup_region
  default_tags { tags = { App = "del-marketplace", ManagedBy = "terraform", Purpose = "backup" } }
}

locals {
  backup_bucket = "${local.name}-backup-${local.account}"
  source_bucket = aws_s3_bucket.media["production"]
}

resource "aws_s3_bucket" "backup" {
  provider            = aws.backup
  bucket              = local.backup_bucket
  force_destroy       = false
  object_lock_enabled = true
}

resource "aws_s3_bucket_public_access_block" "backup" {
  provider                = aws.backup
  bucket                  = aws_s3_bucket.backup.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "backup" {
  provider = aws.backup
  bucket   = aws_s3_bucket.backup.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_versioning" "backup" {
  provider = aws.backup
  bucket   = aws_s3_bucket.backup.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup" {
  provider = aws.backup
  bucket   = aws_s3_bucket.backup.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
    bucket_key_enabled = true
  }
}

# Every version is protected for 30 days, even from admins without the bypass permission (GOVERNANCE mode).
resource "aws_s3_bucket_object_lock_configuration" "backup" {
  provider   = aws.backup
  bucket     = aws_s3_bucket.backup.id
  depends_on = [aws_s3_bucket_versioning.backup]
  rule {
    default_retention {
      mode = "GOVERNANCE"
      days = 30
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  provider   = aws.backup
  bucket     = aws_s3_bucket.backup.id
  depends_on = [aws_s3_bucket_versioning.backup]
  rule {
    id     = "infrequent-access"
    status = "Enabled"
    filter {}
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
    noncurrent_version_expiration { noncurrent_days = 365 }
    abort_incomplete_multipart_upload { days_after_initiation = 3 }
  }
  rule {
    id     = "temporary-uploads"
    status = "Enabled"
    filter { prefix = "temporary-uploads/" }
    expiration { days = 35 }
  }
}

# The application's role can never touch the backup; only TLS; only the replication role and account admins.
data "aws_iam_policy_document" "backup_bucket" {
  statement {
    sid       = "DenyApplicationRole"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.backup.arn, "${aws_s3_bucket.backup.arn}/*"]
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.app.arn]
    }
  }
  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.backup.arn, "${aws_s3_bucket.backup.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
  statement {
    sid       = "DenyDeleteExceptAdmins"
    effect    = "Deny"
    actions   = ["s3:DeleteObject", "s3:DeleteObjectVersion", "s3:PutLifecycleConfiguration", "s3:DeleteBucket", "s3:PutBucketVersioning", "s3:BypassGovernanceRetention"]
    resources = [aws_s3_bucket.backup.arn, "${aws_s3_bucket.backup.arn}/*"]
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.s3_replication.arn, aws_iam_role.gh_deploy.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "backup" {
  provider   = aws.backup
  bucket     = aws_s3_bucket.backup.id
  policy     = data.aws_iam_policy_document.backup_bucket.json
  depends_on = [aws_s3_bucket_public_access_block.backup]
}

# ---------- replication role (used only by S3) ----------
data "aws_iam_policy_document" "s3_replication_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["s3.amazonaws.com", "batchoperations.s3.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "s3_replication" {
  name               = "${local.name}-media-backup-replication"
  assume_role_policy = data.aws_iam_policy_document.s3_replication_assume.json
}

data "aws_iam_policy_document" "s3_replication" {
  statement {
    actions   = ["s3:GetReplicationConfiguration", "s3:ListBucket", "s3:PutInventoryConfiguration"]
    resources = [local.source_bucket.arn]
  }
  statement {
    actions   = ["s3:GetObjectVersionForReplication", "s3:GetObjectVersionAcl", "s3:GetObjectVersionTagging", "s3:GetObjectRetention", "s3:GetObjectLegalHold", "s3:InitiateReplication", "s3:GetObject", "s3:GetObjectVersion"]
    resources = ["${local.source_bucket.arn}/*"]
  }
  # Replicate objects and tags; never ReplicateDelete.
  statement {
    actions   = ["s3:ReplicateObject", "s3:ReplicateTags", "s3:ObjectOwnerOverrideToBucketOwner"]
    resources = ["${aws_s3_bucket.backup.arn}/*"]
  }
}

resource "aws_iam_role_policy" "s3_replication" {
  role   = aws_iam_role.s3_replication.id
  policy = data.aws_iam_policy_document.s3_replication.json
}

resource "aws_s3_bucket_replication_configuration" "media_backup" {
  bucket     = local.source_bucket.id
  role       = aws_iam_role.s3_replication.arn
  depends_on = [aws_s3_bucket_versioning.media, aws_s3_bucket_versioning.backup, aws_s3_bucket_policy.backup]
  rule {
    id       = "media-to-backup"
    status   = "Enabled"
    priority = 1
    filter {}
    delete_marker_replication { status = "Disabled" }
    destination {
      bucket        = aws_s3_bucket.backup.arn
      storage_class = "STANDARD"
      metrics {
        status = "Enabled"
        event_threshold { minutes = 15 }
      }
      replication_time {
        status = "Enabled"
        time { minutes = 15 }
      }
    }
  }
}

# ---------- monitoring ----------
resource "aws_cloudwatch_metric_alarm" "media_backup_failed" {
  alarm_name          = "${local.name}-media-backup-failed-replication"
  alarm_description   = "Objects failed to replicate from the production media bucket to the backup bucket (docs/BACKUP_AND_RECOVERY.md)."
  namespace           = "AWS/S3"
  metric_name         = "OperationsFailedReplication"
  dimensions          = { SourceBucket = local.source_bucket.id, DestinationBucket = aws_s3_bucket.backup.id, RuleId = "media-to-backup" }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "media_backup_lagging" {
  alarm_name          = "${local.name}-media-backup-replication-lag"
  alarm_description   = "Replication to the backup bucket is more than 30 minutes behind."
  namespace           = "AWS/S3"
  metric_name         = "ReplicationLatency"
  dimensions          = { SourceBucket = local.source_bucket.id, DestinationBucket = aws_s3_bucket.backup.id, RuleId = "media-to-backup" }
  statistic           = "Maximum"
  period              = 900
  evaluation_periods  = 2
  threshold           = 1800
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

output "media_backup_bucket" { value = aws_s3_bucket.backup.id }
output "media_backup_region" { value = var.backup_region }
