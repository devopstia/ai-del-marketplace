# Terraform masterclasses: plan (AWS and Azure)

Phase 1 planning, 2026-11-27/28. **Owner 2026-11-28:** "use new Terraform version. we will also need Terragrunt and terraform course. I am okay with the
suggested price". **Approved by the owner (2026-11-28):** the titles, 95 videos per course, $49.99 → $69.99, Terragrunt as a separate
third course. **Still waiting for the owner:** production order, training domain (lesson 11.6). Nothing is sent to the video agent until the owner says OK.

Files: `CONTENT_INVENTORY.md` (deck and repo, slide by slide) · `TERRAFORM_AWS_CURRICULUM.md` ·
`TERRAFORM_AZURE_CURRICULUM.md` (same ids, same detail) · `TERRAGRUNT_CURRICULUM.md` (the third course, § 12) ·
`code/` (ready lab code) · requests **CR-129 … CR-281** (masterclasses) and **CR-282 … CR-299** (Terragrunt) in
`courses/CONTENT_REQUESTS.md`.

## 1. Vision (the owner's words)
- The master prompt: a **"Terraform on AWS Masterclass: From Beginner to Advanced"** built on the owner's PowerPoint
  and GitHub repository, "the foundation of the owner's teaching, to be used, not replaced".
- "**Include AI in the Terraform masterclasses, and both titles must contain AI**": AI is a real strand, not a sticker;
  "AI drafts, Terraform and humans verify; never auto-apply".
- "The **Azure Terraform masterclass must be a full mirror of the AWS one**, because some students work only with AWS
  and others only with Azure": same modules and order, one Azure counterpart for every AWS lesson, same projects and
  capstone, each course self-contained.

## 2. Titles (owner approved 2026-11-28)
| | AWS | Azure |
|---|---|---|
| **Approved** | **AI-Powered Terraform on AWS: From Beginner to Advanced** | **AI-Powered Terraform on Azure: From Beginner to Advanced** |
| Alternative | Terraform on AWS with AI: From Beginner to Advanced | Terraform on Azure with AI: From Beginner to Advanced |
| Alternative | AI-Powered Terraform Masterclass for AWS | AI-Powered Terraform Masterclass for Azure |

Why this pair (approved): it matches the catalogue's "AI-Powered DevOps Automation with n8n", reads as a series, says
the level range, is under 60 characters (54 / 56), and "AI-Powered" is honest: two AI modules (11 videos) plus AI
gates in CI and the capstone. Slugs: `terraform-aws`, `terraform-azure`. Category: new `infrastructure-as-code`
(Infrastructure as Code, icon `layers`), level beginner → advanced.

**Course page, AI part (only what is taught):** write Terraform with AI using professional prompts and prove it with
fmt, validate, tests, policy and a reviewed plan; let AI explain plans and errors, including when it is wrong; AI-written
tests and refactors; an AI agent that reads current provider docs through the Terraform MCP server; an AI review comment
on every pull request with a person approving; and Terraform for AI infrastructure: Bedrock Knowledge Bases on S3
Vectors, Guardrails and AgentCore (AWS) / Foundry, Azure AI Search, content filters and the Agent Service (Azure).

## 3. Structure
- **18 modules, 95 videos per course, ~17 h 32 min** (module table at the top of each curriculum).
- **Shared:** 37 cloud-neutral videos (5 h 20 min) are recorded once and used by both courses. Their demos use the
  local, random and terraform_data providers, so a student with only one cloud follows without an account.
- **Cloud-specific:** 58 lessons have an AWS video and an Azure video with their own lab (116 videos).
  **153 videos in total** for the two courses.
- **Origin (per course):** 48 [owner original] + 20 [owner original, updated] = 68 from the deck (72%);
  16 [new, proposed]; 11 [new, proposed: AI].
- Modules: 0 Welcome and safe set-up · 1 Why IaC · 2 Workstation · 3 Language and workflow · 4 References, data
  sources, naming · 5 Variables and outputs · 6 Console and functions · 7 Meta-arguments and lifecycle · 8 State ·
  9 Environments · 10 Modules · 11 Projects from the owner's deck · 12 Quality, testing, policy · 13 CI/CD and team
  workflows · **14 AI-Powered Terraform** · **15 Terraform for AI infrastructure** · 16 Kubernetes with Terraform ·
  17 Capstone.
