# Improved version of the owner's exercise aws-terraform/terraform-concepts/terraform-import
# (deck slides 423–428: create resources by hand, then bring them under Terraform).
# The owner's version uses the `terraform import` command; this one adds the import block (Terraform >= 1.5),
# which is planned and reviewed like any change, and can generate the configuration for you.

variable "imported_user_name" {
  description = "Name of the IAM user you created by hand in the console."
  type        = string
  default     = "del-import-demo"
}

import {
  to = aws_iam_user.manual
  id = var.imported_user_name
}

# Written by hand here. Alternatively delete this block and run:
#   terraform plan -generate-config-out=generated.tf
# then review and tidy generated.tf (Terraform writes every attribute it found).
resource "aws_iam_user" "manual" {
  name = var.imported_user_name
}
