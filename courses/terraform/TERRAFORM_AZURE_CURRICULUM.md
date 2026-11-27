# AI-Powered Terraform on Azure: From Beginner to Advanced: curriculum

Planned 2026-11-27 (Phase 1). Plan and production order: `TERRAFORM_MASTERCLASS_PLAN.md`; slide/repo inventory: `CONTENT_INVENTORY.md`; requests: `courses/CONTENT_REQUESTS.md` › CR-129 onward.
The owner's deck (`/home/tia/work/terraform-course/Terraform.pptx`, 624 slides) and repo (`devopstia/terraform-course-del`, `azure-terraform/`) are the foundation: their order, examples and projects are used, updated where outdated, never replaced.

**Labels:** [owner original] = a deck section taught as the owner teaches it · [owner original, updated] = the owner's lesson with outdated parts fixed (each fix listed) · [new, proposed] = a gap filled · [new, proposed: AI] = the AI strand · **[shared]** = one cloud-neutral video used by both the AWS and the Azure course (demos use the local, random and terraform_data providers, so a student of either cloud follows without an account).
**Self-contained:** a student of this course never needs the AWS course. Every lesson that touches a cloud has its own Azure video and lab.
**Budget (rule in `CONTENT_REQUESTS.md`):** $100/month for AWS and Azure together; the video agent estimates each run, logs it in its CLOUD_BUDGET.md and destroys and verifies right after recording (no owner pause, owner 2026-11-28); the $80/$100 budget alarms in both clouds stay as the safety net.
**The AI rule, in every lesson that uses AI:** AI drafts; fmt, validate, tests, policy, the plan and a person verify; never auto-apply.

**Size:** 18 modules, 95 videos, about 17 h 27 min. 37 videos are shared with the AWS course.

| Module | Videos | Minutes | Owner original / updated / new / AI |
|---|---:|---:|---|
| 0 Welcome and safe set-up | 2 | 15 | 0 / 0 / 2 / 0 |
| 1 Why Infrastructure as Code | 3 | 25 | 2 / 1 / 0 / 0 |
| 2 Set up your workstation | 3 | 31 | 1 / 2 / 0 / 0 |
| 3 The Terraform language and workflow | 7 | 63 | 6 / 1 / 0 / 0 |
| 4 References, data sources and naming | 4 | 42 | 3 / 1 / 0 / 0 |
| 5 Variables and outputs | 8 | 72 | 7 / 1 / 0 / 0 |
| 6 The console and functions | 7 | 57 | 7 / 0 / 0 / 0 |
| 7 Meta-arguments and lifecycle | 7 | 66 | 4 / 2 / 1 / 0 |
| 8 State | 8 | 82 | 3 / 3 / 2 / 0 |
| 9 Environments and accounts | 4 | 44 | 1 / 2 / 1 / 0 |
| 10 Modules | 5 | 59 | 3 / 1 / 1 / 0 |
| 11 Projects from the owner's deck | 7 | 94 | 5 / 2 / 0 / 0 |
| 12 Code quality, testing and policy | 3 | 36 | 0 / 0 / 3 / 0 |
| 13 CI/CD and team workflows | 6 | 81 | 2 / 3 / 1 / 0 |
| 14 AI-Powered Terraform | 7 | 87 | 0 / 0 / 0 / 7 |
| 15 Terraform for AI infrastructure | 4 | 55 | 0 / 0 / 0 / 4 |
| 16 Kubernetes with Terraform | 5 | 72 | 4 / 1 / 0 / 0 |
| 17 Capstone: an enterprise platform | 5 | 66 | 0 / 0 / 5 / 0 |

## Module 0: Welcome and safe set-up
Both courses: what you will build, how the labs work, and an account that cannot surprise you with a bill.

### 0.1 Course introduction: what you will build and how to learn here  [new, proposed]
- **Request:** CR-130 · **Duration:** ~5 min · **Depends on:** —
- **Objectives:** Describe the path from first resource to the enterprise capstone; Explain how lessons, labs, quizzes and the AI strand fit together; Plan a study rhythm that includes destroying every lab
- **Slides:** slides 1–8 (table of contents) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The finished capstone pipeline first (a pull request, the plan, the AI review comment, a person approving, apply), then the module map and how labs and cleanup work. Shown on Azure (Storage state, workload identity, Foundry).
- **Code:** no lab (introduction video)
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** nothing is created
- **Materials:** PDF slides from the owner's deck (slides 1–8 (table of contents)), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does every lab end with? (A: An apply to production; B: terraform destroy and a check that nothing is left; C: Leaving resources for the next lesson) → **B**
  2. In this course, what is AI allowed to do with infrastructure code? (A: Draft and review it; Terraform and a person verify; B: Apply changes automatically; C: Store state files) → **A**
  3. Where are the lab files for each lesson? (A: Only in the video; B: In the lesson's lab ZIP with a README; C: In the owner's private repo) → **B**

### 0.2 Your training account, safely: budgets, MFA and the cleanup habit  [new, proposed]
- **Request:** CR-132 · **Duration:** ~10 min · **Depends on:** 0.1
- **Objectives:** Turn on MFA and avoid long-lived admin keys; Create a budget alert below the training budget; Find and delete leftover resources
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Azure: MFA on the account, a dedicated subscription or resource-group convention, a Cost Management budget alert at $20, and an Azure Resource Graph query on the Course tag.
- **Code:** checklist PDF and the CLI commands for budgets and tag searches (no Terraform)
- **Cloud resources:** Cost Management budget, Resource Graph · **Cost per run:** $0 · **Cleanup:** keep the budget alert (free); nothing else is created
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why use a budget alert in a training account? (A: It stops resources automatically; B: It warns you before costs grow; C: It is required by Terraform) → **B**
  2. Which tag helps you find every lab resource? (A: Name; B: Course (set on every resource by the lab code); C: Owner) → **B**
  3. What should you do with a lab after recording or practising? (A: Keep it running; B: Destroy it and verify nothing is left; C: Stop the VM only) → **B**
  4. How do you sign the Azure CLI in for these labs? (A: az login with your own account; B: A storage account key; C: A subscription id alone) → **A**

## Module 1: Why Infrastructure as Code
The owner's opening: the problems of manual infrastructure and why teams moved to code.

### 1.1 From click-ops to code: how infrastructure used to be managed  [owner original] **[shared]**
- **Request:** CR-133 · **Duration:** ~8 min · **Depends on:** 0.2
- **Objectives:** Describe the manual way of building servers and networks; Name three problems it causes (drift, slowness, no history); Explain what changes when infrastructure is code
- **Slides:** slides 15–22 · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The owner's diagrams (slides 17–22): ticket, manual console clicks, configuration drift, then the same environment rebuilt from code in minutes.
- **Code:** GEN builds `courses/terraform/code/shared/from-click-ops-to-code-how-infrastructure-used-t/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 15–22), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What is configuration drift? (A: When real infrastructure no longer matches what was intended; B: A Terraform error; C: A cloud region change) → **A**
  2. Which is a weakness of manual changes? (A: They are fast to repeat; B: There is no reliable history of who changed what; C: They cost nothing) → **B**
  3. What replaces the manual steps in IaC? (A: Screenshots; B: Code that is reviewed, versioned and run by a tool; C: Email approvals) → **B**

### 1.2 What IaC is and why it pays off  [owner original] **[shared]**
- **Request:** CR-134 · **Duration:** ~7 min · **Depends on:** 1.1
- **Objectives:** Define Infrastructure as Code; Explain disaster recovery, consistency and visibility benefits; Connect IaC to code review and version control
- **Slides:** slides 23–27 · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Slides 24–27 with one example per benefit: rebuild after a deleted network, two identical environments, the code as documentation.
- **Code:** GEN builds `courses/terraform/code/shared/what-iac-is-and-why-it-pays-off/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 23–27), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. How does IaC help disaster recovery? (A: You can rebuild the environment from code; B: It makes backups automatically; C: It prevents outages) → **A**
  2. Where do you see a resource's settings with IaC? (A: Only in the console; B: In the code and its history; C: In a spreadsheet) → **B**
  3. What makes IaC changes safer? (A: Reviewing them like application code; B: Applying them at night; C: Using a bigger server) → **A**

### 1.3 IaC tools compared: Terraform, OpenTofu, CloudFormation, Bicep and Pulumi  [owner original, updated] **[shared]**
- **Request:** CR-135 · **Duration:** ~10 min · **Depends on:** 1.2
- **Objectives:** Compare declarative multi-cloud tools with cloud-native ones; Explain Terraform's BSL licence and the OpenTofu fork in one minute; Choose a tool for a given team
- **Slides:** slides 28–32 · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The owner's Terraform vs CloudFormation slide (32) extended with Bicep (Azure), Pulumi and OpenTofu; a decision table.
- **Code:** GEN builds `courses/terraform/code/shared/iac-tools-compared-terraform-opentofu-cloudforma/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 28–32), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: deck calls Terraform "open-source" (slide 29). Since Aug 2023 it is BSL 1.1 (source-available); OpenTofu (Linux Foundation, MPL) is the open-source fork (v1.13.10, 2026-11-23).
- **Quiz:**
  1. Which tool is specific to Azure? (A: CloudFormation; B: Bicep; C: OpenTofu) → **B**
  2. What is OpenTofu? (A: An AWS service; B: An open-source fork of Terraform; C: A Terraform plugin) → **B**
  3. Why do many teams choose Terraform? (A: It works across many clouds and services with one workflow; B: It only works on AWS; C: It needs no state) → **A**

## Module 2: Set up your workstation
Editor, Terraform at the right version, and signed-in cloud tools.

### 2.1 VS Code and the Terraform extensions  [owner original] **[shared]**
- **Request:** CR-136 · **Duration:** ~7 min · **Depends on:** 1.3
- **Objectives:** Install the HashiCorp Terraform extension; Turn on format-on-save; Use completion and hover docs
- **Slides:** slides 33–36 · **Owner's repo:** `aws-terraform/terraform-concepts/youtube/vs-code-plugins`
- **Demo:** Slide 36's plugin list reduced to the official HashiCorp Terraform extension (others are optional); format on save; hover docs. Links the free VS Code masterclass.
- **Code:** GEN builds `courses/terraform/code/shared/vs-code-and-the-terraform-extensions/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 33–36), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Improve: slide 36 lists several overlapping plugins; recommend the official one plus format-on-save.
- **Quiz:**
  1. Which extension is the official one? (A: HashiCorp Terraform; B: Terraform Studio; C: Any YAML extension) → **A**
  2. What does format-on-save do? (A: Runs terraform fmt style formatting when you save; B: Applies the plan; C: Deletes comments) → **A**
  3. Where can you learn VS Code in depth? (A: The free VS Code masterclass; B: Only the Terraform docs; C: Nowhere) → **A**

### 2.2 Install Terraform the right way: versions, tfenv and Docker  [owner original, updated] **[shared]**
- **Request:** CR-137 · **Duration:** ~12 min · **Depends on:** 2.1
- **Objectives:** Install a pinned Terraform version on Windows, macOS or Linux; Switch versions with tfenv; Run Terraform in Docker
- **Slides:** slides 43–57 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-installation, Dockerfile in slide 49/54`
- **Demo:** The owner's three platforms (slides 45–53) and Docker (54–55) with today's version; tfenv to switch; the official HashiCorp package repositories as an option.
- **Code:** GEN builds `courses/terraform/code/shared/install-terraform-the-right-way-versions-tfenv-a/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 43–57), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: slides 46–51 download 0.12/0.13 and slide 49 pins 1.0.0; current is 1.17.2 (2026-11-27). Terragrunt install (56–57) moves to lesson 9.4.
- **Quiz:**
  1. Why pin a Terraform version for a project? (A: So everyone gets the same behaviour; B: To make it faster; C: It is required by the cloud) → **A**
  2. What does tfenv do? (A: Installs and switches between Terraform versions; B: Formats code; C: Stores state) → **A**
  3. Which command shows your Terraform version? (A: terraform version; B: terraform show; C: terraform init) → **A**

### 2.3 Your cloud CLI and credentials  [owner original, updated]
- **Request:** CR-139 · **Duration:** ~12 min · **Depends on:** 0.2
- **Objectives:** Install the cloud CLI; Sign in without long-lived admin keys; Check which identity Terraform will use
- **Slides:** slides 37–42 · **Owner's repo:** no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-concepts/aws-cli-installation`, `aws-terraform/youtube/manage-credentials`)
- **Demo:** Azure CLI install, `az login`, `az account set`, `az account show`; how the azurerm provider picks up the CLI login; service principals saved for CI (module 13).
- **Code:** GEN builds `courses/terraform/code/azure/your-cloud-cli-and-credentials/`
- **Cloud resources:** Microsoft Entra ID sign-in · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 37–42), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Improve: slide 42 creates an IAM admin user and downloads access keys; use IAM Identity Center (or short-lived role credentials) instead.
- **Quiz:**
  1. Why avoid long-lived admin keys on a laptop? (A: They can leak and never expire; B: They are slower; C: Terraform cannot use them) → **A**
  2. Which command proves which identity you use? (A: A whoami-style check (aws sts get-caller-identity or az account show); B: terraform plan; C: git status) → **A**
  3. Where should credentials never go? (A: Into .tf files or Git; B: Into the CLI's sign-in cache; C: Into a password manager) → **A**
  4. Which command picks the subscription Terraform uses through the CLI? (A: az account set --subscription <id>; B: az group list; C: az vm start) → **A**

## Module 3: The Terraform language and workflow
HCL, the core commands, files and providers, with cloud-neutral demos first.

### 3.1 HCL: blocks, arguments and resources  [owner original] **[shared]**
- **Request:** CR-140 · **Duration:** ~10 min · **Depends on:** 2.3
- **Objectives:** Read a resource block (type, local name, arguments); Tell blocks, arguments and expressions apart; Explain what tags/labels are for
- **Slides:** slides 58–69 · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Slides 61–69 annotated on screen with a cloud-neutral resource (local_file, random_pet), then the same anatomy on an aws_instance and an azurerm_resource_group.
- **Code:** GEN builds `courses/terraform/code/shared/hcl-blocks-arguments-and-resources/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 58–69), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. In resource "aws_instance" "web", what is "web"? (A: The local name used in references; B: The AMI; C: The region) → **A**
  2. Which file extension holds Terraform code? (A: .tf; B: .tfstate; C: .yaml) → **A**
  3. What is an argument? (A: A key = value setting inside a block; B: A command-line flag only; C: A provider) → **A**

### 3.2 The core workflow: init, fmt, validate, plan, apply, destroy  [owner original] **[shared]**
- **Request:** CR-141 · **Duration:** ~12 min · **Depends on:** 3.1
- **Objectives:** Run the six core commands in order; Read a plan's create/change/destroy summary; Destroy safely
- **Slides:** slides 80–97 · **Owner's repo:** `aws-terraform/terraform-concepts/learning-basic-commands, terraform-commands`
- **Demo:** The owner's command slides (82–93) and workflow (95–97) with a local_file and random_pet project: init downloads providers, fmt, validate, plan, apply, change, destroy.
- **Code:** GEN builds `courses/terraform/code/shared/the-core-workflow-init-fmt-validate-plan-apply-d/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 80–97), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which command downloads providers? (A: terraform init; B: terraform plan; C: terraform fmt) → **A**
  2. What does terraform plan do? (A: Shows what would change without changing anything; B: Applies changes; C: Deletes state) → **A**
  3. Which command removes everything the configuration manages? (A: terraform destroy; B: terraform fmt; C: terraform validate) → **A**

