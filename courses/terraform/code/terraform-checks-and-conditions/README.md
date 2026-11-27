# Validation, preconditions, postconditions and check blocks  [new, proposed]

Extends the owner's "Terraform Resource Validation" (slides 366–371, folder `terraform-resource-validation`).

| Tool | When it runs | What happens when it fails |
|---|---|---|
| `validation` in a variable | before the plan | error, nothing happens |
| `precondition` | during the plan/apply, before the resource | error |
| `postcondition` | after the resource is read/created | error (the resource may already exist) |
| `check` block | end of plan and apply | **warning** only |

## Steps
1. `terraform init && terraform plan -var environment=test` → validation error.
2. `terraform plan -var instance_type=m5.large -var create_instance=true` → precondition error (not free tier).
3. `terraform plan` → the check block result is shown as a warning if the site is down (try a wrong URL).
4. Optional: `-var create_instance=true` and apply to see the postcondition pass, then destroy.

## Cost
$0 by default (no instance). With `create_instance = true`: a t3.micro, about $0.01 per hour; destroy it.

## Clean up
`terraform destroy` and check `aws ec2 describe-instances --filters Name=tag:Lesson,Values=checks-and-conditions --query 'Reservations[].Instances[].State.Name'`.
