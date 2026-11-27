# Remote state on S3 with native locking

Improved version of the owner's exercise `aws-terraform/terraform-concepts/terraform-remote-state`
(deck slides 429–440 and 468–471). The idea and the order are the owner's; the code is updated for 2026:

| Owner's original (2023–2024) | This version |
|---|---|
| DynamoDB table for state locking | `use_lockfile = true`: S3 native locking (a `.tflock` object next to the state). `dynamodb_table` is deprecated since Terraform 1.11 |
| AWS provider `~> 4.0` | `~> 6.0` |
| Bucket settings inline | Versioning, encryption and public access block as separate resources (provider v4+ style) |
| Backend values hard-coded | Partial backend configuration (`backend.hcl`), one code base for every student |

## Requirements
Terraform >= 1.11, AWS CLI signed in (`aws sso login` or a profile), an AWS account you may use for training.

## Steps
```bash
cd bootstrap
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply            # creates the state bucket
cd ../app
cp backend.hcl.example backend.hcl           # put the bucket name from the output
terraform init -backend-config=backend.hcl
terraform apply
```
Show locking: run `terraform apply` in two terminals at the same time; the second waits for the lock
(`Error acquiring the state lock`). Show versioning: change the value, apply, and list the state versions in S3.

## Cost
About $0: S3 storage of a few KB, a free standard SSM parameter. Well inside the $100/month training budget.

## Clean up (always)
```bash
cd app && terraform destroy
cd ../bootstrap && terraform destroy         # allow_destroy=true empties the versioned bucket
aws s3 ls | grep tfstate                     # nothing left
```