### 3.3 Comments and code style  [owner original] **[shared]**
- **Request:** CR-142 · **Duration:** ~5 min · **Depends on:** 3.2
- **Objectives:** Use #, // and /* */ comments; Comment out a block safely; Keep comments useful
- **Slides:** slides 98–104 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-comments`
- **Demo:** The owner's comments example; commenting out a resource and what plan does next (it plans a destroy).
- **Code:** GEN builds `courses/terraform/code/shared/comments-and-code-style/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 98–104), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What happens if you comment out a resource that exists? (A: The next plan destroys it; B: Nothing; C: Terraform crashes) → **A**
  2. Which is a valid single-line comment? (A: # comment; B: -- comment; C: ' comment) → **A**
  3. What makes a good comment? (A: Why the code is like this; B: Repeating the argument name; C: The password) → **A**

### 3.4 Terraform files and project layout  [owner original] **[shared]**
- **Request:** CR-143 · **Duration:** ~8 min · **Depends on:** 3.3
- **Objectives:** Split a configuration into main, variables, outputs and versions files; Explain terraform.tfvars and the .terraform folder; Write a .gitignore for Terraform
- **Slides:** slides 163–170 · **Owner's repo:** `aws-terraform/terraform-concepts/terrafrom-files`
- **Demo:** Slides 165–170 on a real folder; a .gitignore that excludes .terraform/, *.tfstate*, *.tfvars (keep *.tfvars.example).
- **Code:** GEN builds `courses/terraform/code/shared/terraform-files-and-project-layout/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 163–170), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Does Terraform care how you split .tf files in a folder? (A: No, it reads them all; B: Yes, only main.tf is read; C: Only alphabetical order matters) → **A**
  2. Which file should never be committed? (A: terraform.tfstate; B: versions.tf; C: README.md) → **A**
  3. What is the .terraform folder? (A: Downloaded providers and modules; B: Your state; C: Your secrets) → **A**

### 3.5 Providers and version constraints  [owner original, updated]
- **Request:** CR-145 · **Duration:** ~10 min · **Depends on:** 3.4
- **Objectives:** Declare required_version and required_providers; Use ~>, >= and exact constraints; Explain the provider's role between Terraform and the API
- **Slides:** slides 70–79, 460–466 · **Owner's repo:** no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-concepts/terraform-providers, youtube/terraform-providers-version-block`)
- **Demo:** hashicorp/azurerm ~> 5.0 (5.15.0) with `features {}` and `subscription_id` (required since 4.0); azure/azapi ~> 2.0 for brand-new Azure APIs.
- **Code:** GEN builds `courses/terraform/code/azure/providers-and-version-constraints/`
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 70–79, 460–466), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: repo pins aws ~> 4.0 (269 folders) and ~> 3.0 (49), required_version >= 1.0.0; Azure folder azurerm >= 3.0.
- **Quiz:**
  1. What does ~> 6.0 allow? (A: Any 6.x version; B: Only 6.0.0; C: Any version) → **A**
  2. What is required_version about? (A: The Terraform CLI version; B: The provider version; C: The cloud API version) → **A**
  3. Why pin providers in production? (A: A new major version can change behaviour; B: Pinning makes plans faster; C: It is the only way to install them) → **A**
  4. Which block is required in every azurerm provider configuration? (A: features {}; B: region {}; C: tags {}) → **A**

### 3.6 The dependency lock file  [owner original] **[shared]**
- **Request:** CR-146 · **Duration:** ~6 min · **Depends on:** 3.5
- **Objectives:** Explain what .terraform.lock.hcl records; Commit it; Upgrade providers with init -upgrade
- **Slides:** slides 151–156 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-lock-file`
- **Demo:** Slides 153–156; delete .terraform, init again (same version from the lock); init -upgrade; terraform providers lock for several platforms.
- **Code:** GEN builds `courses/terraform/code/shared/the-dependency-lock-file/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 151–156), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Should .terraform.lock.hcl be committed? (A: Yes; B: No; C: Only in production) → **A**
  2. Which command moves to newer allowed provider versions? (A: terraform init -upgrade; B: terraform plan -upgrade; C: terraform fmt) → **A**
  3. What does the lock file store? (A: Exact provider versions and checksums; B: The state; C: Variables) → **A**

### 3.7 Your first resources on the cloud  [owner original]
- **Request:** CR-148 · **Duration:** ~12 min · **Depends on:** 2.3, 3.5
- **Objectives:** Create, change and destroy a first real resource; Find it in the console; Read the plan for a change versus a replacement
- **Slides:** slides 80–97 (applied) · **Owner's repo:** `azure-terraform/terraform-concepts/learning-basic-commands`
- **Demo:** The owner's Azure learning-basic-commands: resource group + virtual network + subnet; rename a tag (update) vs change the address space (replace or update), destroy.
- **Code:** GEN builds `courses/terraform/code/azure/your-first-resources-on-the-cloud/`
- **Cloud resources:** Resource group, VNet · **Cost per run:** $0 (resource groups and VNets are free) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 80–97 (applied)), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Repo fix: learning-basic-commands fails `terraform init` today (Unsupported Terraform Core version: required_version ~> 1.0.0).
- **Quiz:**
  1. What does "-/+" mean in a plan? (A: The resource will be replaced; B: Updated in place; C: Read only) → **A**
  2. Where can you check what Terraform created? (A: The console and terraform state list; B: Only the .tf files; C: Nowhere) → **A**
  3. What should you run when the lab is done? (A: terraform destroy; B: terraform init; C: terraform fmt) → **A**
  4. What holds every Azure resource in this lab? (A: A resource group; B: An S3 bucket; C: A workspace) → **A**

## Module 4: References, data sources and naming
Connect resources together, read what already exists, and name things consistently.

### 4.1 Resource references: connect resources together  [owner original]
- **Request:** CR-150 · **Duration:** ~12 min · **Depends on:** 3.7
- **Objectives:** Reference another resource's attribute; Explain how references create the dependency order; Build a small connected stack
- **Slides:** slides 131–138 · **Owner's repo:** `azure-terraform/resources-example/virtual-machine`
- **Demo:** Resource group → VNet → subnet → NIC → Linux VM (B1s), each referencing the previous one; the graph with `terraform graph`.
- **Code:** GEN builds `courses/terraform/code/azure/resource-references-connect-resources-together/`
- **Cloud resources:** Resource group, VNet, subnet, NIC, B1s VM · **Cost per run:** ~$0.02 per run (B1s VM for under an hour) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 131–138), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. How does Terraform know the creation order? (A: From references between resources; B: From file order; C: Alphabetically) → **A**
  2. What is the syntax of a reference? (A: <type>.<name>.<attribute>; B: $(name); C: {{name}}) → **A**
  3. What does terraform graph show? (A: The dependency graph; B: The bill; C: The state history) → **A**
  4. What connects a VM to a subnet in Azure? (A: A network interface (NIC); B: A security group; C: A route table) → **A**

### 4.2 Data sources: read what already exists  [owner original]
- **Request:** CR-152 · **Duration:** ~12 min · **Depends on:** 4.1
- **Objectives:** Write a data block with filters; Use data sources for images, networks and identities; Explain when to use a data source instead of a resource
- **Slides:** slides 139–150, 472–482 · **Owner's repo:** `azure-terraform/terraform-concepts/data-parameters`
- **Demo:** The owner's data-parameters: an existing resource group and subnet, azurerm_client_config, a platform image lookup; launch a VM into the found subnet.
- **Code:** GEN builds `courses/terraform/code/azure/data-sources-read-what-already-exists/`
- **Cloud resources:** B1s VM (optional) · **Cost per run:** $0–0.02 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 139–150, 472–482), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Duplicate: slides 472–482 repeat 141–150 word for word (Terraform Blocks section); record once.
- **Quiz:**
  1. Does a data source create anything? (A: No, it only reads; B: Yes, it creates the resource; C: It deletes old resources) → **A**
  2. When is a data source the right choice? (A: The thing is managed elsewhere and you only need its values; B: You want Terraform to own it; C: Never) → **A**
  3. How do you reference a data source? (A: data.<type>.<name>.<attribute>; B: var.<name>; C: local.<name>) → **A**
  4. Which data source returns your tenant and object id? (A: azurerm_client_config; B: azurerm_subscription_id; C: azurerm_identity) → **A**

### 4.3 Interpolation and the format function  [owner original] **[shared]**
- **Request:** CR-153 · **Duration:** ~10 min · **Depends on:** 4.2
- **Objectives:** Build strings with ${} interpolation; Use format() with 1–4 arguments; Apply a naming convention
- **Slides:** slides 105–121 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-interpolation, terraform-format`
- **Demo:** The owner's naming convention (2560-dev-del-private-01-us-east-1a, slides 111–121) built with interpolation and format() in terraform console and on local_file names.
- **Code:** GEN builds `courses/terraform/code/shared/interpolation-and-the-format-function/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 105–121), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does format("%s-%s", "dev", "web") return? (A: "dev-web"; B: "%s-%s"; C: "devweb") → **A**
  2. Which syntax inserts a value into a string? (A: "${var.env}-web"; B: "$var.env-web"; C: "{var.env}-web") → **A**
  3. Why use a naming convention? (A: Resources are easy to find and identify; B: Terraform requires it; C: It lowers cost) → **A**

### 4.4 Tags: merge, default tags and a tagging standard  [owner original, updated]
- **Request:** CR-155 · **Duration:** ~8 min · **Depends on:** 4.3
- **Objectives:** Combine common and resource-specific tags with merge(); Set organisation-wide tags once; Find resources by tag
- **Slides:** slides 122–130 · **Owner's repo:** `azure-terraform/modules/resource-group`
- **Demo:** The owner's merge pattern with a `local.common_tags` map (azurerm has no default_tags), and Azure Policy "require a tag" as a preview of policy (module 12).
- **Code:** GEN builds `courses/terraform/code/azure/tags-merge-default-tags-and-a-tagging-standard/`
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 122–130), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does merge(a, b) do with the same key in both maps? (A: b's value wins; B: a's value wins; C: It fails) → **A**
  2. Why tag every resource? (A: Ownership, cost and cleanup; B: Terraform needs tags to run; C: Tags make resources faster) → **A**
  3. Where do common tags live best? (A: In one place (provider default_tags or a local); B: Repeated in every resource; C: In comments) → **A**
  4. How do you share common tags in azurerm? (A: A local map merged into each resource; B: default_tags; C: An environment variable) → **A**

## Module 5: Variables and outputs
Every variable type the owner teaches, with cloud-neutral demos, then applied on your cloud.

### 5.1 Input variables, types and .tfvars files  [owner original] **[shared]**
- **Request:** CR-156 · **Duration:** ~10 min · **Depends on:** 4.4
- **Objectives:** Declare variables with type, default and description; Pass values with -var, -var-file and TF_VAR_; Explain variable precedence
- **Slides:** slides 171–176, 193–195, 500–502 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-variables`
- **Demo:** Slides 173–176; the same variable set four ways (default, terraform.tfvars, -var-file=dev.tfvars, TF_VAR_); precedence order on screen.
- **Code:** GEN builds `courses/terraform/code/shared/input-variables-types-and-tfvars-files/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 171–176, 193–195, 500–502), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which value wins: terraform.tfvars or -var on the command line? (A: -var on the command line; B: terraform.tfvars; C: The default) → **A**
  2. How do you set a variable from the environment? (A: TF_VAR_<name>; B: VAR_<name>; C: TERRAFORM_<name>) → **A**
  3. What is a variable's description for? (A: Documentation shown to users; B: Validation; C: Encryption) → **A**

### 5.2 Locals: name an expression once  [owner original] **[shared]**
- **Request:** CR-157 · **Duration:** ~6 min · **Depends on:** 5.1
- **Objectives:** Define locals; Use them to avoid repetition; Choose between a variable and a local
- **Slides:** slides 177–179, 497–499 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-variables/local-variables`
- **Demo:** The owner's local-variables example rewritten with local_file; a naming local reused in three places.
- **Code:** GEN builds `courses/terraform/code/shared/locals-name-an-expression-once/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 177–179, 497–499), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Duplicate: slides 497–499 repeat 177–179.
- **Quiz:**
  1. Can a user override a local from the command line? (A: No; B: Yes with -var; C: Yes with -local) → **A**
  2. How do you reference a local? (A: local.<name>; B: locals.<name>; C: var.<name>) → **A**
  3. When is a local better than a variable? (A: For values computed inside the configuration; B: For user input; C: For secrets) → **A**

