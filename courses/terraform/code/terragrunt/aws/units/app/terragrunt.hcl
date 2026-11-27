include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${values.modules_dir}//aws-app"
}

dependency "network" {
  config_path = values.network_path
  mock_outputs = {
    vpc_id = "vpc-00000000000000000"
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  vpc_id       = dependency.network.outputs.vpc_id
  allowed_cidr = values.allowed_cidr
  release      = values.release
}
