# ---------------- server ----------------
data "aws_iam_policy_document" "ec2_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}
resource "aws_iam_role" "app" {
  name               = "${local.name}-app"
  assume_role_policy = data.aws_iam_policy_document.ec2_trust.json
}
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}
data "aws_iam_policy_document" "app" {
  statement {
    sid       = "MediaBuckets"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetBucketLocation", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"]
    resources = flatten([for b in aws_s3_bucket.media : [b.arn, "${b.arn}/*"]])
  }
  statement {
    sid       = "AppSecrets"
    actions   = ["ssm:GetParametersByPath", "ssm:GetParameter", "ssm:GetParameters"]
    resources = ["arn:aws:ssm:${var.region}:${local.account}:parameter/${local.name}/*"]
  }
  statement {
    sid       = "PullImages"
    actions   = ["ecr:GetAuthorizationToken", "ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer", "ecr:BatchCheckLayerAvailability"]
    resources = ["*"]
  }
  statement {
    sid       = "SendEmail"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]
    condition {
      test     = "StringLike"
      variable = "ses:FromAddress"
      values   = ["*@${var.domain}"]
    }
  }
}
resource "aws_iam_role_policy" "app" {
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app.json
}
resource "aws_iam_instance_profile" "app" {
  name = "${local.name}-app"
  role = aws_iam_role.app.name
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }
  root_block_device {
    volume_size = 40
    volume_type = "gp3"
    encrypted   = true
  }
  user_data = <<-SH
    #!/bin/bash
    set -eux
    dnf install -y docker
    systemctl enable --now docker
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -fsSL "https://github.com/docker/compose/releases/download/v2.32.1/docker-compose-linux-x86_64" -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
    mkdir -p /srv/del-marketplace && chmod 700 /srv/del-marketplace
    docker network create edge || true
  SH
  lifecycle { ignore_changes = [ami, user_data] }
  tags = { Name = "${local.name}-app" }
}
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"
  tags     = { Name = "${local.name}-app" }
}

# ---------------- DNS (records in the existing ai-devopseasylearning.com zone only) ----------------
resource "aws_route53_record" "apex" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = var.domain
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}
resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = "www.${var.domain}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}
resource "aws_route53_record" "staging" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = var.staging_host
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

# ---------------- email: Amazon SES for the marketplace's own domain ----------------
resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain
}
resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = data.aws_route53_zone.site.zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}
resource "aws_route53_record" "spf" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}
resource "aws_route53_record" "dmarc" {
  zone_id = data.aws_route53_zone.site.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=none; adkim=r; aspf=r"]
}
