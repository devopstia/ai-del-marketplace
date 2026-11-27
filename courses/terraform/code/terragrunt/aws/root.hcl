# Root configuration for every AWS unit (live tree and stacks).
# Updated from the owner's aws-terraform/terragrunt/live/<env>/terragrunt.hcl (deck slides 578–579):
# - the file is root.hcl (Terragrunt 1.x) and units include it with find_in_parent_folders("root.hcl");
# - S3 native locking (use_lockfile) replaces the DynamoDB lock table;
# - the provider is generated once here, with the account guard and the deploy role per environment.
# The owner's common.yaml convention (assetid, environment, project) is kept.

locals {
  common = yamldecode(file(find_in_parent_folders("common.yaml")))
  name   = "${local.common.assetid}-${local.common.environment}-${local.common.project}"
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket       = "${local.common.assetid}-${local.common.project}-tfstate-${local.common.account_id}"
    key          = "${local.common.environment}/${path_relative_to_include()}/terraform.tfstate"
    region       = local.common.region
    encrypt      = true
    use_lockfile = true
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOT
    provider "aws" {
      region              = "${local.common.region}"
      allowed_account_ids = ["${local.common.account_id}"]
      assume_role {
        role_arn = "${local.common.deploy_role_arn}"
      }
      default_tags {
        tags = {
          Course      = "terragrunt-aws"
          Environment = "${local.common.environment}"
          ManagedBy   = "terragrunt"
        }
      }
    }
  EOT
}

inputs = {
  name = local.name
}
