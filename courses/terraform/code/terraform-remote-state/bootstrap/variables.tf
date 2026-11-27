variable "region" {
  description = "AWS region for the state bucket."
  type        = string
  default     = "us-east-1"
}

variable "name_prefix" {
  description = "Prefix for the bucket name (lowercase letters, numbers and hyphens)."
  type        = string
  default     = "del-training"

  validation {
    condition     = can(regex("^[a-z0-9-]{3,30}$", var.name_prefix))
    error_message = "Use 3-30 lowercase letters, numbers or hyphens."
  }
}

variable "allow_destroy" {
  description = "Training only: allow terraform destroy to delete a non-empty bucket."
  type        = bool
  default     = true
}
