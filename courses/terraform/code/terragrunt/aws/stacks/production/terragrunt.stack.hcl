# The whole production environment as one stack: `terragrunt stack generate` writes the units into .terragrunt-stack/,
# `terragrunt stack run plan` plans them in dependency order.
locals {
  modules_dir = "${get_terragrunt_dir()}/../../../modules"
}

unit "network" {
  source = "../../units/network"
  path   = "network"
  values = {
    modules_dir         = local.modules_dir
    cidr_block          = "10.40.0.0/16"
    public_subnet_cidrs = ["10.40.1.0/24", "10.40.2.0/24"]
  }
}

unit "app" {
  source = "../../units/app"
  path   = "app"
  values = {
    modules_dir  = local.modules_dir
    network_path = "../network"
    allowed_cidr = "203.0.113.10/32"
    release      = "v1"
  }
}
