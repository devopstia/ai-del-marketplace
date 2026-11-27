include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "../../../../modules//aws-app"
}

# Owner's deck slide 583 (dependencies), Terragrunt 1.x style: outputs are read from the network unit;
# mock outputs let init, validate and plan run before the network exists.
dependency "network" {
  config_path = "../network"
  mock_outputs = {
    vpc_id = "vpc-00000000000000000"
  }
  mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"]
}

inputs = {
  vpc_id       = dependency.network.outputs.vpc_id
  allowed_cidr = "203.0.113.10/32" # put your own IP /32
  release      = "v1"
}
