# Prompt: write `terraform test` cases

```
Here is a Terraform module (main.tf, variables.tf) and its current tests (*.tftest.hcl).
Write additional run blocks for terraform test (Terraform 1.17) using mock_provider "aws" so no cloud is touched.
Cover: each variable validation (expect_failures), the naming rule, security settings that must stay on,
and one edge case you think is missing. One assert per rule, with a clear error_message.
Do not change the module. Output only the new .tftest.hcl file.
```
Then run `terraform test`. Keep a test only if it fails when you break the rule on purpose (a test that always passes
proves nothing).