- **Progressive projects:** first resource (3.7) → connected stack (4.1) → variables per environment (5.8) → loops
  (7.1) → remote state (8.2) → environments (9.x) → own network module (10.3) → the owner's seven module projects (11.x)
  → tested and policy-checked modules (12.x) → gated pipeline (13.1) → AI review in the pipeline (14.6) → AI platform
  as code (15.x) → **enterprise capstone** (17.x: dev and prod, remote state per environment, the owner's modules,
  terraform test, Checkov, GitHub Actions with OIDC, AI review comment, human approval, drift detection, full destroy).

## 3a. Versions (owner 2026-11-28: "use new Terraform version")
Terraform **1.17.x** (checked 1.17.2) · AWS provider **~> 6.0** (6.74.0) · azurerm **~> 5.0** (5.15.0) · Terragrunt **1.x**
(1.2.3) · S3 native locking `use_lockfile` (no DynamoDB) / Azure blob lease · **HCP Terraform** naming · **EKS access
entries** (no aws-auth ConfigMap). Every lesson, lab and request states them (a "Versions" line in each curriculum entry
and request). No lesson teaches 0.12/1.0 syntax; lesson 13.5 shows old code only as the starting point of an upgrade.
The 20 [owner original, updated] lessons are re-recorded on these versions. The owner's repo code is used from
re-pinned, validated lab copies in `code/owner-updated/` (fix for every failing folder: `CONTENT_INVENTORY.md` › Fixes).

## 4. The AI strand (where AI appears)
| Where | What | Lessons |
|---|---|---|
| Module 12 | Policy is the guardrail for any code, including AI's | 12.3 |
| Module 13 | The pipeline that the AI reviewer joins later | 13.1 |
| **Module 14** | Rules; poor vs professional prompts (links prompt engineering CR-077–CR-082, not repeated); AI explains plans and errors and is caught being wrong; AI-written tests and moved-block refactors; Terraform MCP server (read-only); AI PR review comment; an AI module through the full gate | 14.1–14.7 |
| **Module 15** | AI platform foundations, a RAG stack, guardrails, agents, all as code | 15.1–15.4 |
| Capstone | AI review in the promotion pipeline | 17.3 |

Relation to existing requests: the AI masterclasses' **CR-097/CR-098** (prompt engineering projects "AI-assisted
AWS/Azure infrastructure with Terraform") stay short and point to module 14 as the full treatment; **CR-028/CR-038**
("ship an AI application to production") reuse the module 15/17 code; **CR-108** (S3 + CloudFront website hosting)
already uses Terraform and recommends this course.

## 5. Production order (proposal, not sent to the video agent)
The owner is considering: after the current in-flight batch, a **Terraform fundamentals block**, then **weekly
alternation** between AI masterclass priorities and Terraform modules. Within a Terraform week the module's shared
videos come first, then its AWS and Azure lessons **back to back**, so both courses grow together (never AWS first).

1. **Fundamentals block (13 shared videos, ~1 h 49 min, $0, no cloud account):** 1.1 CR-133 · 1.2 CR-134 ·
   1.3 CR-135 · 2.1 CR-136 · 2.2 CR-137 · 3.1 CR-140 · 3.2 CR-141 · 3.3 CR-142 · 3.4 CR-143 · 3.6 CR-146 ·
   5.1 CR-156 · 5.2 CR-157 · 5.3 CR-158. Almost entirely the owner's deck.
2. Then alternate weeks. Terraform weeks, in order:
   - T1: 0.2, 2.3, 3.5, 3.7 (AWS + Azure each) and module 4.
   - T2: rest of module 5 (5.4–5.8) and module 6.
   - T3: module 7.
   - T4: module 8 (state; uses the ready lab code).
   - T5: modules 9 and 10.
   - T6: module 11 (projects; 11.6 waits for the training domain).
   - T7: modules 12 and 13.
   - T8: module 14 (AI).
   - T9: module 15 (AI infrastructure).
   - T10: module 17 (capstone), then 0.1 (the intros are recorded last because they show the finished capstone;
     their position stays first).
   - T11: module 16 (EKS/AKS), the costliest: one cluster session per sitting, destroyed right after.
