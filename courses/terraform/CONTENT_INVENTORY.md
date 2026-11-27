# Terraform masterclasses: content inventory (owner's deck and repo)

Phase 1 study, 2026-11-27. Sources (read-only, never modified):
- **Deck:** `/home/tia/work/terraform-course/Terraform.pptx`, 624 slides, 21 MB. Each slide has the DEL background
  picture plus text boxes and screenshots (code, console, diagrams); no speaker notes. Text extracted with python-pptx,
  pictures sampled.
- **Repo:** `https://github.com/devopstia/terraform-course-del` (public, last push 2024-06-10, commit `99a3766`
  2024-04-27). `aws-terraform/`: 842 `.tf` files in 504 folders. `azure-terraform/`: 251 `.tf` files in 42 folders.
  The deck's 54 links to `devopstia/terraform-examples` redirect to this repo (it was renamed); update them in the
  new slides.

Status: **ready** = the owner's code works with current Terraform and can be shown as is (pins updated) ·
**improve** = the lesson stays, the code or slides need the listed fixes · **missing** = no code; built new.
Lessons: `TERRAFORM_AWS_CURRICULUM.md` / `TERRAFORM_AZURE_CURRICULUM.md` (same ids).

## Deck section map (slide 3's table of contents)

| Slides | Section | Owner's repo (`aws-terraform/…`, example folders) | Status | Notes | Lesson |
|---|---|---|---|---|---|
| 1–14 | Title, contents, YouTube links | `terraform-concepts/youtube` (8) | ready | 54 YouTube links (older recordings); keep as "further viewing", not lessons | 0.1 |
| 15–22 | Traditional way of managing infrastructure | — | ready | Diagrams on slides 17–22 | 1.1 |
| 23–27 | What IaC is and its benefits | — | ready | | 1.2 |
| 28–32 | Popular IaC tools; Terraform vs CloudFormation | — | improve | Slide 29 calls Terraform open source: BSL 1.1 since 2023; add OpenTofu, Bicep, Pulumi | 1.3, 13.6 |
| 33–36 | VS Code and plugins | `youtube/vs-code-plugins` | improve | Too many overlapping plugins; recommend the official HashiCorp extension | 2.1 |
| 37–42 | AWS CLI installation and configuration | `aws-cli-installation` | improve | Slide 42 creates an admin IAM user with access keys; use IAM Identity Center | 2.3 |
| 43–57 | Terraform installation (Windows, Linux, Mac, Docker, Terragrunt) | `terraform-installation` (README) | improve | Downloads 0.12/0.13; Dockerfile pins 1.0.0 (slide 49); current is **1.17.2** | 2.2, 9.4 |
| 58–69 | Terraform configuration language | — | ready | | 3.1 |
| 70–79 | Providers and required version | `terraform-providers` (4) | improve | Pins aws `~> 4.0`; current aws **6.74.0**, azurerm **5.15.0** | 3.5 |
| 80–97 | Basic commands and workflow | `learning-basic-commands` (1), `terraform-commands` (6) | improve | `learning-basic-commands` fails `init` on Terraform ≥ 1.1 (`required_version ~> 1.0.0`) | 3.2, 3.7 |
| 98–104 | Comments | `terraform-comments` (2) | ready | | 3.3 |
| 105–111 | Interpolation | `terraform-interpolation` (4) | ready | | 4.3 |
| 112–121 | Format function | `terraform-format` (4) | ready | | 4.3 |
| 122–130 | Merge tags | `terraform-merge-tags` (5) | improve | Add provider `default_tags` | 4.4 |
| 131–138 | Resource reference | `terraform-resources-reference` (6) | ready | example-05 validates on 1.17 | 4.1 |
| 139–150 | Data source | `terraform-data-source` (3) | ready | Ubuntu 20.04 AMI is end of life: use 24.04 or AL2023 | 4.2 |
| 151–156 | Lock file | `terraform-lock-file` (4) | ready | | 3.6 |
| 157–162 | Local state file | `terraform-local-state` (1) | improve | `main.tf` has an RDS password in plain text: show as the problem; fix in 8.8 | 8.1, 8.8 |
| 163–170 | Terraform files | `terrafrom-files` (2) | ready | Folder name typo (keep; note) | 3.4 |
| 171–231 | Variables (all types) | `terraform-variables` (29) | ready / improve | Use `optional()` where slides use `try()` for optional attributes | 5.1–5.5, 5.8 |
| 232–270 | Console (map of any, map of object, try, lookup, length/element, format, conditions) | `terraform-console` (10) | ready | Very good method; kept as the owner's signature lesson | 6.1 |
| 271–276 | Splat expression | `terraform-splat-expression` (6) | ready | | 6.7 |
| 277–281 | Depend on | `terraform-depend-on` (2) | ready | | 7.2 |
| 282–292 | Lifecycle | `terraform-lifcycle` (6) | ready | `ignore_changes/example-003` has a hard-coded password | 7.3 |
| 293–297 | User data | `terraform-user-data` (4) | ready | | 7.6 |
| 298–304 | Element function | `terraform-element-function` (3) | ready | | 6.2 |
| 305–317 | Length function and count | `terraform-count-argument-and-lenght-function` (8) | ready | | 6.2 |
| 318–330 | Split and join | `terraform-slipt-function` (4), `terraform-join-function` (7) | ready | | 6.3 |
| 331–358 | Lookup and try | `terraform-lookup-function` (7), `terraform-try-function` (4) | ready | | 6.4 |
| 359–365 | Contains | `terraform-contains-function` (4) | ready | | 6.5 |
| 366–371 | Resource validation | `terraform-resource-validation` (4) | improve | Only variable validation: add pre/postconditions and `check` | 5.7, 7.4 |
| 372–378 | yamldecode | `terraform-yamldecode-function` (2) | ready | | 6.6 |
| 379–389 | Conditions | `terraform-contitions` (9) | ready | `example-09` has a hard-coded password | 6.5 |
| 390–394 | Alias | `terraform-alias` (2) | ready | Mention provider v6 per-resource `region` | 7.5 |
| 395–401 | Provisioner | `terraform-provisioner` (2) | improve | **Committed private keys** (`example-01/02/private-key/*.pem`); `null_resource` → `terraform_data` | 7.7 |
| 402–414 | Loops | `terraform-loops` (25) | ready / improve | Add `dynamic` blocks; Secrets Manager labs need `recovery_window_in_days = 0` | 7.1 |
| 415–422 | Resource deletion and update | `deleting-resources-in-terraform` (1) | improve | Slides 421–422 edit/delete the state file: "what not to do"; add `-replace`, `removed` | 8.3, 8.5 |
| 423–428 | Import | `terraform-import` (2) | improve | Command only: add import blocks and `-generate-config-out` | 8.4 |
| 429–440 | Remote state | `terraform-remote-state` (4), `modules/s3-backend*` | improve | **78 backend configs use a DynamoDB lock table**: deprecated; use `use_lockfile = true` | 8.2, 11.5 |
| 441–446 | Workspace | `terraform-workspace` (2) | ready | | 9.1 |
| 447–458 | Multiple environments or accounts | `deploy-in-multiple-env` (1) | improve | Access keys per profile: use SSO profiles / assume_role | 9.2 |
| 459–508 | Terraform blocks (provider, terraform, backend, data, module, output, locals, variable, provisioner) | `terraform-top-level-blocks` (14) | duplicate | Slides 472–482, 483–492, 497–499, 501–508 repeat earlier sections; record once | 3.5, 4.2, 5.x, 10.1 |
| 509–521 | Modules | `terraform-module` (3) | improve | Registry module versions to current | 10.1, 10.2 |
| 522–525 | Publish a module to the registry | `terraform-module-publish` (2), repo `devopstia/terraform-aws-vpc-module` | ready | | 10.4 |
| 526–534 | Remote state data source | `terraform-remote-state-data-source` (6) | ready | | 8.7 |
| 535–542 | Commands | `terraform-commands` (6) | ready | | 8.6 |
| 543–559 | Projects and modules (VPC, EC2, bastion, Jenkins, S3 backend, SG, ECR, Secrets Manager, MySQL, Aurora, Postgres, ACM) | `modules/*` (40 modules, 26 with README), `resources/*`, `base-code/*` | improve | Requirement lists are excellent project briefs; update pins, remove hard-coded passwords; Aurora explained, not deployed (cost) | 11.1–11.7 |
| 560–573 | EKS project modules | `modules/eks-*`, `aws-auth-config`, `rbac`, add-ons; `base-code/eks-*` | improve | `aws-auth` ConfigMap → EKS access entries; IRSA → Pod Identity option; the costliest module (cluster per session, destroyed right after) | 16.1–16.5 |
| 574–583 | Terragrunt | `terragrunt/live` (dev/staging/prod) | improve | Terragrunt 1.x (`run --all`, `root.hcl`) | 9.4 |
| 584–599 | Terraform Cloud | `terraform-cloud` (11) | improve | Now **HCP Terraform**; AWS keys stored as variables → dynamic provider credentials | 13.2 |
| 600–609 | HashiCorp Packer | `packer/001…007` (13) | ready | | 13.4 |
| 610–613 | Terraform upgrade | `terraform-upgrade` (README) | improve | Targets 1.0 and the 0.14 changelog | 13.5 |
| 614–616 | GitHub Actions and Terraform Cloud | `terraform-with-github-action` (2 workflows) | improve | Static AWS keys in secrets, Terraform 1.0.0, `setup-terraform@v2.0.2` → OIDC | 13.1 |
| 617–622 | Jenkins; Jenkins and Terragrunt | `terraform-with-jenkins*` (README only) | missing (code) | No Jenkinsfile in the repo | 13.3 |
| 623–624 | Reference documentation | — | ready | | — |

