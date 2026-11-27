# The starting point: apply this first, then copy terraform.tfstate's backend (or use the same local state)
# with the refactored ../main.tf. See README.
resource "aws_ssm_parameter" "app_name" {
  name  = "/del-training/moved/name"
  type  = "String"
  value = "billing-api"
}

resource "aws_ssm_parameter" "app_env" {
  name  = "/del-training/moved/env"
  type  = "String"
  value = "dev"
}

resource "aws_ssm_parameter" "legacy" {
  name  = "/del-training/moved/legacy"
  type  = "String"
  value = "kept in AWS after removed"
}
