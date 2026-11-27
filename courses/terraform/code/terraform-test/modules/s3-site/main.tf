# A small module under test: a private, versioned, encrypted bucket with a naming rule.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "name" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9-]{3,40}$", var.name))
    error_message = "name: 3-40 lowercase letters, numbers or hyphens."
  }
}

variable "environment" {
  type = string
}

variable "versioning" {
  type    = bool
  default = true
}

locals {
  bucket_name = "${var.environment}-${var.name}"
}

resource "aws_s3_bucket" "this" {
  bucket = local.bucket_name
  tags   = { Environment = var.environment }
}

resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = var.versioning ? "Enabled" : "Suspended"
  }
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "bucket_name" {
  value = aws_s3_bucket.this.bucket
}