## Counts
- **Deck sections:** 56 in slide 3's contents, 55 rows above (split/join, lookup/try and the two Jenkins sections merged). Status: **ready 30 · ready/improve 2 · improve 21 · missing code 1 · duplicate block 1**.
- **Curriculum (per course):** 95 videos, ~17 h 32 min; 68 come from the owner's deck (48 as taught, 20 updated),
  16 new, 11 AI. 37 are cloud-neutral and shared by both courses; 58 have an AWS and an Azure version.
- **Gaps in the deck** (no slides, no code): `moved`/`removed` blocks, `check` blocks and pre/postconditions, ephemeral
  values and write-only arguments, `terraform test`, TFLint, policy as code (Checkov/OPA/Sentinel), OIDC in CI,
  dynamic blocks, OpenTofu, a capstone, the whole AI strand, Terraform for AI infrastructure.

## Repo findings (aws-terraform)
- **Versions:** `required_version` is `>= 1.0.0` in 313 places, `~> 1.0.0` in 11 (these fail `init` today), `~> 0.14`
  and `~> 0.13` in a few. AWS provider `~> 4.0` in 269, `~> 3.0` in 49, `~> 2.0` in 2; 35 folders pin nothing.
- **State locking:** 78 files use `dynamodb_table`; none uses `use_lockfile`.
- **Format:** `terraform fmt -check -recursive` flags 5 files (`modules/vpc-01/outputs.tf`, `modules/vpc-03/outputs.tf`,
  `terraform-module-publish/vpc/outputs.tf`, `terraform-remote-state-data-source/example-002/modules/vpc-01/outputs.tf`,
  `terraform-variables/map-of-object-variable/example-02/main.tf`).
