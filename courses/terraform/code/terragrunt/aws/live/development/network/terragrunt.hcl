include "root" {
  path   = find_in_parent_folders("root.hcl")
  expose = true
}

terraform {
  source = "../../../../modules//aws-network"
}

locals {
  prefix = include.root.locals.common.cidr_prefix
}

inputs = {
  cidr_block          = "${local.prefix}.0.0/16"
  public_subnet_cidrs = ["${local.prefix}.1.0/24", "${local.prefix}.2.0/24"]
}
