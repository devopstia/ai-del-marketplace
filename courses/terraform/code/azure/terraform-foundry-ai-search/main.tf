# Azure mirror of the AI-infrastructure lesson: a RAG stack as code.
# Foundry resource (AIServices account with projects) + a Foundry project + a chat and an embedding deployment,
# Azure AI Search (Free tier) and a Storage container for the documents. Keys off: Entra ID roles only.

variable "chat_model" {
  type = object({ name = string, version = string })
  default = {
    name    = "gpt-4.1-mini"
    version = "2025-04-14"
  }
}

variable "embedding_model" {
  type = object({ name = string, version = string })
  default = {
    name    = "text-embedding-3-small"
    version = "1"
  }
}

variable "search_sku" {
  description = "free (one per subscription, $0) or basic (about $75/month: ask the owner first)."
  type        = string
  default     = "free"
  validation {
    condition     = contains(["free", "basic"], var.search_sku)
    error_message = "Use free for training; basic only with the owner's OK."
  }
}

data "azurerm_client_config" "current" {}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

resource "azurerm_resource_group" "this" {
  name     = "rg-del-training-foundry"
  location = var.location
  tags     = local.tags
}

resource "azurerm_cognitive_account" "foundry" {
  name                       = "ais-del-${random_string.suffix.result}"
  location                   = azurerm_resource_group.this.location
  resource_group_name        = azurerm_resource_group.this.name
  kind                       = "AIServices"
  sku_name                   = "S0"
  custom_subdomain_name      = "ais-del-${random_string.suffix.result}"
  project_management_enabled = true  # Foundry projects live under this resource
  local_auth_enabled         = false # no API keys: Entra ID only
  tags                       = local.tags

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_cognitive_account_project" "this" {
  name                 = "devops-assistant"
  cognitive_account_id = azurerm_cognitive_account.foundry.id
  location             = azurerm_resource_group.this.location
  display_name         = "DevOps assistant"
  description          = "RAG over runbooks (Terraform masterclass)"

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_cognitive_deployment" "chat" {
  name                 = var.chat_model.name
  cognitive_account_id = azurerm_cognitive_account.foundry.id
  model {
    format  = "OpenAI"
    name    = var.chat_model.name
    version = var.chat_model.version
  }
  sku {
    name     = "GlobalStandard" # pay per token, nothing by the hour
    capacity = 10               # thousands of tokens per minute
  }
}

resource "azurerm_cognitive_deployment" "embedding" {
  name                 = var.embedding_model.name
  cognitive_account_id = azurerm_cognitive_account.foundry.id
  model {
    format  = "OpenAI"
    name    = var.embedding_model.name
    version = var.embedding_model.version
  }
  sku {
    name     = "GlobalStandard"
    capacity = 10
  }
  depends_on = [azurerm_cognitive_deployment.chat] # deployments on one account are created one at a time
}

resource "azurerm_search_service" "this" {
  name                         = "srch-del-${random_string.suffix.result}"
  location                     = azurerm_resource_group.this.location
  resource_group_name          = azurerm_resource_group.this.name
  sku                          = var.search_sku
  local_authentication_enabled = false
  tags                         = local.tags

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_storage_account" "docs" {
  name                            = "stdeldocs${random_string.suffix.result}"
  location                        = azurerm_resource_group.this.location
  resource_group_name             = azurerm_resource_group.this.name
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  tags                            = local.tags
}

resource "azurerm_storage_container" "docs" {
  name                  = "runbooks"
  storage_account_id    = azurerm_storage_account.docs.id
  container_access_type = "private"
}

# Roles: you upload documents; Search reads them and calls the embedding model; you query Search and the model.
locals {
  roles = {
    me_blob        = { scope = azurerm_storage_account.docs.id, role = "Storage Blob Data Contributor", principal = data.azurerm_client_config.current.object_id }
    search_blob    = { scope = azurerm_storage_account.docs.id, role = "Storage Blob Data Reader", principal = azurerm_search_service.this.identity[0].principal_id }
    search_openai  = { scope = azurerm_cognitive_account.foundry.id, role = "Cognitive Services OpenAI User", principal = azurerm_search_service.this.identity[0].principal_id }
    me_openai      = { scope = azurerm_cognitive_account.foundry.id, role = "Cognitive Services OpenAI User", principal = data.azurerm_client_config.current.object_id }
    me_search_data = { scope = azurerm_search_service.this.id, role = "Search Index Data Contributor", principal = data.azurerm_client_config.current.object_id }
    me_search_svc  = { scope = azurerm_search_service.this.id, role = "Search Service Contributor", principal = data.azurerm_client_config.current.object_id }
  }
}

resource "azurerm_role_assignment" "this" {
  for_each             = local.roles
  scope                = each.value.scope
  role_definition_name = each.value.role
  principal_id         = each.value.principal
}

output "foundry_endpoint" {
  value = azurerm_cognitive_account.foundry.endpoint
}

output "search_endpoint" {
  value = "https://${azurerm_search_service.this.name}.search.windows.net"
}

output "storage_account" {
  value = azurerm_storage_account.docs.name
}
