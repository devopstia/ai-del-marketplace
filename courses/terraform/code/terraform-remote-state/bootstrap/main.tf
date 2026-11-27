# Improved version of the owner's exercise aws-terraform/terraform-concepts/terraform-remote-state
# (same lesson, same idea: create the state bucket first, then use it as a backend).
# What changed (2026): S3 native state locking (use_lockfile) instead of a DynamoDB table,
# AWS provider v6, versioning + encryption + public access block on the state bucket.

terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Course    = "terraform-aws-masterclass"
      Lesson    = "remote-state"
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  # Bucket names are global: the account id keeps them unique.
  bucket_name = "${var.name_prefix}-tfstate-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "state" {
  bucket = local.bucket_name
  # Training only: lets `terraform destroy` empty the bucket. Never in a real state bucket.
  force_destroy = var.allow_destroy
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
