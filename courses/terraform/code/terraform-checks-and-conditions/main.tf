# New lesson: validation, preconditions, postconditions and check blocks.
# Extends the owner's "Resource Validation" (deck slides 366–371), which covers variable validation only.

terraform {
  required_version = ">= 1.11.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = {
      Course    = "terraform-aws-masterclass"
      Lesson    = "checks-and-conditions"
      ManagedBy = "terraform"
    }
  }
}

variable "region" {
  type    = string
  default = "us-east-1"
}

# 1. Variable validation: wrong input stops the plan before anything is called.
variable "environment" {
  type    = string
  default = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging or prod."
  }
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

data "aws_ec2_instance_type" "chosen" {
  instance_type = var.instance_type
}

data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# 2. Precondition: a rule about the world before Terraform creates the resource.
# 3. Postcondition: a promise about the result after it is created.
# Only planned here (count = 0 by default) so the lesson costs nothing; set create_instance = true to see them run.
variable "create_instance" {
  type    = bool
  default = false
}

resource "aws_instance" "web" {
  count         = var.create_instance ? 1 : 0
  ami           = data.aws_ssm_parameter.al2023.value
  instance_type = var.instance_type

  metadata_options {
    http_tokens = "required" # IMDSv2 only
  }

  lifecycle {
    precondition {
      condition     = data.aws_ec2_instance_type.chosen.free_tier_eligible || var.environment == "prod"
      error_message = "Outside prod, use a free-tier eligible instance type (training budget)."
    }
    postcondition {
      condition     = self.metadata_options[0].http_tokens == "required"
      error_message = "The instance must require IMDSv2."
    }
  }
}

# 4. Check block: a health check that warns but never blocks the apply.
check "course_site_is_up" {
  data "http" "site" {
    url = "https://www.devopseasylearning.com"
  }
  assert {
    condition     = data.http.site.status_code == 200
    error_message = "The site answered ${data.http.site.status_code}."
  }
}
