# Azure mirror of the import lesson (owner's AWS exercise: aws-terraform/terraform-concepts/terraform-import).
# Create the resource group by hand first: az group create -n rg-del-import-demo -l eastus

import {
  to = azurerm_resource_group.manual
  id = "/subscriptions/${var.subscription_id}/resourceGroups/rg-del-import-demo"
}

resource "azurerm_resource_group" "manual" {
  name     = "rg-del-import-demo"
  location = var.location
}
