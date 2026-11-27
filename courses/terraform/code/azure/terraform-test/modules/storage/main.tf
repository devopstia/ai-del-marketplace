# Module under test (Azure mirror of ../../../terraform-test): a private storage account with a naming rule.
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
  }
}

variable "name" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9]{3,16}$", var.name))
    error_message = "name: 3-16 lowercase letters or numbers (storage account names allow no hyphens)."
  }
}

variable "environment" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type    = string
  default = "eastus"
}

resource "azurerm_storage_account" "this" {
  name                            = "st${var.environment}${var.name}"
  resource_group_name             = var.resource_group_name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  tags                            = { Environment = var.environment }
}

output "account_name" {
  value = azurerm_storage_account.this.name
}
