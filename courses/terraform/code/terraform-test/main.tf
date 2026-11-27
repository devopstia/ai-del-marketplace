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

module "site" {
  source      = "./modules/s3-site"
  name        = "help-site"
  environment = "dev"
}

output "bucket_name" {
  value = module.site.bucket_name
}
