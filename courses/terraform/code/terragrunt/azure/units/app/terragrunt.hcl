include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${values.modules_dir}//azure-app"
}

dependency "network" {
  config_path = values.network_path
  mock_outputs = {
    resource_group_name = "rg-mock"
    subnet_ids          = ["/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/rg-mock/providers/Microsoft.Network/virtualNetworks/vnet-mock/subnets/snet-mock-01"]
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  resource_group_name = dependency.network.outputs.resource_group_name
  subnet_id           = dependency.network.outputs.subnet_ids[0]
  allowed_cidr        = values.allowed_cidr
  release             = values.release
}
