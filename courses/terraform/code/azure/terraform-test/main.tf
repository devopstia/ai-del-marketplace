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
}

module "storage" {
  source              = "./modules/storage"
  name                = "helpsite"
  environment         = "dev"
  resource_group_name = "rg-del-training-test"
}

output "account_name" {
  value = module.storage.account_name
}
