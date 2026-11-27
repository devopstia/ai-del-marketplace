# Lab code for the Terraform masterclasses

Gap code written during planning (2026-11-27) for the lessons the owner's repo does not cover or covers with outdated
code. The owner's repo (`devopstia/terraform-course-del`) stays the source for every other lesson; the video agent
builds the remaining labs from the curricula (`../TERRAFORM_AWS_CURRICULUM.md`, `../TERRAFORM_AZURE_CURRICULUM.md`).

| Folder | Lesson | AWS | Azure (`azure/…`) |
|---|---|---|---|
| `terraform-remote-state` | 8.2 remote state with locking (updated owner exercise) | S3 + `use_lockfile` | Storage + blob lease, Entra ID |
| `terraform-import` | 8.4 import blocks (updated owner exercise) | IAM user | resource group |
| `terraform-moved-removed` | 8.5 moved / removed blocks | SSM parameters | — (GEN mirrors) |
| `terraform-ephemeral-write-only` | 8.8 secrets out of state | SSM `value_wo` | Key Vault `value_wo` |
| `terraform-checks-and-conditions` | 7.4 pre/postconditions, check | EC2 (plan only) | — (GEN mirrors) |
| `terraform-test` | 12.2 `terraform test` with mocks | S3 module | storage module |
| `terraform-policy-checkov` | 12.3 policy as code | weak S3 bucket | — (GEN mirrors) |
| `terraform-with-github-action` | 13.1 OIDC pipeline (updated owner exercise) | IAM OIDC roles | managed identities + federated credentials |
| `ai-terraform-prompts` | 14.1–14.6 prompt files | both clouds | both clouds |
| `terraform-mcp-server` | 14.5 Terraform MCP server (read-only) | shared | shared |
| `terraform-bedrock-knowledge-base` | 15.2/15.3 RAG + guardrail | Bedrock KB on S3 Vectors | `azure/terraform-foundry-ai-search` |
| `owner-updated/` | the owner's failing folders that lessons use, fixed for current versions (24 folders, see its README) | aws-terraform/… | azure-terraform/… |
| `terragrunt/` | the Terragrunt courses: live trees (dev/staging/prod), stacks, CI, drift, AI prompts | `terragrunt/aws` | `terragrunt/azure` |

**Checked 2026-11-27** with Terraform 1.17.2, aws 6.74.0, azurerm 5.15.0, random 3.9.1: `terraform fmt -check -recursive`
clean; `terraform init -backend=false && terraform validate` succeeds in all 20 root folders; `terraform test` passes
3/3 in both test folders and fails 1 when a rule is broken; Checkov 3 on the policy lab: 5 passed, 11 failed (on purpose).
Nothing was applied: no cloud credentials were used. Apply/destroy is verified by the video agent when it records,
with the cost logged.

Rules for every folder: Terraform >= 1.11, pinned providers, default tags (`Course`, `Lesson`, `ManagedBy`),
`.tfvars.example` only, no secrets or keys, a README with cost and cleanup.