- **Validate:** 285 of 386 folders validate on Terraform 1.17.2 (`init -backend=false` + `validate`, no credentials);
  45 fail for real reasons, 56 could not be checked here (details in "Validation results" below).
- **Keys and passwords in the repo:** the public repo contains private keys (provisioner examples, `testing/ssh-key`,
  `base-code/eks-mix`, Azure `vm-ssh-key` and `ssh-keys/*.pem`) and hard-coded database passwords
  (`terraform-local-state`, `terraform-contitions/example-09`, `terraform-loops/others-examples-02/example-005`,
  `terraform-lifcycle/ignore_changes/example-003`, `base-code/aurora-mysql-cluster`). The owner said not to worry about
  them (2026-11-28); the rule stays: **never copy them** into the marketplace, labs generate keys at run time and use
  write-only passwords. No AWS access keys, no state files.
- **Also in the repo:** `helm/` (Argo CD, External DNS charts), `k8s/` (manifests for the EKS lessons),
  `terraform-interview-questions/` (a good source for module assessments).

## Repo findings (azure-terraform)
- 42 folders with code: `modules/` (19: resource-group, vnet, virtual-machine, storage-account, storage-backend,
  key-vault, key-vault-values, acr, azure-mysql, azure-dns-zone, static-public-ip, service-principal, AKS control
  plane, Linux/Windows/spot node pools, namespaces, auth config, nginx-ingress, cert-manager), `resources/` (6),
  `resources-example/` (15: VNet, VMs, bastion, load balancer, NAT, state in a storage account), `aks-resources/`.
