# Azure mirror: a generated password written to Key Vault with a write-only argument.
# It reaches Key Vault but never the plan or the state file.

variable "secret_version" {
  description = "Increase by 1 to rotate."
  type        = number
  default     = 1
}

data "azurerm_client_config" "current" {}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "azurerm_resource_group" "this" {
  name     = "rg-del-training-ephemeral"
  location = var.location
  tags     = local.tags
}

resource "azurerm_key_vault" "this" {
  name                       = "kv-del-eph-${random_string.suffix.result}"
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = false # training: lets destroy purge the vault
  soft_delete_retention_days = 7
  tags                       = local.tags
}

resource "azurerm_role_assignment" "me" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

ephemeral "random_password" "db" {
  length  = 24
  special = true
}

resource "azurerm_key_vault_secret" "db_password" {
  name             = "db-password"
  key_vault_id     = azurerm_key_vault.this.id
  value_wo         = ephemeral.random_password.db.result
  value_wo_version = var.secret_version
  depends_on       = [azurerm_role_assignment.me]
}
