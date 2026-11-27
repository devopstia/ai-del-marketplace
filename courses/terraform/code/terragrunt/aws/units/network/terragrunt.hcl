# Unit template used by stacks (Terragrunt 1.x): its inputs come from the stack's `values`.
include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${values.modules_dir}//aws-network"
}

inputs = {
  cidr_block          = values.cidr_block
  public_subnet_cidrs = values.public_subnet_cidrs
}