- `terraform-concepts/` (10 folders) is **README notes only** (187 lines, no code): the Azure concept labs are new.
- azurerm `>= 3.0` (33), `>= 2.0` (8), one exact `3.75.0`; current is **5.15.0** (`features {}` and
  `subscription_id` required since 4.0). 9 `backend "azurerm"` configs (lease locking, nothing to replace).
- No Azure slides in the deck: the Azure course reuses the shared slides and gets new cloud slides.

## Fixes for the 45 failing folders (owner 2026-11-28: "use new Terraform version")
"Fixed" = an updated copy in `code/owner-updated/<same path>` validates on Terraform 1.17.2 (2026-11-28). "Documented" =
not used by a lesson as is (the lesson uses another folder or new code), so only the fix is recorded here.

| Folder (`aws-terraform/…` unless Azure) | Problem | Fix | Status |
|---|---|---|---|
| `terraform-concepts/learning-basic-commands` (3.7) | `required_version ~> 1.0.0` | `>= 1.11.0`, aws `~> 6.0` | fixed |
| `terraform-concepts/youtube/terraform-workflow` (3.2) | `~> 1.0.0` | `>= 1.11.0`, aws `~> 6.0` | fixed |
| `terraform-concepts/youtube/vs-code-plugins` (2.1) | `~> 1.0.0`; typo `vpc_security_group_idsht` | version; `vpc_security_group_ids` | fixed |
| `terraform-concepts/youtube/write-module/modules/sample` (10.3) | `~> 1.0.0` | `>= 1.11.0` | fixed |
| `terraform-concepts/terraform-remote-state-data-source/example-001/ec2` (8.7) | `~> 1.0.0` | `>= 1.11.0`, aws `~> 6.0` | fixed |
| `terraform-concepts/terraform-lock-file/terraform-v1` (3.6) | `~> 1.0.0` | `>= 1.11.0`, aws `~> 6.0` | fixed |
| `terraform-concepts/terraform-lock-file/terrafom-v12`, `terraform-v13`, `terraform-v14` | pins 0.12/0.13/0.14 on purpose (lock-file history) | not taught: lesson 3.6 shows the lock file on 1.17 only | documented |
| `terraform-concepts/sessions/s5/{modules/ec2,resources/dev/ec2,resources/prod/ec2,resources/prod/s3-backend}` | `~> 1.0.0`; DynamoDB lock | `>= 1.11.0`, aws `~> 6.0`, `use_lockfile` | documented (class session notes, not a lesson) |
| `terraform-concepts/terraform-comments/example-02` (3.3) | `random_string.numeric` with an old random provider | pin random `~> 3.7` | fixed |
| `terraform-concepts/terraform-commands/input-file-variable` (5.1) | same | pin random `~> 3.7` | fixed |
| `terraform-concepts/terraform-contitions/example-08` (6.5) | `region` on `aws_s3_bucket` needs provider 6 | aws `~> 6.0` (v6 per-resource region) | fixed |
| `terraform-concepts/terraform-join-function/example-03` (6.3) | `concat("tia", var.args)` (string, not list) | `concat(["tia"], var.args)` | fixed |
| `terraform-concepts/terraform-loops/others-examples-01/example-001`, `-004` (7.1) | outputs reference an undefined `vpc` | `[for vpc in aws_vpc.example : vpc.id]` / `.arn` | fixed |
| `terraform-concepts/terraform-module/ec2` (10.2) | unpinned registry module now v6: `root_block_device` list, `ebs_block_device` | `version = "~> 6.0"`, `root_block_device = {…}`, `ebs_volumes = {…}`, aws `~> 6.0` | fixed |
| `terraform-concepts/terraform-top-level-blocks/terraform-module-block/ec2` | duplicate of the above | same fix | documented (duplicate) |
| `resources/vpc-02` (11.1) + `modules/vpc-02` | passes `tags` the module does not declare; `aws_eip.vpc = true` removed in aws 5+ | drop the input (module default `common_tags`); `domain = "vpc"`; aws `~> 6.0` | fixed |
| `resources/vpc-03` | same pattern as vpc-02 | same fix | documented (11.1 uses vpc-02) |
| `modules/aws-load-balancer-controller`, `aws-ebs-csi-driver`, `cluster-auto-scaler`, `external-dns` (16.5) | Helm provider 3.x: `kubernetes {}` block and `set {}` blocks removed | `kubernetes = {…}`, `set = [{…}, …]`, helm `~> 3.0`, kubernetes `~> 2.38`, aws `~> 6.0` | fixed |
| `resources/aws-load-balancer-controller`, `aws-ebs-csi-driver`, `cluster-auto-scaler`, `external-dns` | call the four modules above | point at the fixed modules | documented (callers) |
| Azure `modules/nginx-ingress` (16.5) | Helm 3.x provider syntax | as above, helm `~> 3.0`, azurerm `~> 5.0` | fixed |
| Azure `modules/aks-all-in-one/terraform` | Helm 3.x syntax, azurerm renames | same fixes as the split modules | documented (16.x uses the split modules) |
| Azure `modules/aks-controle-plane` (16.1) | azurerm 5: `automatic_channel_upgrade`, `enable_auto_scaling` renamed; `node_provisioning_profile` required; SSH key read from a committed file | `automatic_upgrade_channel`, `auto_scaling_enabled`, `node_provisioning_profile { mode = "Manual" }`, `var.ssh_public_key` (key not copied) | fixed |
| Azure `modules/aks-linux-node-group`, `aks-linux-spot-node-group`, `aks-windows-node-group` (16.2) | `enable_auto_scaling` renamed | `auto_scaling_enabled`, azurerm `~> 5.0` | fixed |
| Azure `modules/acr` (11.3) | references a resource group and AKS cluster not in the module | inputs `resource_group_name`, `location`, `kubelet_object_id`; Basic SKU | fixed |
| Azure `modules/azure-mysql` | azurerm 5: `service_endpoints` on the subnet and `private_dns_zone_name` on the link changed (`private_dns_zone_id`) | use `private_dns_zone_id`; the Azure lesson 11.4 uses PostgreSQL Flexible instead | documented |
| `base-code/vpc` | routes reference NAT gateways not defined in the folder | add the `aws_nat_gateway` resources (or drop NAT routes) | documented (16.x builds from modules) |
| `base-code/eks-blue-green-node`, `base-code/eks-mix/iam-roles` | fragments that reference a cluster, roles and subnets in other folders | run with the cluster folder, or turn into a module with inputs | documented |
| `terraform-concepts/youtube/manage-credentials/db` | references Secrets Manager data sources not in the folder | add the data blocks, or `manage_master_user_password = true` (preferred) | documented |
| `resources/all`, Azure `resources/sc` | point at module folders that are not in the repo | — (cannot be completed from the repo) | documented |

