# Azure mirror of aws-network: resource group, VNet and subnets (free). Based on the owner's azure-terraform/modules/vnet.
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
}

variable "location" {
  type = string
}

variable "address_space" {
  type = string
}

variable "subnet_cidrs" {
  type = list(string)
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "azurerm_resource_group" "this" {
  name     = "rg-${var.name}"
  location = var.location
  tags     = var.tags
}

resource "azurerm_virtual_network" "this" {
  name                = "vnet-${var.name}"
  location            = azurerm_resource_group.this.location
  resource_group_name = azurerm_resource_group.this.name
  address_space       = [var.address_space]
  tags                = var.tags
}

resource "azurerm_subnet" "this" {
  for_each             = { for i, cidr in var.subnet_cidrs : i => cidr }
  name                 = format("snet-%s-%02d", var.name, tonumber(each.key) + 1)
  resource_group_name  = azurerm_resource_group.this.name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [each.value]
}

output "resource_group_name" {
  value = azurerm_resource_group.this.name
}

output "subnet_ids" {
  value = [for s in azurerm_subnet.this : s.id]
}
