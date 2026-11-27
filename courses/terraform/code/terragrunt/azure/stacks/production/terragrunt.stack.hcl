# Azure production environment as one stack (mirror of ../../../aws/stacks/production).
locals {
  modules_dir = "${get_terragrunt_dir()}/../../../modules"
}

unit "network" {
  source = "../../units/network"
  path   = "network"
  values = {
    modules_dir   = local.modules_dir
    address_space = "10.40.0.0/16"
    subnet_cidrs  = ["10.40.1.0/24", "10.40.2.0/24"]
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
