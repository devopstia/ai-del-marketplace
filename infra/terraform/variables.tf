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
