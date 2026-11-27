# The owner's exercises, updated to current versions

Copies of folders from `devopstia/terraform-course-del` that **fail on Terraform 1.17 / aws 6.x / azurerm 5.x** and that a
lesson uses, fixed so they validate today. Paths mirror the owner's repo (`aws-terraform/…`, `azure-terraform/…`).
The fix for each folder is listed in `../../CONTENT_INVENTORY.md` › Fixes; the code, names and teaching are the owner's.

Rules: no keys, passwords or state were copied (the AKS module's committed `vm-ssh-key/` was not copied: it now takes
`var.ssh_public_key`); `terraform.tfvars` became `terraform.tfvars.example`; versions are pinned
(`required_version >= 1.11.0`, aws `~> 6.0`, azurerm `~> 5.0`, helm `~> 3.0`, kubernetes `~> 2.38`, random `~> 3.7`).

**Checked 2026-11-28:** `terraform fmt -check -recursive` clean; `terraform init -backend=false && terraform validate`
succeeds in all 25 folders on Terraform 1.17.2. Nothing applied. Some examples still contain the owner's placeholder
ids (AMI, subnet, security group ids, key pair names): the lesson replaces them with data sources or its own values.
