# Terraform in GitHub Actions with OIDC on Azure (no client secret)  [Azure mirror]

Azure counterpart of `../../terraform-with-github-action`. GitHub's OIDC token is exchanged for an Entra ID token of a
**user-assigned managed identity** through a federated credential: nothing secret is stored in GitHub.

| Identity | Federated subject | Rights |
|---|---|---|
| `id-del-gha-plan` | `repo:<owner>/<repo>:pull_request` | Reader on the target resource group + state blob |
| `id-del-gha-apply` | `repo:<owner>/<repo>:environment:production` (required reviewer) | Contributor on the target resource group + state blob |

## Steps
1. State account from `../terraform-remote-state/bootstrap`.
2. `cd oidc && cp terraform.tfvars.example terraform.tfvars && terraform init && terraform apply`.
3. GitHub repo: copy `infra/` and `.github/`; repository variables from the `github_variables` output plus
   `TF_STATE_ACCOUNT`; environment `production` with yourself as required reviewer.
4. PR → plan comment; merge → apply waits for approval → approve.

## Cost
$0 (managed identities, role assignments and resource groups are free).

## Clean up
Destroy `infra` locally (`az login`, same backend config), then `cd oidc && terraform destroy`.
Check `az group list --query "[?starts_with(name,'rg-del-training-ci')].name"` is empty.
