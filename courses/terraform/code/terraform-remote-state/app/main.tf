# A tiny resource stored in the remote state, to show locking and versioning.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Partial configuration: the values come from backend.hcl (terraform init -backend-config=backend.hcl),
  # so the same code works for every student's bucket.
  backend "s3" {}
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

variable "region" {
  type    = string
  default = "us-east-1"
}

# An SSM parameter costs nothing (standard tier) and is easy to see in the console.
resource "aws_ssm_parameter" "hello" {
  name  = "/del-training/remote-state/hello"
  type  = "String"
  value = "stored in remote state"
}

output "parameter_name" {
  value = aws_ssm_parameter.hello.name
}
