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
      Lesson    = "moved-removed"
      ManagedBy = "terraform"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

