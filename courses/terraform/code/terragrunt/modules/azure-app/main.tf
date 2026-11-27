# Azure mirror of aws-app: an NSG in the network unit's resource group, associated with its first subnet. Free.
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

variable "resource_group_name" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "allowed_cidr" {
  type = string
}

variable "release" {
  type    = string
  default = "v1"
}

resource "azurerm_network_security_group" "app" {
  name                = "nsg-${var.name}-app"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = { Release = var.release }

  security_rule {
    name                       = "https-from-allowed"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = var.allowed_cidr
    destination_address_prefix = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "app" {
  subnet_id                 = var.subnet_id
  network_security_group_id = azurerm_network_security_group.app.id
}

output "nsg_id" {
  value = azurerm_network_security_group.app.id
}