### 5.3 String, number and bool variables  [owner original] **[shared]**
- **Request:** CR-158 · **Duration:** ~8 min · **Depends on:** 5.2
- **Objectives:** Use string, number and bool types; Turn a resource on or off with a bool; Catch wrong types early
- **Slides:** slides 180–192 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-variables/{string,number,boolean}-variable`
- **Demo:** The owner's examples (create_instance = true/false, instance counts) shown with random_pet and count so they run anywhere.
- **Code:** GEN builds `courses/terraform/code/shared/string-number-and-bool-variables/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 180–192), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does count = var.create ? 1 : 0 do when create is false? (A: Creates nothing; B: Creates one; C: Fails) → **A**
  2. Which type holds true or false? (A: bool; B: string; C: number) → **A**
  3. What happens if a string is passed to a number variable? (A: Terraform tries to convert, and errors if it cannot; B: It is ignored; C: It becomes 0) → **A**

### 5.4 Collections: list, set and tuple  [owner original] **[shared]**
- **Request:** CR-159 · **Duration:** ~10 min · **Depends on:** 5.3
- **Objectives:** Use list, set and tuple variables; Explain order and duplicates; Pick the right collection
- **Slides:** slides 196–209, 226–231 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-variables/{list,set,tuple}-variable`
- **Demo:** The owner's comparison slides (204–206, 227–229) as a table; each type in terraform console; allowed IP set example.
- **Code:** GEN builds `courses/terraform/code/shared/collections-list-set-and-tuple/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 196–209, 226–231), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which collection removes duplicates? (A: set; B: list; C: tuple) → **A**
  2. Which collection has fixed length and per-position types? (A: tuple; B: list; C: set) → **A**
  3. How do you read the first element of a list? (A: var.list[0]; B: var.list.first; C: var.list(1)) → **A**

### 5.5 Structures: map, object, any and optional attributes  [owner original, updated] **[shared]**
- **Request:** CR-160 · **Duration:** ~12 min · **Depends on:** 5.4
- **Objectives:** Use map, object and map(object) types; Make object attributes optional with defaults; Explain why any should be rare
- **Slides:** slides 210–225 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-variables/{map,object,map-of-object,any}-variable`
- **Demo:** The owner's object and map-of-object examples (slides 217–223) with try(); then optional(type, default) which replaces most try() workarounds (Terraform >= 1.3).
- **Code:** GEN builds `courses/terraform/code/shared/structures-map-object-any-and-optional-attribute/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 210–225), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Improve: slides 218–220 use try() for optional attributes; optional() is the modern way.
- **Quiz:**
  1. What does optional(string, "t3.micro") do? (A: Makes the attribute optional with a default; B: Makes it required; C: Turns it into a list) → **A**
  2. Which type maps keys to objects? (A: map(object({...})); B: list(string); C: any) → **A**
  3. Why avoid type any? (A: Mistakes are caught later or not at all; B: It is slower; C: It is deprecated) → **A**

### 5.6 Outputs: share results  [owner original] **[shared]**
- **Request:** CR-161 · **Duration:** ~6 min · **Depends on:** 5.5
- **Objectives:** Declare outputs; Read them with terraform output (-raw, -json); Mark an output sensitive
- **Slides:** slides 493–495 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-top-level-blocks/output`
- **Demo:** Slides 494–495; terraform output -json piped to jq; a sensitive output hidden in the CLI but present in state (link to lesson 8.8).
- **Code:** GEN builds `courses/terraform/code/shared/outputs-share-results/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 493–495), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which command prints one output without quotes? (A: terraform output -raw <name>; B: terraform show <name>; C: terraform get <name>) → **A**
  2. Does sensitive = true remove the value from state? (A: No, it only hides it in output; B: Yes; C: Only in CI) → **A**
  3. What are outputs used for? (A: Showing results and passing values to other stacks; B: Storing passwords; C: Formatting code) → **A**

### 5.7 Variable validation and sensitive values  [owner original] **[shared]**
- **Request:** CR-162 · **Duration:** ~8 min · **Depends on:** 5.6
- **Objectives:** Write validation blocks with clear error messages; Validate with regex, contains and length; Mark inputs sensitive
- **Slides:** slides 366–371 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-resource-validation`
- **Demo:** The owner's validation examples (allowed environments, instance types) plus a regex naming rule; sensitive = true on a password variable.
- **Code:** GEN builds `courses/terraform/code/shared/variable-validation-and-sensitive-values/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 366–371), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. When does a validation block run? (A: Before the plan uses the value; B: After apply; C: Never in CI) → **A**
  2. What must a validation block contain? (A: condition and error_message; B: only a regex; C: a default) → **A**
  3. What does sensitive = true do on a variable? (A: Hides the value in plan output; B: Encrypts the state; C: Deletes it after apply) → **A**

### 5.8 Variables in practice on the cloud  [owner original]
- **Request:** CR-164 · **Duration:** ~12 min · **Depends on:** 5.7
- **Objectives:** Drive a real resource from variables and tfvars per environment; Use a map of objects to create differently sized machines; Keep secrets out of tfvars in Git
- **Slides:** slides 179–225 (applied) · **Owner's repo:** `azure-terraform/terraform-concepts/variables`, `azure-terraform/map-off-objects`
- **Demo:** The owner's Azure variables and map-off-objects folders: VMs or storage accounts from a map of objects; dev.tfvars and prod.tfvars.
- **Code:** GEN builds `courses/terraform/code/azure/variables-in-practice-on-the-cloud/`
- **Cloud resources:** Storage accounts (or B1s VM) · **Cost per run:** ~$0.01 per run · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 179–225 (applied)), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which file should hold environment values? (A: dev.tfvars; B: main.tf; C: the state) → **A**
  2. How do you create one resource per map entry? (A: for_each = var.map; B: count = var.map; C: depends_on) → **A**
  3. Where do secrets come from instead of tfvars in Git? (A: A secret store or environment variables; B: Comments; C: The README) → **A**
  4. What decides an Azure VM's size? (A: size (e.g. Standard_B1s); B: sku_name; C: tier) → **A**

## Module 6: The console and functions
The owner's terraform console method: try every function before using it.

### 6.1 terraform console: test expressions safely  [owner original] **[shared]**
- **Request:** CR-165 · **Duration:** ~10 min · **Depends on:** 5.8
- **Objectives:** Open the console with variables loaded; Explore maps, lists and nested objects; Test an expression before putting it in code
- **Slides:** slides 232–262 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-console`
- **Demo:** The owner's var.context examples (slides 235–262): EKS-style map of any, map of objects, try, lookup, element, length, format.
- **Code:** GEN builds `courses/terraform/code/shared/terraform-console-test-expressions-safely/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 232–262), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Does terraform console change infrastructure? (A: No; B: Yes; C: Only with -apply) → **A**
  2. How do you list a map's values? (A: values(var.map); B: var.map.values; C: list(var.map)) → **A**
  3. Why test in the console first? (A: You see the result instantly without a plan; B: It is required; C: It saves state) → **A**

### 6.2 count, length and element  [owner original] **[shared]**
- **Request:** CR-166 · **Duration:** ~10 min · **Depends on:** 6.1
- **Objectives:** Create N copies with count and count.index; Use length() to size count; Use element() to wrap around a list
- **Slides:** slides 298–317 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-count-argument-and-lenght-function, terraform-element-function`
- **Demo:** The owner's examples (subnets across AZs with element) on local_file names; the risk of count when an item is removed from the middle (preview of for_each).
- **Code:** GEN builds `courses/terraform/code/shared/count-length-and-element/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 298–317), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What is count.index for the first copy? (A: 0; B: 1; C: -1) → **A**
  2. What does element(["a","b"], 2) return? (A: "a" (it wraps around); B: an error; C: "b") → **A**
  3. What happens when you remove the middle item of a count list? (A: Later items shift and may be replaced; B: Nothing; C: Only that item is removed) → **A**

### 6.3 split and join  [owner original] **[shared]**
- **Request:** CR-167 · **Duration:** ~6 min · **Depends on:** 6.2
- **Objectives:** Turn a string into a list with split; Turn a list into a string with join; Combine them with other functions
- **Slides:** slides 318–330 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-slipt-function, terraform-join-function`
- **Demo:** The owner's examples: CIDR lists from a comma string, a join for names and security group descriptions.
- **Code:** GEN builds `courses/terraform/code/shared/split-and-join/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 318–330), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does split(",", "a,b") return? (A: ["a","b"]; B: "a b"; C: "ab") → **A**
  2. What does join("-", ["dev","web"]) return? (A: "dev-web"; B: ["dev","web"]; C: "devweb") → **A**
  3. Which is the separator argument in join? (A: The first one; B: The second one; C: There is none) → **A**

### 6.4 lookup and try: safe access to maps and objects  [owner original] **[shared]**
- **Request:** CR-168 · **Duration:** ~8 min · **Depends on:** 6.3
- **Objectives:** Read a map key with a default; Use try() to fall back when an attribute is missing; Choose between them and optional()
- **Slides:** slides 331–358 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-lookup-function, terraform-try-function`
- **Demo:** The owner's console examples (slides 245–253) and folders; when to prefer optional() (lesson 5.5).
- **Code:** GEN builds `courses/terraform/code/shared/lookup-and-try-safe-access-to-maps-and-objects/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 331–358), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does lookup(map, "k", "none") return when k is missing? (A: "none"; B: an error; C: null) → **A**
  2. What does try(a, b) return? (A: a if it works, otherwise b; B: always b; C: both) → **A**
  3. When is optional() better than try()? (A: When you control the variable's type; B: Never; C: Only for lists) → **A**

### 6.5 contains and conditional expressions  [owner original] **[shared]**
- **Request:** CR-169 · **Duration:** ~10 min · **Depends on:** 6.4
- **Objectives:** Test membership with contains(); Write condition ? a : b; Use conditions to switch settings per environment
- **Slides:** slides 359–365, 379–389 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-contains-function, terraform-contitions`
- **Demo:** The owner's examples (Route 53 only in prod, RDS backup retention, blue/green node sizes) shown with neutral values, then nested conditions and why to keep them readable.
- **Code:** GEN builds `courses/terraform/code/shared/contains-and-conditional-expressions/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 359–365, 379–389), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does contains(["dev","prod"], "qa") return? (A: false; B: true; C: an error) → **A**
  2. What is the syntax of a conditional? (A: condition ? true_value : false_value; B: if condition then a else b; C: condition && a || b) → **A**
  3. How do you create a resource only in prod? (A: count = var.env == "prod" ? 1 : 0; B: depends_on = prod; C: lifecycle prod) → **A**

### 6.6 yamldecode: keep configuration in YAML  [owner original] **[shared]**
- **Request:** CR-170 · **Duration:** ~7 min · **Depends on:** 6.5
- **Objectives:** Load YAML with yamldecode(file(...)); Use path.module; Validate what you load
- **Slides:** slides 372–378 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-yamldecode-function`
- **Demo:** The owner's variable.yaml examples; a YAML list of users turned into resources with for_each.
- **Code:** GEN builds `courses/terraform/code/shared/yamldecode-keep-configuration-in-yaml/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 372–378), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does yamldecode return? (A: A Terraform value (map or list); B: A string; C: A file) → **A**
  2. Why use path.module in file()? (A: The path works wherever the module is called from; B: It is faster; C: It encrypts the file) → **A**
  3. What is a risk of YAML input? (A: Wrong types or keys are only caught when used; B: YAML is not allowed; C: It is slower) → **A**

### 6.7 Splat expressions  [owner original] **[shared]**
- **Request:** CR-171 · **Duration:** ~6 min · **Depends on:** 6.6
- **Objectives:** Collect one attribute from many resources with [*]; Use it in outputs; Compare with a for expression
- **Slides:** slides 271–276 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-splat-expression`
- **Demo:** The owner's splat examples on several random_pet resources; the same with [for x in ... : x.id].
- **Code:** GEN builds `courses/terraform/code/shared/splat-expressions/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 271–276), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does aws_instance.web[*].id return? (A: A list of ids; B: The first id; C: A map) → **A**
  2. Which works on for_each resources? (A: A for expression over values(); B: [*] directly on the map; C: Neither) → **A**
  3. What is splat short for? (A: Collecting an attribute from every element; B: Splitting a string; C: A loop that creates resources) → **A**

## Module 7: Meta-arguments and lifecycle
Loops, ordering, lifecycle rules and conditions, plus bootstrapping servers.

### 7.1 Loops: count, for_each and dynamic blocks  [owner original, updated]
- **Request:** CR-173 · **Duration:** ~14 min · **Depends on:** 6.7
- **Objectives:** Create many resources with count and with for_each; Explain why for_each is safer for named items; Generate nested blocks with dynamic
- **Slides:** slides 402–414 · **Owner's repo:** `azure-terraform/terraform-concepts/loops`, `azure-terraform/count`
- **Demo:** The owner's Azure loops: resource groups and subnets with count and for_each; a dynamic security_rule block in an NSG.
- **Code:** GEN builds `courses/terraform/code/azure/loops-count-for-each-and-dynamic-blocks/`
- **Cloud resources:** Resource groups, subnets, NSG · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 402–414), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Gap: dynamic blocks are not in the deck. Secrets Manager names are reserved 7–30 days after delete: use recovery_window_in_days = 0 in labs.
- **Quiz:**
  1. Why is for_each safer than count for named items? (A: Removing one item does not shift the others; B: It is faster; C: It needs no state) → **A**
  2. What is each.key in for_each over a map? (A: The map key; B: The index number; C: The value) → **A**
  3. What does a dynamic block generate? (A: Repeated nested blocks inside one resource; B: Several resources; C: A module) → **A**
  4. Which nested block does a dynamic block often generate in an NSG? (A: security_rule; B: ingress; C: subnet) → **A**

### 7.2 depends_on: hidden dependencies  [owner original] **[shared]**
- **Request:** CR-174 · **Duration:** ~6 min · **Depends on:** 7.1
- **Objectives:** Explain implicit vs explicit dependencies; Use depends_on only when there is no reference; Spot overuse
- **Slides:** slides 277–281 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-depend-on`
- **Demo:** The owner's depends_on examples; a case with no reference (a policy that must exist before use) shown with terraform_data.
- **Code:** GEN builds `courses/terraform/code/shared/depends-on-hidden-dependencies/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 277–281), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. When do you need depends_on? (A: When a dependency is not visible through a reference; B: Always; C: Never) → **A**
  2. What is an implicit dependency? (A: One created by a reference; B: One written in depends_on; C: A provider) → **A**
  3. What is a cost of depends_on? (A: Plans become less precise and slower; B: It costs money; C: It deletes resources) → **A**

