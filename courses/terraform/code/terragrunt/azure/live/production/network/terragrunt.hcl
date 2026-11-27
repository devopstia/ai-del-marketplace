include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

terraform {
  source = "../../../../modules//azure-network"
}

locals {
  prefix = include.root.locals.common.cidr_prefix
}

inputs = {
  address_space = "${local.prefix}.0.0/16"
  subnet_cidrs  = ["${local.prefix}.1.0/24", "${local.prefix}.2.0/24"]
}
