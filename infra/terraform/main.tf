data "aws_caller_identity" "me" {}
data "aws_vpc" "default" { default = true }
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}
data "aws_route53_zone" "site" { name = var.domain }
data "aws_ssm_parameter" "al2023" { name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" }

locals {
  name    = "del-marketplace"
  account = data.aws_caller_identity.me.account_id
  stacks  = { production = var.domain, staging = var.staging_host }
}

# ---------------- storage ----------------
resource "aws_s3_bucket" "media" {
  for_each      = local.stacks
  bucket        = "${local.name}-${each.key}-${local.account}"
  force_destroy = false
}
resource "aws_s3_bucket_public_access_block" "media" {
  for_each                = aws_s3_bucket.media
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_ownership_controls" "media" {
  for_each = aws_s3_bucket.media
  bucket   = each.value.id
  rule { object_ownership = "BucketOwnerEnforced" }
}
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  for_each = aws_s3_bucket.media
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}
resource "aws_s3_bucket_versioning" "media" {
  for_each = aws_s3_bucket.media
  bucket   = each.value.id
  versioning_configuration { status = each.key == "production" ? "Enabled" : "Suspended" }
}
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  for_each = aws_s3_bucket.media
  bucket   = each.value.id
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 3 }
  }
  rule {
    id     = "temporary-uploads"
    status = "Enabled"
    filter { prefix = "temporary-uploads/" }
    expiration { days = 7 }
  }
  rule {
    id     = "old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}
resource "aws_s3_bucket_cors_configuration" "media" {
  for_each = aws_s3_bucket.media
  bucket   = each.value.id
  cors_rule {
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = ["https://${local.stacks[each.key]}"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# ---------------- images ----------------
resource "aws_ecr_repository" "app" {
  for_each             = toset(["api", "web"])
  name                 = "${local.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE" # a version is never overwritten (owner 2026-11-25); rollback = redeploy an older tag
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}
resource "aws_ecr_lifecycle_policy" "app" {
  for_each   = aws_ecr_repository.app
  repository = each.value.name
  policy     = jsonencode({ rules = [{ rulePriority = 1, description = "keep the 20 newest images", selection = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }, action = { type = "expire" } }] })
}

# ---------------- network ----------------
resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "Marketplace web server: HTTP and HTTPS from everywhere (no geographic rules). No SSH: access through SSM."
  vpc_id      = data.aws_vpc.default.id
  ingress {
    description      = "HTTP (redirects to HTTPS)"
    from_port        = 80
    to_port          = 80
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
  ingress {
    description      = "HTTPS"
    from_port        = 443
    to_port          = 443
    protocol         = "tcp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
  ingress {
    description      = "HTTP/3"
    from_port        = 443
    to_port          = 443
    protocol         = "udp"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}
resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "Marketplace database: PostgreSQL from the marketplace server only"
  vpc_id      = data.aws_vpc.default.id
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
}

# ---------------- database ----------------
resource "random_password" "db" {
  length  = 32
  special = false
}
resource "aws_db_subnet_group" "db" {
  name       = "${local.name}-db"
  subnet_ids = data.aws_subnets.default.ids
}
resource "aws_db_instance" "db" {
  identifier                   = "${local.name}-rds"
  engine                       = "postgres"
  engine_version               = "16"
  instance_class               = var.db_instance_class
  allocated_storage            = 20
  max_allocated_storage        = 100
  storage_type                 = "gp3"
  storage_encrypted            = true
  db_name                      = "marketplace"
  username                     = "delmarket"
  password                     = random_password.db.result
  db_subnet_group_name         = aws_db_subnet_group.db.name
  vpc_security_group_ids       = [aws_security_group.db.id]
  publicly_accessible          = false
  backup_retention_period      = 7
  backup_window                = "03:00-04:00"
  maintenance_window           = "sun:04:30-sun:05:30"
  deletion_protection          = true
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${local.name}-final"
  auto_minor_version_upgrade   = true
  performance_insights_enabled = false
  copy_tags_to_snapshot        = true
}