Totals: 45 folders → 24 fixed in lab copies (plus `modules/vpc-02`, which `resources/vpc-02` needs), 21 documented.

## Terragrunt course: deck and repo (2026-11-28)
| Slides | Section | Owner's repo | Status | Notes | Terragrunt lesson |
|---|---|---|---|---|---|
| 56–57 | Terragrunt compatibility and installation | — | improve | 0.x links; Terragrunt is 1.2.3 (2026-11-25) | 1.2 |
| 574–577 | Terragrunt: what and why | `terragrunt/README.md` | ready | | 1.1 |
| 578–579 | remote_state with generated backend.tf | `terragrunt/live/<env>/terragrunt.hcl`, `backend.tf` | improve | DynamoDB lock table → `use_lockfile`; root file → `root.hcl` | 2.1 |
| 580–582 | units for VPC, EC2, S3 with include and inputs | `terragrunt/live/development/{vpc,ec2,bastion-host,eks-control-plane}` | improve | `include { path = find_in_parent_folders() }` → `include "root" { path = find_in_parent_folders("root.hcl") }` | 1.3, 1.4, 4.1 |
| 583 | dependencies between units | `live/development/eks-control-plane` | improve | `dependencies { paths }` → `dependency` blocks with mock outputs | 3.1 |
| 620–622 | Jenkins and Terragrunt | `terraform-concepts/terraform-with-jenkins-and-terragrunt` (README only) | missing (code) | Jenkinsfile written new | 6.3 |
| — | (not in the deck) stacks, `--filter-affected`, `backend bootstrap/migrate`, hooks/errors, drift, `terragrunt mcp` | — | missing | new lessons | 2.2, 3.2, 3.3, 5.x, 7.x, 8.x |

