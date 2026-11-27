provider "aws" {
  region = var.aws_region
}

## Terraform block
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = "~> 3.0"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}
