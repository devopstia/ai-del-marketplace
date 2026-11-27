terraform {
  required_version = ">= 1.11.0"
  required_providers {
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
  }

}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

variable "subscription_id" {
  description = "Your training subscription id (az account show --query id -o tsv)."
  type        = string
}

variable "location" {
  type    = string
  default = "eastus"
}

locals {
  tags = {
    Course    = "terraform-azure-masterclass"
    Lesson    = "foundry-ai-search"
    ManagedBy = "terraform"
  }
}
