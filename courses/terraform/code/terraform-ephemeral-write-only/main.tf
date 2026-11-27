# New lesson: keep secrets out of the state file.
# The owner's repo has passwords written in .tf files (e.g. terraform-local-state/main.tf) and the deck shows that
# the state stores every value. Ephemeral resources (Terraform >= 1.10) and write-only arguments (>= 1.11) fix that:
# the generated password is sent to AWS but never written to the plan or the state.

terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Course    = "terraform-aws-masterclass"
      Lesson    = "ephemeral-write-only"
      ManagedBy = "terraform"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "secret_version" {
  description = "Increase by 1 to rotate the password (Terraform cannot see write-only values, so it watches this number)."
  type        = number
  default     = 1
}

ephemeral "random_password" "db" {
  length  = 24
  special = true
}

# A SecureString parameter (free standard tier) stands in for a database password.
# The same pattern works for aws_db_instance.password_wo and aws_secretsmanager_secret_version.secret_string_wo.
resource "aws_ssm_parameter" "db_password" {
  name             = "/del-training/ephemeral/db-password"
  type             = "SecureString"
  value_wo         = ephemeral.random_password.db.result
  value_wo_version = var.secret_version
}

# Old way, for comparison (do not use): the password ends up in terraform.tfstate in plain text.
# resource "random_password" "db_old" { length = 24 }
# resource "aws_ssm_parameter" "db_password_old" {
#   name  = "/del-training/ephemeral/db-password-old"
#   type  = "SecureString"
#   value = random_password.db_old.result
# }

output "parameter_name" {
  value = aws_ssm_parameter.db_password.name
}
