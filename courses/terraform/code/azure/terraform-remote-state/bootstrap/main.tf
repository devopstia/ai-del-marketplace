# Azure mirror of the remote-state lesson (owner's AWS exercise: aws-terraform/terraform-concepts/terraform-remote-state;
# owner's Azure modules: azure-terraform/modules/storage-backend). State in an Azure Storage blob container.
# Locking is built in: the azurerm backend takes a blob lease, nothing extra to create (unlike DynamoDB on old AWS setups).

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "azurerm_resource_group" "state" {
  name     = "rg-del-training-tfstate"
  location = var.location
  tags     = local.tags
}

resource "azurerm_storage_account" "state" {
  name                            = "deltfstate${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.state.name
  location                        = azurerm_resource_group.state.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false # sign in with Entra ID (use_azuread_auth in the backend)
  default_to_oauth_authentication = true
  tags                            = local.tags

  blob_properties {
    versioning_enabled = true
    delete_retention_policy {
      days = 7
    }
  }
}

resource "azurerm_storage_container" "state" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.state.id
  container_access_type = "private"
}

# You need data-plane rights to read and write the state blob with Entra ID.
data "azurerm_client_config" "current" {}

resource "azurerm_role_assignment" "me" {
  scope                = azurerm_storage_account.state.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azurerm_client_config.current.object_id
}

output "storage_account_name" {
  value = azurerm_storage_account.state.name
}

output "resource_group_name" {
  value = azurerm_resource_group.state.name
}
