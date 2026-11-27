# A free resource stored in the remote state: a resource group with tags.
resource "azurerm_resource_group" "demo" {
  name     = "rg-del-training-remote-state-demo"
  location = var.location
  tags     = local.tags
}
