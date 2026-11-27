# The stack the pipeline deploys: deliberately tiny and free.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {}
}

provider "aws" {
  region = "us-east-1"
  default_tags {
    tags = {
      Course    = "terraform-aws-masterclass"
      Lesson    = "github-actions-oidc"
      ManagedBy = "terraform"
    }
  }
}

variable "message" {
  type    = string
  default = "deployed by GitHub Actions"
}

resource "aws_ssm_parameter" "release" {
  name  = "/del-training/ci/release"
  type  = "String"
  value = var.message
}
