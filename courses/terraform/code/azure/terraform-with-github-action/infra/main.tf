# The stack the pipeline deploys: a free user-assigned identity whose tag changes with each release.
variable "message" {
  type    = string
  default = "deployed by GitHub Actions"
}

data "azurerm_resource_group" "target" {
  name = "rg-del-training-ci-target"
}

resource "azurerm_user_assigned_identity" "release" {
  name                = "id-del-ci-release"
  location            = var.location
  resource_group_name = data.azurerm_resource_group.target.name
  tags                = merge(local.tags, { Release = var.message })
}
