# Root configuration for every Azure unit (mirror of ../aws/root.hcl).
# State in an Azure Storage container (lease locking built in), Entra ID auth, one subscription per environment.
locals {
  common = yamldecode(file(find_in_parent_folders("common.yaml")))
  name   = "${local.common.assetid}-${local.common.environment}-${local.common.project}"
}

remote_state {
  backend = "azurerm"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    resource_group_name  = local.common.state_resource_group
    storage_account_name = local.common.state_storage_account
    container_name       = "tfstate"
    key                  = "${local.common.environment}/${path_relative_to_include()}/terraform.tfstate"
    use_azuread_auth     = true
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<-EOT
    provider "azurerm" {
      features {}
      subscription_id = "${local.common.subscription_id}"
    }
  EOT
}

inputs = {
  name     = local.name
  location = local.common.location
  tags = {
    Course      = "terragrunt-azure"
    Environment = local.common.environment
    ManagedBy   = "terragrunt"
  }
}
