# AI-Powered Terragrunt: Terraform at Scale on AWS and on Azure: curriculum

Planned 2026-11-28 (owner: "we will also need Terragrunt and terraform course"). Two courses with the same lesson ids, as the masterclasses (owner's mirror rule): **AI-Powered Terragrunt on AWS: Terraform at Scale** and **AI-Powered Terragrunt on Azure: Terraform at Scale**. Shared videos are cloud-neutral and used by both; every cloud lesson has an AWS and an Azure video and lab. Plan: `TERRAFORM_MASTERCLASS_PLAN.md` § 12; code: `code/terragrunt/`; requests: CR-282 … CR-299 (module level) in `courses/CONTENT_REQUESTS.md`.

**Foundation:** the owner's Terragrunt section (deck slides 574–583, install 56–57, Jenkins + Terragrunt 620–622) and `aws-terraform/terragrunt/live` (development, staging, production with `common.yaml`; units vpc, ec2, bastion-host, eks-control-plane). Slides 584–609 (HCP Terraform, Packer) stay in the masterclass. The owner's `devopstia/s4` repo (session04/terragrunt) is a public older variant: same pattern, not needed.
**Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease. Labels as in the masterclasses: [owner original] · [owner original, updated] · [new, proposed] · [new, proposed: AI] · **[shared]**.
**Prerequisite:** the Terraform masterclass of the same cloud (modules 8–10, 13); the course does not re-teach Terraform.
**Budget:** estimate, log, destroy; no owner pause; the $80/$100 monthly alarms remain (`CONTENT_REQUESTS.md`). Almost every lab uses free resources.
**AI rule:** AI drafts units and reviews; Terragrunt (`hcl fmt`, `hcl validate`, `render`, plan) and a person verify; never auto-apply.

**Size per course:** 10 modules, 32 videos, about 5 h 27 min (15 shared videos, 17 cloud lessons). Both courses: 49 videos.

| Module | Videos | Minutes | Requests |
|---|---:|---:|---|
| 0 Introduction | 1 | 10 | intro: coordinator (CR-300+) |
| 1 Terragrunt 1.x essentials | 6 | 53 | CR-282 |
| 2 Remote state generation | 2 | 21 | CR-283, CR-284 |
| 3 Dependencies and orchestration | 3 | 28 | CR-285 |
| 4 Environments and the multi-account / multi-subscription layout | 3 | 34 | CR-286, CR-287 |
| 5 Catalogs and stacks | 3 | 30 | CR-288 |
| 6 CI/CD with OIDC | 3 | 36 | CR-289, CR-290 |
| 7 Drift detection and day-2 operations | 3 | 30 | CR-291, CR-292 |
| 8 AI for Terragrunt | 3 | 34 | CR-293, CR-294, CR-295 |
| 9 Capstone: a multi-account platform with Terragrunt | 5 | 51 | CR-296, CR-297, CR-298 |

## Module 0: Introduction
The course trailer: what Terragrunt adds to Terraform, the finished multi-environment platform, the roadmap.

### 0.1 Course introduction: Terraform at scale with Terragrunt and AI  [new, proposed]
- **Request:** the premium introduction request (CR-300 onward, written by the coordinator); none reserved here · **Duration:** ~10 min · **Depends on:** the Terraform masterclass of the same cloud
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** See the finished platform (three environments, stacks, a gated pipeline with an AI review); Follow the animated roadmap of the course; Know what to install and what it costs
- **Slides:** slides 574–576 · **Owner's repo:** — (none in the owner's repo)
- **AWS course:** Premium introduction (8–12 min): the capstone running first (a pull request that changes one unit, the affected-units plan, the AI review comment, approvals per environment), an animated roadmap of the ten modules, real previews of the projects, and a clear call to action. Shown on AWS: S3 state with native locking, one account per environment, GitHub OIDC.
  - Code: no lab (introduction video) · Resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- **Azure course:** Premium introduction (8–12 min): the capstone running first (a pull request that changes one unit, the affected-units plan, the AI review comment, approvals per environment), an animated roadmap of the ten modules, real previews of the projects, and a clear call to action. Shown on Azure: Storage state with lease locking, one subscription per environment, workload identity.
  - Code: no lab (introduction video) · Resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What does Terragrunt add on top of Terraform? (A: DRY configuration, generated backends and providers, and orchestration across units; B: A new cloud provider; C: A state format) → **A**
  2. Which course should you finish first? (A: The Terraform masterclass; B: None; C: The n8n course) → **A**
  3. What happens after every lab? (A: Destroy and verify nothing is left; B: Keep it running; C: Stop the VMs only) → **A**

## Module 1: Terragrunt 1.x essentials
The owner's Terragrunt lessons on today's Terragrunt: units, the root file, inputs, generated code and the CLI.

### 1.1 Why Terragrunt: the repetition problem in big Terraform estates  [owner original] **[shared]**
- **Request:** CR-282 · **Duration:** ~8 min · **Depends on:** Terraform masterclass (modules 8–10)
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Name the repetition Terraform leaves in multi-environment code (backends, providers, inputs); Explain units and the live/modules split; Decide when Terragrunt is worth it
- **Slides:** slides 576–577 · **Owner's repo:** `aws-terraform/terragrunt/README.md`
- **Demo (both courses, one video):** The owner's slide 576 explanation with a neutral example: three environment folders of copy-pasted Terraform, then the same with one module, three small terragrunt.hcl files and one root.hcl.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What is a unit in Terragrunt? (A: A folder with a terragrunt.hcl that deploys one module instance; B: A Terraform provider; C: A state file) → **A**
  2. What usually repeats across environments without Terragrunt? (A: Backend and provider blocks and inputs; B: Resource types; C: The Terraform binary) → **A**
  3. When is Terragrunt not worth it? (A: A single small stack with one environment; B: Many environments and accounts; C: Many teams) → **A**