Repo: `aws-terraform/terragrunt/live/{development,staging,production}` with `common.yaml` (assetid 2560, environment,
project del) and units vpc, ec2, bastion-host, eks-control-plane (development only; staging and production hold only
their root file). No Azure Terragrunt code. Public variant `devopstia/s4` (`terroform/session04/terragrunt`), same
pattern. Slides 584–609 (Terraform Cloud, Packer) stay in the masterclass (lessons 13.2, 13.4).
New code: `code/terragrunt/` (validated with Terragrunt 1.2.3 and Terraform 1.17.2, see its README).

## Current facts used (checked 2026-11-27)
| Item | Value | Source |
|---|---|---|
| Terraform CLI | 1.17.2 (1.16.0 on 2026-08-27 added import blocks in child modules and destroy-time actions; 1.15 dynamic module sources, variable deprecation) | Terraform's own version check; HashiCorp blog/Discuss |
| AWS provider | 6.74.0 (2026-11-23); v6 added a per-resource `region` argument | registry.terraform.io |
| azurerm / azapi | 5.15.0 (2026-11-24) / 2.14.0 (2026-11-17) | registry.terraform.io |
| S3 state locking | `use_lockfile` (1.10 experimental, GA 1.11); `dynamodb_table` deprecated | developer.hashicorp.com S3 backend docs, v1.11 upgrade guide |
| Import / moved / removed / check | import blocks 1.5 (child modules 1.16), moved 1.1, removed 1.7, check 1.5 | Terraform docs |
| Ephemeral / write-only | ephemeral resources 1.10, write-only arguments 1.11 (`password_wo`, `value_wo`, `secret_string_wo`); azurerm `value_wo` on Key Vault secrets (schema checked) | HashiCorp 1.11 blog, provider schemas |
| `terraform test` | 1.6; `mock_provider` 1.7 | Terraform docs (tests run here: 3 passed) |
| HCP Terraform | the new name of Terraform Cloud; projects, variable sets, dynamic provider credentials | HashiCorp docs |
| Terraform MCP server | GA, v1.4.1 (2026-10-23), Docker `hashicorp/terraform-mcp-server:1.4.1`; toolsets `registry`, `registry-private`, `terraform` | GitHub releases, Docker Hub, developer.hashicorp.com/terraform/mcp-server |
| OpenTofu | v1.13.10 (2026-11-23) | GitHub releases |
| Terragrunt | v1.2.3 (2026-11-25) | GitHub releases |
| Bedrock as code | `aws_bedrockagent_knowledge_base` with `S3_VECTORS` storage (provider ≥ 6.27), `aws_s3vectors_*`, `aws_bedrock_guardrail`, `aws_bedrockagentcore_agent_runtime` | provider 6.74.0 schema |
| Foundry as code | `azurerm_cognitive_account` (kind AIServices, `project_management_enabled`), `azurerm_cognitive_account_project`, `azurerm_cognitive_deployment`, `azurerm_search_service`, `azurerm_cognitive_account_rai_policy` | azurerm 5.15.0 schema |
| Stacks | HCP Terraform Stacks exist (MCP server has Stacks tools); not taught (HCP-only, beyond the budget and scope); mentioned in 13.2 | HashiCorp blog |

