# Refactor safely with moved and removed blocks  [new, proposed]

Not in the owner's deck. It extends "Resource Deletion and Update" (slides 415–422): the deck removes things with
`terraform state rm` and by editing the state file; `moved` and `removed` do the same through a reviewed plan.

## Steps
1. `cd before && terraform init && terraform apply` (three parameters).
2. Copy the state into the refactored folder: `cp terraform.tfstate ..` and `cd ..` (in the course this is one
   folder whose code changes; two folders keep both versions visible).
3. `terraform init && terraform plan`: `aws_ssm_parameter.app_name has moved to aws_ssm_parameter.app["name"]`,
   plus a destroy for `legacy` (it has no block any more).
4. Uncomment the `removed` block, plan again: `legacy` will be **forgotten**, not destroyed. Apply.
5. Show it is still in AWS: `aws ssm get-parameter --name /del-training/moved/legacy`.

## Cost
$0 (standard SSM parameters are free).

## Clean up
`terraform destroy`, then delete the forgotten one by hand:
`aws ssm delete-parameter --name /del-training/moved/legacy`. Check: `aws ssm get-parameters-by-path --path /del-training/moved` is empty.
