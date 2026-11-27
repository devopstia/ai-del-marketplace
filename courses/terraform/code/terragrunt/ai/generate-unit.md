# Prompt: AI generates a Terragrunt unit from the module catalog (lesson 8.1)

```
Role: platform engineer for a Terragrunt 1.x live repository (root.hcl, common.yaml per environment,
units include root.hcl with find_in_parent_folders("root.hcl")).
Task: add an "app" unit to live/staging that uses modules//aws-app, depends on ../network for vpc_id
with mock outputs for init/validate/plan, and allows 443 only from 203.0.113.10/32.
Constraints: no provider or backend blocks (root.hcl generates them); no secrets; copy the style of live/development/app.
Output: the terragrunt.hcl file only.
Checks you must pass: terragrunt hcl fmt --check, terragrunt hcl validate, terragrunt render, a plan with mocked outputs.
```
