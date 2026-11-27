# Import existing resources with import blocks

Improved version of the owner's `aws-terraform/terraform-concepts/terraform-import` (deck slides 423–428).
The owner's lesson (create by hand, then import) stays; this adds the **import block** and **generated configuration**.

## Steps
1. In the IAM console create a user `del-import-demo` (no permissions, no keys).
2. `cp terraform.tfvars.example terraform.tfvars && terraform init`
3. `terraform plan`: shows `1 to import, 0 to add, 0 to change`. Nothing is changed in AWS.
4. `terraform apply`: the user is now in the state (`terraform state list`).
5. Remove the `import` block (it has done its job); `terraform plan` shows no changes.
6. Generated config: delete `resource "aws_iam_user" "manual"`, put the import block back and run
   `terraform plan -generate-config-out=generated.tf`. Review the file before you keep it.
7. Old way for comparison: `terraform import aws_iam_user.manual del-import-demo` (no plan, no review).

## Cost
$0 (IAM users are free).

## Clean up
`terraform destroy` deletes the user (it is managed now). Check: `aws iam get-user --user-name del-import-demo` fails.
