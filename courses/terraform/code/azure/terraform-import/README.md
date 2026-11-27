# Import existing Azure resources with import blocks  [Azure mirror]

Azure counterpart of `../../terraform-import`. Azure ids are full resource paths
(`/subscriptions/<id>/resourceGroups/<name>`); `az group show -n <name> --query id -o tsv` prints one.

## Steps
1. `az group create -n rg-del-import-demo -l eastus` (by hand, like the owner's lesson).
2. `terraform init && terraform plan` → `1 to import`. `terraform apply`. Remove the import block; plan is clean.
3. Generated config: remove the resource block and run `terraform plan -generate-config-out=generated.tf`; review it.
   (The aztfexport tool can export a whole resource group; shown as an alternative.)

## Cost / clean up
$0. `terraform destroy`; check `az group exists -n rg-del-import-demo` → false.