### 1.2 Install Terragrunt 1.x and pin versions  [owner original, updated] **[shared]**
- **Request:** CR-282 · **Duration:** ~8 min · **Depends on:** 1.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease · **re-recorded on these versions**
- **Objectives:** Install Terragrunt 1.2.x with a checksum check; Pin Terraform and Terragrunt versions per repo; Know the 0.x to 1.x renames
- **Slides:** slides 56–57 · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** The owner's install steps (slides 56–57) with Terragrunt 1.2.3 and Terraform 1.17.2, checksum verification, mise or tgenv pins, terraform_version_constraint / terragrunt_version_constraint; the renames: run-all → run --all, terragrunt.hcl root → root.hcl, hclfmt → hcl fmt.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. Which command replaced run-all? (A: terragrunt run --all; B: terragrunt all; C: terragrunt run-all-units) → **A**
  2. Why verify the download checksum? (A: To be sure the binary is the published one; B: It is faster; C: Terragrunt requires it) → **A**
  3. Which setting pins the Terraform version a repo accepts? (A: terraform_version_constraint; B: required_terragrunt; C: tf_pin) → **A**
- **Notes:** Outdated: the deck links the 0.x compatibility table and run-all commands; Terragrunt 1.x (v1.2.3, 2026-11-25) renamed the CLI.

### 1.3 Units, root.hcl and include  [owner original, updated] **[shared]**
- **Request:** CR-282 · **Duration:** ~10 min · **Depends on:** 1.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease · **re-recorded on these versions**
- **Objectives:** Write a unit with terraform.source and inputs; Include a root.hcl with find_in_parent_folders("root.hcl"); Expose the root's locals to a unit
- **Slides:** slides 580–582 · **Owner's repo:** `aws-terraform/terragrunt/live/development/{vpc,ec2,bastion-host}/terragrunt.hcl`
- **Demo (both courses, one video):** The owner's development/vpc unit (slide 580) rebuilt with local_file and random_pet modules: source with the double slash, include "root" with expose, inputs; terragrunt render to see the final configuration.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What does the double slash in source = "../modules//vpc" mean? (A: Copy the modules folder, run in its vpc subfolder; B: A comment; C: A Git ref) → **A**
  2. How does a unit read a value from root.hcl locals? (A: include "root" { expose = true } then include.root.locals.x; B: var.root; C: It cannot) → **A**
  3. Which command shows the final configuration with includes resolved? (A: terragrunt render; B: terragrunt show; C: terragrunt print) → **A**
- **Notes:** Improve: the owner's units use include { path = find_in_parent_folders() } and a root terragrunt.hcl; 1.x uses a named include and root.hcl.

### 1.4 Inputs, locals and the common.yaml convention  [owner original] **[shared]**
- **Request:** CR-282 · **Duration:** ~9 min · **Depends on:** 1.3
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Pass inputs that become TF_VAR values; Load the owner's common.yaml with yamldecode; Build names from assetid, environment and project
- **Slides:** slides 578–582 · **Owner's repo:** `aws-terraform/terragrunt/live/*/common.yaml`
- **Demo (both courses, one video):** The owner's common.yaml (assetid 2560, environment, project del) loaded in root.hcl and used for names like 2560-dev-del-*, the same convention as the Terraform masterclass naming lesson.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. How do inputs reach Terraform? (A: As TF_VAR_ environment variables for the module; B: As a tfvars file in Git; C: Through the state) → **A**
  2. Which function reads the owner's common.yaml? (A: yamldecode(file(...)); B: jsondecode; C: read_yaml) → **A**
  3. Which function finds the nearest common.yaml above a unit? (A: find_in_parent_folders("common.yaml"); B: get_parent; C: path_relative) → **A**