### 7.3 Lifecycle rules: create_before_destroy, prevent_destroy, ignore_changes  [owner original]
- **Request:** CR-176 · **Duration:** ~10 min · **Depends on:** 7.2
- **Objectives:** Replace without downtime using create_before_destroy; Protect critical resources with prevent_destroy; Ignore changes made outside Terraform
- **Slides:** slides 282–292 · **Owner's repo:** `azure-terraform/new`
- **Demo:** The same three rules on a storage account (prevent_destroy), a VM (ignore_changes on tags set by Azure Policy), and a public IP (create_before_destroy).
- **Code:** GEN builds `courses/terraform/code/azure/lifecycle-rules-create-before-destroy-prevent-de/`
- **Cloud resources:** Storage account, public IP · **Cost per run:** ~$0.01 (public IP prorated) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 282–292), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does prevent_destroy do? (A: Fails any plan that would destroy the resource; B: Backs it up; C: Hides it) → **A**
  2. When is ignore_changes useful? (A: When something outside Terraform changes an attribute on purpose; B: To skip validation; C: To speed up plans) → **A**
  3. What does create_before_destroy change? (A: The new object is created before the old one is removed; B: Nothing; C: The order of files) → **A**
  4. Why might Azure Policy make you use ignore_changes? (A: Policy can add tags Terraform did not set; B: Policy blocks Terraform; C: It is required by azurerm) → **A**

### 7.4 Preconditions, postconditions and check blocks  [new, proposed]
- **Request:** CR-178 · **Duration:** ~10 min · **Depends on:** 7.3
- **Objectives:** Add a precondition that stops a bad plan; Add a postcondition that guarantees a result; Use a check block for health warnings
- **Slides:** extends slides 366–371 · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Mirror: a precondition that the VM size is in an allowed list, a postcondition that the storage account is private, a check block on an App Service URL.
- **Code:** GEN builds `courses/terraform/code/azure/preconditions-postconditions-and-check-blocks/` (reuses `courses/terraform/code/terraform-checks-and-conditions`)
- **Cloud resources:** Storage account · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which one only warns and never blocks? (A: check block; B: precondition; C: postcondition) → **A**
  2. When does a postcondition run? (A: After the resource is created or read; B: Before the plan; C: Only in tests) → **A**
  3. What is a precondition for? (A: A rule that must be true before Terraform acts; B: Formatting; C: Imports) → **A**
  4. Which argument keeps a storage account's blobs from being public? (A: allow_nested_items_to_be_public = false; B: public = false; C: https_only) → **A**

### 7.5 Provider aliases: several regions and subscriptions  [owner original]
- **Request:** CR-180 · **Duration:** ~8 min · **Depends on:** 7.4
- **Objectives:** Configure a second provider with alias; Pass a provider to a resource and a module; Explain the AWS v6 per-resource region option
- **Slides:** slides 390–394 · **Owner's repo:** `azure-terraform/terraform-concepts/multiple-providers`
- **Demo:** The owner's multiple-providers example: two azurerm providers for two subscriptions (or one subscription and two features blocks), a resource in each.
- **Code:** GEN builds `courses/terraform/code/azure/provider-aliases-several-regions-and-subscriptio/`
- **Cloud resources:** Resource groups in two subscriptions or regions · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 390–394), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. How do you choose an aliased provider in a resource? (A: provider = aws.west (or azurerm.second); B: alias = west; C: region = west) → **A**
  2. How does a module receive an aliased provider? (A: providers = { aws = aws.west }; B: depends_on; C: A variable) → **A**
  3. Why use aliases? (A: To manage several regions or accounts from one configuration; B: To speed up apply; C: To hide resources) → **A**
  4. What usually differs between two azurerm provider blocks? (A: subscription_id; B: features; C: location only) → **A**

### 7.6 Bootstrap servers: user data and cloud-init  [owner original]
- **Request:** CR-182 · **Duration:** ~8 min · **Depends on:** 7.5
- **Objectives:** Pass a script at first boot; Use templatefile() for variables; Check the boot log
- **Slides:** slides 293–297 · **Owner's repo:** `azure-terraform/new`
- **Demo:** custom_data with cloud-init on a B1s Ubuntu VM installing nginx; templatefile; base64encode; checking with the serial console.
- **Code:** GEN builds `courses/terraform/code/azure/bootstrap-servers-user-data-and-cloud-init/`
- **Cloud resources:** B1s VM, NSG, public IP · **Cost per run:** ~$0.02 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 293–297), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. When does user data (cloud-init) run? (A: At first boot; B: On every plan; C: After destroy) → **A**
  2. Which function fills variables into a script file? (A: templatefile(); B: format(); C: file() only) → **A**
  3. Where should real configuration management live for large fleets? (A: An image (Packer) or a config tool, not long boot scripts; B: In comments; C: In state) → **A**
  4. Which azurerm argument carries cloud-init on a Linux VM? (A: custom_data; B: user_data_script; C: init_script) → **A**

### 7.7 Provisioners and terraform_data: the last resort  [owner original, updated]
- **Request:** CR-184 · **Duration:** ~10 min · **Depends on:** 7.6
- **Objectives:** Run local-exec and remote-exec; Use terraform_data instead of null_resource; Explain why provisioners are a last resort
- **Slides:** slides 395–401, 504–508 · **Owner's repo:** `azure-terraform/new`
- **Demo:** The same on a B1s VM: local-exec calling az CLI, remote-exec over SSH with a generated key, and the Run Command alternative.
- **Code:** GEN builds `courses/terraform/code/azure/provisioners-and-terraform-data-the-last-resort/`
- **Cloud resources:** B1s VM, public IP · **Cost per run:** ~$0.02 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 395–401, 504–508), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Security: the repo commits private keys (provisioner/example-01,02 *.pem, testing/ssh-key, base-code/eks-mix, azure ssh-keys). Not reused; labs generate keys at run time. Duplicate: slides 504–508 repeat 397–401.
- **Quiz:**
  1. Which resource replaces null_resource in modern Terraform? (A: terraform_data; B: local_file; C: random_id) → **A**
  2. Why are provisioners a last resort? (A: Terraform cannot plan or track what they do; B: They are slow; C: They cost extra) → **A**
  3. Where must SSH private keys never be? (A: In Git; B: In memory during the run; C: In an agent) → **A**
  4. Which Azure feature runs a script on a VM without SSH? (A: Run Command; B: Bastion only; C: Key Vault) → **A**

## Module 8: State
The state file, remote state with locking, imports, refactoring and secrets.

### 8.1 The state file: current vs desired state  [owner original] **[shared]**
- **Request:** CR-185 · **Duration:** ~8 min · **Depends on:** 7.7
- **Objectives:** Explain what state records and why; Compare desired, current and recorded state; Name the risks of local state
- **Slides:** slides 157–162, 430–431 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-local-state`
- **Demo:** Slides 159–162 and 431; open terraform.tfstate of a neutral project; why it must not be edited by hand or committed.
- **Code:** GEN builds `courses/terraform/code/shared/the-state-file-current-vs-desired-state/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 157–162, 430–431), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Fix: the repo's terraform-local-state/main.tf has a database password in plain text; the lesson shows it as the problem, not as code to copy.
- **Quiz:**
  1. What is in the state? (A: What Terraform manages and the last known attributes; B: Only the code; C: Only outputs) → **A**
  2. Why is local state a problem for teams? (A: Only one person has it and there is no locking; B: It is slow; C: It is encrypted) → **A**
  3. Can state contain secrets? (A: Yes, so it must be protected; B: No, never; C: Only in Azure) → **A**

### 8.2 Remote state with locking  [owner original, updated]
- **Request:** CR-187 · **Duration:** ~14 min · **Depends on:** 8.1, 3.7
- **Objectives:** Create a secure state bucket or storage account; Configure the backend with partial configuration; Show locking and versioning
- **Slides:** slides 429–440, 467–471 · **Owner's repo:** `azure-terraform/modules/storage-backend`
- **Demo:** Lesson code: storage account (Entra ID only, versioning, soft delete) and container; backend "azurerm" with use_azuread_auth; the blob lease lock.
- **Code:** `courses/terraform/code/azure/terraform-remote-state` (ready, validated)
- **Cloud resources:** Resource group, storage account, container · **Cost per run:** ~$0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 429–440, 467–471), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: the repo's 78 backend configs use a DynamoDB lock table; dynamodb_table is deprecated since Terraform 1.11 (S3 native locking, use_lockfile).
- **Quiz:**
  1. Why lock state? (A: Two people applying at once would corrupt it; B: To encrypt it; C: To make it smaller) → **A**
  2. What is a partial backend configuration? (A: Backend values given at init time (-backend-config); B: A broken backend; C: A backend for tests only) → **A**
  3. Why turn on versioning for state? (A: To recover an earlier state; B: It is required; C: To speed up plans) → **A**
  4. How does the azurerm backend lock state? (A: A lease on the state blob; B: A DynamoDB table; C: A lock file in Git) → **A**

### 8.3 Change and delete resources safely  [owner original, updated] **[shared]**
- **Request:** CR-188 · **Duration:** ~10 min · **Depends on:** 8.2
- **Objectives:** Remove a resource by deleting its code; Replace one with -replace; Explain why editing or deleting the state file is dangerous
- **Slides:** slides 415–422 · **Owner's repo:** `aws-terraform/terraform-concepts/deleting-resources-in-terraform`
- **Demo:** The owner's options (slides 417–422) on a neutral project, ranked from safest to riskiest: remove the code, destroy -target (exceptional), apply -replace, removed block (8.5), state rm, editing state (never).
- **Code:** GEN builds `courses/terraform/code/shared/change-and-delete-resources-safely/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 415–422), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Improve: slides 421–422 show editing and deleting the state file; kept only as "what not to do".
- **Quiz:**
  1. What is the normal way to delete a resource? (A: Remove its code and apply; B: Edit the state file; C: Delete it in the console) → **A**
  2. What does terraform apply -replace=ADDR do? (A: Recreates that one resource; B: Deletes state; C: Imports it) → **A**
  3. Why is -target an exception, not a habit? (A: It skips the rest of the configuration and hides drift; B: It is slow; C: It is deprecated) → **A**

### 8.4 Import existing resources  [owner original, updated]
- **Request:** CR-190 · **Duration:** ~12 min · **Depends on:** 8.2
- **Objectives:** Import with an import block and review the plan; Generate configuration with -generate-config-out; Compare with the terraform import command
- **Slides:** slides 423–428 · **Owner's repo:** no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-concepts/terraform-import`)
- **Demo:** Lesson code: a resource group created with az CLI, imported by its full resource id; aztfexport shown for whole groups.
- **Code:** `courses/terraform/code/azure/terraform-import` (ready, validated)
- **Cloud resources:** Resource group · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 423–428), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does an import block add over terraform import? (A: The import is planned and reviewed; B: Nothing; C: It deletes the old resource) → **A**
  2. Which flag writes configuration for imported resources? (A: -generate-config-out; B: -write-config; C: -import-config) → **A**
  3. After a successful import, what does plan show if the code matches? (A: No changes; B: A replacement; C: An error) → **A**
  4. What is the import id of an Azure resource? (A: Its full resource id path; B: Its name only; C: Its tag) → **A**

### 8.5 Refactor without destroying: moved and removed blocks  [new, proposed]
- **Request:** CR-192 · **Duration:** ~10 min · **Depends on:** 8.4
- **Objectives:** Rename or restructure resources with moved blocks; Stop managing a resource with removed; Read "has moved to" in a plan
- **Slides:** extends slides 415–422 · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Mirror: two resource groups refactored into one for_each resource; a storage account forgotten with removed.
- **Code:** GEN builds `courses/terraform/code/azure/refactor-without-destroying-moved-and-removed-bl/`
- **Cloud resources:** Resource groups, storage account · **Cost per run:** ~$0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does a moved block prevent? (A: A destroy-and-create when you rename or move code; B: Imports; C: Drift) → **A**
  2. What does removed with destroy = false do? (A: Forgets the resource but leaves it in the cloud; B: Deletes it; C: Moves it) → **A**
  3. Where do moved blocks help most? (A: When refactoring into modules or for_each; B: When installing Terraform; C: In variables) → **A**
  4. Is the forgotten storage account still in Azure after removed? (A: Yes; B: No; C: Only in the portal) → **A**

### 8.6 State commands: list, show, mv, rm and pull  [owner original] **[shared]**
- **Request:** CR-193 · **Duration:** ~8 min · **Depends on:** 8.5
- **Objectives:** Inspect state with list and show; Move and remove items safely; Back up state before surgery
- **Slides:** slides 535–542 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-commands`
- **Demo:** The owner's commands section on a neutral project; why moved blocks (8.5) are preferred over state mv in a team.
- **Code:** GEN builds `courses/terraform/code/shared/state-commands-list-show-mv-rm-and-pull/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 535–542), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which command lists everything in the state? (A: terraform state list; B: terraform show -list; C: terraform list) → **A**
  2. Why prefer moved blocks over state mv? (A: They are reviewed in a plan and repeatable; B: They are faster; C: state mv is removed) → **A**
  3. What should you do before state surgery? (A: terraform state pull > backup.tfstate; B: Nothing; C: Delete .terraform) → **A**

### 8.7 Read another stack's outputs: terraform_remote_state  [owner original]
- **Request:** CR-195 · **Duration:** ~10 min · **Depends on:** 8.6
- **Objectives:** Expose outputs from a network stack; Read them from an app stack; Choose between remote state and data sources
- **Slides:** slides 526–534 · **Owner's repo:** `azure-terraform/new`
- **Demo:** The same with a VNet stack and a VM stack through the azurerm backend.
- **Code:** GEN builds `courses/terraform/code/azure/read-another-stack-s-outputs-terraform-remote-st/`
- **Cloud resources:** VNet, subnets, B1s VM · **Cost per run:** ~$0.02 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 526–534), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What can terraform_remote_state read? (A: Root-level outputs of another state; B: Every resource attribute; C: Variables) → **A**
  2. What is a downside of remote state data sources? (A: The reader needs access to the whole state; B: They are slow; C: They cost money) → **A**
  3. What is an alternative? (A: Data sources that query the cloud, or a parameter store; B: Copying state files; C: Hard-coding ids) → **A**
  4. Which backend type does the Azure example read? (A: azurerm; B: s3; C: gcs) → **A**

