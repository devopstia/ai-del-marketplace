# Test modules with `terraform test`  [new, proposed]

Not in the owner's deck (the repo's `testing` folder is a scratch folder, not tests). `terraform test` (Terraform
>= 1.6, mocks >= 1.7) runs `.tftest.hcl` files: each `run` block plans or applies and checks `assert` conditions.
With `mock_provider` nothing is created in AWS.

## Steps
```bash
terraform init
terraform test            # 3 passed, 0 failed
terraform test -verbose   # shows each plan
```
Break it on purpose: set `versioning = false` as the default in the module and run again (1 failed).
Later lesson (AI module): ask an AI assistant to write extra cases, then run them; keep only those that pass for the
right reason.

## Cost
$0: the provider is mocked. A real-provider run (remove `mock_provider`) creates and destroys S3 buckets for cents.

## Clean up
Nothing to clean with the mock. Without it, `terraform test` destroys what it created at the end of the file;
check `aws s3 ls | grep help-site`.
