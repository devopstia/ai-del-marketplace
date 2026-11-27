# Secrets without leaking into state: Key Vault with write-only arguments  [Azure mirror]

Azure counterpart of `../../terraform-ephemeral-write-only`. Fixes the owner's Azure pattern of keys and passwords in
the repo (e.g. `azure-terraform/modules/key-vault-values`, committed `.pem` files).

## Steps
`terraform init && terraform apply` → the secret is in Key Vault (`az keyvault secret show --vault-name <name> -n db-password`),
and `value_wo` is null in `terraform.tfstate`. Rotate with `-var secret_version=2`.
If apply says 403 on the secret, the role assignment is still propagating: wait a minute and apply again.

## Cost
Cents: Key Vault standard charges per 10,000 operations; a lesson uses a few dozen.

## Clean up
`terraform destroy` (the provider purges the soft-deleted vault on destroy by default). Check
`az keyvault list-deleted --query "[?starts_with(name,'kv-del-eph')]"` is empty; if not,
`az keyvault purge -n <name>`.