### 1.5 Generate blocks: providers and versions once  [new, proposed] **[shared]**
- **Request:** CR-282 · **Duration:** ~8 min · **Depends on:** 1.4
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Generate provider.tf and versions.tf from root.hcl; Use if_exists safely; Keep modules free of provider configuration
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** A generate "provider" block with a neutral provider, then if_exists = "overwrite_terragrunt" vs "skip"; why modules must not configure providers themselves.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What does a generate block do? (A: Writes a file into the unit's working directory before Terraform runs; B: Generates a module; C: Creates state) → **A**
  2. Why should modules not configure providers? (A: The caller decides region, account and credentials; B: Providers are deprecated; C: It is faster) → **A**
  3. What does if_exists = "overwrite_terragrunt" protect? (A: Files you wrote yourself are never overwritten; B: Nothing; C: The state) → **A**

### 1.6 The Terragrunt 1.x CLI: run, run --all, find, list and dag graph  [new, proposed] **[shared]**
- **Request:** CR-282 · **Duration:** ~10 min · **Depends on:** 1.5
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Run one unit and all units; List and find units and their dependencies; Draw the dependency graph
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** terragrunt run plan, run --all plan, find, list --dag, dag graph (DOT), --filter and --parallelism on the course's neutral live tree.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. Which command draws the dependency graph? (A: terragrunt dag graph; B: terragrunt graph-deps; C: terraform graph) → **A**
  2. What does --filter do with run --all? (A: Limits the units that run; B: Filters output lines; C: Deletes units) → **A**
  3. Which flag limits how many units run at once? (A: --parallelism; B: --max; C: --threads) → **A**

## Module 2: Remote state generation
One backend definition for every unit, with native locking; bootstrapping and migrating state.

### 2.1 Generate the backend for every unit  [owner original, updated]
- **Request:** CR-283 (AWS) / CR-284 (Azure) · **Duration:** ~12 min · **Depends on:** 1.3; masterclass 8.2 state store
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease · **re-recorded on these versions**
- **Objectives:** Define remote_state once in root.hcl; Give every unit its own state key with path_relative_to_include(); Show locking with two runs
- **Slides:** slides 578–579 · **Owner's repo:** `aws-terraform/terragrunt/live/development/{terragrunt.hcl,backend.tf}`
- **AWS course:** Lesson code: backend "s3" generated with use_lockfile = true and a key per environment and unit (the owner's DynamoDB table removed); two applies at once show the lock.
  - Code: `courses/terraform/code/terragrunt/aws/root.hcl` (ready, validated) · Resources: S3 state bucket (from the masterclass lesson 8.2), SSM parameters · Cost per run: ~$0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** Lesson code: backend "azurerm" generated with use_azuread_auth and a key per environment and unit; blob lease locking.
  - Code: `courses/terraform/code/terragrunt/azure/root.hcl` (ready, validated) · Resources: Storage account and container (from masterclass lesson 8.2) · Cost per run: ~$0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What gives each unit its own state file? (A: A key built with path_relative_to_include(); B: A separate bucket per unit; C: Workspaces) → **A**
  2. Where is remote_state defined? (A: Once, in root.hcl; B: In every module; C: In the state) → **A**
  3. What does the generated backend.tf contain? (A: The backend block for that unit; B: The provider; C: Outputs) → **A**
  AWS: 4. Which S3 backend setting replaces the DynamoDB lock table? (A: use_lockfile = true; B: dynamodb_table; C: lock_table) → **A**
  Azure: 4. How does the azurerm backend lock state? (A: A lease on the state blob; B: A lock table; C: A Git tag) → **A**
- **Notes:** Outdated: the owner's root config sets dynamodb_table (deprecated since Terraform 1.11); replaced by use_lockfile = true.

### 2.2 Bootstrap and migrate state with terragrunt backend  [new, proposed]
- **Request:** CR-283 (AWS) / CR-284 (Azure) · **Duration:** ~9 min · **Depends on:** 2.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Bootstrap the state store with terragrunt backend bootstrap; Move a unit's state with backend migrate; Delete state only on purpose
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **AWS course:** terragrunt backend bootstrap creating a versioned, encrypted bucket; backend migrate when a unit is renamed; why --backend-bootstrap stays off in CI.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (aws) · Resources: none or free resources only · Cost per run: ~$0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The state storage account created by the masterclass bootstrap; backend migrate after renaming a unit folder.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (azure) · Resources: none or free resources only · Cost per run: ~$0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What happens to state when you rename a unit folder? (A: Its key changes, so migrate the state first; B: Nothing; C: Terraform renames it) → **A**
  2. Why keep automatic bootstrap off in CI? (A: The pipeline should never create state stores by surprise; B: It is slower; C: It is not supported) → **A**
  3. Which command moves state between units? (A: terragrunt backend migrate; B: terragrunt state mv only; C: terragrunt copy) → **A**
  AWS: 4. Which bucket settings must bootstrap set? (A: Versioning, encryption and public access block; B: Static website; C: Replication only) → **A**
  Azure: 4. Which auth should the azurerm backend use? (A: Entra ID (use_azuread_auth); B: Storage account keys; C: Anonymous) → **A**

## Module 3: Dependencies and orchestration
Units that read each other's outputs, run in order, retry and run hooks.

### 3.1 dependency blocks and mock outputs  [owner original, updated] **[shared]**
- **Request:** CR-285 · **Duration:** ~10 min · **Depends on:** 2.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease · **re-recorded on these versions**
- **Objectives:** Read another unit's outputs with a dependency block; Plan before the dependency exists with mock outputs; Limit mocks to safe commands
- **Slides:** slide 583 · **Owner's repo:** `aws-terraform/terragrunt/live/development/eks-control-plane/terragrunt.hcl`
- **Demo (both courses, one video):** The owner's slide 583 (an RDS security group depending on the VPC) rebuilt with neutral units: dependency "network", outputs, mock_outputs with mock_outputs_allowed_terraform_commands = ["init", "validate", "plan"].
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What do mock outputs allow? (A: Planning a unit before its dependency is applied; B: Applying without dependencies; C: Skipping tests) → **A**
  2. Why limit mocks to init, validate and plan? (A: An apply must never use fake values; B: Mocks are slow; C: It is required) → **A**
  3. How does a unit read the network's vpc_id? (A: dependency.network.outputs.vpc_id; B: var.network; C: data.network) → **A**
- **Notes:** Improve: the owner's example uses dependencies { paths } only; dependency blocks also pass outputs.

### 3.2 run --all: order, filters, the affected units and parallelism  [new, proposed] **[shared]**
- **Request:** CR-285 · **Duration:** ~10 min · **Depends on:** 3.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Predict the run order from the DAG; Run only what a change affects with --filter-affected; Destroy in reverse order safely
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** run --all plan on the neutral tree, the order printed by list --dag, --filter-affected after a commit, run --all destroy in reverse order, --queue-ignore-dag-order and why not to use it.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. In which order does run --all destroy run? (A: Reverse dependency order; B: Alphabetical; C: Random) → **A**
  2. What does --filter-affected select? (A: Units changed between main and HEAD and what depends on them; B: Every unit; C: Only failed units) → **A**
  3. Why avoid --queue-ignore-dag-order? (A: Dependencies may run before what they need; B: It is slower; C: It is deprecated) → **A**

### 3.3 Hooks, errors and retries  [new, proposed] **[shared]**
- **Request:** CR-285 · **Duration:** ~8 min · **Depends on:** 3.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Run before and after hooks (fmt, tflint, checkov); Retry known transient errors; Ignore nothing silently
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** before_hook running terraform fmt -check and TFLint, an after_hook posting a message, the errors block with retry rules for a throttling error.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What is a before_hook good for? (A: Checks such as fmt and lint before Terraform runs; B: Changing state; C: Creating units) → **A**
  2. Which errors may be retried automatically? (A: Known transient ones like throttling; B: Every error; C: Validation errors) → **A**
  3. Where are retry rules defined in Terragrunt 1.x? (A: The errors block; B: A shell loop; C: The provider) → **A**

## Module 4: Environments and the multi-account / multi-subscription layout
The owner's dev/staging/production tree, one account or subscription per environment, and promotion.

### 4.1 The live tree: environments, regions and units  [owner original, updated]
- **Request:** CR-286 (AWS) / CR-287 (Azure) · **Duration:** ~12 min · **Depends on:** 3.3
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease · **re-recorded on these versions**
- **Objectives:** Lay out live/<environment>/<unit>; Keep environment values in common.yaml; Add an environment by copying four small files
- **Slides:** slides 576–582 · **Owner's repo:** `aws-terraform/terragrunt/live/{development,staging,production}`
- **AWS course:** Lesson code: development, staging and production, each with common.yaml (assetid, environment, project, region, account_id) and network/app units; terragrunt dag graph.
  - Code: `courses/terraform/code/terragrunt/aws/live` (ready, validated) · Resources: VPC, subnets, IGW, security groups, SSM parameters (all free) · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** Lesson code: the same tree with subscription_id, location and the state storage account in each common.yaml.
  - Code: `courses/terraform/code/terragrunt/azure/live` (ready, validated) · Resources: Resource groups, VNets, subnets, NSGs (all free) · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What changes between environment folders? (A: Only small value files and inputs; B: The modules; C: The Terraform version) → **A**
  2. Where do environment values live in the owner's layout? (A: common.yaml per environment; B: main.tf; C: The state) → **A**
  3. How do you add a new environment? (A: Copy an environment folder and change its values; B: Edit every module; C: Create a new repo) → **A**
  AWS: 4. What identifies the target AWS account in common.yaml? (A: account_id; B: region; C: assetid) → **A**
  Azure: 4. What identifies the target Azure subscription in common.yaml? (A: subscription_id; B: location; C: tenant name) → **A**

### 4.2 One account or subscription per environment  [new, proposed]
- **Request:** CR-286 (AWS) / CR-287 (Azure) · **Duration:** ~12 min · **Depends on:** 4.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Generate a provider that assumes the environment's role or targets its subscription; Guard against the wrong account; Explain why prod is isolated
- **Slides:** slides 447–458 (masterclass) · **Owner's repo:** —
- **AWS course:** The generated provider with assume_role per environment and allowed_account_ids; AWS Organizations layout explained; a deliberate wrong account id fails the plan.
  - Code: `courses/terraform/code/terragrunt/aws/root.hcl` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The generated provider with subscription_id per environment; management groups explained; a wrong subscription fails the guard.
  - Code: `courses/terraform/code/terragrunt/azure/root.hcl` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. Why one account or subscription per environment? (A: A dev mistake cannot reach prod; B: It is cheaper; C: Terraform requires it) → **A**
  2. Where is the provider written? (A: Generated once from root.hcl; B: In every unit; C: In the module) → **A**
  3. What should a wrong-environment run do? (A: Fail before any change; B: Apply with a warning; C: Nothing) → **A**
  AWS: 4. Which provider argument blocks the wrong AWS account? (A: allowed_account_ids; B: assume_role; C: region) → **A**
  Azure: 4. Which provider argument selects the Azure subscription? (A: subscription_id; B: tenant_id only; C: location) → **A**

### 4.3 Promote a module version from dev to staging to prod  [new, proposed]
- **Request:** CR-286 (AWS) / CR-287 (Azure) · **Duration:** ~10 min · **Depends on:** 4.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Source modules by Git tag; Promote a tag one environment at a time; Roll back by moving back a tag
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **AWS course:** The network module tagged v1.1.0, used by development, then staging, then production; a bad change rolled back to v1.0.0.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (aws) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same promotion on the Azure tree.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (azure) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. How is a module version pinned in a unit? (A: source = "git::...//network?ref=v1.1.0"; B: version = latest; C: A branch name) → **A**
  2. In which order is a change promoted? (A: Development, staging, production; B: Production first; C: All at once) → **A**
  3. How do you roll back a unit? (A: Point it at the previous tag and apply; B: Delete the state; C: Edit the cloud console) → **A**
  AWS: 4. What does the AWS promotion change in the tree? (A: Only the ref in each environment's unit; B: The bucket; C: The account) → **A**
  Azure: 4. What does the Azure promotion change in the tree? (A: Only the ref in each environment's unit; B: The subscription; C: The storage account) → **A**

## Module 5: Catalogs and stacks
Reusable unit templates and Terragrunt 1.x stacks: a whole environment from one file.

### 5.1 A module catalog and scaffold  [new, proposed] **[shared]**
- **Request:** CR-288 · **Duration:** ~8 min · **Depends on:** 4.3
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Organise modules and unit templates as a catalog; Start a unit with terragrunt scaffold; Browse it with terragrunt catalog
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** The course modules folder as a catalog, terragrunt scaffold for a new unit, terragrunt catalog to browse, and versioning the catalog repo.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What does terragrunt scaffold create? (A: A new unit's terragrunt.hcl from a module; B: A module; C: A state) → **A**
  2. Why version the catalog? (A: Environments choose when to take changes; B: It is required; C: Faster plans) → **A**
  3. Where do unit templates live? (A: In the catalog (units/); B: In every environment; C: In the state) → **A**

### 5.2 Stacks: an environment from one terragrunt.stack.hcl  [new, proposed] **[shared]**
- **Request:** CR-288 · **Duration:** ~12 min · **Depends on:** 5.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Write unit blocks with source, path and values; Generate and run a stack; Read values inside a unit template
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **Demo (both courses, one video):** The course's production stack: unit "network" and unit "app" with values, terragrunt stack generate (.terragrunt-stack/), stack run plan, stack output, stack clean.
- **Code:** `courses/terraform/code/terragrunt/aws/stacks/production` (ready, validated), `courses/terraform/code/terragrunt/azure/stacks/production` (ready, validated) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What does terragrunt stack generate do? (A: Writes the stack's units into .terragrunt-stack; B: Applies the stack; C: Deletes state) → **A**
  2. How does a unit template read stack values? (A: values.<name>; B: var.<name>; C: local.<name>) → **A**
  3. Should .terragrunt-stack be committed? (A: No, it is generated; B: Yes; C: Only in prod) → **A**

### 5.3 Move a live tree to stacks without destroying anything  [new, proposed] **[shared]**
- **Request:** CR-288 · **Duration:** ~10 min · **Depends on:** 5.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Keep state keys stable while switching to stacks; Use backend migrate where keys change; Prove the change with a no-op plan
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** The development tree turned into a stack: compare state keys, migrate where the path changes, and end with plans that show no changes.
- **Code:** GEN builds it in `courses/terraform/code/terragrunt/` (neutral providers) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What must a migration to stacks end with? (A: Plans with no changes; B: Recreated resources; C: New accounts) → **A**
  2. Why do state keys matter in this move? (A: A new key means Terraform sees empty state and recreates resources; B: They do not; C: They change the region) → **A**
  3. Which tool moves state to the new key? (A: terragrunt backend migrate; B: git mv; C: terraform import only) → **A**

## Module 6: CI/CD with OIDC
Pipelines that plan only what changed, apply environment by environment, and never store cloud keys.

### 6.1 Plan affected units on every pull request  [new, proposed]
- **Request:** CR-289 (AWS) / CR-290 (Azure) · **Duration:** ~14 min · **Depends on:** masterclass 13.1 (OIDC)
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Sign in with OIDC from GitHub Actions; Plan only affected units with --filter-affected; Post the plan on the pull request
- **Slides:** slides 614–616 (masterclass) · **Owner's repo:** —
- **AWS course:** Lesson code: the plan workflow with configure-aws-credentials (plan role), Terragrunt installed with a checksum, hcl fmt --check, run --all --filter-affected plan, a PR comment.
  - Code: `courses/terraform/code/terragrunt/.github/workflows/terragrunt-plan.yml` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The Azure variant: azure/login with the plan identity's federated credential, ARM_USE_OIDC, the same affected-units plan.
  - Code: `courses/terraform/code/terragrunt/.github/workflows/terragrunt-plan.yml` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. Why plan only affected units? (A: Faster runs and a smaller review; B: It is required; C: It hides changes) → **A**
  2. What does the pipeline store for cloud access? (A: Nothing secret: OIDC gives short-lived credentials; B: Access keys; C: Passwords) → **A**
  3. What must the checkout fetch for --filter-affected? (A: Enough history to compare with main; B: Nothing; C: Tags only) → **A**
  AWS: 4. Which action assumes the AWS plan role? (A: aws-actions/configure-aws-credentials; B: actions/cache; C: hashicorp/setup-terraform) → **A**
  Azure: 4. Which action signs in to Azure with OIDC? (A: azure/login with a federated credential; B: actions/checkout; C: azure/cli with a password) → **A**

### 6.2 Apply environment by environment with approvals  [new, proposed]
- **Request:** CR-289 (AWS) / CR-290 (Azure) · **Duration:** ~12 min · **Depends on:** 6.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Apply after merge one environment at a time; Require a reviewer per environment; Stop on the first failure
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **AWS course:** Lesson code: the apply workflow with a matrix development → staging → production (max-parallel 1), each a GitHub environment with a required reviewer and its own role.
  - Code: `courses/terraform/code/terragrunt/.github/workflows/terragrunt-apply.yml` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same with one managed identity per environment and its federated credential (environment:<name>).
  - Code: `courses/terraform/code/terragrunt/.github/workflows/terragrunt-apply.yml` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. Why max-parallel 1 in the apply matrix? (A: Environments go one after the other; B: Speed; C: Cost) → **A**
  2. Who approves production? (A: A named reviewer on the GitHub environment; B: The AI; C: Nobody) → **A**
  3. What happens if staging fails? (A: Production does not run; B: Production runs anyway; C: The state is deleted) → **A**
  AWS: 4. How does each environment get its own AWS rights? (A: A role per environment trusted for that environment's OIDC subject; B: One shared key; C: The root user) → **A**
  Azure: 4. How does each environment get its own Azure rights? (A: A managed identity per environment with its federated credential; B: One storage key; C: A password) → **A**

### 6.3 Terragrunt in Jenkins  [owner original, updated]
- **Request:** CR-289 (AWS) / CR-290 (Azure) · **Duration:** ~10 min · **Depends on:** masterclass 11.7 (Jenkins)
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease · **re-recorded on these versions**
- **Objectives:** Run run --all plan and apply from a Jenkinsfile; Use the agent's role or managed identity; Gate apply with an input step
- **Slides:** slides 620–622 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-with-jenkins-and-terragrunt (README)`
- **AWS course:** A Jenkinsfile for the owner's Jenkins (masterclass lesson 11.7): instance profile credentials, plan, input, apply per environment.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (aws) · Resources: Jenkins EC2 from the masterclass (t3.small) · Cost per run: ~$0.10 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same on the Azure Jenkins VM with its managed identity (ARM_USE_MSI).
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (azure) · Resources: Jenkins VM from the masterclass (B2s) · Cost per run: ~$0.15 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. Which Jenkins step waits for approval? (A: input; B: sh; C: build) → **A**
  2. Where do Jenkins credentials come from? (A: The agent's role or managed identity; B: A key in the Jenkinsfile; C: The state) → **A**
  3. Why apply a saved plan? (A: The apply does exactly what was reviewed; B: Speed; C: It is required) → **A**
  AWS: 4. How does the EC2 agent get AWS credentials? (A: Its instance profile; B: A key file; C: The root user) → **A**
  Azure: 4. Which setting makes azurerm use the VM's managed identity? (A: ARM_USE_MSI=true; B: ARM_KEY; C: use_cli) → **A**
- **Notes:** Gap: the owner's Jenkins + Terragrunt folder has no Jenkinsfile; written new.

## Module 7: Drift detection and day-2 operations
Find drift every night, keep versions current, and destroy safely.

### 7.1 Nightly drift detection  [new, proposed]
- **Request:** CR-291 (AWS) / CR-292 (Azure) · **Duration:** ~12 min · **Depends on:** 6.3
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Plan every unit on a schedule with -detailed-exitcode; Open an issue when something drifted; Decide to revert or adopt the change
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **AWS course:** Lesson code: the nightly workflow; a security group rule added in the console is reported the next morning and reverted by apply.
  - Code: `courses/terraform/code/terragrunt/.github/workflows/terragrunt-drift.yml` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same with an NSG rule added in the portal.
  - Code: `courses/terraform/code/terragrunt/.github/workflows/terragrunt-drift.yml` (ready, validated) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What does exit code 2 from plan -detailed-exitcode mean? (A: There are changes; B: Error; C: No changes) → **A**
  2. What are the two ways to fix drift? (A: Revert it with apply, or adopt it in code; B: Delete the state; C: Ignore it) → **A**
  3. Why use -lock=false in the nightly plan? (A: It only reads and must not block real applies; B: It is faster; C: It is required) → **A**
  AWS: 4. Which change did the AWS demo detect? (A: A security group rule added in the console; B: A new region; C: A deleted bucket) → **A**
  Azure: 4. Which change did the Azure demo detect? (A: An NSG rule added in the portal; B: A new subscription; C: A deleted RG) → **A**

### 7.2 Keep versions current: Terraform, providers and Terragrunt  [new, proposed]
- **Request:** CR-291 (AWS) / CR-292 (Azure) · **Duration:** ~10 min · **Depends on:** 7.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Upgrade one version step in a branch; Use the provider cache for speed; Read upgrade guides before major versions
- **Slides:** slides 610–613 (masterclass) · **Owner's repo:** — (none in the owner's repo)
- **AWS course:** A Terragrunt patch upgrade and an AWS provider minor upgrade across all units on a branch, with a no-change plan as the goal; --provider-cache.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (aws) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same with azurerm.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (azure) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What is the goal plan after an upgrade? (A: No changes; B: Everything replaced; C: Any plan) → **A**
  2. Why upgrade on a branch first? (A: The pipeline proves it before it reaches main; B: It is required; C: It is faster) → **A**
  3. What does the provider cache save? (A: Downloading providers for every unit; B: State; C: Credentials) → **A**
  AWS: 4. Which AWS provider major is current? (A: 6; B: 4; C: 3) → **A**
  Azure: 4. Which azurerm major is current? (A: 5; B: 3; C: 2) → **A**

### 7.3 Destroy safely and prove nothing is left  [new, proposed]
- **Request:** CR-291 (AWS) / CR-292 (Azure) · **Duration:** ~8 min · **Depends on:** 7.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Destroy in reverse order with run --all destroy; Protect production with prevent_destroy; Prove the account is clean by tags
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **AWS course:** run --all destroy in development, prevent_destroy on production data units, the tag search.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (aws) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same with a Resource Graph query on the Course tag.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (azure) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. Which units are destroyed first? (A: The ones that depend on others; B: The network; C: Random) → **A**
  2. What protects production data units? (A: prevent_destroy; B: A comment; C: A tag) → **A**
  3. How do you prove nothing is left? (A: A tag search returns nothing; B: The pipeline is green; C: Closing the terminal) → **A**
  AWS: 4. Which AWS tool searches by tag? (A: Resource Groups Tag Editor; B: IAM; C: CloudFront) → **A**
  Azure: 4. Which Azure tool searches by tag? (A: Azure Resource Graph; B: Key Vault; C: Bastion) → **A**

## Module 8: AI for Terragrunt
AI drafts units and reviews changes; Terragrunt, the plan and a person verify.

### 8.1 AI generates units from the catalog  [new, proposed: AI] **[shared]**
- **Request:** CR-293 · **Duration:** ~10 min · **Depends on:** 7.3
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Give an AI assistant the repository conventions in a professional prompt; Verify its unit with hcl fmt, hcl validate, render and a plan; Reject output that breaks conventions
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **Demo (both courses, one video):** The prompt file run live; the first answer adds a provider block (against the rule) and a wrong include; the checks catch both; the fixed unit plans cleanly with mocks.
- **Code:** `courses/terraform/code/terragrunt/ai/generate-unit.md` (ready, validated) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. What did the checks catch in the first AI answer? (A: A provider block and a wrong include; B: Nothing; C: A typo in a comment) → **A**
  2. Which command shows the unit's final configuration for review? (A: terragrunt render; B: terragrunt show; C: terragrunt graph) → **A**
  3. Who decides to keep AI output? (A: A person, after the checks pass; B: The AI; C: The pipeline only) → **A**

### 8.2 AI review of a Terragrunt pull request  [new, proposed: AI]
- **Request:** CR-294 (AWS) / CR-295 (Azure) · **Duration:** ~14 min · **Depends on:** 6.1
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Feed the AI the affected units, the DAG and the plans; Get risks, blast radius and environment checks as a comment; Keep the human approval as the gate
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **AWS course:** The plan workflow plus a review job: affected units (find --filter-affected), dag graph and plans summarised by a model with the review prompt; a production change without staging is flagged HIGH RISK.
  - Code: `courses/terraform/code/terragrunt/ai/review-terragrunt-plan.md` (ready, validated), `courses/terraform/code/terragrunt/.github/workflows/terragrunt-plan.yml` (ready, validated) · Resources: none or free resources only · Cost per run: ~$0.10 (model calls) · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same on the Azure pipeline.
  - Code: `courses/terraform/code/terragrunt/ai/review-terragrunt-plan.md` (ready, validated), `courses/terraform/code/terragrunt/.github/workflows/terragrunt-plan.yml` (ready, validated) · Resources: none or free resources only · Cost per run: ~$0.10 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What does the DAG add to an AI review? (A: The blast radius: units that depend on the change; B: Speed; C: Credentials) → **A**
  2. Can the AI approve the change? (A: No, it only comments; B: Yes; C: Only on Fridays) → **A**
  3. What should never be sent to the model? (A: Secrets and state; B: The plan summary; C: The diff) → **A**
  AWS: 4. Where does the model key live? (A: A GitHub secret; B: In root.hcl; C: In common.yaml) → **A**
  Azure: 4. Where does the model key live in the Azure pipeline? (A: A GitHub secret (or Key Vault via OIDC); B: In root.hcl; C: In the state) → **A**

### 8.3 A read-only MCP server for your Terragrunt repo  [new, proposed: AI] **[shared]**
- **Request:** CR-293 · **Duration:** ~10 min · **Depends on:** masterclass 14.5
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Serve Terragrunt to an AI agent with terragrunt mcp (experiment) in read-only mode; Add the Terraform MCP registry toolset for current docs; Keep apply and exec off
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **Demo (both courses, one video):** terragrunt mcp with the mcp-command experiment and no --allow flags (apply and destroy are off unless --dangerously-allow-apply), plus the Terraform MCP server's registry toolset; the agent explains the DAG and a unit's inputs; it cannot apply.
- **Code:** `courses/terraform/code/terraform-mcp-server` (ready, validated) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. Which flag would allow apply through Terragrunt's MCP server? (A: --dangerously-allow-apply (left off); B: --read-only; C: --safe) → **A**
  2. What does the Terraform MCP registry toolset add? (A: Current provider and module docs; B: Cloud credentials; C: State access) → **A**
  3. What is the agent allowed to do in this lesson? (A: Read and explain; B: Apply; C: Destroy) → **A**
- **Notes:** terragrunt mcp is an experiment in 1.2.3 (needs --experiment mcp-command): check its flags on the recording day.

## Module 9: Capstone: a multi-account platform with Terragrunt
Three environments in separate accounts or subscriptions, stacks, the full pipeline, drift, destroy.

### 9.1 Capstone design and cost  [new, proposed]
- **Request:** CR-297 (AWS) / CR-298 (Azure) · **Duration:** ~8 min · **Depends on:** 8.3
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Read the requirements; Design accounts or subscriptions, state, stacks and the pipeline; Estimate the cost
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **AWS course:** Three accounts (or one with prefixes), state per account, a stack per environment from the catalog, the OIDC pipeline with AI review and approvals.
  - Code: the capstone requirements and design PDF · Resources: none or free resources only · Cost per run: $0 (design) · Cleanup: nothing is created
- **Azure course:** Three subscriptions (or one with prefixes), Storage state per subscription, a stack per environment, workload identity per environment.
  - Code: the capstone requirements and design PDF · Resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What does each environment get? (A: Its own state, identity and stack; B: A copy of the modules; C: Nothing) → **A**
  2. Why estimate before building? (A: To stay in budget and know what to destroy; B: It is required; C: For fun) → **A**
  3. What is the single source of the environment's units? (A: Its terragrunt.stack.hcl; B: The state; C: The README) → **A**

### 9.2 Build the environments as stacks  [new, proposed]
- **Request:** CR-297 (AWS) / CR-298 (Azure) · **Duration:** ~16 min · **Depends on:** 5.2, 4.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Build development, staging and production stacks from the catalog; Apply development; Read stack outputs
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **AWS course:** Network, app and a small RDS PostgreSQL (db.t4g.micro, write-only password) unit per stack; development applied.
  - Code: `courses/terraform/code/terragrunt/aws/stacks` (ready, validated) · Resources: VPC, SG, SSM, RDS db.t4g.micro · Cost per run: ~$0.10 per session; destroy the same day · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** Network, app and PostgreSQL Flexible B1ms (write-only password) per stack; development applied.
  - Code: `courses/terraform/code/terragrunt/azure/stacks` (ready, validated) · Resources: VNet, NSG, PostgreSQL Flexible B1ms · Cost per run: ~$0.10 per session; destroy the same day · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. How is the database password kept out of state? (A: Ephemeral value with a write-only argument; B: In common.yaml; C: In inputs) → **A**
  2. Which environment is applied first? (A: Development; B: Production; C: All) → **A**
  3. How do you read a stack's outputs? (A: terragrunt stack output; B: terraform output in root; C: cat state) → **A**
  AWS: 4. Which RDS class keeps the lab cheap? (A: db.t4g.micro; B: db.r6g.large; C: db.m5.xlarge) → **A**
  Azure: 4. Which PostgreSQL Flexible SKU keeps the lab cheap? (A: B1ms; B: D4s; C: E8s) → **A**

### 9.3 The pipeline: affected plans, AI review, approvals and drift  [new, proposed]
- **Request:** CR-297 (AWS) / CR-298 (Azure) · **Duration:** ~14 min · **Depends on:** 6.2, 7.1, 8.2
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Run the full pipeline on a pull request; Promote through staging to production with approvals; Watch the nightly drift job
- **Slides:** none in the deck (new lesson) · **Owner's repo:** —
- **AWS course:** A PR changing the app unit: affected-units plan, AI review comment, merge, development → staging → production with approvals; drift found the next morning and reverted.
  - Code: `courses/terraform/code/terragrunt/.github/workflows` (ready, validated) · Resources: none or free resources only · Cost per run: ~$0.20 (model calls; infra in 9.2) · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same on Azure.
  - Code: `courses/terraform/code/terragrunt/.github/workflows` (ready, validated) · Resources: none or free resources only · Cost per run: ~$0.20 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. Which units does the PR plan? (A: Only the affected ones; B: All of them; C: None) → **A**
  2. When does production apply? (A: After staging succeeds and a reviewer approves; B: Immediately; C: Never) → **A**
  3. What does the drift job do when it finds a change? (A: Opens an issue; B: Applies automatically; C: Deletes the unit) → **A**
  AWS: 4. How does the AWS pipeline sign in? (A: OIDC roles per environment; B: Access keys; C: The root user) → **A**
  Azure: 4. How does the Azure pipeline sign in? (A: Managed identities with federated credentials; B: Storage keys; C: Passwords) → **A**

### 9.4 Destroy the platform and prove it  [new, proposed]
- **Request:** CR-297 (AWS) / CR-298 (Azure) · **Duration:** ~8 min · **Depends on:** 9.3
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Destroy production, staging, then development; Remove state stores last; Prove nothing is left
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **AWS course:** stack run destroy per environment, state bucket emptied and deleted, tag search empty.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (aws) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terragrunt-aws`; the README lists the exact check)
- **Azure course:** The same with resource groups and the Resource Graph query.
  - Code: GEN builds it in `courses/terraform/code/terragrunt/` (azure) · Resources: none or free resources only · Cost per run: $0 · Cleanup: `terragrunt run --all destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terragrunt-azure`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Quiz** (questions 1–3 in both courses; question 4 per course):
  1. What is destroyed last? (A: The state store; B: The network; C: The app) → **A**
  2. Why destroy production first in a lab? (A: It holds the most protected data and must be confirmed explicitly; B: It is cheaper; C: Random) → **A**
  3. What proves the lab is clean? (A: An empty tag search; B: A green pipeline; C: Nothing) → **A**
  AWS: 4. What must be emptied before deleting the AWS state bucket? (A: All object versions; B: Nothing; C: Only the latest file) → **A**
  Azure: 4. What usually remains after deleting Azure resource groups? (A: Nothing, if every resource was inside them; B: The VNets; C: The NSGs) → **A**

### 9.5 Wrap-up, final assessment and what to learn next  [new, proposed] **[shared]**
- **Request:** CR-296 · **Duration:** ~5 min · **Depends on:** 9.4
- **Versions:** Terragrunt 1.x (checked 1.2.3) · Terraform 1.17.x · AWS provider ~> 6.0 / azurerm ~> 5.0 · S3 `use_lockfile` (no DynamoDB) / Azure blob lease
- **Objectives:** Review the skills; Take the final assessment; Choose the next course
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo (both courses, one video):** Recap, final assessment (20 questions), next: the AI for DevOps masterclass of your cloud, the other cloud's Terragrunt course, n8n automation.
- **Code:** no lab (wrap-up; final assessment JSON) · **Cost:** $0 (runs locally) · **Cleanup:** nothing in any cloud
- **Quiz:**
  1. Which rule held through the course? (A: AI drafts; Terragrunt, the plan and a person verify; B: AI applies; C: Never destroy) → **A**
  2. What does every lab end with? (A: Destroy and verify; B: Apply to prod; C: Nothing) → **A**
  3. What comes before this course in the path? (A: The Terraform masterclass; B: Nothing; C: The VS Code course only) → **A**

## Assessments
- CR-299: a module assessment (6–8 questions) for modules 1–9 and a 20-question final assessment, the same for both courses except the cloud questions.