3. Each week ends with QA of what was delivered; each course can open for sale after T7 (modules 0–13, ~11 h) as
   "early access" with the remaining modules marked "coming", or wait for the full course (owner's choice).

Rough length: ~11 Terraform weeks + 10 AI weeks ≈ 5 months at one Terraform module group per fortnight. Faster if GEN
records more per week.

## 6. Budget (rule: `CONTENT_REQUESTS.md` › Training cloud budget, $100/month AWS + Azure)
**Estimate, log, destroy; no owner pause** (owner to the video agent, 2026-11-28): labs over ~$5 per run, EKS/AKS
clusters and new accounts don't wait for the owner's OK. The video agent estimates each run, logs it in its
`CLOUD_BUDGET.md`, and destroys and verifies right after recording; the $80/$100 monthly alarms in both clouds remain
the safety net.
- 37 shared videos: $0. Most cloud lessons: $0–$0.05 per run (free resources, minutes of t3.micro/B1s).
- Higher, still small: RDS/PostgreSQL projects (~$0.05), Jenkins (~$0.15), capstone sessions (~$0.50 each),
  RAG stacks (< $0.50), NAT gateways only for the demo minute, agents (15.4, estimated on the day).
- Costliest: module 16 (EKS ~$1–2 and AKS ~$0.50–1 per two-hour session): record each cluster session in one sitting,
  destroy right after. Kept as a design choice, not a budget gate: Aurora explained, not deployed; Azure AI Search
  Free tier (Basic is ~$75/month).
- Estimate for recording both courses: about **$15–25 on AWS and $10–20 on Azure** plus ~$5–10 for module 16, spread
  over the months. Every lab: `terraform destroy` and a tag search proving nothing is left.

## 7. Quality and completion criteria
A lesson is done when: video (1080p, captions, everyday example first, then live), PDF slides, lab ZIP (code passes
`terraform fmt -check` and `terraform validate`; tests pass where the lesson has them; README with cost and cleanup;
`.tfvars.example` only), 3–5 quiz questions, destroy verified and the run's cost logged; and it passes
`courses/QA_CHECKLIST.md` as a student. A course is done when every lesson is done, module and final assessments exist,
the course page meets `docs/COURSE_STANDARD.md` §3a, and the instructor, student and customer reviews pass.
Code rules: Terraform ≥ 1.11 (`required_version`), aws `~> 6.0` / azurerm `~> 5.0`, no secrets or keys in any file,
default tags (`Course`, `Lesson`, `ManagedBy`), no public buckets/accounts unless the lesson is about them.

**Ready now:** 17 lesson folders in `code/` (11 AWS or shared, including the AI prompt files and the MCP set-up; 6 Azure in `code/azure/`), 20 Terraform root configurations, all `fmt` and `validate` clean on Terraform 1.17.2 with
aws 6.74.0 / azurerm 5.15.0; both `terraform test` suites pass (3/3) and fail when a rule is broken; Checkov run on
the policy lab. Also ready: `code/owner-updated/` (24 of the owner's folders fixed for current versions, all validate) and
`code/terragrunt/` (§ 12). The video agent builds the rest from the curricula.

## 8. Price (owner approved 2026-11-28: "I am okay with the suggested price")
- **Terraform masterclasses (AWS and Azure): $49.99 at launch, $69.99 once complete and reviewed** (~10 good reviews).
  Early access after week T7, if the owner chooses it: $39.99.
- **Terragrunt courses** (§ 12, suggestion, not yet approved): $39.99 at launch, $49.99 once complete and reviewed.
- Later bundles, when the platform supports them: both Terraform masterclasses $79.99; Terraform + Terragrunt of the
  same cloud $79.99; Terraform + AI masterclass of the same cloud $129.99.

## 9. Catalogue fit
| Course | Recommends | Recommended by |
|---|---|---|
| AI-Powered Terraform on AWS | AI for DevOps on AWS (its AI apps run on this infrastructure), n8n automation, the Azure Terraform course (multi-cloud), VS Code (free) | AI for DevOps on AWS (infrastructure lessons, website module CR-108, CR-028, CR-097), Introduction to AI for DevOps (free), VS Code masterclass (CR-044 Terraform lesson) |
| AI-Powered Terraform on Azure | AI for DevOps on Azure, n8n automation, the AWS Terraform course, VS Code | AI for DevOps on Azure (CR-038, CR-098, CR-109), the free intro, VS Code |
Last lesson 17.5 is the "continue your learning journey" lesson; module 2.1 points to the free VS Code course.

## 10. Dependencies and blockers
- Owner: titles, price, production order, the training domain (11.6; same decision as CR-111/112).
- Lab accounts: an AWS training account and an Azure training subscription with budget alerts (rule above).
- GEN: draft message below, sent only after the owner's OK.

## 11. Message for the video agent (draft, not sent)
> Terraform masterclasses (AWS + Azure), requests CR-129 … CR-281 in `courses/CONTENT_REQUESTS.md`. Plan:
> `courses/terraform/TERRAFORM_MASTERCLASS_PLAN.md`; curricula `TERRAFORM_AWS_CURRICULUM.md` /
> `TERRAFORM_AZURE_CURRICULUM.md` (objectives, demo, code, cost, cleanup and quiz per video); ready lab code in
> `courses/terraform/code/` (AWS) and `code/azure/` (Azure). The owner's deck
> (`/home/tia/work/terraform-course/Terraform.pptx`) and repo (`devopstia/terraform-course-del`) are the
> **foundation of the owner's teaching: use them, do not replace them**; fix only what the curriculum marks outdated,
> and never reuse the repo's committed keys or passwords. Budget rule (`CONTENT_REQUESTS.md`): $100/month AWS +
> Azure: estimate each run, log it in CLOUD_BUDGET.md, destroy and verify right after recording (no owner pause; the
> $80/$100 alarms remain). Order: <the owner's approved
> order>. Shared videos once for both courses; AWS and Azure lessons of a module back to back.

## 12. Third course: AI-Powered Terragrunt (owner 2026-11-28: "we will also need Terragrunt and terraform course")
**Recommendation: two courses, AWS and Azure, like the masterclasses** (not one course with two tracks).
Reason: certificates are issued only when every lesson of a course is complete (`docs/CERTIFICATES.md`), so a single
course with an AWS and an Azure track would never certify an AWS-only or Azure-only student; two courses keep each
self-contained (the owner's mirror rule), and the 15 shared videos are recorded once and used by both, so the extra
cost is only the cloud lessons.

| | AI-Powered Terragrunt on AWS: Terraform at Scale | AI-Powered Terragrunt on Azure: Terraform at Scale |
|---|---|---|
| Size | 10 modules, 32 videos, ~5 h 27 min | same; 15 videos shared |
| Built from | deck slides 574–583 (+ 56–57, 620–622), `aws-terraform/terragrunt/live` | the same, mirrored on Azure (no Azure Terragrunt code in the repo) |
| Origin | 2 [owner original] + 6 [owner original, updated], 21 new, 3 AI | same |
| Requests | CR-282 … CR-299 at module level (shared, AWS and Azure per module; CR-299 assessments) | same |
| Code | `code/terragrunt/` (live trees for dev/staging/prod, stacks, CI, drift, AI prompts; validated) | same |
| Price (suggested) | $39.99 launch, $49.99 after reviews | same |

Modules: 0 Introduction (premium intro, coordinator's request) · 1 Terragrunt 1.x essentials · 2 Remote state
generation (`use_lockfile` / blob lease, `backend bootstrap`/`migrate`) · 3 Dependencies and orchestration (dependency
blocks, mocks, `run --all`, `--filter-affected`, hooks, errors) · 4 Environments and the multi-account /
multi-subscription layout (the owner's dev/staging/production tree, a role or subscription per environment, promotion
by tag) · 5 Catalogs and stacks (`scaffold`, `catalog`, `terragrunt.stack.hcl`, moving a live tree to stacks) ·
6 CI/CD with OIDC (affected-units plans, per-environment approvals, Jenkins) · 7 Drift and day-2 operations · 8 AI for
Terragrunt (AI-generated units checked by `hcl validate`/`render`/plan, AI PR review with the DAG's blast radius,
`terragrunt mcp` read-only plus the Terraform MCP registry toolset) · 9 Capstone (three environments as stacks, the
full pipeline, drift, destroy).

**Learning path:** after the Terraform masterclass of the same cloud (prerequisite: modules 8–10 and 13). Related
courses: it recommends the AI for DevOps masterclass of the same cloud, the other cloud's Terragrunt course and n8n
automation; it is recommended by the Terraform masterclass (last lesson 17.5, and lesson 9.4 "Terragrunt" as a preview)
and by nothing earlier. **Production:** after the Terraform masterclass's module 13 is recorded (week T7 or later), the
shared Terragrunt videos first, then each module's AWS and Azure videos back to back.

