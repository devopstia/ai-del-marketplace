# ---------------- GitHub Actions (OIDC; the account's provider already exists for Insurance Hub and is only read) ----------------
data "aws_iam_openid_connect_provider" "github" { url = "https://token.actions.githubusercontent.com" }

data "aws_iam_policy_document" "gh_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main", "repo:${var.github_repo}:environment:production", "repo:${var.github_repo}:environment:staging"]
    }
  }
}
resource "aws_iam_role" "gh_deploy" {
  name               = "${local.name}-gh-deploy"
  assume_role_policy = data.aws_iam_policy_document.gh_trust.json
}
data "aws_iam_policy_document" "gh_deploy" {
  statement {
    sid       = "PushImages"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions   = ["ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart", "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage", "ecr:DescribeImages", "ecr:DescribeImageScanFindings"]
    resources = [for r in aws_ecr_repository.app : r.arn]
  }
  statement {
    sid       = "ReleaseThroughSSM"
    actions   = ["ssm:SendCommand"]
    resources = [aws_instance.app.arn, "arn:aws:ssm:${var.region}::document/AWS-RunShellScript"]
  }
  statement {
    actions   = ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ec2:DescribeInstances"]
    resources = ["*"]
  }
  statement {
    sid       = "SnapshotBeforeRelease"
    actions   = ["rds:CreateDBSnapshot", "rds:DescribeDBSnapshots", "rds:DeleteDBSnapshot", "rds:AddTagsToResource"]
    resources = [aws_db_instance.db.arn, "arn:aws:rds:${var.region}:${local.account}:snapshot:pre-release-*"]
  }
  statement {
    actions   = ["rds:DescribeDBSnapshots"]
    resources = ["*"]
  }
  statement {
    actions   = ["ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.region}:${local.account}:parameter/${local.name}/*/PUBLIC_HOST"]
  }
}
resource "aws_iam_role_policy" "gh_deploy" {
  role   = aws_iam_role.gh_deploy.id
  policy = data.aws_iam_policy_document.gh_deploy.json
}

# ---------------- monitoring (like the Hub: health check + alarms; subscribe an email to the topic in the console) ----------------
resource "aws_sns_topic" "alerts" { name = "${local.name}-alerts" }
resource "aws_route53_health_check" "site" {
  fqdn              = var.domain
  type              = "HTTPS"
  resource_path     = "/api/health"
  port              = 443
  failure_threshold = 3
  request_interval  = 30
  tags              = { Name = "${local.name}-site" }
}
resource "aws_cloudwatch_metric_alarm" "site_down" {
  alarm_name          = "${local.name}-site-down"
  namespace           = "AWS/Route53"
  metric_name         = "HealthCheckStatus"
  dimensions          = { HealthCheckId = aws_route53_health_check.site.id }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_metric_alarm" "ec2_status" {
  alarm_name          = "${local.name}-instance-status"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn, "arn:aws:automate:${var.region}:ec2:recover"]
}
resource "aws_cloudwatch_metric_alarm" "ec2_cpu" {
  alarm_name          = "${local.name}-cpu-high"
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  alarm_name          = "${local.name}-db-storage-low"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.db.identifier }
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2000000000
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name}-db-cpu-high"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.db.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

output "instance_id" { value = aws_instance.app.id }
output "public_ip" { value = aws_eip.app.public_ip }
output "ecr_registry" { value = "${local.account}.dkr.ecr.${var.region}.amazonaws.com" }
output "db_endpoint" { value = aws_db_instance.db.address }
output "buckets" { value = { for k, b in aws_s3_bucket.media : k => b.bucket } }
output "gh_deploy_role" { value = aws_iam_role.gh_deploy.arn }
