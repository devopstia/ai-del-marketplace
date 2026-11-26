variable "region" { default = "us-east-1" }
variable "domain" { default = "ai-devopseasylearning.com" }
variable "staging_host" { default = "staging.ai-devopseasylearning.com" }
variable "instance_type" { default = "t3a.medium" }
variable "db_instance_class" { default = "db.t4g.micro" }
variable "github_repo" { default = "devopstia/ai-del-marketplace" }
variable "acme_email" {
  description = "Let's Encrypt account contact (certificate expiry notices)"
  default     = "support@devopseasylearning.com"
}

# GitHub immutable OIDC subject prefix (owner@owner_id/repo@repo_id), from `gh api repos/<repo>/actions/oidc/customization/sub`.
variable "github_repo_immutable" { default = "devopstia@116234952/ai-del-marketplace@1470488285" }

# Monthly cost alert for the marketplace's own resources (fixed cost is about $52 before video traffic: docs/AWS_COSTS.md).
variable "monthly_budget_usd" { default = 75 }
# DEL's support address receives budget alerts (not a personal address).
variable "alert_email" { default = "support@devopseasylearning.com" }
