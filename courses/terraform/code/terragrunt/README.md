# Lab code: AI-Powered Terragrunt (AWS and Azure)

Built from the owner's `aws-terraform/terragrunt/live` (deck slides 574–583): the `common.yaml` convention
(assetid, environment, project), one folder per environment, units that include a root file and read each other's
outputs. Updated to **Terragrunt 1.2.3 / Terraform 1.17.2 / aws ~> 6.0 / azurerm ~> 5.0**:

| Owner's original | This version |
|---|---|
| root `terragrunt.hcl` per environment, `include { path = find_in_parent_folders() }` | one `root.hcl`, `include "root" { path = find_in_parent_folders("root.hcl") }` |
| S3 backend with a DynamoDB lock table | `use_lockfile = true` (S3 native locking); Azure: blob lease, Entra ID auth |
| provider written in every module | `generate "provider"` once, with `allowed_account_ids` and an `assume_role` per environment (Azure: `subscription_id`) |
| `dependencies { paths = [...] }` | `dependency` blocks with mock outputs for init/validate/plan |
| `run-all` | `run --all`, `--filter-affected` in CI, `dag graph`, stacks (`terragrunt.stack.hcl`) |

```
modules/        aws-network, aws-app, azure-network, azure-app (small, free resources)
aws/            root.hcl · live/{development,staging,production}/{common.yaml,network,app} · units/ · stacks/production
azure/          the same for Azure
.github/        terragrunt-plan (OIDC, affected units, PR comment) · terragrunt-apply (per environment, approvals) · terragrunt-drift (nightly)
ai/             prompt files for lessons 8.1 and 8.2
```

## Run it
```bash
cd aws/live/development      # set account_id and deploy_role_arn in common.yaml first (one account for all envs is fine)
terragrunt run --all plan
terragrunt run --all apply
terragrunt dag graph         # app -> network
cd ../../stacks/production && terragrunt stack generate && terragrunt stack run plan
```
Azure: `az login`, set `subscription_id` and the state storage account (from `../azure/terraform-remote-state`) in each
`common.yaml`, then the same commands in `azure/live/...`.

## Checked 2026-11-28 (no credentials, nothing applied)
`terragrunt hcl fmt --check` clean; `terragrunt hcl validate` clean in `live/` (the `units/` templates only validate
inside a stack, where `values` exists); `terragrunt run --all --no-dependency-outputs -- init -backend=false` and
`run --all -- validate` succeed for all 6 units in `aws/live` and all 6 in `azure/live`; `terragrunt stack generate`
plus init/validate succeed for both production stacks; `terraform fmt -check` clean on the modules.

## Cost
$0: VPC, subnets, internet gateway, security groups, SSM parameters, resource groups, VNets and NSGs are free.
State storage: cents.

## Clean up (always)
`terragrunt run --all destroy` in each environment folder (production first), `terragrunt stack run destroy` in each
stack, then check the tag search (`Course=terragrunt-aws` / `terragrunt-azure`) shows nothing.
