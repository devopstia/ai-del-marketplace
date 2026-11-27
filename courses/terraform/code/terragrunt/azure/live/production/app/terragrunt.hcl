include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../../modules//azure-app"
}

dependency "network" {
  config_path = "../network"
  mock_outputs = {
    resource_group_name = "rg-mock"
    subnet_ids          = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-mock/providers/Microsoft.Network/virtualNetworks/vnet-mock/subnets/snet-mock-01"]
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  resource_group_name = dependency.network.outputs.resource_group_name
  subnet_id           = dependency.network.outputs.subnet_ids[0]
  allowed_cidr        = "203.0.113.10/32" # put your own IP /32
  release             = "v1"
}