### 8.8 Keep secrets out of state: ephemeral values and write-only arguments  [new, proposed]
- **Request:** CR-197 · **Duration:** ~10 min · **Depends on:** 8.7
- **Objectives:** Generate a secret with an ephemeral resource; Send it with a write-only argument; Rotate it with a version number
- **Slides:** extends slides 157–162 · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Lesson code: ephemeral random_password → azurerm_key_vault_secret value_wo with RBAC Key Vault.
- **Code:** `courses/terraform/code/azure/terraform-ephemeral-write-only` (ready, validated)
- **Cloud resources:** Key Vault, secret · **Cost per run:** ~$0.01 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Are write-only values stored in state? (A: No; B: Yes; C: Only encrypted) → **A**
  2. How do you rotate a write-only secret? (A: Increase its _wo_version; B: Delete the state; C: Run init) → **A**
  3. Which Terraform version introduced write-only arguments? (A: 1.11; B: 0.12; C: 1.0) → **A**
  4. Which argument writes a Key Vault secret without storing it? (A: value_wo; B: value; C: secret_value) → **A**

## Module 9: Environments and accounts
Dev, staging and prod: workspaces, folders, accounts and Terragrunt.

### 9.1 Workspaces  [owner original] **[shared]**
- **Request:** CR-198 · **Duration:** ~8 min · **Depends on:** 8.8
- **Objectives:** Create and switch workspaces; Use terraform.workspace in names; Explain when workspaces are not enough
- **Slides:** slides 441–446 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-workspace`
- **Demo:** The owner's dev.tfvars/prod.tfvars workspace example on a neutral project; why separate state per environment folder or account is safer for production (lesson 9.3).
- **Code:** GEN builds `courses/terraform/code/shared/workspaces/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 441–446), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does each workspace have? (A: Its own state; B: Its own code; C: Its own provider) → **A**
  2. How do you read the current workspace in code? (A: terraform.workspace; B: var.workspace; C: local.workspace) → **A**
  3. Why are workspaces weak isolation for prod? (A: Same code, same backend and same credentials; B: They are slow; C: They cost more) → **A**

### 9.2 Several environments and accounts  [owner original, updated]
- **Request:** CR-200 · **Duration:** ~12 min · **Depends on:** 9.1
- **Objectives:** Point Terraform at different accounts or subscriptions; Assume a role per environment; Prevent applying to the wrong one
- **Slides:** slides 447–458 · **Owner's repo:** `azure-terraform/new`
- **Demo:** Subscriptions per environment: subscription_id per tfvars, az account set, and a check that fails the plan on the wrong subscription.
- **Code:** GEN builds `courses/terraform/code/azure/several-environments-and-accounts/`
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 447–458), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Improve: slides 449–450 store access keys per profile; use SSO profiles or roles.
- **Quiz:**
  1. Why separate accounts or subscriptions per environment? (A: A mistake in dev cannot touch prod; B: It is cheaper; C: Terraform requires it) → **A**
  2. What stops an apply in the wrong environment? (A: A guard in code (allowed ids or a check); B: Hope; C: A comment) → **A**
  3. Where does the environment choice live? (A: In tfvars or backend config per environment; B: In the state; C: In the provider binary) → **A**
  4. Which provider argument selects the Azure subscription? (A: subscription_id; B: tenant_only; C: location) → **A**

### 9.3 One folder per environment  [new, proposed] **[shared]**
- **Request:** CR-201 · **Duration:** ~10 min · **Depends on:** 9.2
- **Objectives:** Lay out modules/ and envs/dev, envs/prod; Give each environment its own backend key; Promote a change from dev to prod
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** A neutral layout used by the capstone: modules/, envs/dev, envs/prod with their own backend.hcl and tfvars; the same module version promoted.
- **Code:** GEN builds `courses/terraform/code/shared/one-folder-per-environment/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does each environment folder have? (A: Its own state and variables; B: Its own copy of every module's code; C: Nothing) → **A**
  2. How is a change promoted? (A: Apply in dev, then the same version in prod; B: Copy the state; C: Edit prod first) → **A**
  3. Why pin module versions per environment? (A: Prod changes only when you choose; B: It is faster; C: It is required) → **A**

### 9.4 Terragrunt: keep environments DRY  [owner original, updated]
- **Request:** CR-203 · **Duration:** ~14 min · **Depends on:** 9.3
- **Objectives:** Generate backends and providers with Terragrunt; Share inputs across environments; Order stacks with dependencies
- **Slides:** slides 574–583, 56–57 · **Owner's repo:** `azure-terraform/new`
- **Demo:** The same layout for Azure: resource group, VNet, VM; remote_state backend azurerm generated per folder.
- **Code:** GEN builds `courses/terraform/code/azure/terragrunt-keep-environments-dry/`
- **Cloud resources:** Resource group, VNet, B1s VM · **Cost per run:** ~$0.03 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 574–583, 56–57), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: Terragrunt is now 1.x (v1.2.3, 2026-11-25): `run --all` replaces `run-all`, root.hcl replaces a root terragrunt.hcl, find_in_parent_folders("root.hcl"). Check commands at recording.
- **Quiz:**
  1. What problem does Terragrunt solve? (A: Repeated backend and provider code across environments; B: Provider installation; C: State encryption) → **A**
  2. What does a dependency block do? (A: Reads another unit's outputs and orders the runs; B: Installs Terraform; C: Locks state) → **A**
  3. Which command plans every unit? (A: terragrunt run --all plan; B: terraform plan --all; C: terragrunt init) → **A**
  4. Which backend does the Azure root config generate? (A: azurerm; B: s3; C: local) → **A**

## Module 10: Modules
Use, write, version and publish modules.

### 10.1 What modules are and how to call them  [owner original] **[shared]**
- **Request:** CR-204 · **Duration:** ~10 min · **Depends on:** 9.4
- **Objectives:** Explain root and child modules; Call a module with source and inputs; Read its outputs
- **Slides:** slides 509–521, 483–492 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-module`
- **Demo:** Slides 511–514 with a local neutral module (a naming module); source types (local, Git with ?ref=, registry).
- **Code:** GEN builds `courses/terraform/code/shared/what-modules-are-and-how-to-call-them/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 509–521, 483–492), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Duplicate: slides 483–492 repeat 509–521.
- **Quiz:**
  1. What is the root module? (A: The folder where you run Terraform; B: The registry; C: The provider) → **A**
  2. How do you read a module output? (A: module.<name>.<output>; B: output.<module>; C: var.<module>) → **A**
  3. Which source pins a Git module to a tag? (A: git::https://...?ref=v1.2.0; B: git@latest; C: module@v1) → **A**

### 10.2 Use registry modules  [owner original, updated]
- **Request:** CR-206 · **Duration:** ~12 min · **Depends on:** 10.1
- **Objectives:** Find a trustworthy module in the registry; Pin its version; Read its inputs and outputs before use
- **Slides:** slides 518–521 · **Owner's repo:** `azure-terraform/new`
- **Demo:** Azure Verified Modules (AVM): avm-res-network-virtualnetwork and a VM module; pinning, telemetry setting, reading inputs.
- **Code:** GEN builds `courses/terraform/code/azure/use-registry-modules/`
- **Cloud resources:** VNet, B1s VM · **Cost per run:** ~$0.02 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 518–521), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why pin a registry module version? (A: Upgrades only when you choose; B: It is required; C: To lower cost) → **A**
  2. What should you read before using a module? (A: Its inputs, outputs, examples and changelog; B: Only the name; C: Nothing) → **A**
  3. What is a sign of a trustworthy module? (A: Maintained, versioned, documented and widely used; B: Many stars only; C: No README) → **A**
  4. What are Microsoft's official Terraform modules called? (A: Azure Verified Modules; B: Azure Blueprints; C: ARM modules) → **A**

### 10.3 Write your own network module  [owner original]
- **Request:** CR-208 · **Duration:** ~15 min · **Depends on:** 10.2
- **Objectives:** Design a module's inputs and outputs; Create subnets across zones with for_each; Document the module
- **Slides:** slides 509–521, 544 · **Owner's repo:** `azure-terraform/modules/vnet`, `azure-terraform/aks-vnet`
- **Demo:** The owner's vnet module: VNet, subnets from a map, NSG association, optional NAT gateway.
- **Code:** GEN builds `courses/terraform/code/azure/write-your-own-network-module/`
- **Cloud resources:** VNet, subnets, NSGs (NAT optional) · **Cost per run:** $0 without NAT; NAT gateway ~$0.05/hour if turned on · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 509–521, 544), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What makes a good module input? (A: Typed, described, validated, with sensible defaults; B: As many as possible; C: Untyped any) → **A**
  2. Why make NAT optional? (A: It costs by the hour; B: It is deprecated; C: It is required) → **A**
  3. What should a network module output? (A: Network and subnet ids; B: Passwords; C: The state) → **A**
  4. What do you attach to Azure subnets to filter traffic? (A: A network security group; B: A security group rule in AWS; C: A firewall in the VM only) → **A**

### 10.4 Version, source and publish modules  [owner original] **[shared]**
- **Request:** CR-209 · **Duration:** ~10 min · **Depends on:** 10.3
- **Objectives:** Version a module with Git tags; Publish to the public registry from GitHub; Use a private registry
- **Slides:** slides 522–525 · **Owner's repo:** `aws-terraform/terraform-concepts/terraform-module-publish`, devopstia/terraform-aws-vpc-module
- **Demo:** The owner's publish steps (slides 524–525): repo name terraform-<provider>-<name>, semantic version tags, registry sign-in; HCP Terraform private registry as the team option.
- **Code:** GEN builds `courses/terraform/code/shared/version-source-and-publish-modules/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides from the owner's deck (slides 522–525), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What repo name does the registry require? (A: terraform-<provider>-<name>; B: module-<name>; C: any name) → **A**
  2. How does the registry find versions? (A: Git tags like v1.2.0; B: Branch names; C: Commit messages) → **A**
  3. What does a major version bump tell users? (A: Breaking changes; B: A typo fix; C: Nothing) → **A**

### 10.5 Compose modules: network, compute and data  [new, proposed]
- **Request:** CR-211 · **Duration:** ~12 min · **Depends on:** 10.4
- **Objectives:** Wire modules together through outputs; Keep each module small; Avoid passing whole objects around
- **Slides:** none in the deck (new lesson) · **Owner's repo:** `azure-terraform/modules/vnet`, `azure-terraform/virtual-machine`, `azure-terraform/azure-mysql`
- **Demo:** The owner's vnet and virtual-machine modules composed; outputs flow from network to compute.
- **Code:** GEN builds `courses/terraform/code/azure/compose-modules-network-compute-and-data/`
- **Cloud resources:** VNet, NSG, B1s VM · **Cost per run:** ~$0.02 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. How do modules share values? (A: Outputs of one become inputs of another; B: Shared state files; C: Global variables) → **A**
  2. Why keep modules small? (A: Easier to test, reuse and review; B: Fewer files; C: Faster init) → **A**
  3. Should a child module configure its own provider? (A: No, the root passes providers; B: Yes always; C: Only in prod) → **A**
  4. Which owner module creates the VM? (A: modules/virtual-machine; B: modules/acr; C: modules/key-vault) → **A**

## Module 11: Projects from the owner's deck
The owner's module projects, each a real requirement list turned into a tested module.

### 11.1 Project: a production-style network  [owner original]
- **Request:** CR-213 · **Duration:** ~15 min · **Depends on:** 10.3
- **Objectives:** Build the network module to the owner's requirement list; Tag and name it with the convention; Test it with terraform test
- **Slides:** slide 544 · **Owner's repo:** `azure-terraform/modules/vnet`, `azure-terraform/aks-vnet`
- **Demo:** Same requirements in Azure: VNet with public/private subnets, NSGs, optional NAT gateway, outputs.
- **Code:** GEN builds `courses/terraform/code/azure/project-a-production-style-network/`
- **Cloud resources:** VNet, subnets, NSGs, (NAT optional) · **Cost per run:** $0 without NAT; ~$0.05 per hour with one NAT gateway · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slide 544), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why create subnets in three zones? (A: A zone failure does not take everything down; B: It is cheaper; C: It is required) → **A**
  2. Which part of the network costs by the hour? (A: NAT gateway; B: Subnets; C: Route tables) → **A**
  3. What proves the module meets the requirements? (A: Tests and a plan reviewed against the list; B: Its file size; C: Its name) → **A**
  4. What does a private Azure subnet need for outbound internet? (A: An explicit outbound method such as a NAT gateway; B: Nothing at all; C: A storage account) → **A**

### 11.2 Project: virtual machines and a secure jump host  [owner original, updated]
- **Request:** CR-215 · **Duration:** ~15 min · **Depends on:** 11.1
- **Objectives:** Build a VM module with optional public IP and user data; Build a jump host that only your IP can reach; Prefer keyless access where the cloud offers it
- **Slides:** slides 545–546 · **Owner's repo:** `azure-terraform/modules/virtual-machine`
- **Demo:** The VM module with SSH key generated at run time, NSG from your IP only; Azure Bastion Developer (free tier where available) or just-in-time access as alternatives.
- **Code:** GEN builds `courses/terraform/code/azure/project-virtual-machines-and-a-secure-jump-host/`
- **Cloud resources:** B1s VM x2, NSG, public IP · **Cost per run:** ~$0.03 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 545–546), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Security: replace committed .pem keys with tls_private_key or ssh-keygen at run time.
- **Quiz:**
  1. Who should reach a jump host? (A: Only known IPs or identities; B: Everyone; C: Only the internet gateway) → **A**
  2. Why generate keys at run time? (A: Keys in Git leak; B: It is faster; C: Terraform requires it) → **A**
  3. What should the VM module expose as inputs? (A: Size, image, subnet, user data, access options; B: Every attribute; C: Nothing) → **A**
  4. Which Azure feature gives browser SSH without a public IP? (A: Azure Bastion; B: Key Vault; C: Front Door) → **A**