## Validation results (2026-11-28)
Every folder with `.tf` files in `aws-terraform/{terraform-concepts,modules,resources,base-code}` and `azure-terraform/`
(386 folders), validated in place on a copy of the repo with Terraform 1.17.2, `init -backend=false`, then `validate`.
No credentials, nothing applied.

| Result | Folders | Examples |
|---|---:|---|
| Valid | 272 | most concept examples, 36 of 40 AWS modules, all `base-code` except 3 |
| Valid with warnings (deprecated arguments) | 13 | |
| `required_version` pins an old Terraform (`~> 1.0.0`, `~> 0.14`) | 13 | `terraform-concepts/learning-basic-commands`, `sessions/s5/*` |
| Breaks on today's provider majors (unpinned or `>=` pins pick up helm 3 / azurerm 5 / new module versions) | 22 | helm `set {}` blocks in `modules/aws-ebs-csi-driver`, `aws-load-balancer-controller`, `cluster-auto-scaler`, `external-dns`, Azure `nginx-ingress`; removed azurerm arguments in `aks-linux-node-group`, `aks-linux-spot-node-group`, `aks-windows-node-group`, `azure-mysql`, `aks-controle-plane`; registry module arguments in `resources/vpc-02`, `vpc-03`, `terraform-module/ec2` |
| Code errors (undeclared references, wrong arguments or functions) | 8 | `terraform-loops/others-examples-01/example-001`, `-004`, `terraform-join-function/example-03`, `terraform-comments/example-02`, `terraform-contitions/example-08`, `azure-terraform/modules/acr`, `youtube/manage-credentials/db` |
| Need sibling folders that are not in the repo (`Unreadable module directory`) | 2 | `resources/all`, `azure-terraform/resources/sc` |
| **Not checked here** (my local plugin cache was locked by leftover provider processes, or the registry query failed) | 56 | mostly `azure-terraform/resources*` and some AWS modules; not a finding about the code |

Lesson for the course: the breakages are the case for lesson 3.5 (pin providers with `~>`) and 13.5 (upgrade one step at
a time). Every lab the video agent takes from the repo gets current pins and a clean `validate` before recording.
