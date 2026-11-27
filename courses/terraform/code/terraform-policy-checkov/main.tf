# New lesson: policy as code as the guardrail for any code, including AI-generated code.
# This bucket is deliberately weak (the kind of code an AI assistant often writes from a short prompt).
# Run Checkov, read the findings, then fix them the way ../terraform-remote-state/bootstrap does.

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
  region = "us-east-1"
}

resource "aws_s3_bucket" "reports" {
  bucket = "del-training-reports-example"
}

resource "aws_s3_bucket_public_access_block" "reports" {
  bucket                  = aws_s3_bucket.reports.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}
