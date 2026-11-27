# Owner's azure-terraform/modules/acr, made self-contained (the original referenced a resource group and an AKS
# cluster that are not in the module): they are inputs now. Basic SKU for labs (Standard in the original).
terraform {
  required_version = ">= 1.11.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
  }
}

variable "acr_name" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "sku" {
  type    = string
  default = "Basic"
}

variable "kubelet_object_id" {
  description = "AKS kubelet identity object id (azurerm_kubernetes_cluster.<name>.kubelet_identity[0].object_id); null to skip."
  type        = string
  default     = null
}

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.sku
  admin_enabled       = false
}

resource "azurerm_role_assignment" "role_acrpull" {
  count                            = var.kubelet_object_id == null ? 0 : 1
  scope                            = azurerm_container_registry.acr.id
  role_definition_name             = "AcrPull"
  principal_id                     = var.kubelet_object_id
  skip_service_principal_aad_check = true
}

output "acr_id" {
  value = azurerm_container_registry.acr.id
}