### 11.3 Project: firewall rules and a container registry with loops  [owner original]
- **Request:** CR-217 · **Duration:** ~12 min · **Depends on:** 11.2
- **Objectives:** Generate firewall rules from a map; Create several registries with for_each; Add lifecycle and scan settings
- **Slides:** slides 551–552 · **Owner's repo:** `azure-terraform/modules/acr`
- **Demo:** An NSG module from a rules map and the owner's ACR module (Basic SKU), admin user off, RBAC pull.
- **Code:** GEN builds `courses/terraform/code/azure/project-firewall-rules-and-a-container-registry/`
- **Cloud resources:** NSG, ACR Basic · **Cost per run:** ~$0.17 per day (ACR Basic); destroy the same day · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 551–552), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why build firewall rules from a map? (A: One place to review every rule; B: It is required; C: Fewer resources) → **A**
  2. Why add a lifecycle policy to a registry? (A: Old images are deleted and storage stays cheap; B: Faster pulls; C: Security only) → **A**
  3. Which access is safer for a registry? (A: Identity-based pull (IAM/RBAC); B: A shared admin password; C: Public access) → **A**
  4. Which ACR setting should be off? (A: admin_enabled; B: public_network_access only; C: sku) → **A**

### 11.4 Project: a database with secrets done right  [owner original, updated]
- **Request:** CR-219 · **Duration:** ~15 min · **Depends on:** 8.8, 11.1
- **Objectives:** Create a managed database in private subnets; Generate its password with write-only arguments; Store connection details in a secret store
- **Slides:** slides 553–558 · **Owner's repo:** `azure-terraform/modules/azure-mysql`, `azure-terraform/key-vault`
- **Demo:** Azure Database for PostgreSQL Flexible Server (B1ms) with administrator_password_wo, Key Vault secret value_wo, private access.
- **Code:** GEN builds `courses/terraform/code/azure/project-a-database-with-secrets-done-right/`
- **Cloud resources:** PostgreSQL Flexible Server B1ms, Key Vault · **Cost per run:** ~$0.05 per run (B1ms under an hour) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 553–558), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Fix: base-code/aurora-mysql-cluster and others hard-code master passwords; replaced by write-only arguments. Aurora clusters cost more per hour than the lab needs: explained on the owner's slides, not deployed.
- **Quiz:**
  1. Where should a database live? (A: Private subnets, reachable only from the app; B: A public subnet; C: Anywhere) → **A**
  2. How is the password kept out of state? (A: Ephemeral generation plus a write-only argument; B: sensitive = true; C: Encrypting the laptop) → **A**
  3. Why skip final snapshots in labs only? (A: So destroy finishes and costs stop; production keeps them; B: It is faster in production; C: Snapshots are free) → **A**
  4. Which argument sets the PostgreSQL Flexible Server password without storing it? (A: administrator_password_wo; B: administrator_password; C: password_secret) → **A**

### 11.5 Project: a state backend module with replication  [owner original]
- **Request:** CR-221 · **Duration:** ~12 min · **Depends on:** 11.4
- **Objectives:** Package the state backend as a module; Add cross-region replication; Lock down who can read state
- **Slides:** slides 549–550 · **Owner's repo:** `azure-terraform/modules/storage-backend`
- **Demo:** The owner's storage-backend module updated: GRS or object replication to a second region, Entra ID only, resource lock (CanNotDelete).
- **Code:** GEN builds `courses/terraform/code/azure/project-a-state-backend-module-with-replication/`
- **Cloud resources:** 2 storage accounts (or GRS), management lock · **Cost per run:** ~$0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 549–550), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why replicate state? (A: To survive a regional outage or deletion; B: To speed up plans; C: It is required) → **A**
  2. Who should read state? (A: Only the pipeline roles and admins; B: Everyone; C: The public) → **A**
  3. Why deny non-TLS requests? (A: State must never travel unencrypted; B: It is faster; C: It is free) → **A**
  4. Which Azure feature stops a storage account from being deleted? (A: A management lock (CanNotDelete); B: A tag; C: A NSG) → **A**

### 11.6 Project: TLS certificates and DNS  [owner original]
- **Request:** CR-223 · **Duration:** ~10 min · **Depends on:** 11.5
- **Objectives:** Request a wildcard certificate; Validate it with DNS records created by Terraform; Wait for validation in the plan
- **Slides:** slide 559 · **Owner's repo:** `azure-terraform/modules/azure-dns-zone`, `azure-terraform/cert-manager`
- **Demo:** Azure DNS zone (owner's module) and an App Service managed certificate (or Key Vault certificate) validated by a TXT record.
- **Code:** GEN builds `courses/terraform/code/azure/project-tls-certificates-and-dns/`
- **Cloud resources:** DNS zone, App Service managed certificate · **Cost per run:** ~$0.50 (DNS zone month) — needs the training domain · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slide 559), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why validate certificates with DNS? (A: It can be automated and renews itself; B: It is faster to type; C: Email is required) → **A**
  2. What does a wildcard certificate cover? (A: Every first-level subdomain; B: Every domain; C: Only the root) → **A**
  3. What does this project need from the owner? (A: A training domain; B: A credit card change; C: Nothing) → **A**
  4. Which record type usually proves domain ownership for Azure certificates? (A: TXT; B: MX; C: SRV) → **A**

### 11.7 Project: Jenkins on the cloud with an agent  [owner original]
- **Request:** CR-225 · **Duration:** ~15 min · **Depends on:** 11.2 (13.4 optional)
- **Objectives:** Launch a Jenkins controller and an agent from modules; Reach it safely; Tear it down completely
- **Slides:** slides 547–548 · **Owner's repo:** `azure-terraform/new`
- **Demo:** A Jenkins controller VM and agent VM with cloud-init, NSG from your IP only, managed identity for agents.
- **Code:** GEN builds `courses/terraform/code/azure/project-jenkins-on-the-cloud-with-an-agent/`
- **Cloud resources:** B2s VM x2 (or B1ms), NSG, public IP · **Cost per run:** ~$0.15 per run · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 547–548), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why build Jenkins from code? (A: The same server can be rebuilt any time; B: It is required by Jenkins; C: It is free) → **A**
  2. Who should reach the Jenkins UI in a lab? (A: Only your IP; B: Everyone; C: No one) → **A**
  3. What is the agent for? (A: Running builds away from the controller; B: Storing state; C: Serving the UI) → **A**
  4. What installs Jenkins on the Azure VM in this lab? (A: cloud-init in custom_data; B: Azure Policy; C: Key Vault) → **A**

## Module 12: Code quality, testing and policy
Prove the code before anyone applies it: linting, tests and policy as code.

### 12.1 fmt, validate and TFLint before every commit  [new, proposed] **[shared]**
- **Request:** CR-226 · **Duration:** ~10 min · **Depends on:** 11.7
- **Objectives:** Run fmt, validate and TFLint locally; Add them to a pre-commit hook; Read and fix lint findings
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** A neutral project with mistakes (unused variable, deprecated syntax, wrong type); TFLint core rules, then where the AWS and Azure rulesets plug in; pre-commit-terraform hooks.
- **Code:** GEN builds `courses/terraform/code/shared/fmt-validate-and-tflint-before-every-commit/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which tool finds unused variables? (A: TFLint; B: terraform fmt; C: terraform output) → **A**
  2. When should checks run? (A: Before every commit and again in CI; B: Only in production; C: Once a year) → **A**
  3. Does validate need cloud credentials? (A: No; B: Yes; C: Only for Azure) → **A**

### 12.2 Test modules with terraform test  [new, proposed]
- **Request:** CR-228 · **Duration:** ~14 min · **Depends on:** 10.3
- **Objectives:** Write .tftest.hcl run blocks with asserts; Mock the provider so tests are free; Test validation with expect_failures
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Lesson code: a storage-account module tested for naming, privacy and TLS, with mock_provider "azurerm".
- **Code:** `courses/terraform/code/azure/terraform-test` (ready, validated)
- **Cloud resources:** none or free resources only · **Cost per run:** $0 (mocked) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does mock_provider do? (A: Fakes the provider so nothing is created; B: Speeds up the real provider; C: Skips tests) → **A**
  2. How do you test that bad input is rejected? (A: expect_failures = [var.name]; B: assert false; C: skip = true) → **A**
  3. When is a test worth keeping? (A: It fails when you break the rule on purpose; B: It always passes; C: It is long) → **A**
  4. Which storage setting does the test protect? (A: No public blobs, no shared keys, TLS 1.2; B: Replication only; C: Tags only) → **A**

### 12.3 Policy as code: Checkov, OPA and Sentinel  [new, proposed]
- **Request:** CR-230 · **Duration:** ~12 min · **Depends on:** 12.2
- **Objectives:** Scan code with Checkov and read the findings; Skip a check only with a written reason; Check a plan with OPA and know where Sentinel fits
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Mirror: a weak storage account and Key Vault scanned (CKV_AZURE checks), fixed; Azure Policy as the cloud-side guardrail.
- **Code:** GEN builds `courses/terraform/code/azure/policy-as-code-checkov-opa-and-sentinel/`
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. When should a failed check be skipped? (A: Only with a written reason in the code; B: Whenever it is annoying; C: Never document it) → **A**
  2. What does OPA check in this lesson? (A: The JSON plan; B: The provider binary; C: The state lock) → **A**
  3. Why is policy the guardrail for AI-written code? (A: It checks every change the same way, whoever wrote it; B: AI cannot write Terraform; C: It is faster than AI) → **A**
  4. What is Azure's own policy service called? (A: Azure Policy; B: Sentinel; C: Guardrails) → **A**

## Module 13: CI/CD and team workflows
Terraform in pipelines without stored cloud keys; HCP Terraform, Jenkins, Packer and upgrades.

### 13.1 GitHub Actions with OIDC: plan on pull request, apply on approval  [owner original, updated]
- **Request:** CR-232 · **Duration:** ~18 min · **Depends on:** 8.2
- **Objectives:** Trust GitHub's OIDC token in the cloud; Plan on pull requests and comment the plan; Apply only after merge and a reviewer's approval
- **Slides:** slides 614–616 · **Owner's repo:** no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-with-github-action`)
- **Demo:** Lesson code: two user-assigned managed identities with federated credentials (pull_request and environment:production), ARM_USE_OIDC, the approval gate.
- **Code:** `courses/terraform/code/azure/terraform-with-github-action` (ready, validated)
- **Cloud resources:** 2 managed identities, federated credentials, role assignments · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 614–616), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: the owner's workflows use AWS access keys as GitHub secrets, setup-terraform@v2.0.2 and Terraform 1.0.0.
- **Quiz:**
  1. Why OIDC instead of stored keys? (A: Short-lived credentials, nothing to leak; B: It is faster; C: GitHub requires it) → **A**
  2. Who approves the apply? (A: A person, through the protected environment; B: The AI reviewer; C: Nobody) → **A**
  3. Why separate plan and apply identities? (A: Pull requests get read-only rights; B: It is cheaper; C: Terraform needs two) → **A**
  4. Which environment variable tells azurerm to use OIDC? (A: ARM_USE_OIDC=true; B: AZURE_OIDC=1; C: TF_OIDC) → **A**

### 13.2 HCP Terraform: remote runs, variable sets and dynamic credentials  [owner original, updated]
- **Request:** CR-234 · **Duration:** ~15 min · **Depends on:** 13.1
- **Objectives:** Create an organisation, project and workspace; Run plans from VCS; Use dynamic provider credentials instead of stored keys
- **Slides:** slides 584–599 · **Owner's repo:** `azure-terraform/new`
- **Demo:** The same with Azure dynamic credentials (federated identity), variable sets and a VNet module run.
- **Code:** GEN builds `courses/terraform/code/azure/hcp-terraform-remote-runs-variable-sets-and-dyna/`
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 584–599), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: "Terraform Cloud" is now HCP Terraform; slides 593 and 597 store AWS keys as variables (use dynamic credentials). Check the free plan's current limits before recording.
- **Quiz:**
  1. What is Terraform Cloud called today? (A: HCP Terraform; B: Terraform Hub; C: Terraform Online) → **A**
  2. What groups workspaces in HCP Terraform? (A: Projects; B: Folders; C: Branches) → **A**
  3. What replaces stored cloud keys in workspaces? (A: Dynamic provider credentials (OIDC); B: A bigger plan; C: Sentinel) → **A**
  4. What does an Azure dynamic credential use? (A: A federated identity credential; B: A storage key; C: A certificate on disk) → **A**

### 13.3 Terraform with Jenkins and Terragrunt pipelines  [owner original]
- **Request:** CR-236 · **Duration:** ~14 min · **Depends on:** 11.7
- **Objectives:** Write a Jenkinsfile with plan, approval and apply stages; Use the agent's role instead of keys; Run Terragrunt from Jenkins
- **Slides:** slides 617–622 · **Owner's repo:** `azure-terraform/new`
- **Demo:** The same on the Azure Jenkins VM with its managed identity (ARM_USE_MSI) and the azurerm backend.
- **Code:** GEN builds `courses/terraform/code/azure/terraform-with-jenkins-and-terragrunt-pipelines/`
- **Cloud resources:** Jenkins VM (from 11.7) · **Cost per run:** ~$0.15 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 617–622), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Gap: the repo's Jenkins folders have no Jenkinsfile; written new.
- **Quiz:**
  1. Which Jenkins step waits for a person? (A: input; B: sh; C: stash) → **A**
  2. Where do Jenkins credentials for the cloud come from in this lesson? (A: The agent's role or managed identity; B: Hard-coded keys; C: The Jenkinsfile) → **A**
  3. Why save the plan file and apply it? (A: The apply does exactly what was reviewed; B: It is faster; C: It is required) → **A**
  4. Which setting makes azurerm use a VM's managed identity? (A: ARM_USE_MSI=true; B: ARM_KEY; C: use_cli) → **A**

### 13.4 Machine images with Packer  [owner original]
- **Request:** CR-238 · **Duration:** ~14 min · **Depends on:** 13.3
- **Objectives:** Write a Packer HCL template with variables; Build an image with provisioners; Use the image from Terraform
- **Slides:** slides 600–609 · **Owner's repo:** `azure-terraform/new`
- **Demo:** azure-arm builder to a managed image (or Azure Compute Gallery), the same provisioners; the image used by an azurerm VM; delete afterwards.
- **Code:** GEN builds `courses/terraform/code/azure/machine-images-with-packer/`
- **Cloud resources:** Temporary build VM, managed image · **Cost per run:** ~$0.05 per build; delete the image · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 600–609), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does Packer produce? (A: A machine image; B: A state file; C: A container only) → **A**
  2. Why bake images? (A: Faster, repeatable servers; B: Cheaper storage; C: No security updates needed) → **A**
  3. What must you clean up after an AMI lab? (A: The AMI and its snapshot; B: Nothing; C: Only the instance) → **A**
  4. Which Packer builder makes Azure images? (A: azure-arm; B: amazon-ebs; C: qemu) → **A**

