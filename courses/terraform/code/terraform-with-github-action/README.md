# Terraform in GitHub Actions with OIDC (no stored AWS keys)

Improved version of the owner's `aws-terraform/terraform-with-github-action` (deck slides 614–616).

| Owner's original | This version |
|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` as repository secrets | GitHub OIDC: short-lived credentials, nothing stored |
| One identity for plan and apply | Plan role (read-only + state) for PRs; apply role only for the approved `production` environment |
| Terraform 1.0.0, `setup-terraform@v2.0.2` | Terraform 1.17.2, `setup-terraform@v3`, `configure-aws-credentials@v4` |
| Apply on push | Apply after merge **and** a reviewer's approval; plan posted on the PR |

The AI plan review (an AI comment with risks, cost and blast radius, a person still approves) is added in the AI
module lesson on top of this pipeline.

## Steps
1. State bucket from `../terraform-remote-state/bootstrap`.
2. `cd oidc && cp terraform.tfvars.example terraform.tfvars` (your repo) → `terraform init && terraform apply`.
3. New GitHub repo: copy `infra/` and `.github/`. Repository variables: `AWS_PLAN_ROLE_ARN`, `AWS_APPLY_ROLE_ARN`,
   `TF_STATE_BUCKET`. Environment `production` with yourself as required reviewer.
4. Open a PR changing `message` → plan comment. Merge → the apply job waits for approval → approve → applied.

## Cost
$0 (IAM, OIDC provider and SSM parameters are free; GitHub Actions minutes on a public repo are free).

## Clean up
Locally with your own credentials: `cd infra && terraform init -backend-config=... && terraform destroy`, then
`cd ../oidc && terraform destroy`. Delete the repository variables. Check: `aws iam list-roles | grep gha-terraform` is empty.
