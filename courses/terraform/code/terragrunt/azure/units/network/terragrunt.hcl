include "root" {
  path = find_in_parent_folders("root.hcl")
}

terraform {
  source = "${values.modules_dir}//azure-network"
}

inputs = {
  address_space = values.address_space
  subnet_cidrs  = values.subnet_cidrs
}
