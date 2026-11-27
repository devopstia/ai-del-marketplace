# Azure mirror of the GitHub Actions lesson: OIDC (workload identity federation), no client secret stored in GitHub.
# Two user-assigned managed identities: "plan" (Reader + state) for pull requests, "apply" (Contributor on one resource
# group + state) only for the approved "production" environment.

variable "github_repository" {
  description = "owner/repo allowed to sign in."
  type        = string
}

variable "state_storage_account_id" {
  description = "Resource id of the state storage account from ../../terraform-remote-state/bootstrap."
  type        = string
}

resource "azurerm_resource_group" "ci" {
  name     = "rg-del-training-ci"
  location = var.location
  tags     = local.tags
}

resource "azurerm_resource_group" "target" {
  name     = "rg-del-training-ci-target"
  location = var.location
  tags     = local.tags
}

resource "azurerm_user_assigned_identity" "plan" {
  name                = "id-del-gha-plan"
  location            = azurerm_resource_group.ci.location
  resource_group_name = azurerm_resource_group.ci.name
}

resource "azurerm_user_assigned_identity" "apply" {
  name                = "id-del-gha-apply"
  location            = azurerm_resource_group.ci.location
  resource_group_name = azurerm_resource_group.ci.name
}

resource "azurerm_federated_identity_credential" "plan_pr" {
  name                      = "github-pull-request"
  user_assigned_identity_id = azurerm_user_assigned_identity.plan.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_repository}:pull_request"
}

resource "azurerm_federated_identity_credential" "apply_prod" {
  name                      = "github-production-environment"
  user_assigned_identity_id = azurerm_user_assigned_identity.apply.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_repository}:environment:production"
}

resource "azurerm_role_assignment" "plan_reader" {
  scope                = azurerm_resource_group.target.id
  role_definition_name = "Reader"
  principal_id         = azurerm_user_assigned_identity.plan.principal_id
}

resource "azurerm_role_assignment" "apply_contributor" {
  scope                = azurerm_resource_group.target.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.apply.principal_id
}

# Both need the state blob (plan takes the lease lock).
resource "azurerm_role_assignment" "state" {
  for_each             = { plan = azurerm_user_assigned_identity.plan.principal_id, apply = azurerm_user_assigned_identity.apply.principal_id }
  scope                = var.state_storage_account_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value
}

data "azurerm_client_config" "current" {}

output "github_variables" {
  description = "Set these as repository variables."
  value = {
    AZURE_TENANT_ID       = data.azurerm_client_config.current.tenant_id
    AZURE_SUBSCRIPTION_ID = var.subscription_id
    AZURE_PLAN_CLIENT_ID  = azurerm_user_assigned_identity.plan.client_id
    AZURE_APPLY_CLIENT_ID = azurerm_user_assigned_identity.apply.client_id
  }
}
