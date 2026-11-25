# DevOps Easy Learning marketplace on AWS (docs/DEPLOYMENT.md). Same account as Insurance Hub, separate
# del-marketplace-* resources; nothing here reads or changes an insuranceprep-* resource except the account's
# existing GitHub OIDC provider, which is only looked up.
terraform {
  required_version = ">= 1.10"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.80" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  backend "s3" {
    # created once by scripts/deploy-aws.sh bootstrap (versioned, encrypted, private)
    key          = "del-marketplace/production.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = { App = "del-marketplace", ManagedBy = "terraform" } }
}