### 13.5 Upgrade Terraform and providers safely  [owner original, updated]
- **Request:** CR-240 · **Duration:** ~12 min · **Depends on:** 13.4
- **Objectives:** Read upgrade guides and changelogs; Upgrade one version step in a branch with a clean plan; Handle provider major versions
- **Slides:** slides 610–613 · **Owner's repo:** `azure-terraform/new`
- **Demo:** The same with azurerm 3 → 4 → 5 (features, subscription_id, renamed arguments) on the owner's Azure modules.
- **Code:** GEN builds `courses/terraform/code/azure/upgrade-terraform-and-providers-safely/`
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 610–613), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: README targets Terraform 1.0 and the 0.14 changelog.
- **Quiz:**
  1. What is the goal plan after an upgrade? (A: No changes; B: Everything replaced; C: Any plan) → **A**
  2. Where do you start a provider major upgrade? (A: The provider's upgrade guide; B: The state file; C: Production) → **A**
  3. Why upgrade in small steps? (A: Each step's changes are easy to see and undo; B: It is required; C: It is faster) → **A**
  4. Which azurerm major is current in late 2026? (A: 5; B: 2; C: 3) → **A**

### 13.6 OpenTofu: what changes and how to try it  [new, proposed] **[shared]**
- **Request:** CR-241 · **Duration:** ~8 min · **Depends on:** 13.5
- **Objectives:** Explain the licence history; Run a project with tofu; List the features that differ
- **Slides:** slides 28–32 (extends) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** A neutral project with tofu init/plan; state encryption (an OpenTofu feature); where the two differ and how to stay compatible.
- **Code:** GEN builds `courses/terraform/code/shared/opentofu-what-changes-and-how-to-try-it/` (cloud-neutral providers: local, random, terraform_data)
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Who maintains OpenTofu? (A: The Linux Foundation community; B: HashiCorp; C: AWS) → **A**
  2. Which command runs OpenTofu? (A: tofu; B: terraform; C: otf) → **A**
  3. Which feature is OpenTofu known for? (A: Built-in state encryption; B: Sentinel; C: HCP projects) → **A**

## Module 14: AI-Powered Terraform
AI drafts, Terraform and a person verify: writing, explaining, testing and reviewing infrastructure code with AI.

### 14.1 AI drafts, Terraform verifies: the rules of AI-assisted IaC  [new, proposed: AI] **[shared]**
- **Request:** CR-242 · **Duration:** ~8 min · **Depends on:** 13.6
- **Objectives:** State the rules (AI drafts; fmt, validate, tests, policy, plan and a person verify; never auto-apply); Name what never goes into a prompt; Explain why AI gets provider details wrong
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The verification ladder on one slide; a real AI answer with an outdated argument caught by validate; what not to paste (state, tfvars with secrets, keys).
- **Code:** `courses/terraform/code/ai-terraform-prompts`
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Who approves an AI-written change? (A: A person, after the checks pass; B: The AI; C: Nobody) → **A**
  2. What must never go into a prompt? (A: State files, secrets and keys; B: Error messages; C: Module names) → **A**
  3. Why do assistants get provider arguments wrong? (A: They learned older versions; B: They are random; C: Providers change every hour) → **A**

### 14.2 Prompt AI to write HCL: poor vs professional prompts  [new, proposed: AI]
- **Request:** CR-244 · **Duration:** ~14 min · **Depends on:** 14.1, CR-077–CR-082 (prompt engineering)
- **Objectives:** Write a professional prompt (role, context, task, constraints, output, checks); Compare results of a poor and a professional prompt live; Prove the result with fmt, validate, Checkov and plan
- **Slides:** none in the deck (new lesson) · **Owner's repo:** no Azure exercise in the owner's repo (mirrors `aws-terraform/links CR-077–CR-082`)
- **Demo:** The same for a private storage account with Key Vault; the poor answer uses storage keys and azurerm 3.x syntax.
- **Code:** GEN builds `courses/terraform/code/azure/prompt-ai-to-write-hcl-poor-vs-professional-prom/` (reuses `code/ai-terraform-prompts/01-write-hcl-professional.md`)
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which part of a prompt states the versions and standards? (A: Context; B: Role; C: Output) → **A**
  2. What proves AI output is usable? (A: fmt, validate, policy and a reviewed plan; B: The AI saying so; C: Its length) → **A**
  3. What is a typical flaw of a short prompt's output? (A: Missing security settings and version pins; B: Too many comments; C: It fails to format) → **A**
  4. What outdated syntax did the poor Azure answer use? (A: azurerm 3.x arguments; B: Bicep; C: CloudFormation) → **A**

### 14.3 AI explains plans and errors (and when it is wrong)  [new, proposed: AI]
- **Request:** CR-246 · **Duration:** ~12 min · **Depends on:** 14.2
- **Objectives:** Ask AI to summarise a plan with risks; Troubleshoot an error with AI and confirm against the docs; Recognise a confident wrong answer
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** A plan that replaces a storage account because of a changed replication type; a 403 from missing data-plane roles; one wrong AI answer caught by the docs.
- **Code:** GEN builds `courses/terraform/code/azure/ai-explains-plans-and-errors-and-when-it-is-wron/` (reuses `code/ai-terraform-prompts/02-explain-plan.md`)
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What should you do with an AI explanation? (A: Check it against the plan and the provider docs; B: Apply it; C: Ignore the plan) → **A**
  2. What is the riskiest line in a plan? (A: A replace or destroy of a stateful resource; B: An added tag; C: A new output) → **A**
  3. How did we catch the invented argument? (A: terraform validate; B: The AI apologised; C: A comment) → **A**
  4. Why did the Azure 403 happen? (A: The identity lacked a data-plane role; B: Wrong region; C: Old Terraform) → **A**

### 14.4 AI writes tests and refactors modules with moved blocks  [new, proposed: AI]
- **Request:** CR-248 · **Duration:** ~14 min · **Depends on:** 12.2, 8.5
- **Objectives:** Have AI write terraform test cases and keep only those that catch a broken rule; Have AI refactor a module into for_each with moved blocks; Prove the refactor plans with no destroy
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The same on the storage module and a count-based resource-group set.
- **Code:** GEN builds `courses/terraform/code/azure/ai-writes-tests-and-refactors-modules-with-moved/` (reuses `code/ai-terraform-prompts/04-write-tests.md`)
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. How do you know an AI-written test is useful? (A: It fails when the rule is broken on purpose; B: It passes; C: It is long) → **A**
  2. What must a refactor plan show? (A: Moves, no destroys; B: Destroys and creates; C: Nothing at all) → **A**
  3. What do moved blocks need from you? (A: The old and new addresses; B: The state file; C: A new backend) → **A**
  4. Which Azure resource set is refactored? (A: Count-based resource groups; B: AKS; C: Key Vault) → **A**

### 14.5 The Terraform MCP server: an agent that reads current docs  [new, proposed: AI] **[shared]**
- **Request:** CR-249 · **Duration:** ~12 min · **Depends on:** 14.1
- **Objectives:** Connect an AI agent to the Terraform MCP server; Let it look up current provider and module docs; Keep its permissions read-only
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The registry toolset in Claude Code or VS Code (Docker image hashicorp/terraform-mcp-server:1.4.1), the same question asked with and without MCP; HCP Terraform tools with a read-only token; destructive tools left off.
- **Code:** `courses/terraform/code/terraform-mcp-server`
- **Cloud resources:** none (local, random, terraform_data providers) · **Cost per run:** $0 (cloud-neutral demo, runs locally) · **Cleanup:** `terraform destroy` (local files only); nothing in any cloud
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does the registry toolset give the agent? (A: Current provider and module documentation; B: Cloud credentials; C: The state file) → **A**
  2. Which token is right for the lesson's HCP Terraform tools? (A: A read-only team token in an environment variable; B: An owner token in the file; C: None) → **A**
  3. Does the agent apply changes in this lesson? (A: No; B: Yes; C: Only at night) → **A**

### 14.6 AI review of a pull request's plan in GitHub Actions  [new, proposed: AI]
- **Request:** CR-251 · **Duration:** ~15 min · **Depends on:** 13.1, 14.3
- **Objectives:** Add an AI review job that comments risks, cost and blast radius; Keep secrets out of what the AI sees; Keep the human approval as the gate
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The same on the Azure pipeline; a storage account replacement flagged HIGH RISK.
- **Code:** GEN builds `courses/terraform/code/azure/ai-review-of-a-pull-request-s-plan-in-github-act/` (reuses `code/ai-terraform-prompts/03-review-pr-plan.md`)
- **Cloud resources:** none or free resources only · **Cost per run:** ~$0.10 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Can the AI reviewer approve the apply? (A: No, it only comments; B: Yes; C: Only for small changes) → **A**
  2. What should the AI see? (A: A redacted plan summary and the code diff; B: The state and secrets; C: Cloud credentials) → **A**
  3. What does HIGH RISK mean in the comment? (A: A stateful resource is replaced or destroyed; B: The plan is big; C: The AI is unsure) → **A**
  4. Where does the model key live for the Azure pipeline? (A: A GitHub secret (or Key Vault via OIDC); B: In tfvars; C: In the state) → **A**

### 14.7 An AI-generated module through the full gate  [new, proposed: AI]
- **Request:** CR-253 · **Duration:** ~12 min · **Depends on:** 12.2, 12.3, 14.2
- **Objectives:** Run AI output through fmt, TFLint, tests, Checkov and a reviewed plan; Fix what fails; Decide when to reject AI output
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** AI writes a Static Web App + storage module; the gate catches shared keys enabled; fixed, applied, destroyed.
- **Code:** GEN builds `courses/terraform/code/azure/an-ai-generated-module-through-the-full-gate/`
- **Cloud resources:** Static Web App Free, storage account · **Cost per run:** ~$0 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which check catches insecure settings? (A: Policy (Checkov); B: fmt; C: output) → **A**
  2. When should you reject AI output? (A: When fixing it costs more than writing it; B: Never; C: Always) → **A**
  3. What comes last before apply? (A: A person reviews the plan; B: Another AI; C: Nothing) → **A**
  4. What did the gate catch in the Azure module? (A: Shared keys enabled; B: Wrong region; C: A missing tag) → **A**

## Module 15: Terraform for AI infrastructure
Build the AI platforms of the AI masterclasses as code: models, RAG, guardrails and agents.

### 15.1 AI platform foundations as code: model access, identities and logging  [new, proposed: AI]
- **Request:** CR-255 · **Duration:** ~12 min · **Depends on:** 14.7
- **Objectives:** Provision the AI platform's identities and least-privilege access; Turn on invocation logging; Tag and budget AI resources
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** A Foundry resource (AIServices, project_management_enabled) and project, local auth off, Entra roles (Cognitive Services OpenAI User), diagnostic settings to Log Analytics.
- **Code:** GEN builds `courses/terraform/code/azure/ai-platform-foundations-as-code-model-access-ide/`
- **Cloud resources:** Foundry resource and project, Log Analytics workspace · **Cost per run:** ~$0 (Log Analytics ingestion cents) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why restrict which models a role may invoke? (A: Cost and data control; B: Speed; C: It is required) → **A**
  2. Why log model invocations? (A: Auditing, cost and troubleshooting; B: To train the model; C: It is free storage) → **A**
  3. What should replace API keys? (A: Identity-based access; B: Longer keys; C: Keys in tfvars) → **A**
  4. Which Azure resource hosts Foundry projects? (A: An AIServices account with project management enabled; B: A storage account; C: A VM) → **A**

### 15.2 A RAG stack as code  [new, proposed: AI]
- **Request:** CR-257 · **Duration:** ~18 min · **Depends on:** 15.1
- **Objectives:** Build documents storage, embeddings and a vector index as code; Connect a knowledge base to it; Ask a grounded question and see the cited source
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Lesson code: Foundry chat + embedding deployments, Azure AI Search Free tier, private Storage, Entra roles; import-and-vectorize; the playground answer citing the runbook.
- **Code:** `courses/terraform/code/azure/terraform-foundry-ai-search` (ready, validated)
- **Cloud resources:** Foundry resource, deployments, AI Search Free, storage account · **Cost per run:** < $0.50 per run (Search Free tier) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Links the AI masterclasses' RAG module: there students use RAG, here they build its platform.
- **Quiz:**
  1. What turns documents into vectors? (A: An embedding model; B: The chat model; C: The state file) → **A**
  2. Why choose the cheapest vector store for labs? (A: Some charge by the hour even when idle; B: They are all free; C: Speed) → **A**
  3. What shows an answer is grounded? (A: It cites the source document; B: It is long; C: It is fast) → **A**
  4. Which Azure service holds the vector index? (A: Azure AI Search; B: Cosmos DB only; C: Key Vault) → **A**

### 15.3 Guardrails as code  [new, proposed: AI]
- **Request:** CR-259 · **Duration:** ~10 min · **Depends on:** 15.2
- **Objectives:** Define content and PII filters as code; Deny topics with examples; Test the guardrail before an app uses it
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** An azurerm_cognitive_account_rai_policy (content filters) attached to the deployment and a blocklist; tested in the Foundry playground.
- **Code:** GEN builds `courses/terraform/code/azure/guardrails-as-code/`
- **Cloud resources:** RAI policy, blocklist · **Cost per run:** ~$0.05 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does a denied topic do? (A: Blocks requests about that subject; B: Speeds up answers; C: Deletes logs) → **A**
  2. Why version guardrails? (A: Apps pin a reviewed version; B: It is required; C: It is cheaper) → **A**
  3. Where is a guardrail tested first? (A: In the console or playground before the app uses it; B: In production; C: Never) → **A**
  4. Which azurerm resource defines content filters? (A: azurerm_cognitive_account_rai_policy; B: azurerm_ai_guardrail; C: azurerm_policy) → **A**

### 15.4 Agents as code  [new, proposed: AI]
- **Request:** CR-261 · **Duration:** ~15 min · **Depends on:** 15.3
- **Objectives:** Provision an agent runtime and its identity as code; Limit its tools and permissions; Estimate and cap its cost
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** A Foundry project agent (azapi or azurerm where available) with the AI Search tool from 15.2, a managed identity, invocation from the CLI or SDK.
- **Code:** GEN builds `courses/terraform/code/azure/agents-as-code/`
- **Cloud resources:** Foundry project agent, managed identity · **Cost per run:** Estimate before recording (pay per use) and log it in CLOUD_BUDGET.md · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Fast-moving services: check resource names and pricing on the recording day.
- **Quiz:**
  1. Why give an agent few tools? (A: Smaller blast radius; B: Faster answers; C: It is required) → **A**
  2. What must you estimate before this lab? (A: The run's cost; B: The state size; C: Nothing) → **A**
  3. Who can change an agent's permissions? (A: Only the IaC pipeline with review; B: The agent itself; C: Anyone) → **A**
  4. Which Azure service runs agents here? (A: Foundry Agent Service; B: Logic Apps only; C: AKS only) → **A**

## Module 16: Kubernetes with Terraform
The owner's EKS projects and their AKS mirror. The costliest module: record each cluster session in one sitting and destroy it right after.

### 16.1 A managed Kubernetes control plane module  [owner original]
- **Request:** CR-263 · **Duration:** ~15 min · **Depends on:** 11.1
- **Objectives:** Create a cluster in the module 11 network; Configure logging and endpoint access; Connect kubectl
- **Slides:** slides 560–561 · **Owner's repo:** `azure-terraform/modules/aks-controle-plane`, `azure-terraform/aks-all-in-one`
- **Demo:** The owner's aks-controle-plane module: AKS with Entra ID integration, a system node pool, az aks get-credentials.
- **Code:** GEN builds `courses/terraform/code/azure/a-managed-kubernetes-control-plane-module/`
- **Cloud resources:** AKS cluster (free tier control plane) · **Cost per run:** $0 control plane (Free tier) + nodes (~$0.50–1 per two-hour session); estimate, log, destroy right after · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 560–561), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does the managed service run for you? (A: The control plane; B: Your pods' code; C: Your laptop) → **A**
  2. Why restrict API endpoint access? (A: The cluster API is a high-value target; B: It is faster; C: It is free) → **A**
  3. What does kubectl need to reach the cluster? (A: A kubeconfig with credentials; B: The Terraform state; C: An image id) → **A**
  4. What does the AKS Free tier charge for the control plane? (A: Nothing; B: $0.10 per hour; C: $1 per hour) → **A**

### 16.2 Node groups: simple, blue-green and spot  [owner original]
- **Request:** CR-265 · **Duration:** ~15 min · **Depends on:** 16.1
- **Objectives:** Add node groups in private subnets; Do a blue-green node upgrade with the owner's green/blue variables; Use spot capacity safely
- **Slides:** slides 562–563 · **Owner's repo:** `azure-terraform/modules/aks-linux-node-group`, `azure-terraform/aks-linux-spot-node-group`, `azure-terraform/aks-windows-node-group`
- **Demo:** The owner's node pool modules: Linux user pool, spot pool with eviction policy, Windows pool explained; blue-green pool swap.
- **Code:** GEN builds `courses/terraform/code/azure/node-groups-simple-blue-green-and-spot/`
- **Cloud resources:** AKS node pools (B2s) · **Cost per run:** ~$0.05/hour per B2s node; destroy right after · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 562–563), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does a blue-green node upgrade avoid? (A: Downtime during the node upgrade; B: Cost; C: Logs) → **A**
  2. What is the risk of spot nodes? (A: They can be taken back at short notice; B: They are slower; C: They are public) → **A**
  3. Where should worker nodes run? (A: Private subnets; B: Public subnets; C: Anywhere) → **A**
  4. What sets what happens when a spot node is reclaimed? (A: eviction_policy; B: priority only; C: os_disk) → **A**

### 16.3 Serverless and mixed capacity  [owner original]
- **Request:** CR-267 · **Duration:** ~12 min · **Depends on:** 16.2
- **Objectives:** Run pods without managing nodes; Mix serverless and node capacity; Know the limits
- **Slides:** slides 564–565 · **Owner's repo:** `azure-terraform/new`
- **Demo:** AKS virtual nodes (ACI) or node auto-provisioning explained and deployed on a test namespace.
- **Code:** GEN builds `courses/terraform/code/azure/serverless-and-mixed-capacity/`
- **Cloud resources:** AKS virtual nodes / ACI · **Cost per run:** counted in the cluster session (16.1) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 564–565), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What is the benefit of serverless pods? (A: No nodes to patch or size; B: Free compute; C: More control) → **A**
  2. Which workload often does not fit serverless pods? (A: DaemonSets; B: Web APIs; C: Batch jobs) → **A**
  3. How do pods land on serverless capacity? (A: Profiles or selectors on namespace/labels; B: Random; C: Node names) → **A**
  4. What backs AKS virtual nodes? (A: Azure Container Instances; B: Azure Functions; C: App Service) → **A**

### 16.4 Cluster access: identities and RBAC  [owner original, updated]
- **Request:** CR-269 · **Duration:** ~12 min · **Depends on:** 16.3
- **Objectives:** Grant users and roles cluster access as code; Map them to Kubernetes RBAC; Remove access cleanly
- **Slides:** slides 566, 572–573 · **Owner's repo:** `azure-terraform/modules/aks-auth-config`
- **Demo:** The owner's aks-auth-config: Entra ID groups, Azure RBAC for Kubernetes, a namespace-scoped role.
- **Code:** GEN builds `courses/terraform/code/azure/cluster-access-identities-and-rbac/`
- **Cloud resources:** AKS role assignments · **Cost per run:** counted in the cluster session (16.1) · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 566, 572–573), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Notes (owner's deck and AWS repo; the Azure lab applies the same fix):** Outdated: the aws-auth ConfigMap is deprecated in favour of EKS access entries.
- **Quiz:**
  1. Why manage cluster access as code? (A: Reviewed, auditable and repeatable; B: It is faster; C: It is required) → **A**
  2. What should a developer usually get? (A: Namespace-scoped rights; B: Cluster admin; C: Nothing) → **A**
  3. What happens to access when the identity is removed from code? (A: The next apply removes it; B: Nothing; C: The cluster breaks) → **A**
  4. What identity source does AKS use for users? (A: Microsoft Entra ID; B: AWS IAM; C: LDAP only) → **A**

### 16.5 Cluster add-ons with Terraform and Helm  [owner original]
- **Request:** CR-271 · **Duration:** ~18 min · **Depends on:** 16.4
- **Objectives:** Install add-ons with the Helm provider and IRSA/Pod Identity or workload identity; Create namespaces with loops; Clean up load balancers before destroying the cluster
- **Slides:** slides 567–571 · **Owner's repo:** `azure-terraform/modules/azure-aks-name-space`, `azure-terraform/nginx-ingress`, `azure-terraform/cert-manager`, `azure-terraform/external-dns`
- **Demo:** The owner's AKS modules: namespaces, NGINX ingress, cert-manager, External DNS with workload identity.
- **Code:** GEN builds `courses/terraform/code/azure/cluster-add-ons-with-terraform-and-helm/`
- **Cloud resources:** Add-ons, a load balancer and public IP · **Cost per run:** a full AKS lab is about $0.50–1 for two hours; destroy right after · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides from the owner's deck (slides 567–571), redrawn to the course standard; lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Why delete Kubernetes load balancers before the cluster? (A: They are cloud resources Terraform may not track; B: They are free; C: It is faster) → **A**
  2. How do add-ons get cloud permissions? (A: A workload identity bound to a role; B: Node keys; C: Hard-coded keys) → **A**
  3. Which provider installs Helm charts from Terraform? (A: helm; B: kubernetes only; C: null) → **A**
  4. Which is the current way for AKS pods to get Azure permissions? (A: Microsoft Entra Workload ID; B: Storage keys; C: Pod passwords) → **A**

## Module 17: Capstone: an enterprise platform
Everything together: two environments, remote state, modules, tests, policy, AI review and a gated pipeline.

### 17.1 Capstone design: environments, state, modules and pipeline  [new, proposed]
- **Request:** CR-273 · **Duration:** ~10 min · **Depends on:** all core modules
- **Objectives:** Read the capstone requirements; Draw the folder, state and pipeline design; Estimate the cost before building
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** dev and prod (two subscriptions or resource-group sets), Storage state per environment, the same modules on Azure, workload identity pipeline; cost table.
- **Code:** the capstone requirements and design PDF (no Terraform yet)
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** nothing is created
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does each environment get in the capstone? (A: Its own state, variables and identity; B: A copy of the pipeline only; C: Nothing) → **A**
  2. Why estimate the cost before building? (A: To stay in budget and know what to destroy; B: It is required; C: For fun) → **A**
  3. What makes this design enterprise-grade? (A: Isolation, review gates and repeatability; B: Size; C: Number of files) → **A**

### 17.2 Build the modules and environments  [new, proposed]
- **Request:** CR-275 · **Duration:** ~20 min · **Depends on:** 10.5, 11.4, 8.2
- **Objectives:** Assemble the owner's modules into the capstone; Deploy dev; Prove it with tests and a reviewed plan
- **Slides:** none in the deck (new lesson) · **Owner's repo:** `azure-terraform/modules/vnet`, `azure-terraform/virtual-machine`, `azure-terraform/azure-mysql`
- **Demo:** VNet, Container Apps (consumption) or App Service B1, PostgreSQL Flexible B1ms with write-only password; dev applied.
- **Code:** GEN builds `courses/terraform/code/azure/build-the-modules-and-environments/`
- **Cloud resources:** VNet, Container Apps environment, PostgreSQL Flexible B1ms · **Cost per run:** ~$0.40 per two-hour session; destroy the same day · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which environment is applied first? (A: dev; B: prod; C: both together) → **A**
  2. Where does the database password come from? (A: An ephemeral value through a write-only argument; B: tfvars; C: The README) → **A**
  3. What has to pass before apply? (A: Tests, policy and a reviewed plan; B: Only fmt; C: Nothing) → **A**
  4. Which Azure service runs the app containers here? (A: Azure Container Apps; B: AKS; C: Batch) → **A**

### 17.3 The pipeline: OIDC, tests, policy, AI review and approval  [new, proposed]
- **Request:** CR-277 · **Duration:** ~18 min · **Depends on:** 13.1, 14.6, 12.2, 12.3
- **Objectives:** Run fmt, TFLint, tests and Checkov in the pipeline; Add the AI review comment; Promote dev to prod through approvals
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The same on the Azure pipeline with workload identity per environment.
- **Code:** `courses/terraform/code/azure/terraform-with-github-action` (ready, validated)
- **Cloud resources:** none or free resources only · **Cost per run:** ~$0.20 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What happens if Checkov fails in the pipeline? (A: The pull request cannot merge; B: It is ignored; C: Apply runs anyway) → **A**
  2. Who approves prod? (A: A named reviewer; B: The AI; C: The pipeline itself) → **A**
  3. What does the AI comment add? (A: A readable risk summary for the reviewer; B: The approval; C: Credentials) → **A**
  4. How does each environment's job sign in to Azure? (A: Its own managed identity with a federated credential; B: A storage key; C: A password) → **A**

### 17.4 Operate it: drift, promotion and destroy  [new, proposed]
- **Request:** CR-279 · **Duration:** ~12 min · **Depends on:** 17.3
- **Objectives:** Detect drift with plan -refresh-only and a scheduled pipeline; Promote a module version to prod; Destroy everything and prove it is gone
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** The same with a portal change, a module tag promotion, destroy, and a Resource Graph query that shows nothing left.
- **Code:** GEN builds `courses/terraform/code/azure/operate-it-drift-promotion-and-destroy/`
- **Cloud resources:** none or free resources only · **Cost per run:** counted in 17.2 · **Cleanup:** `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. What does plan -refresh-only show? (A: Differences between state and the real cloud; B: New resources only; C: Nothing) → **A**
  2. In which order are environments destroyed here? (A: prod, then dev, then the state storage; B: State first; C: Any order) → **A**
  3. How do you prove nothing is left? (A: A tag search shows no lab resources; B: Close the laptop; C: Check the code) → **A**
  4. Which Azure feature queries resources by tag? (A: Azure Resource Graph; B: Key Vault; C: Bastion) → **A**

### 17.5 Course wrap-up, final assessment and what to learn next  [new, proposed]
- **Request:** CR-281 · **Duration:** ~6 min · **Depends on:** 17.4
- **Objectives:** Review the skills gained; Take the final assessment; Choose the next course
- **Slides:** none in the deck (new lesson) · **Owner's repo:** — (none in the owner's repo)
- **Demo:** Recap of the Azure path; final assessment; next: the AI for DevOps on Azure masterclass, n8n automation, and the AWS Terraform masterclass for multi-cloud.
- **Code:** no lab (wrap-up; final assessment JSON)
- **Cloud resources:** none or free resources only · **Cost per run:** $0 · **Cleanup:** nothing is created
- **Materials:** PDF slides (new, course standard); lab ZIP = the code folder (README with requirements, cost, steps and cleanup; `.tfvars.example` only, never real values)
- **Quiz:**
  1. Which rule held through the whole course? (A: AI drafts, Terraform and a person verify; B: AI applies; C: Never destroy) → **A**
  2. What does every lab end with? (A: Destroy and verify; B: Apply to prod; C: Nothing) → **A**
  3. Where do the AI apps from the AI masterclass fit? (A: On infrastructure built with these modules; B: Nowhere; C: Only on laptops) → **A**

## Assessments
- A module assessment (8–10 questions) at the end of each module, from that module's lesson quizzes and objectives.
- Final assessment: 20 questions across the course, in lesson 17.5. Certificate as for every DEL course.
