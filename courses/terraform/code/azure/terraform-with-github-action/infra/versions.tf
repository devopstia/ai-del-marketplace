terraform {
  required_version = ">= 1.11.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
  }

}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
  use_oidc        = true # in GitHub Actions; locally az login is used
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
    Lesson    = "github-actions-oidc"
    ManagedBy = "terraform"
  }
}
