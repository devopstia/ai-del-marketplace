# Remote state in Azure Storage (blob lease locking)  [Azure mirror]

Azure counterpart of `../../terraform-remote-state` (AWS). Builds on the owner's Azure module
`azure-terraform/modules/storage-backend` (azurerm >= 3.0, storage keys) with: azurerm ~> 5.0, Entra ID auth instead of
storage account keys (`shared_access_key_enabled = false`, `use_azuread_auth = true`), blob versioning and soft delete.

## Steps
```bash
az login && az account set --subscription <training-subscription>
cd bootstrap && cp terraform.tfvars.example terraform.tfvars && terraform init && terraform apply
cd ../app && cp backend.hcl.example backend.hcl   # storage account name from the output
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl && terraform apply
```
Locking: run two applies at once; the second fails with `state blob is already locked` (a blob lease) until the first ends.
The role assignment can take a minute to apply: if init says 403, wait and retry.

## Cost
About $0: a few KB in LRS storage (cents per month), free resource groups. Inside the $100/month budget.

## Clean up (always)
`cd app && terraform destroy`, then `cd ../bootstrap && terraform destroy`.
Check: `az group list --query "[?starts_with(name,'rg-del-training')].name"` is empty.
