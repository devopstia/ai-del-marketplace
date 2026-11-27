# Secrets without leaking into state: ephemeral resources and write-only arguments  [new, proposed]

Fixes a pattern in the owner's examples (passwords in `.tf` files, e.g. `terraform-local-state`,
`base-code/aurora-mysql-cluster`) and complements deck slides 157–162 (local state) and 429–440 (remote state).

## Steps
1. `terraform init && terraform apply`
2. `grep -c value_wo terraform.tfstate` and look at the resource in the state: `value_wo` is `null`.
   The password is in AWS: `aws ssm get-parameter --name /del-training/ephemeral/db-password --with-decryption`.
3. Compare with the old way: uncomment the two "old way" blocks, apply, and find the password in the state file.
   Comment them out again and apply (it is deleted).
4. Rotate: `terraform apply -var secret_version=2` → a new password is written.

## Cost
$0 (standard SecureString parameters with the AWS-managed key are free).

## Clean up
`terraform destroy`; check `aws ssm get-parameters-by-path --path /del-training/ephemeral` is empty.
Delete the local `terraform.tfstate*` files if you tried the old way (they contain a password).
