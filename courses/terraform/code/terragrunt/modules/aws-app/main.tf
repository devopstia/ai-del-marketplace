# The "app" unit: a security group in the network unit's VPC and an SSM parameter recording the release.
# Free resources, so dev, staging and production can all be applied in a lesson.
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
}

variable "vpc_id" {
  type = string
}

variable "allowed_cidr" {
  description = "Who may reach the app on 443 (your IP /32 in a lab)."
  type        = string
}

variable "release" {
  type    = string
  default = "v1"
}

resource "aws_security_group" "app" {
  name        = "${var.name}-app"
  description = "App access (Terragrunt course)"
  vpc_id      = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = var.allowed_cidr
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_ssm_parameter" "release" {
  name  = "/del-training/terragrunt/${var.name}/release"
  type  = "String"
  value = var.release
}

output "security_group_id" {
  value = aws_security_group.app.id
}
