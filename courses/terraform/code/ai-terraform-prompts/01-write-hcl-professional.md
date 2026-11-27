# Prompt: write Terraform (professional structure)

Uses the structure taught in the prompt engineering lessons (role, context, task, constraints, output, checks).
Compare with the poor prompt: "write terraform for an s3 bucket".

```
Role: You are a senior platform engineer who writes production Terraform for AWS.

Context:
- Terraform 1.17, AWS provider ~> 6.0, region us-east-1.
- Our standards: default_tags on the provider (Course, ManagedBy), no hard-coded account ids or secrets,
  separate aws_s3_bucket_* resources (provider v4+ style), variables with descriptions and validation.

Task: Create a private S3 bucket for application logs.

Constraints:
- Block all public access; versioning on; SSE-S3 encryption; expire objects after 30 days.
- Bucket name = "<var.environment>-<var.name>-logs".
- No provider credentials in code. No `force_destroy` unless a variable allows it (default false).

Output: main.tf, variables.tf, outputs.tf as separate code blocks. No explanation outside the code comments.

Checks you must pass: terraform fmt, terraform validate, Checkov with no failed checks except the ones you
list with a reason. Tell me any assumption you made.
```
After the answer: run `terraform fmt -check`, `terraform validate`, `checkov -d .`, `terraform plan`. Never apply code
you have not read. AI drafts; Terraform and a person verify.
