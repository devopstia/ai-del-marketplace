# Content requests: Course Upload Agent ⇄ Course Generation Agent

The single register of every request for new or corrected course content (owner 2026-11-27). Both agents read it
before they start and update it as they work; nothing agreed in a chat counts until it is here. Older background notes:
`courses/GENERATION_FEEDBACK.md` (history, read-only).

**Agents:** UPLOAD = Course Upload and Publishing Agent (session `ai-del-marketplace`, repo
`/home/tia/work/ai-del-marketplace`); GEN = Course Generation Agent (session `ai-videos`, writes to the Dropbox videos
root `C:\Users\tiaje\Dropbox\AI-VIDEOS\ai-devops\videos` = `/mnt/c/Users/tiaje/Dropbox/AI-VIDEOS/ai-devops/videos`).

**Lifecycle** (the Status column): `requested` → `in-progress` → `generated` → `ready-for-review` → `validated` →
`uploaded` → `verified` → `completed` (or `declined`, with the reason).
- UPLOAD opens a request (`requested`), sends GEN a short message pointing at its id, and later moves it from
  `ready-for-review` through `completed`.
- GEN moves it to `in-progress`, `generated` (files written) and `ready-for-review` (files complete in Dropbox, no
  `*.part` left), fills **Delivered at**, and sends UPLOAD a message with the id.
- Either side adds a dated line under the request's **Log** for anything that changes (scope, dates, problems).
- Ids never change or get reused. **Only UPLOAD edits this file** (2026-11-27: the owner told GEN "do not do anything on
  marketplace, just handle videos"). GEN reports every change as a message (id, status, delivered at, a log line) and
  UPLOAD records it here the same day; GEN keeps a mirror in its repo
  (`projects/ai-devops/docs/courses/n8n-devops-automation.md` › "Content requests").

**Priority:** P1 = blocks selling or misleads students; P2 = makes the course clearly better; P3 = nice to have.

## How to write a request (template, owner 2026-11-27)
Every new request has a row in the register and a details block with all of these (a short request gets a weak video):
```
### CR-0xx <recommended title>
- Course / module / position: <course> · <module> · after <lesson> (why there)
- Why: the gap, and how it improves the learner's experience
- Learning objectives: 3–5, verbs, checkable
- Concepts to explain: …
- Tools and technologies to demonstrate: …
- Live demonstration: what is built on screen, start to finish
- Real-world use case: the situation a DevOps team recognises
- Slides: PDF next to the PPTX, what they must show
- Lab ZIP / source code: files, README (hardware, cost, cleanup), .env.example only
- Quiz: 4 spoken multiple-choice questions ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")
- Quality bar: 1080p, captions, everyday example first, then live; length guide
- Deliver to: <folder in the videos root>; manifest entry with position
- Priority, owner (GEN), status, log
```
Missing slides, labs, quizzes, assessments or documentation use the same template (only the relevant lines).

**Status 2026-11-27 night:** GEN paused (weekly usage limit) until **Dec 1, 1 pm America/Chicago**. CR-005 and CR-007–010 are
built but not QA'd: treat their folders as not ready. No AWS resources left running. CR-006 needs the owner's GitHub token.
Each lesson arrives on its own after QA (lab included); ignore a folder until GEN's "ready-for-review" message.

**Training cloud budget (owner 2026-11-28): $100 per month, total across AWS and Azure.** Rules for every lab:
- Prefer local runs (Docker Compose, Minikube) with a cloud variant.
- Estimate the cost before each lab (written in its request and README).
- **Estimate, log, destroy; no owner pause** (owner to GEN, 2026-11-28): no waiting for the owner's OK for labs over ~$5 per run,
  EKS/AKS clusters or new accounts. GEN estimates each run, logs it in its `CLOUD_BUDGET.md`, and destroys and verifies
  right after recording; the $80/$100 monthly alarms in both clouds remain the safety net.
- GEN keeps a running monthly total in its notes and reports it with each delivery.
- Billing budget alarms in both accounts (AWS Budgets and an Azure cost alert at $80 and $100); GEN sets them if missing
  and asks the owner if that needs permissions it doesn't have.
- Terraform for everything; destroy right after recording and verify nothing is left.

**Proposed global order (2026-11-28, waiting for the owner's OK; not yet sent to GEN):** 1. finish the n8n batch
(CR-005, CR-008–CR-010; CR-006 after the token) → 2. course intros CR-014–CR-017 and CR-051 → 3. prompt engineering
basics + DevOps prompting (CR-077–CR-082, CR-096, CR-085–CR-088) → 4. LLMOps core (CR-056, CR-059/060, CR-061–CR-063) →
5. beginner website path (CR-105–CR-110, CR-113; CR-111/112 once the domain is decided) → 6. cloud-specific projects
(CR-023–CR-029, CR-034–CR-039, CR-071/072, CR-097/098, CR-116/117) → 7. the rest by priority (P1 before P2 before P3).


| Id | Course | Module / lesson | Request | Owner | Opened | Priority | Status | Delivered at | Upload |
|---|---|---|---|---|---|---|---|---|---|
| CR-001 | AI-Powered DevOps Automation with n8n | Module 1, first lesson | Course introduction / overview video | GEN | 2026-11-27 | P1 | completed (published 2026-11-28: first lesson, preview, promo) | `18-automation-n8n/00-n0-n8n-course-intro` (3:32, mp4, captions, PDF; 'four parts' scene re-recorded to the page's module names; GEN validate PASS) | in the n8n plan (first lesson, preview, intro, promo); sync after the pending n8n revision is decided |
| CR-002 | n8n | Module 1 · lesson 01 | Lab ZIP promised in the closing line | GEN | 2026-11-26 | P2 | ready-for-review | `01-n1-…/01-n1-n8n-mattermost-explained-lab.zip` | scanned 2026-11-27 (clean); upload on next sync |
| CR-003 | n8n | Lessons 01–03 | Quiz options read aloud so the 12 questions can be imported | GEN | 2026-11-26 | P2 | ready-for-review (01–03 delivered 2026-11-27, validate PASS) | same folders (re-recorded quiz scenes) | — |
| CR-004 | n8n; also in both masterclasses' 'Automate it with n8n' module | Module 3 (with notifications) | GitHub pull request notifications (signed webhooks) | GEN | 2026-11-27 | P1 | completed (published 2026-11-28 in the n8n course and both masterclasses) | `09-n7-n8n-github-pr-live` (16:03, lab) | in the n8n plan (module 2, after 06) and both masterclasses (n8n module); staging next, production after sign-in |
| CR-005 | n8n | Module 3 | AWS automation (CloudWatch, S3, SQS) — proposed by GEN | GEN | 2026-11-27 | P2 | on hold (GEN re-recording one scene, 2026-11-28) | `11-n11-n8n-aws-automation-live` (18:27, lab) | taken out of the plan until GEN sends ready-for-review again; then module 3 after Kubernetes alerts |
| CR-006 | n8n; also in both masterclasses' n8n module | Module 4 (AI) | AI pull request review assistant | GEN | 2026-11-27 | P1 | unblocked 2026-11-28 (owner gave a classic GitHub token; delete it on GitHub when CR-006 is recorded) | — | — |
| CR-007 | n8n; also in both masterclasses' n8n module | Module 4 (AI) | AI agents in n8n (AI Agent node, tools, guardrails, human approval) | GEN | 2026-11-27 | P1 | completed (published 2026-11-28: n8n module 4 after AI summaries; both masterclasses' n8n module) | `19-n19-n8n-ai-agent-live` | — |
| CR-008 | n8n | Module 4 (AI) | AI incident triage and root-cause suggestions | GEN | 2026-11-27 | P1 | validated (lab scanned clean 2026-11-28) | `20-n20-n8n-ai-incident-triage-live` (16:18, lab) | in the n8n plan (after AI summaries) and both masterclasses (n8n module); publish at the next production sign-in |
| CR-009 | n8n | Module 4 (AI) | AI in CI/CD (explain failed pipelines, suggest fixes; never auto-deploy) | GEN | 2026-11-27 | P1 | validated (lab scanned clean 2026-11-28) | `22-n22-n8n-ai-cicd-live` (17:05, lab) | in the n8n plan (after the AI ops agent) and both masterclasses (n8n module); publish at the next production sign-in |
| CR-010 | n8n | Module 3 or 4 | Intelligent alerting (grouping, noise reduction, rules first, AI second) | GEN | 2026-11-27 | P2 | validated (lab scanned clean 2026-11-28) | `21-n21-n8n-intelligent-alerting-live` (16:43, lab) | in the n8n plan (module 3 after incident management) and both masterclasses' n8n module; publish at next sign-in |
| CR-011 | n8n | Module 3 | Slack integration | GEN | 2026-11-27 | P2 | blocked: needs the owner's Slack webhook | — | — |
| CR-012 | n8n | End of each module | Module assessment (8–10 multiple-choice questions over the module, answers + explanations) | GEN | 2026-11-27 | P2 | requested | `18-automation-n8n/assessments/module-<n>.json` | — |
| CR-013 | n8n | Last lesson | Final course assessment (20 questions across the course) and a short conclusion video (recap, what to build next, certificate) | GEN | 2026-11-27 | P2 | requested | `assessments/final.json` + `99-conclusion…/` | — |
| CR-014 | Introduction to Artificial Intelligence for DevOps | Module 1, first lesson | Course introduction: AI for DevOps, where to start | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-015 | AI for DevOps on AWS | Module 1, first lesson | Course introduction: AI for DevOps on AWS | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-016 | AI for DevOps on Azure | Module 1, first lesson | Course introduction: AI for DevOps on Azure | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-017 | Visual Studio Code Masterclass for DevOps and AI | Module 1, first lesson | Course introduction: VS Code for DevOps and AI | GEN | 2026-11-27 | P1 | accepted, to be mapped onto the approved VS Code curriculum | — | — |
| CR-018 | AI for DevOps on AWS and on Azure (changed 2026-11-27: not in the free intro, which stays concise) | Module 2 'The vocabulary of AI models', after 'Prompts, tokens…' | Prompt engineering for DevOps (4 lessons) | GEN | 2026-11-27 | P1 | merged 2026-11-28 into the prompt engineering module (CR-077–CR-083; see details) | — | — |
| CR-019 | AI for DevOps on AWS and on Azure (optional, end of Module 1; changed 2026-11-27); VS Code reuses the CLI parts | Masterclass Module 1, last | AI tools tour: ChatGPT and Claude, Claude Code and Codex CLI, Ollama (3 lessons) | GEN | 2026-11-27 | P2 | merged 2026-11-28: chat assistants + Ollama → CR-084; Claude Code/Codex CLI → CR-089 (VS Code keeps CR-045) | — | — |
| CR-020 | Introduction to AI for DevOps | Module 3, last (before the next-step text lesson) | Final assessment (the next-step part is now a text lesson written by UPLOAD) | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-021 | AI for DevOps on AWS | Module 2, after 'Amazon Bedrock explained' | Amazon SageMaker AI for DevOps engineers | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-022 | AI for DevOps on AWS | Module 2 | Kiro (formerly Amazon Q Developer) for DevOps | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-023 | AI for DevOps on AWS | Module 3, after the Bedrock chatbot | Amazon Bedrock from code: SDK, Converse API and model comparison | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-024 | AI for DevOps on AWS | Module 4 | Build and deploy an AI-powered web app on AWS | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-025 | AI for DevOps on AWS | Module 6 | Build a DevOps agent with Amazon Bedrock AgentCore | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-026 | AI for DevOps on AWS (Azure variant in CR-036) | Module 7 | AI pull request review in GitHub Actions with Amazon Bedrock | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-027 | AI for DevOps on AWS | Module 8, after 'First MCP server' | MCP with AWS: connect agents to AWS services safely | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-028 | AI for DevOps on AWS | Module 9 (new) | Ship an AI application to production on AWS | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-029 | AI for DevOps on AWS | Module 10 | Bedrock Guardrails, monitoring and cost control | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-030 | AI for DevOps on AWS | Module 11 (new) | AWS capstones and final assessment | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-031 | All AI courses | existing lessons | Quizzes: spoken options and missing quizzes | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-032 | Intro, AWS, Azure | existing lessons | Labs promised but missing | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-033 | Azure | existing lessons | Rename 'Azure AI Foundry' to 'Microsoft Foundry' | GEN | 2026-11-27 | P3 | declined (owner 2026-11-27) | — | — |
| CR-034 | AI for DevOps on Azure | Module 3 | Azure OpenAI in Foundry Models from code: SDK and model comparison | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-035 | AI for DevOps on Azure | Module 6 | Build a DevOps agent with Foundry Agent Service | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-036 | AI for DevOps on Azure | Module 7 | AI pull request review with Foundry in GitHub Actions and Azure DevOps | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-037 | AI for DevOps on Azure | Module 8 | MCP with Azure: connect agents to Azure safely | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-038 | AI for DevOps on Azure | Module 9 (new) | Ship an AI application to production on Azure | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-039 | AI for DevOps on Azure | Module 10 | Content safety, identity and cost on Azure | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-040 | AI for DevOps on Azure | Module 2/5 | Azure Machine Learning and Document Intelligence for DevOps | GEN | 2026-11-27 | P3 | accepted | — | — |
| CR-041 | AI for DevOps on Azure | Module 11 (new) | Azure capstones and final assessment | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-042 | Visual Studio Code Masterclass | Module 2 | Productivity and essential shortcuts | GEN | 2026-11-27 | P2 | accepted, to be mapped onto the approved VS Code curriculum | — | — |
| CR-043 | Visual Studio Code Masterclass | Module 3 | Remote development: SSH to AWS and Azure VMs, Dev Containers | GEN | 2026-11-27 | P2 | accepted, to be mapped onto the approved VS Code curriculum | — | — |
| CR-044 | Visual Studio Code Masterclass | Module 4 | VS Code for DevOps tooling (3 lessons) | GEN | 2026-11-27 | P2 | accepted, to be mapped onto the approved VS Code curriculum | — | — |
| CR-045 | Visual Studio Code Masterclass | Module 5, after the .claude folder | AI coding agents in VS Code: Codex CLI, AGENTS.md and reviewing AI code | GEN | 2026-11-27 | P2 | accepted, to be mapped onto the approved VS Code curriculum | — | — |
| CR-046 | Visual Studio Code Masterclass | Module 6 | Real-world projects and final assessment | GEN | 2026-11-27 | P3 | accepted, to be mapped onto the approved VS Code curriculum | — | — |
| CR-047 | All four new courses | end of each module | Module assessments | GEN | 2026-11-27 | P2 | accepted | — | — |
| CR-048 | AI for DevOps on AWS | Module 7 'AI agents for DevOps', after CR-025 | Multi-agent collaboration with human approval on AWS | GEN | 2026-11-27 | P1 | requested | — | — |
| CR-049 | AI for DevOps on Azure | Module 7 'AI agents for DevOps', after CR-035 | Multi-agent collaboration with human approval on Azure | GEN | 2026-11-27 | P1 | requested | — | — |
| CR-050 | n8n module in both masterclasses (end) | — | Short video: "Take your n8n automation skills to the next level" (recommends the complete n8n course) | GEN | 2026-11-28 | P2 | accepted (after the n8n batch; CR-051 first) | `99-next-<course>/` in the course's source folder group | — |
| CR-051 | Introduction to AI for DevOps (last lesson) | — | Short video: "Your next step in AI-powered DevOps" (recommends the AWS and Azure masterclasses and the n8n course) | GEN | 2026-11-28 | P1 | validated (2026-11-28) | `23-intro-ai-devops/99-ai-next-step-recommendation` (1:39) | in the intro plan above the next-step text lesson; publishes with the intro restructure (owner's OK pending) |
| CR-052 | AWS masterclass (last module) | — | Short video: "Building your multi-cloud AI and DevOps skills" (AWS → Azure masterclass, n8n, VS Code) | GEN | 2026-11-28 | P2 | accepted (after the n8n batch; CR-051 first) | `99-next-<course>/` in the course's source folder group | — |
| CR-053 | Azure masterclass (last module) | — | Short video: "Building your multi-cloud AI and DevOps skills" (Azure → AWS masterclass, n8n, VS Code) | GEN | 2026-11-28 | P2 | accepted (after the n8n batch; CR-051 first) | `99-next-<course>/` in the course's source folder group | — |
| CR-054 | n8n course (last lesson) | — | Short video: "From automation to AI systems: continue with AWS or Azure" (recommends both masterclasses) | GEN | 2026-11-28 | P2 | accepted (after the n8n batch; CR-051 first) | `99-next-<course>/` in the course's source folder group | — |
| CR-055 | VS Code masterclass (last lesson) | — | Short video: "Continue your AI learning journey" (free AI intro, then the masterclasses) | GEN | 2026-11-28 | P3 | accepted (after the n8n batch; CR-051 first) | `99-next-<course>/` in the course's source folder group | — |
| CR-056 | LLMOps: M1 Introduction | — | DevOps, MLOps, LLMOps, AIOps and AgentOps: one story, five disciplines | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-057 | LLMOps: Free intro (teaser) | — | What LLMOps is, and why your next AI app needs it | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-058 | LLMOps: M1 Introduction | — | The LLM application lifecycle versus a traditional app lifecycle | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-059 | LLMOps: M2 / Project 1 | — | Project 1a: a simple LLM app with Ollama and Docker Compose | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-060 | LLMOps: M2 / Project 1 | — | Project 1b: from demo to production-ready | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-061 | LLMOps: M3 Prompt management | — | Version prompts like code: Git, environments and rollback | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-062 | LLMOps: M4 Evaluation | — | LLM evaluation explained: golden sets, LLM-as-judge and hallucination tests (promptfoo) | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-063 | LLMOps: M4 / Project 5 | — | Project 5: an evaluation gate in GitHub Actions that blocks a bad prompt | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-064 | LLMOps: M4 Evaluation | — | Evaluate a RAG app: retrieval and faithfulness with Ragas | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-065 | LLMOps: M5 Observability | — | LLM observability with Langfuse and OpenTelemetry: traces, tokens, latency and cost | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-066 | LLMOps: M5 (AWS) | — | Monitor Bedrock apps with CloudWatch: invocations, tokens, latency, alarms and cost | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-067 | LLMOps: M5 (Azure) | — | Monitor Foundry apps with Azure Monitor and Application Insights | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-068 | LLMOps: M6 Security | — | Secure an LLM application: secrets, least privilege, prompt injection, PII and audit logs | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-069 | LLMOps: M7 CI/CD | — | CI/CD for LLM apps: test, evaluate, build, deploy with approvals and rollback | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-070 | LLMOps: M8 Cost and reliability | — | Control LLM cost and keep it up: caching, rate limits, retries and fallbacks (LiteLLM) | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-071 | LLMOps: Project 2 (AWS) | — | Project 2: LLMOps with Amazon Bedrock, end to end | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-072 | LLMOps: Project 3 (Azure) | — | Project 3: LLMOps with Microsoft Foundry, end to end | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-073 | LLMOps: Project 4 (both) | — | Project 4: LLMOps on Kubernetes with Helm and Argo CD | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-074 | LLMOps: Project 6 (both) | — | Project 6: operate an enterprise RAG app with LLMOps | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-075 | LLMOps: M1–M8 wrap | — | LLMOps review and assessment | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-076 | LLMOps: M9 n8n | — | LLMOps automation with n8n: failure alerts, cost alerts, evaluation reports and health checks | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-077 | PE: M1 Introduction | — | What prompt engineering is: same AI, two people, two very different answers | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-078 | PE: M2 Anatomy | — | Anatomy of a professional prompt: role, context, constraints, deliverables and acceptance criteria | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-079 | PE: M3 Techniques (1) | — | Prompting techniques you'll use daily: zero-, one- and few-shot, role, context and instruction prompting | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-080 | PE: M3 Techniques (2) | — | Structured output and prompt templates: JSON schema answers your scripts can trust | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-081 | PE: M3 Techniques (3) | — | Break big tasks down: decomposition, iterative prompting, chaining and asking AI to clarify | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-082 | PE: M3 Techniques (4) | — | Reasoning you can check, and prompts with images and documents | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-083 | PE: M4 Advanced | — | Master prompts for complex work: requirements, constraints, checkpoints and reusable templates | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-084 | PE: M5 Platforms | — | One prompt, many models: ChatGPT, Claude, Bedrock, Foundry and Ollama compared | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-085 | PE: M6 DevOps (1) | — | Prompt AI for infrastructure code: Terraform, Dockerfiles, Compose, Kubernetes and Helm, validated | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-086 | PE: M6 DevOps (2) | — | Prompt AI for pipelines and scripts: GitHub Actions, Argo CD, Bash and Python | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-087 | PE: M6 DevOps (3) | — | Prompt AI to investigate: logs, Kubernetes failures, CI/CD failures and incident reports | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-088 | PE: M6 DevOps (4) | — | Prompt AI to review: pull requests, documentation, security and cost of your infrastructure | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-089 | PE: M7 AI coding agents | — | Work with AI coding agents professionally: study, plan, branch, change little, test, ask first | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-090 | PE: M7 Project 2 | — | Project 2: build a complete app from one master prompt | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-091 | PE: M8 Agents | — | Instructions for AI agents: system prompts, tools, memory, AGENTS.md, skills, handover and approvals | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-092 | PE: M8 Project 6 | — | Project 6: build a reusable DevOps AI agent | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-093 | PE: M9 RAG and LLMOps | — | Prompts for RAG: answer only from approved sources, cite them, and say when you don't know | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-094 | PE: M9 Project 7 | — | Project 7: compare prompt versions automatically and ship only the better one | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-095 | PE: M10 Security | — | Prompt security and reliability: hallucinations, injection, secrets and validating AI output | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-096 | PE: Project 1 | — | Project 1: from a vague prompt to a professional one, step by step | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-097 | PE: Project 3 (AWS) | — | Project 3: AI-assisted AWS infrastructure with Terraform, reviewed and destroyed | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-098 | PE: Project 4 (Azure) | — | Project 4: AI-assisted Azure infrastructure with Terraform, reviewed and destroyed | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-099 | PE: Project 5 | — | Project 5: troubleshoot Kubernetes with AI, without blindly running its commands | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-100 | PE: Project 8 (n8n) | — | Project 8: prompts that change how an n8n AI workflow behaves | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-101 | PE: Free intro teaser (1) | — | Same AI, better prompt: one question asked two ways | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-102 | PE: Free intro teaser (2) | — | Give AI the right context: fix a broken Dockerfile in one prompt | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-103 | PE: Toolkit | — | The Prompt Engineering Toolkit (downloadable ZIP) | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-104 | PE: Assessment | — | Prompt engineering review and assessment | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-105 | WEB: M1 | — | From idea to website: requirements, audience, features and stack with AI | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-106 | WEB: M2 | — | Website master prompts: "build me a website" versus a professional master prompt | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-107 | WEB: M3/M4 · Project 1 · Template T1 | — | Project 1: build a professional business website with AI (technology consulting company) | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-108 | WEB: M6 (AWS) | — | Host your AI-built website on Amazon S3 + CloudFront | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-109 | WEB: M7 (Azure) | — | Host your AI-built website on Azure Static Web Apps | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-110 | WEB: M8 | — | Domains, DNS and HTTPS explained: what happens when someone types your address | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-111 | WEB: M6/M8 (AWS) | — | Connect a custom domain with HTTPS on AWS: Route 53 + ACM + CloudFront | GEN | 2026-11-28 | P1 | blocked: owner's domain choice | see details | — |
| CR-112 | WEB: M7/M8 (Azure) | — | Connect a custom domain with HTTPS on Azure: Azure DNS + Static Web Apps managed certificate | GEN | 2026-11-28 | P1 | blocked: owner's domain choice | see details | — |
| CR-113 | WEB: Project 2 · Template T2 | — | Project 2: your DevOps portfolio website, built and kept up to date with AI | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-114 | WEB: M5 | — | Containerise an AI-built website: Dockerfile, Compose, env vars and a database | GEN | 2026-11-28 | P1 | requested | see details | — |
| CR-115 | WEB: Project 3 · Template T3 | — | Project 3: a service booking website with a backend, database and sign-in | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-116 | WEB: M6 (AWS) | — | Run a dynamic website on AWS: a small VM with nginx and Let's Encrypt, then ECS Express Mode | GEN | 2026-11-28 | P2 | requested (domain parts blocked: owner's domain choice) | see details | — |
| CR-117 | WEB: M7 (Azure) | — | Run a dynamic website on Azure: App Service and Container Apps | GEN | 2026-11-28 | P2 | requested (domain parts blocked: owner's domain choice) | see details | — |
| CR-118 | WEB: M9 | — | Ship website changes with AI and CI/CD: request, review, merge, deploy, roll back | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-119 | WEB: M8 | — | Website security essentials: secrets, firewall, sign-in, database and backups | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-120 | WEB: M9 · n8n | — | Automate your website with n8n: contact forms, inquiries and AI triage | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-121 | WEB: Project 6 · Template T10 | — | Project 6: an AI-powered business website with a document-aware support chatbot | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-122 | WEB: Project 4 · Template T7 | — | Project 4: an online store with cart, accounts, orders and Stripe test mode | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-123 | WEB: Project 5 · Template T9 | — | Project 5: a subscription SaaS app with plans, feature access and Stripe test mode | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-124 | WEB: Project 7 (capstone) · Template T8 | — | Project 7 capstone: a business directory and marketplace | GEN | 2026-11-28 | P3 | requested | see details | — |
| CR-125 | WEB: Enterprise | — | Websites at scale: Kubernetes, Helm and GitOps for an AI-built app | GEN | 2026-11-28 | P3 | requested | see details | — |
| CR-126 | WEB: Entrepreneurship | — | From idea to MVP: building digital products responsibly | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-127 | WEB: Templates | — | Template pack A: real estate (T4), restaurant (T5), professional services (T6) | GEN | 2026-11-28 | P2 | requested | see details | — |
| CR-128 | WEB: Assessment | — | Module assessment: build and ship websites with AI | GEN | 2026-11-28 | P3 | requested | see details | — |
| CR-129 | AI-Powered Terraform on AWS | M0 · 0.1 | Course introduction: what you will build and how to learn here [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-130 | AI-Powered Terraform on Azure | M0 · 0.1 | Course introduction: what you will build and how to learn here [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-131 | AI-Powered Terraform on AWS | M0 · 0.2 | Your training account, safely: budgets, MFA and the cleanup habit [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-132 | AI-Powered Terraform on Azure | M0 · 0.2 | Your training account, safely: budgets, MFA and the cleanup habit [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-133 | Terraform AWS + Azure (shared video) | M1 · 1.1 | From click-ops to code: how infrastructure used to be managed [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-134 | Terraform AWS + Azure (shared video) | M1 · 1.2 | What IaC is and why it pays off [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-135 | Terraform AWS + Azure (shared video) | M1 · 1.3 | IaC tools compared: Terraform, OpenTofu, CloudFormation, Bicep and Pulumi [owner original, updated] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-136 | Terraform AWS + Azure (shared video) | M2 · 2.1 | VS Code and the Terraform extensions [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-137 | Terraform AWS + Azure (shared video) | M2 · 2.2 | Install Terraform the right way: versions, tfenv and Docker [owner original, updated] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-138 | AI-Powered Terraform on AWS | M2 · 2.3 | Your cloud CLI and credentials [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-139 | AI-Powered Terraform on Azure | M2 · 2.3 | Your cloud CLI and credentials [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-140 | Terraform AWS + Azure (shared video) | M3 · 3.1 | HCL: blocks, arguments and resources [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-141 | Terraform AWS + Azure (shared video) | M3 · 3.2 | The core workflow: init, fmt, validate, plan, apply, destroy [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-142 | Terraform AWS + Azure (shared video) | M3 · 3.3 | Comments and code style [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-143 | Terraform AWS + Azure (shared video) | M3 · 3.4 | Terraform files and project layout [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-144 | AI-Powered Terraform on AWS | M3 · 3.5 | Providers and version constraints [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-145 | AI-Powered Terraform on Azure | M3 · 3.5 | Providers and version constraints [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-146 | Terraform AWS + Azure (shared video) | M3 · 3.6 | The dependency lock file [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-147 | AI-Powered Terraform on AWS | M3 · 3.7 | Your first resources on the cloud [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-148 | AI-Powered Terraform on Azure | M3 · 3.7 | Your first resources on the cloud [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-149 | AI-Powered Terraform on AWS | M4 · 4.1 | Resource references: connect resources together [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-150 | AI-Powered Terraform on Azure | M4 · 4.1 | Resource references: connect resources together [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-151 | AI-Powered Terraform on AWS | M4 · 4.2 | Data sources: read what already exists [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-152 | AI-Powered Terraform on Azure | M4 · 4.2 | Data sources: read what already exists [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-153 | Terraform AWS + Azure (shared video) | M4 · 4.3 | Interpolation and the format function [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-154 | AI-Powered Terraform on AWS | M4 · 4.4 | Tags: merge, default tags and a tagging standard [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-155 | AI-Powered Terraform on Azure | M4 · 4.4 | Tags: merge, default tags and a tagging standard [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-156 | Terraform AWS + Azure (shared video) | M5 · 5.1 | Input variables, types and .tfvars files [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-157 | Terraform AWS + Azure (shared video) | M5 · 5.2 | Locals: name an expression once [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-158 | Terraform AWS + Azure (shared video) | M5 · 5.3 | String, number and bool variables [owner original] | GEN | 2026-11-28 | P1 | requested (planning; order waits for the owner's OK) | — | — |
| CR-159 | Terraform AWS + Azure (shared video) | M5 · 5.4 | Collections: list, set and tuple [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-160 | Terraform AWS + Azure (shared video) | M5 · 5.5 | Structures: map, object, any and optional attributes [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-161 | Terraform AWS + Azure (shared video) | M5 · 5.6 | Outputs: share results [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-162 | Terraform AWS + Azure (shared video) | M5 · 5.7 | Variable validation and sensitive values [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-163 | AI-Powered Terraform on AWS | M5 · 5.8 | Variables in practice on the cloud [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-164 | AI-Powered Terraform on Azure | M5 · 5.8 | Variables in practice on the cloud [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-165 | Terraform AWS + Azure (shared video) | M6 · 6.1 | terraform console: test expressions safely [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-166 | Terraform AWS + Azure (shared video) | M6 · 6.2 | count, length and element [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-167 | Terraform AWS + Azure (shared video) | M6 · 6.3 | split and join [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-168 | Terraform AWS + Azure (shared video) | M6 · 6.4 | lookup and try: safe access to maps and objects [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-169 | Terraform AWS + Azure (shared video) | M6 · 6.5 | contains and conditional expressions [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-170 | Terraform AWS + Azure (shared video) | M6 · 6.6 | yamldecode: keep configuration in YAML [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-171 | Terraform AWS + Azure (shared video) | M6 · 6.7 | Splat expressions [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-172 | AI-Powered Terraform on AWS | M7 · 7.1 | Loops: count, for_each and dynamic blocks [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-173 | AI-Powered Terraform on Azure | M7 · 7.1 | Loops: count, for_each and dynamic blocks [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-174 | Terraform AWS + Azure (shared video) | M7 · 7.2 | depends_on: hidden dependencies [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-175 | AI-Powered Terraform on AWS | M7 · 7.3 | Lifecycle rules: create_before_destroy, prevent_destroy, ignore_changes [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-176 | AI-Powered Terraform on Azure | M7 · 7.3 | Lifecycle rules: create_before_destroy, prevent_destroy, ignore_changes [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-177 | AI-Powered Terraform on AWS | M7 · 7.4 | Preconditions, postconditions and check blocks [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-178 | AI-Powered Terraform on Azure | M7 · 7.4 | Preconditions, postconditions and check blocks [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-179 | AI-Powered Terraform on AWS | M7 · 7.5 | Provider aliases: several regions and subscriptions [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-180 | AI-Powered Terraform on Azure | M7 · 7.5 | Provider aliases: several regions and subscriptions [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-181 | AI-Powered Terraform on AWS | M7 · 7.6 | Bootstrap servers: user data and cloud-init [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-182 | AI-Powered Terraform on Azure | M7 · 7.6 | Bootstrap servers: user data and cloud-init [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-183 | AI-Powered Terraform on AWS | M7 · 7.7 | Provisioners and terraform_data: the last resort [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-184 | AI-Powered Terraform on Azure | M7 · 7.7 | Provisioners and terraform_data: the last resort [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-185 | Terraform AWS + Azure (shared video) | M8 · 8.1 | The state file: current vs desired state [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-186 | AI-Powered Terraform on AWS | M8 · 8.2 | Remote state with locking [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-187 | AI-Powered Terraform on Azure | M8 · 8.2 | Remote state with locking [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-188 | Terraform AWS + Azure (shared video) | M8 · 8.3 | Change and delete resources safely [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-189 | AI-Powered Terraform on AWS | M8 · 8.4 | Import existing resources [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-190 | AI-Powered Terraform on Azure | M8 · 8.4 | Import existing resources [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-191 | AI-Powered Terraform on AWS | M8 · 8.5 | Refactor without destroying: moved and removed blocks [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-192 | AI-Powered Terraform on Azure | M8 · 8.5 | Refactor without destroying: moved and removed blocks [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-193 | Terraform AWS + Azure (shared video) | M8 · 8.6 | State commands: list, show, mv, rm and pull [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-194 | AI-Powered Terraform on AWS | M8 · 8.7 | Read another stack's outputs: terraform_remote_state [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-195 | AI-Powered Terraform on Azure | M8 · 8.7 | Read another stack's outputs: terraform_remote_state [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-196 | AI-Powered Terraform on AWS | M8 · 8.8 | Keep secrets out of state: ephemeral values and write-only arguments [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-197 | AI-Powered Terraform on Azure | M8 · 8.8 | Keep secrets out of state: ephemeral values and write-only arguments [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-198 | Terraform AWS + Azure (shared video) | M9 · 9.1 | Workspaces [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-199 | AI-Powered Terraform on AWS | M9 · 9.2 | Several environments and accounts [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-200 | AI-Powered Terraform on Azure | M9 · 9.2 | Several environments and accounts [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-201 | Terraform AWS + Azure (shared video) | M9 · 9.3 | One folder per environment [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-202 | AI-Powered Terraform on AWS | M9 · 9.4 | Terragrunt: keep environments DRY [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-203 | AI-Powered Terraform on Azure | M9 · 9.4 | Terragrunt: keep environments DRY [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-204 | Terraform AWS + Azure (shared video) | M10 · 10.1 | What modules are and how to call them [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-205 | AI-Powered Terraform on AWS | M10 · 10.2 | Use registry modules [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-206 | AI-Powered Terraform on Azure | M10 · 10.2 | Use registry modules [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-207 | AI-Powered Terraform on AWS | M10 · 10.3 | Write your own network module [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-208 | AI-Powered Terraform on Azure | M10 · 10.3 | Write your own network module [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-209 | Terraform AWS + Azure (shared video) | M10 · 10.4 | Version, source and publish modules [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-210 | AI-Powered Terraform on AWS | M10 · 10.5 | Compose modules: network, compute and data [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-211 | AI-Powered Terraform on Azure | M10 · 10.5 | Compose modules: network, compute and data [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-212 | AI-Powered Terraform on AWS | M11 · 11.1 | Project: a production-style network [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-213 | AI-Powered Terraform on Azure | M11 · 11.1 | Project: a production-style network [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-214 | AI-Powered Terraform on AWS | M11 · 11.2 | Project: virtual machines and a secure jump host [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-215 | AI-Powered Terraform on Azure | M11 · 11.2 | Project: virtual machines and a secure jump host [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-216 | AI-Powered Terraform on AWS | M11 · 11.3 | Project: firewall rules and a container registry with loops [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-217 | AI-Powered Terraform on Azure | M11 · 11.3 | Project: firewall rules and a container registry with loops [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-218 | AI-Powered Terraform on AWS | M11 · 11.4 | Project: a database with secrets done right [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-219 | AI-Powered Terraform on Azure | M11 · 11.4 | Project: a database with secrets done right [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-220 | AI-Powered Terraform on AWS | M11 · 11.5 | Project: a state backend module with replication [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-221 | AI-Powered Terraform on Azure | M11 · 11.5 | Project: a state backend module with replication [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-222 | AI-Powered Terraform on AWS | M11 · 11.6 | Project: TLS certificates and DNS [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-223 | AI-Powered Terraform on Azure | M11 · 11.6 | Project: TLS certificates and DNS [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-224 | AI-Powered Terraform on AWS | M11 · 11.7 | Project: Jenkins on the cloud with an agent [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-225 | AI-Powered Terraform on Azure | M11 · 11.7 | Project: Jenkins on the cloud with an agent [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-226 | Terraform AWS + Azure (shared video) | M12 · 12.1 | fmt, validate and TFLint before every commit [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-227 | AI-Powered Terraform on AWS | M12 · 12.2 | Test modules with terraform test [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-228 | AI-Powered Terraform on Azure | M12 · 12.2 | Test modules with terraform test [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-229 | AI-Powered Terraform on AWS | M12 · 12.3 | Policy as code: Checkov, OPA and Sentinel [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-230 | AI-Powered Terraform on Azure | M12 · 12.3 | Policy as code: Checkov, OPA and Sentinel [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-231 | AI-Powered Terraform on AWS | M13 · 13.1 | GitHub Actions with OIDC: plan on pull request, apply on approval [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-232 | AI-Powered Terraform on Azure | M13 · 13.1 | GitHub Actions with OIDC: plan on pull request, apply on approval [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-233 | AI-Powered Terraform on AWS | M13 · 13.2 | HCP Terraform: remote runs, variable sets and dynamic credentials [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-234 | AI-Powered Terraform on Azure | M13 · 13.2 | HCP Terraform: remote runs, variable sets and dynamic credentials [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-235 | AI-Powered Terraform on AWS | M13 · 13.3 | Terraform with Jenkins and Terragrunt pipelines [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-236 | AI-Powered Terraform on Azure | M13 · 13.3 | Terraform with Jenkins and Terragrunt pipelines [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-237 | AI-Powered Terraform on AWS | M13 · 13.4 | Machine images with Packer [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-238 | AI-Powered Terraform on Azure | M13 · 13.4 | Machine images with Packer [owner original] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-239 | AI-Powered Terraform on AWS | M13 · 13.5 | Upgrade Terraform and providers safely [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-240 | AI-Powered Terraform on Azure | M13 · 13.5 | Upgrade Terraform and providers safely [owner original, updated] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-241 | Terraform AWS + Azure (shared video) | M13 · 13.6 | OpenTofu: what changes and how to try it [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-242 | Terraform AWS + Azure (shared video) | M14 · 14.1 | AI drafts, Terraform verifies: the rules of AI-assisted IaC [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-243 | AI-Powered Terraform on AWS | M14 · 14.2 | Prompt AI to write HCL: poor vs professional prompts [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-244 | AI-Powered Terraform on Azure | M14 · 14.2 | Prompt AI to write HCL: poor vs professional prompts [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-245 | AI-Powered Terraform on AWS | M14 · 14.3 | AI explains plans and errors (and when it is wrong) [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-246 | AI-Powered Terraform on Azure | M14 · 14.3 | AI explains plans and errors (and when it is wrong) [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-247 | AI-Powered Terraform on AWS | M14 · 14.4 | AI writes tests and refactors modules with moved blocks [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-248 | AI-Powered Terraform on Azure | M14 · 14.4 | AI writes tests and refactors modules with moved blocks [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-249 | Terraform AWS + Azure (shared video) | M14 · 14.5 | The Terraform MCP server: an agent that reads current docs [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-250 | AI-Powered Terraform on AWS | M14 · 14.6 | AI review of a pull request's plan in GitHub Actions [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-251 | AI-Powered Terraform on Azure | M14 · 14.6 | AI review of a pull request's plan in GitHub Actions [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-252 | AI-Powered Terraform on AWS | M14 · 14.7 | An AI-generated module through the full gate [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-253 | AI-Powered Terraform on Azure | M14 · 14.7 | An AI-generated module through the full gate [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-254 | AI-Powered Terraform on AWS | M15 · 15.1 | AI platform foundations as code: model access, identities and logging [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-255 | AI-Powered Terraform on Azure | M15 · 15.1 | AI platform foundations as code: model access, identities and logging [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-256 | AI-Powered Terraform on AWS | M15 · 15.2 | A RAG stack as code [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-257 | AI-Powered Terraform on Azure | M15 · 15.2 | A RAG stack as code [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-258 | AI-Powered Terraform on AWS | M15 · 15.3 | Guardrails as code [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-259 | AI-Powered Terraform on Azure | M15 · 15.3 | Guardrails as code [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-260 | AI-Powered Terraform on AWS | M15 · 15.4 | Agents as code [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-261 | AI-Powered Terraform on Azure | M15 · 15.4 | Agents as code [new, proposed: AI] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-262 | AI-Powered Terraform on AWS | M16 · 16.1 | A managed Kubernetes control plane module [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-263 | AI-Powered Terraform on Azure | M16 · 16.1 | A managed Kubernetes control plane module [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-264 | AI-Powered Terraform on AWS | M16 · 16.2 | Node groups: simple, blue-green and spot [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-265 | AI-Powered Terraform on Azure | M16 · 16.2 | Node groups: simple, blue-green and spot [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-266 | AI-Powered Terraform on AWS | M16 · 16.3 | Serverless and mixed capacity [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-267 | AI-Powered Terraform on Azure | M16 · 16.3 | Serverless and mixed capacity [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-268 | AI-Powered Terraform on AWS | M16 · 16.4 | Cluster access: identities and RBAC [owner original, updated] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-269 | AI-Powered Terraform on Azure | M16 · 16.4 | Cluster access: identities and RBAC [owner original, updated] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-270 | AI-Powered Terraform on AWS | M16 · 16.5 | Cluster add-ons with Terraform and Helm [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-271 | AI-Powered Terraform on Azure | M16 · 16.5 | Cluster add-ons with Terraform and Helm [owner original] | GEN | 2026-11-28 | P3 | requested (planning; order waits for the owner's OK) | — | — |
| CR-272 | AI-Powered Terraform on AWS | M17 · 17.1 | Capstone design: environments, state, modules and pipeline [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-273 | AI-Powered Terraform on Azure | M17 · 17.1 | Capstone design: environments, state, modules and pipeline [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-274 | AI-Powered Terraform on AWS | M17 · 17.2 | Build the modules and environments [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-275 | AI-Powered Terraform on Azure | M17 · 17.2 | Build the modules and environments [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-276 | AI-Powered Terraform on AWS | M17 · 17.3 | The pipeline: OIDC, tests, policy, AI review and approval [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-277 | AI-Powered Terraform on Azure | M17 · 17.3 | The pipeline: OIDC, tests, policy, AI review and approval [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-278 | AI-Powered Terraform on AWS | M17 · 17.4 | Operate it: drift, promotion and destroy [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-279 | AI-Powered Terraform on Azure | M17 · 17.4 | Operate it: drift, promotion and destroy [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-280 | AI-Powered Terraform on AWS | M17 · 17.5 | Course wrap-up, final assessment and what to learn next [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |
| CR-281 | AI-Powered Terraform on Azure | M17 · 17.5 | Course wrap-up, final assessment and what to learn next [new, proposed] | GEN | 2026-11-28 | P2 | requested (planning; order waits for the owner's OK) | — | — |

## Details

### CR-001 Course introduction / overview video
- **Why:** every course starts with an intro (standard §4); it is the first free preview and the course's promo video.
- **Deliverables:** folder `00-intro-ai-devops-automation-n8n/`, one MP4 (2–4 min), `captions/*.en.srt`, slides PDF; role
  `intro` in `course.manifest.json`. Content: what the course is and why it matters, who it's for, prerequisites, tools,
  the projects, the 4 modules, what you can do afterwards. Honest: only what the videos teach.
- **Placement:** first lesson of module 1, free preview, promo video.
- **Log:** 2026-11-27 GEN: started, ~3 min. 2026-11-27 GEN: script written, build queued. 2026-11-27 UPLOAD: folder seen
  (video 3:32, captions, PDF); review, place first in module 1 as a preview and promo video, staging then production.

### CR-002 Lab for lesson 01
- **Why:** the video ends with "Download the lab and practise".
- **Log:** 2026-11-27 GEN: delivered (n8n-mattermost lab, 32 files). UPLOAD: scanned, only the deliberate fake demo
  secrets (`Sup3rSecretDemo`, `not-a-real-key`); upload with the next production sync.

### CR-003 Quiz options read aloud (01–03)
- **Log:** 2026-11-27 GEN: quiz scenes of 01–03 re-recorded with spoken options ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …"); 03 true-peak fixed; 01 includes its lab (CR-002); validate PASS; delivered one lesson at a time. UPLOAD: an earlier copy of 01–03 already went into the pending production revision (12 quiz questions imported); the next n8n sync picks up any final changes by checksum.
- **Why:** options only on slide images can't be imported (never invented); 12 questions are missing today.
- **Deliverables:** re-recorded quiz scenes, same format as lessons 04–18 ("Question N of 4. … A: …; B: …; or C: …?" /
  "The answer is X: …"); the rest of each video unchanged. Updated captions.
- **Note for UPLOAD:** a changed MP4 replaces the lesson's video; the lesson id stays, so progress is kept.

### CR-004 … CR-011 New lessons
Outlines and labs: `courses/GENERATION_FEEDBACK.md` (2026-11-26 later entry). Each: one MP4, captions, slides PDF, lab
ZIP (README, `.env.example` only), 4 spoken multiple-choice questions, a `course.manifest.json` entry with `position`.
- **Log:** 2026-11-27 GEN: CR-004 and CR-005 in production; CR-006–CR-010 next (folders from 19); CR-011 waits for the
  owner's Slack webhook (kept only in GEN's git-ignored `.secrets/`, never on screen or in a lab).
  2026-11-27 GEN: CR-007 started (`19-n19-n8n-ai-agent-live`); CR-006, 008, 009, 010 start as slots free up; CR-003 01–03
  next in the re-record queue.

### CR-012 Module assessments
- **Why:** the owner wants assessments as a standard (lesson quizzes, module assessments, final assessment).
- **Deliverables:** `assessments/module-<n>.json` per module: `{ "module": "<title>", "questions": [{ "q", "options"
  (3–5), "correct" (0-based), "why" }] }`, 8–10 questions drawn only from that module's videos, each with an
  explanation. UPLOAD adds it as the module's last lesson ("Module <n> assessment").
- **Log:** 2026-11-27 GEN: accepted; written after each module's lessons are final, so they match what is taught.

### CR-013 Final assessment and conclusion
- **Deliverables:** `assessments/final.json` (20 questions, same format), and `99-conclusion-…/` (2–3 min: recap, what
  to build next, how to get the certificate). Placement: last module, after the last lesson.
- **Log:** 2026-11-27 GEN: accepted; the conclusion video comes last.

### 2026-11-27 GEN reply on CR-014–CR-047 (recorded by UPLOAD)
- All accepted; GEN mirrors them in its repo (`projects/ai-devops/docs/courses/content-requests-cr014-047.md`).
- GEN's order: finish the n8n batch first (CR-001 intro scene, CR-003 lesson 03, CR-004, CR-005, CR-007–CR-010; CR-006 waits
  for an owner-created GitHub token), then CR-014–017 → CR-018 → CR-023/034 → CR-025/035 → CR-026/036 → CR-024/028/038 →
  CR-029/039 → CR-031/032 → the rest. One Dropbox group and one `course.manifest.json` per new course group. Product names
  re-verified at recording. Throughput: one recording at a time, about 6–10 lessons a day.
- **CR-033 declined (owner 2026-11-27):** finished videos are not re-recorded. The lessons that say "Azure AI Foundry"
  (17-cloud-ai/11, 16-cloud-labs/03) get one line in their summary: "Microsoft has since renamed it Microsoft Foundry."
  New recordings use the current name.
- **CR-006 blocked:** the owner will create the GitHub token; it waits until then.
- **VS Code (owner 2026-11-27):** the owner-approved 32-lesson curriculum is the source of truth for the VS Code plan and
  catalog. The owner approved it on 2026-11-26 in GEN's repo
  (`/home/tia/work/ai-videos/projects/ai-devops/docs/courses/vscode-masterclass.md`, modules 0–12; lessons 0.1, 0.2 and 1.2
  are built). GEN maps CR-017 and CR-042–CR-046 onto those lessons instead of making parallel versions and will send the
  mapping. The marketplace plan follows that curriculum's module names (Start here, Install and set up, …).

## AI for DevOps catalogue requests (CR-014 onward, 2026-11-27)
From the owner's catalogue brief: four new courses (`courses/COURSE_CATALOG.md`). Inventory of what exists: `courses/INVENTORY.md`.
**Quality bar for every lesson below** (brief §13): 1080p, English captions, an everyday example first, then architecture diagram/animation, then live; VS Code on screen for code; browser verification; 4 spoken multiple-choice questions with answers explained; PDF next to the PPTX; lab ZIP with README (local Docker Compose and cloud VM options, VM size, cost, Terraform, .env.example with bring-your-own-key, troubleshooting, cleanup), no real secrets; 10-20 min.
**Recommended production order:** CR-014–CR-017 (intros) → CR-018 (prompt engineering, shared) → CR-023, CR-034 (SDK) →
CR-025, CR-035 (agents) → CR-026, CR-036 (PR review) → CR-024, CR-028, CR-038 (apps and production) → CR-029, CR-039
(security and cost) → CR-031, CR-032 (quiz and lab fixes) → CR-019, CR-021, CR-022, CR-027, CR-037, CR-042–CR-045 →
CR-020, CR-030, CR-041, CR-046, CR-047 (capstones and assessments) → CR-033, CR-040.
Service names checked 2026-11-27: Microsoft Foundry (formerly Azure AI Foundry), Foundry Agent Service, Azure OpenAI in
Foundry Models; Amazon Bedrock AgentCore (Bedrock Agents is now 'Agents Classic', closed to new customers since
2026-07-30), Bedrock Knowledge Bases and Guardrails unchanged; Kiro is the successor of Amazon Q Developer. Re-check
at recording time.

### CR-014 Course introduction: AI for DevOps, where to start
- Course / module / position: Introduction to Artificial Intelligence for DevOps · Module 1, first lesson
- Why: Every course starts with an intro (standard §4); it is the first free preview and the promo video.
- Learning objectives: Know what the course covers, who it is for, how it is organised and where the labs and quizzes are
- Concepts to explain: What AI changes for DevOps; the four modules; the free path into the AWS and Azure courses
- Tools and technologies: Course player, lesson files, quizzes, certificate
- Live demonstration: Short tour of the course page and player
- Slides: PDF next to the PPTX · Lab ZIP / source: none (role intro)
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: — · deliver to: `videos/23-intro-ai-devops/00-intro-ai-for-devops/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-015 Course introduction: AI for DevOps on AWS
- Course / module / position: AI for DevOps on AWS · Module 1, first lesson
- Why: Intro and free preview for the premium AWS course.
- Learning objectives: Know the projects (Bedrock chatbot, RAG, agents, MCP, production deployment), prerequisites and the cost-safety rules
- Concepts to explain: The 11 modules, the AWS account and budget alarm, how labs are destroyed
- Tools and technologies: AWS console, Terraform, Docker
- Live demonstration: Montage of the finished projects running in the browser
- Slides: PDF next to the PPTX · Lab ZIP / source: none (role intro)
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: — · deliver to: `videos/24-ai-devops-aws/00-intro-ai-for-devops-aws/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-016 Course introduction: AI for DevOps on Azure
- Course / module / position: AI for DevOps on Azure · Module 1, first lesson
- Why: Intro and free preview for the premium Azure course.
- Learning objectives: Know the projects (Foundry chat app, Azure RAG, agents, MCP, production deployment), prerequisites and cost rules
- Concepts to explain: The 11 modules, the Azure subscription and budget alert, resource-group cleanup
- Tools and technologies: Azure portal, Terraform, Docker
- Live demonstration: Montage of the finished projects running in the browser
- Slides: PDF next to the PPTX · Lab ZIP / source: none (role intro)
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: — · deliver to: `videos/25-ai-devops-azure/00-intro-ai-for-devops-azure/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-017 Course introduction: VS Code for DevOps and AI
- Course / module / position: Visual Studio Code Masterclass for DevOps and AI · Module 1, first lesson
- Why: Intro and free preview for the VS Code course.
- Learning objectives: Know what the course covers and how to follow it on the sample repository
- Concepts to explain: Modules: setup, productivity, remote, DevOps tooling, AI-assisted development, projects
- Tools and technologies: VS Code
- Live demonstration: Quick tour of the finished setup
- Slides: PDF next to the PPTX · Lab ZIP / source: none (role intro)
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: — · deliver to: `videos/22-vscode/00-vsc-00-intro/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-018 Prompt engineering for DevOps (4 lessons)
- Course / module / position: Introduction to AI for DevOps; reused in AWS and Azure Module 1 · Intro Module 4 (new 'Prompt engineering'); AWS/Azure Module 1 after 'Prompts, tokens…'
- Why: Brief §7 Module 4 and §5/§6 Module 1 require prompt engineering; no video covers it today.
- Learning objectives: Write prompts with system and user instructions, context and structured output; use zero-/few-shot and master prompts; reduce hallucinations; keep prompts safe
- Concepts to explain: System vs user instructions; context; JSON/structured output with validation; zero- and few-shot; master prompts; grounding; prompt injection basics
- Tools and technologies: A chat UI and an API call from Python (any provider, BYO key), VS Code
- Live demonstration: Turn a vague incident question into a reliable structured triage prompt, test it, break it with an injection, fix it
- Slides: PDF next to the PPTX · Lab ZIP / source: prompt-lab: Python script + prompts + a golden set of 10 questions
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: — · deliver to: `videos/23-intro-ai-devops/<NN>-prompt-engineering-*/ (4 folders)` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

- **Log:** 2026-11-28 UPLOAD: merged into the prompt engineering module (owner's Prompt Engineering brief): CR-077–CR-083 cover
  it in depth; no separate CR-018 video. GEN: please don't record CR-018 separately.

### CR-019 AI tools tour: ChatGPT and Claude, Claude Code and Codex CLI, Ollama (3 lessons)
- Course / module / position: Introduction to AI for DevOps; VS Code Module 5 reuses the CLI parts · Intro Module 5 'Practical AI tools'
- Why: Brief §7 Module 5; students need a hands-on start with today's tools before the cloud courses.
- Learning objectives: Use a chat assistant well; run Claude Code and Codex CLI on a repo with limits; run a local model with Ollama
- Concepts to explain: Assistants vs coding agents vs local models; data privacy; costs; permissions
- Tools and technologies: ChatGPT, Claude, Claude Code, Codex CLI, Ollama, Docker
- Live demonstration: Same task done with each tool; Ollama answering offline
- Slides: PDF next to the PPTX · Lab ZIP / source: ai-tools-lab: Docker Compose for Ollama + sample repo
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: CR-018 · deliver to: `videos/23-intro-ai-devops/<NN>-ai-tools-*/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

- **Log:** 2026-11-28 UPLOAD: merged: chat assistants and Ollama → CR-084, Claude Code and Codex CLI → CR-089 (VS Code keeps its
  own CR-045). GEN: no separate CR-019 videos.

### CR-020 Next steps and final assessment
- Course / module / position: Introduction to AI for DevOps · Module 7, last
- Why: Brief §7 Module 7: a real assessment and a path into the paid courses, without being only marketing.
- Learning objectives: Check understanding across the course and pick the next course
- Concepts to explain: Recap of modules; how the AWS, Azure and n8n courses continue
- Tools and technologies: —
- Live demonstration: Short practical demo recap
- Slides: PDF next to the PPTX · Lab ZIP / source: assessments/intro-final.json (20 questions)
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: CR-018, CR-019 · deliver to: `videos/23-intro-ai-devops/99-next-steps/ + assessments/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-021 Amazon SageMaker AI for DevOps engineers
- Course / module / position: AI for DevOps on AWS · Module 2, after 'Amazon Bedrock explained'
- Why: Module 2 lists SageMaker AI; only the services map mentions it.
- Learning objectives: Know when SageMaker AI is the right tool and what operating it means
- Concepts to explain: Studio, training jobs, endpoints, costs, when not to use it
- Tools and technologies: AWS console
- Live demonstration: Console walkthrough, deploy a tiny endpoint, delete it
- Slides: PDF next to the PPTX · Lab ZIP / source: sagemaker-lab: Terraform for a small endpoint + cleanup
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: — · deliver to: `videos/24-ai-devops-aws/<NN>-sagemaker-ai/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-022 Kiro (formerly Amazon Q Developer) for DevOps
- Course / module / position: AI for DevOps on AWS · Module 2
- Why: The brief lists Amazon Q Developer; AWS has moved it to Kiro (checked 2026-11-27). Teach the current product.
- Learning objectives: Use Kiro's IDE/CLI for infrastructure code with review and limits
- Concepts to explain: Spec-driven development, CLI, permissions, pricing
- Tools and technologies: Kiro IDE and CLI
- Live demonstration: Generate and review Terraform for an S3 + CloudFront site
- Slides: PDF next to the PPTX · Lab ZIP / source: kiro-lab: sample repo
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: — · deliver to: `videos/24-ai-devops-aws/<NN>-kiro/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-023 Amazon Bedrock from code: SDK, Converse API and model comparison
- Course / module / position: AI for DevOps on AWS · Module 3, after the Bedrock chatbot
- Why: Module 3 needs APIs/SDKs, inference parameters and cost comparison.
- Learning objectives: Call several Bedrock models from Python with the Converse API, tune parameters, compare quality, latency and cost
- Concepts to explain: Model access, IAM, Converse API, streaming, inference profiles, token pricing
- Tools and technologies: boto3, VS Code, Bedrock playground
- Live demonstration: Same prompt across 3 models with a cost table
- Slides: PDF next to the PPTX · Lab ZIP / source: bedrock-sdk-lab: Python + Terraform IAM role
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: — · deliver to: `videos/24-ai-devops-aws/<NN>-bedrock-sdk/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-024 Build and deploy an AI-powered web app on AWS
- Course / module / position: AI for DevOps on AWS · Module 4
- Why: Module 4: AI website, Python app, containerise, deploy locally and on AWS, verify in the browser.
- Learning objectives: Containerise an AI web app and deploy it to AWS with least privilege
- Concepts to explain: App architecture, container image, ECR, App Runner or ECS Fargate, IAM task role
- Tools and technologies: Docker, Terraform, AWS
- Live demonstration: Local Compose → ECR → ECS/App Runner, browser test, destroy
- Slides: PDF next to the PPTX · Lab ZIP / source: ai-webapp-aws-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-023 · deliver to: `videos/24-ai-devops-aws/<NN>-ai-webapp-aws/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-025 Build a DevOps agent with Amazon Bedrock AgentCore
- Course / module / position: AI for DevOps on AWS · Module 6
- Why: Bedrock Agents is now 'Agents Classic' and closed to new customers (AWS docs, checked 2026-11-27); AgentCore is the current way.
- Learning objectives: Build an agent with tools, memory and a human approval step on AgentCore
- Concepts to explain: AgentCore runtime, gateway/tools, memory, identity, observability; approvals
- Tools and technologies: AgentCore, Python, Terraform
- Live demonstration: An on-call agent that reads CloudWatch and proposes a fix you approve
- Slides: PDF next to the PPTX · Lab ZIP / source: agentcore-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-023 · deliver to: `videos/24-ai-devops-aws/<NN>-agentcore-agent/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-026 AI pull request review in GitHub Actions with Amazon Bedrock
- Course / module / position: AI for DevOps on AWS (Azure variant in CR-036) · Module 7
- Why: Module 7: AI-assisted PR reviews, GitHub Actions, notifications to Slack/Mattermost.
- Learning objectives: Add an AI review step to a pipeline that comments, never merges, and notifies the team
- Concepts to explain: OIDC from GitHub to AWS, diff limits, redaction, prompt injection in diffs, cost caps
- Tools and technologies: GitHub Actions, Bedrock, Mattermost/Slack webhook
- Live demonstration: Open a PR, get a labelled AI review comment and a chat notification
- Slides: PDF next to the PPTX · Lab ZIP / source: ai-pr-review-aws-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-023 · deliver to: `videos/24-ai-devops-aws/<NN>-ai-pr-review/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-027 MCP with AWS: connect agents to AWS services safely
- Course / module / position: AI for DevOps on AWS · Module 8, after 'First MCP server'
- Why: Module 8: MCP integrated with AWS services.
- Learning objectives: Run AWS MCP servers and limit what an agent can do in an account
- Concepts to explain: AWS MCP servers, scoped IAM, read-only first, audit
- Tools and technologies: Claude Code or Codex, AWS MCP servers
- Live demonstration: Agent answers 'what changed in this account today' read-only
- Slides: PDF next to the PPTX · Lab ZIP / source: mcp-aws-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: CR-025 · deliver to: `videos/24-ai-devops-aws/<NN>-mcp-aws/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-028 Ship an AI application to production on AWS
- Course / module / position: AI for DevOps on AWS · Module 9 (new)
- Why: Module 9 has no video yet: Terraform, containers, EKS/ECS, GitHub Actions, Argo CD, secrets.
- Learning objectives: Deploy the course's AI app with Terraform, CI/CD and GitOps, secrets in Secrets Manager
- Concepts to explain: Environments, Secrets Manager, OIDC, GitHub Actions, Argo CD on EKS (or ECS)
- Tools and technologies: Terraform, GitHub Actions, EKS, Argo CD
- Live demonstration: Push → pipeline → Argo CD sync → browser test → destroy
- Slides: PDF next to the PPTX · Lab ZIP / source: ai-app-prod-aws-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-024 · deliver to: `videos/24-ai-devops-aws/<NN>-production-deploy/ (2 lessons)` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-029 Bedrock Guardrails, monitoring and cost control
- Course / module / position: AI for DevOps on AWS · Module 10
- Why: Module 10: Guardrails, hallucination and injection defences, observability, cost.
- Learning objectives: Add Guardrails, log and monitor model calls, set cost alarms
- Concepts to explain: Guardrails (content, PII, grounding), CloudWatch metrics and logs, budgets, quotas
- Tools and technologies: Bedrock Guardrails, CloudWatch, AWS Budgets
- Live demonstration: Block a prompt injection and a PII leak, show the alarm
- Slides: PDF next to the PPTX · Lab ZIP / source: guardrails-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-023 · deliver to: `videos/24-ai-devops-aws/<NN>-guardrails-cost/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-030 AWS capstones and final assessment
- Course / module / position: AI for DevOps on AWS · Module 11 (new)
- Why: Module 11: real projects plus a final assessment.
- Learning objectives: Combine RAG, agents and automation in production-style projects
- Concepts to explain: Production RAG chatbot; DevOps assistant; PR review agent; notification system
- Tools and technologies: All of the above
- Live demonstration: Two capstone builds end to end
- Slides: PDF next to the PPTX · Lab ZIP / source: capstone labs + assessments/aws-final.json (25 questions)
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: CR-024–CR-029 · deliver to: `videos/24-ai-devops-aws/<NN>-capstone-*/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-031 Quizzes: spoken options and missing quizzes
- Course / module / position: All AI courses · existing lessons
- Why: Quiz questions read without options can't be imported (never invented). 12 lessons of 02-ai-foundations plus 05/20, 05/21, 07/20, 08/19-21, 16/06, 16/10 have open questions; 01-before-ai (4), 04-by-hand-vs-ai, 16/02, 16/03, 17/04 and 17/11 have none.
- Learning objectives: Every lesson ends with 3-5 checkable questions
- Concepts to explain: Same questions, options read aloud ('A: …; B: …; or C: …?' / 'The answer is X: …')
- Tools and technologies: —
- Live demonstration: Re-record only the quiz scenes
- Slides: PDF next to the PPTX · Lab ZIP / source: —
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: — · deliver to: `same folders (replace MP4 + captions)` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-032 Labs promised but missing
- Course / module / position: Intro, AWS, Azure · existing lessons
- Why: 19-ai-cicd/01 ends 'Download the lab, and map your own pipeline' and 20-mcp/02 ends 'Download the lab and practise: open the MCP Inspector', but neither folder has a lab.
- Learning objectives: Keep every promise a video makes
- Concepts to explain: Pipeline-mapping worksheet; MCP Inspector setup
- Tools and technologies: —
- Live demonstration: —
- Slides: PDF next to the PPTX · Lab ZIP / source: the two lab ZIPs
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: — · deliver to: `same folders` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-033 Rename 'Azure AI Foundry' to 'Microsoft Foundry'
- Course / module / position: Azure · existing lessons
- Why: 17-cloud-ai/11 and 16-cloud-labs/03 say 'Azure AI Foundry'; Microsoft renamed it Microsoft Foundry (checked 2026-11-27). The page already uses the new name.
- Learning objectives: Current names on screen and in narration
- Concepts to explain: Name change only; portal screens if they changed
- Tools and technologies: —
- Live demonstration: Re-record the affected lines and slides
- Slides: PDF next to the PPTX · Lab ZIP / source: —
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P3 · depends on: — · deliver to: `same folders` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-034 Azure OpenAI in Foundry Models from code: SDK and model comparison
- Course / module / position: AI for DevOps on Azure · Module 3
- Why: Module 3: model endpoints, authentication, inference, comparing models.
- Learning objectives: Call Foundry models from Python with Entra ID, compare models on quality, latency and cost
- Concepts to explain: Deployments, endpoints, Entra ID vs keys, quotas (TPM), model retirements
- Tools and technologies: Azure SDK for Python, Foundry portal
- Live demonstration: Same prompt across 3 deployments with a cost table
- Slides: PDF next to the PPTX · Lab ZIP / source: foundry-sdk-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: — · deliver to: `videos/25-ai-devops-azure/<NN>-foundry-sdk/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-035 Build a DevOps agent with Foundry Agent Service
- Course / module / position: AI for DevOps on Azure · Module 6
- Why: Module 6 needs Azure's own agent capability.
- Learning objectives: Create an agent with tools, memory and an approval step in Foundry Agent Service
- Concepts to explain: Agents, tools (functions, AI Search, OpenAPI), threads/memory, approvals
- Tools and technologies: Foundry Agent Service, Python
- Live demonstration: An on-call agent reading Azure Monitor and proposing a fix you approve
- Slides: PDF next to the PPTX · Lab ZIP / source: foundry-agent-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-034 · deliver to: `videos/25-ai-devops-azure/<NN>-foundry-agent/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-036 AI pull request review with Foundry in GitHub Actions and Azure DevOps
- Course / module / position: AI for DevOps on Azure · Module 7
- Why: Module 7: PR reviews, GitHub Actions and Azure DevOps pipelines.
- Learning objectives: Add an AI review step that comments, never merges, and notifies the team
- Concepts to explain: Workload identity federation, diff limits, redaction, injection in diffs
- Tools and technologies: GitHub Actions, Azure Pipelines, Foundry, Teams/Slack/Mattermost
- Live demonstration: PR → AI review comment → chat notification
- Slides: PDF next to the PPTX · Lab ZIP / source: ai-pr-review-azure-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-034 · deliver to: `videos/25-ai-devops-azure/<NN>-ai-pr-review/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-037 MCP with Azure: connect agents to Azure safely
- Course / module / position: AI for DevOps on Azure · Module 8
- Why: Module 8: secure Azure integrations with MCP.
- Learning objectives: Run Azure MCP servers with scoped identities
- Concepts to explain: Azure MCP server, managed identity, read-only first
- Tools and technologies: Claude Code or Codex, Azure MCP server
- Live demonstration: Agent answers 'what changed in this subscription today' read-only
- Slides: PDF next to the PPTX · Lab ZIP / source: mcp-azure-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: CR-035 · deliver to: `videos/25-ai-devops-azure/<NN>-mcp-azure/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-038 Ship an AI application to production on Azure
- Course / module / position: AI for DevOps on Azure · Module 9 (new)
- Why: Module 9: Terraform, Container Apps, AKS, GitHub Actions/Azure DevOps, Argo CD, Key Vault.
- Learning objectives: Deploy the course's AI app with Terraform, CI/CD and GitOps, secrets in Key Vault
- Concepts to explain: Container Apps vs AKS, Key Vault, managed identity, pipelines, Argo CD
- Tools and technologies: Terraform, GitHub Actions or Azure Pipelines, AKS, Argo CD
- Live demonstration: Push → pipeline → sync → browser test → destroy
- Slides: PDF next to the PPTX · Lab ZIP / source: ai-app-prod-azure-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-034 · deliver to: `videos/25-ai-devops-azure/<NN>-production-deploy/ (2 lessons)` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-039 Content safety, identity and cost on Azure
- Course / module / position: AI for DevOps on Azure · Module 10
- Why: Module 10: Entra ID, RBAC, managed identities, Key Vault, content safety, monitoring, cost.
- Learning objectives: Secure and observe an AI app on Azure and keep its cost in check
- Concepts to explain: Azure AI Content Safety / Foundry guardrails, prompt shields, Entra ID, RBAC, Azure Monitor, budgets
- Tools and technologies: Foundry, Azure Monitor, Cost Management
- Live demonstration: Block an injection, trace a call, trigger a budget alert
- Slides: PDF next to the PPTX · Lab ZIP / source: azure-safety-cost-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P1 · depends on: CR-034 · deliver to: `videos/25-ai-devops-azure/<NN>-safety-cost/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-040 Azure Machine Learning and Document Intelligence for DevOps
- Course / module / position: AI for DevOps on Azure · Module 2/5
- Why: Module 2 lists Azure Machine Learning; capstone needs intelligent document processing.
- Learning objectives: Know when Azure ML fits; extract data from documents for RAG
- Concepts to explain: Azure ML workspace basics; Document Intelligence
- Tools and technologies: Azure portal, Python
- Live demonstration: Parse invoices into an index
- Slides: PDF next to the PPTX · Lab ZIP / source: doc-intel-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P3 · depends on: — · deliver to: `videos/25-ai-devops-azure/<NN>-azure-ml-docintel/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-041 Azure capstones and final assessment
- Course / module / position: AI for DevOps on Azure · Module 11 (new)
- Why: Module 11: real projects plus a final assessment.
- Learning objectives: Combine RAG, agents and automation in production-style projects
- Concepts to explain: Enterprise RAG chatbot; DevOps assistant; document processing; AI CI/CD
- Tools and technologies: All of the above
- Live demonstration: Two capstone builds end to end
- Slides: PDF next to the PPTX · Lab ZIP / source: capstone labs + assessments/azure-final.json (25 questions)
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: CR-034–CR-039 · deliver to: `videos/25-ai-devops-azure/<NN>-capstone-*/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-042 Productivity and essential shortcuts
- Course / module / position: Visual Studio Code Masterclass · Module 2
- Why: Module 2 has no video yet.
- Learning objectives: Work fast: Command Palette, multi-cursor, search and replace, navigation, terminal, snippets, formatting
- Concepts to explain: Keyboard-first editing
- Tools and technologies: VS Code
- Live demonstration: Refactor a Helm chart and a Terraform module at speed
- Slides: PDF next to the PPTX · Lab ZIP / source: sample repo
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: — · deliver to: `videos/22-vscode/<NN>-vsc-productivity/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-043 Remote development: SSH to AWS and Azure VMs, Dev Containers
- Course / module / position: Visual Studio Code Masterclass · Module 3
- Why: Module 3 has no video yet.
- Learning objectives: Develop on a remote Linux VM and in a Dev Container
- Concepts to explain: Remote SSH, keys, port forwarding, Dev Containers
- Tools and technologies: VS Code Remote, Terraform VM on AWS or Azure
- Live demonstration: Open a cloud VM in VS Code, then the same repo in a Dev Container, destroy the VM
- Slides: PDF next to the PPTX · Lab ZIP / source: remote-dev-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: — · deliver to: `videos/22-vscode/<NN>-vsc-remote/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-044 VS Code for DevOps tooling (3 lessons)
- Course / module / position: Visual Studio Code Masterclass · Module 4
- Why: Module 4 has no video yet.
- Learning objectives: Use VS Code for Git/GitHub, Docker/Compose, Kubernetes/Helm, YAML, Terraform, Python/Bash, GitHub Actions and debugging
- Concepts to explain: Extensions and workflows per tool
- Tools and technologies: VS Code + extensions
- Live demonstration: Full DevOps loop in one window
- Slides: PDF next to the PPTX · Lab ZIP / source: devops-tooling-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: — · deliver to: `videos/22-vscode/<NN>-vsc-devops-*/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-045 AI coding agents in VS Code: Codex CLI, AGENTS.md and reviewing AI code
- Course / module / position: Visual Studio Code Masterclass · Module 5, after the .claude folder
- Why: Module 5 lists Codex CLI, AGENTS.md and reviewing AI-generated code; only Claude Code's files are covered.
- Learning objectives: Use Codex CLI with AGENTS.md, review AI code critically, manage agent context
- Concepts to explain: AGENTS.md vs CLAUDE.md, review checklist, context and memory
- Tools and technologies: Codex CLI, Claude Code, VS Code
- Live demonstration: Same change by two agents, reviewed and corrected
- Slides: PDF next to the PPTX · Lab ZIP / source: ai-coding-lab
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: CR-019 · deliver to: `videos/21-claude-code/<NN>-codex-agents-md/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-046 Real-world projects and final assessment
- Course / module / position: Visual Studio Code Masterclass · Module 6
- Why: Module 6.
- Learning objectives: Build a containerised app and its infrastructure end to end in VS Code
- Concepts to explain: Projects
- Tools and technologies: VS Code, Docker, Terraform
- Live demonstration: Two short projects
- Slides: PDF next to the PPTX · Lab ZIP / source: project labs + assessments/vscode-final.json
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P3 · depends on: CR-042–CR-045 · deliver to: `videos/22-vscode/<NN>-vsc-projects/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### CR-047 Module assessments
- Course / module / position: All four new courses · end of each module
- Why: Standard §8a: 8-10 questions per module, drawn only from that module's videos.
- Learning objectives: Check each module
- Concepts to explain: —
- Tools and technologies: —
- Live demonstration: —
- Slides: PDF next to the PPTX · Lab ZIP / source: assessments/<course>/module-<n>.json
- Quiz: 4 spoken multiple-choice questions · Quality bar: as above
- Priority P2 · depends on: module content final · deliver to: `videos/<course folder>/assessments/` with a `course.manifest.json` entry
- **Log:** 2026-11-27 UPLOAD: requested. GEN: accepted (see the reply above).

### 2026-11-27 later: gateway restructure (UPLOAD, owner's request)
- The free **Introduction to AI for DevOps** is now 12 videos in 3 modules plus a text lesson "Your next step" (written by
  UPLOAD, links to both masterclasses). The two **masterclasses are self-contained**: each teaches every foundations
  video (before-ai, tm1–tm12, agents/RAG ideas, MCP basics) itself, then the cloud material, plus a module
  "Automate it with n8n" (n8n 06, 12, 17 now; CR-004, CR-007, CR-006 when delivered).
- Changed: CR-018 (prompt engineering) and CR-019 (AI tools tour) move to the masterclasses only; CR-020 is now only the
  intro's final assessment. New: CR-048, CR-049 (multi-agent). CR-033 closed (declined; a note in the lesson summaries).
- GEN delivery rule (2026-11-27): each lesson arrives on its own after QA, with its lab; no bulk deliveries.
- **CR-006 token** (from GEN): fine-grained GitHub token for the practice repo `demo-n8n-review-cd01` only, Contents read,
  Pull requests read and write, 7 days; the owner saves it in GEN's session (never in our files).
- **VS Code mapping** (GEN, onto the owner-approved curriculum): CR-017 → new `vsc-00-course-intro`; CR-042 → 2.1–2.4;
  CR-043 → 10.1–10.3 and 7.4; CR-044 → 7.1, 7.2, 8.1 (7.3 Helm available); CR-045 → 11.3 plus a Codex CLI / AGENTS.md
  lesson in `21-claude-code`; CR-046 → 12.1, 12.2 and the final assessment. Built: 0.1, 0.2, 1.2.

### CR-048 Multi-agent collaboration with human approval on AWS
- Course / module / position: AI for DevOps on AWS · Module 7 'AI agents for DevOps' · after CR-025 (the single AgentCore agent comes first)
- Why: Brief §5 Module 6 asks for multi-step workflows, multi-agent collaboration and human approval; today's agent lessons show one agent at a time.
- Learning objectives: Split an on-call task between a supervisor and specialist agents; pass context between them safely; require a human approval before any change; trace and debug a multi-agent run
- Concepts to explain: Supervisor/worker patterns, hand-offs, shared memory vs per-agent context, approval gates, loop and cost limits, tracing
- Tools and technologies to demonstrate: Amazon Bedrock AgentCore (multi-agent), Lambda tools, CloudWatch, Slack or Mattermost for the approval message
- Live demonstration: A supervisor agent receives a 5xx alarm, asks a log agent and a deploy-history agent, proposes a rollback, waits for an engineer's approval in chat, then applies it and verifies in the browser
- Real-world use case: Night-time incident triage where no single agent should both diagnose and change production
- Slides: PDF next to the PPTX (architecture diagram, hand-off sequence, approval gate)
- Lab ZIP / source code: Terraform for the tools and roles, agent definitions, a broken sample service, README with cost, `.env.example` only, `terraform destroy` cleanup
- Quiz: 4 spoken multiple-choice questions ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")
- Quality bar: 1080p, captions, everyday example first, then live; 15–20 minutes
- Deliver to: `videos/17-cloud-ai/<NN>-aws-multi-agent-live/`; manifest entry with position
- Priority P1 · depends on: CR-025 · owner GEN · status requested
- **Log:** 2026-11-27 UPLOAD: requested.

### CR-049 Multi-agent collaboration with human approval on Azure
- Course / module / position: AI for DevOps on Azure · Module 7 'AI agents for DevOps' · after CR-035
- Why: Brief §6 Module 6 (multi-agent collaboration, intelligent workflows, human approval); not covered on Azure yet.
- Learning objectives: Orchestrate connected agents in Foundry Agent Service; keep each agent's permissions minimal; require human approval before changes; trace a run
- Concepts to explain: Connected agents and orchestration, hand-offs, managed identities per agent, approval gates, limits and cost, tracing
- Tools and technologies to demonstrate: Foundry Agent Service, Azure Functions tools, Azure Monitor / Log Analytics, Teams or Mattermost for the approval
- Live demonstration: The same incident as CR-048, on Azure: supervisor plus log and deployment agents, a proposed fix approved by an engineer, applied and verified in the browser
- Real-world use case: Incident triage on Azure with separation of duties between agents and people
- Slides: PDF next to the PPTX
- Lab ZIP / source code: Terraform, agent definitions, a sample service, README with cost and cleanup, `.env.example` only
- Quiz: 4 spoken multiple-choice questions
- Quality bar: as CR-048
- Deliver to: `videos/17-cloud-ai/<NN>-azure-multi-agent-live/`; manifest entry with position
- Priority P1 · depends on: CR-035 · owner GEN · status requested
- **Log:** 2026-11-27 UPLOAD: requested.

### CR-050 … CR-055 Course recommendation videos (owner 2026-11-28, "Strategic Course Integration")
- **Why:** courses form a connected learning path; at natural end points (end of a course, end of the n8n module in the
  masterclasses) a short video introduces the related course. A text lesson with links is already live in each place
  (key `go-further-n8n` / `next-steps` / `continue-journey`); the video goes **above** it in the same position.
- **Deliverables per video:** 60–120 s, captions, a 1-slide PDF (no lab, no quiz); role `conclusion`; title as in the
  register. Content: what the recommended course is, its educational value, 2–3 concrete projects from it (only what
  that course really contains; see `courses/COURSE_CATALOG.md`), the technologies and skills, DEL branding and the
  course's cover style, and a calm invitation ("you'll find it on DevOps Easy Learning"). No prices, no discounts, no
  pressure, no claims about lessons not yet published. Never interrupt a technical demo: these are separate lessons.
- **Placement:** after the course's last lesson (CR-051–055) or the n8n module's last lesson (CR-050).

### CR-056 … CR-076 LLMOps (owner 2026-11-28, "LLMOps Curriculum Development")
Every lesson follows the 13-step progressive structure (docs/COURSE_STANDARD.md §8e) and ships a PDF, a lab ZIP (source,
diagrams, Terraform, Compose, Kubernetes/Helm where relevant, CI config, `.env.example`, README with prerequisites, VM
sizing, estimated cost, troubleshooting and cleanup) and 3–5 spoken quiz questions. Recommended order: concepts
(056, 058, 057) → Project 1 (059, 060) → prompts (061) → evaluation and Project 5 (062, 063, 064) → observability (065,
066, 067) → security (068) → CI/CD (069) → cost (070) → cloud projects (071, 072) → Kubernetes (073) → RAG ops (074) →
n8n (076) → assessment (075).

| CR | Title | Courses | Position | Priority | Est. cost per run | Depends on |
|---|---|---|---|---|---|---|
| CR-056 | DevOps, MLOps, LLMOps, AIOps and AgentOps: one story, five disciplines | AWS, Azure | LLMOps module, before "LLMOps day to day" | P1 | $0 (concept, animations) | — |
| CR-057 | What LLMOps is, and why your next AI app needs it | Intro | Intro, module 3, before "Your next step" | P1 | $0 (Docker Compose, a local model optional) | CR-056 (can share animations) |
| CR-058 | The LLM application lifecycle versus a traditional app lifecycle | AWS, Azure | LLMOps module | P2 | $0 | CR-056 |
| CR-059 | Project 1a: a simple LLM app with Ollama and Docker Compose | AWS, Azure | LLMOps module (projects start) | P1 | $0 locally (16 GB RAM); cloud VM variant t3.xlarge/D4s ≈ $0.17–0.20/h, < $1 per run | — |
| CR-060 | Project 1b: from demo to production-ready | AWS, Azure | after CR-059 | P1 | $0 locally | CR-059 |
| CR-061 | Version prompts like code: Git, environments and rollback | AWS, Azure | after CR-060 | P1 | $0 (tokens < $0.10) | CR-060 |
| CR-062 | LLM evaluation explained: golden sets, LLM-as-judge and hallucination tests (promptfoo) | AWS, Azure | after CR-061 | P1 | tokens < $0.50 per run | CR-061 |
| CR-063 | Project 5: an evaluation gate in GitHub Actions that blocks a bad prompt | AWS, Azure, (n8n link) | after CR-062 | P1 | GitHub Actions free tier; tokens < $1 per run | CR-062 |
| CR-064 | Evaluate a RAG app: retrieval and faithfulness with Ragas | AWS, Azure | after CR-063 (or in the RAG module) | P2 | tokens < $1 | CR-063; uses the RAG stack lab |
| CR-065 | LLM observability with Langfuse and OpenTelemetry: traces, tokens, latency and cost | AWS, Azure | after CR-064 | P1 | $0 (self-hosted Langfuse in Docker Compose) | CR-060 |
| CR-066 | Monitor Bedrock apps with CloudWatch: invocations, tokens, latency, alarms and cost | AWS | after CR-065 | P1 | < $1 per run (CloudWatch metrics/alarms, a few Bedrock calls) | CR-065 |
| CR-067 | Monitor Foundry apps with Azure Monitor and Application Insights | Azure | after CR-065 | P1 | < $1 per run | CR-065 |
| CR-068 | Secure an LLM application: secrets, least privilege, prompt injection, PII and audit logs | AWS, Azure | after the observability lessons | P1 | $0 locally | CR-060 |
| CR-069 | CI/CD for LLM apps: test, evaluate, build, deploy with approvals and rollback | AWS, Azure | after CR-068 | P1 | < $1 (GitHub Actions free tier, a small VM or Container Apps/App Runner for the deploy stage) | CR-063 |
| CR-070 | Control LLM cost and keep it up: caching, rate limits, retries and fallbacks (LiteLLM) | AWS, Azure | after CR-069 | P1 | $0 locally; tokens < $0.50 | CR-065 |
| CR-071 | Project 2: LLMOps with Amazon Bedrock, end to end | AWS | LLMOps module, projects | P1 | ≈ $1–3 per run (EC2 or App Runner, CloudWatch, Bedrock calls); cleanup with terraform destroy | CR-063, CR-066, CR-069 |
| CR-072 | Project 3: LLMOps with Microsoft Foundry, end to end | Azure | LLMOps module, projects | P1 | ≈ $1–3 per run (Container Apps, Key Vault, App Insights, Foundry calls); cleanup with terraform destroy | CR-063, CR-067, CR-069 |
| CR-073 | Project 4: LLMOps on Kubernetes with Helm and Argo CD | AWS, Azure | LLMOps module, projects | P2 | $0 on Minikube (main path). EKS/AKS variant ≈ $5–10 per run (control plane + nodes): **ask the owner before provisioning** | CR-069 |
| CR-074 | Project 6: operate an enterprise RAG app with LLMOps | AWS, Azure | LLMOps module, last project | P2 | $0 locally (reuses the RAG stack lab); cloud variant optional < $3 | CR-064, CR-065 |
| CR-075 | LLMOps review and assessment | AWS, Azure | end of the LLMOps module | P2 | $0 | the module's lessons |
| CR-076 | LLMOps automation with n8n: failure alerts, cost alerts, evaluation reports and health checks | n8n course; AWS and Azure (n8n module) | n8n course module 4; masterclass n8n module after the AI ops agent | P2 | $0 locally | CR-063, CR-065 |

What each one teaches and demonstrates:
- **CR-056 DevOps, MLOps, LLMOps, AIOps and AgentOps: one story, five disciplines:** What each discipline manages (code, models, LLM apps, operations data, agents), with one everyday example (a restaurant: recipes, a chef learning, a chef who talks, a manager watching, assistants acting) before the architectures; how they complement each other; why LLMOps is the DevOps engineer's job. Animated comparison table; no lab.
- **CR-057 What LLMOps is, and why your next AI app needs it:** 5–6 min. An AI app that worked on Friday gives worse answers on Monday: what changed (prompt, model, data, cost)? The 4 LLMOps pipelines in one picture; a 60-second demo of an eval run failing then passing. Ends by pointing to the masterclasses' LLMOps module (no prices).
- **CR-058 The LLM application lifecycle versus a traditional app lifecycle:** Side by side: build-test-deploy-monitor vs prompt-and-data-evaluate-deploy-observe-improve; what is new (non-deterministic output, prompts as code, data freshness, token cost, safety); the DevOps engineer's role; enterprise use cases.
- **CR-059 Project 1a: a simple LLM app with Ollama and Docker Compose:** A small FastAPI chatbot calling a local model through Ollama, then the same app pointed at Bedrock or Foundry by config only. Teaches endpoints, model choice, environment config. Lab: compose.yaml, app, .env.example, README with VM sizing and cleanup.
- **CR-060 Project 1b: from demo to production-ready:** Take Project 1a step by step to production shape: settings and secrets out of code, prompts as files in Git, unit tests and a first eval, health checks, structured logs, a container image, a deployment checklist. Shows the gap between building and operating an AI app.
- **CR-061 Version prompts like code: Git, environments and rollback:** Prompts in Git with semantic versions; dev/staging/prod prompt selection by config; comparing two prompt versions on the same questions; rolling back a bad prompt; where hosted prompt stores (Langfuse prompts, Bedrock Prompt Management, Foundry) fit and when Git is enough.
- **CR-062 LLM evaluation explained: golden sets, LLM-as-judge and hallucination tests (promptfoo):** Why unit tests are not enough; a golden set; deterministic checks (structured output, must-contain), model-graded checks, hallucination/groundedness checks; thresholds. Tool: promptfoo (open source, YAML, runs locally, native GitHub Action).
- **CR-063 Project 5: an evaluation gate in GitHub Actions that blocks a bad prompt:** The owner's scenario end to end: a developer edits a prompt → pull request → promptfoo eval in GitHub Actions → score below threshold → merge blocked, PR comment, Mattermost/Slack notification → corrected prompt passes → deploy. Lab: repo template, workflow YAML, golden set, notification webhook as a secret placeholder.
- **CR-064 Evaluate a RAG app: retrieval and faithfulness with Ragas:** Context precision/recall, faithfulness, answer relevancy on a small test set; wiring Ragas metrics into the same CI gate (via a script or DeepEval); what to do when retrieval, not the model, is the problem.
- **CR-065 LLM observability with Langfuse and OpenTelemetry: traces, tokens, latency and cost:** Instrument Project 1 with OpenTelemetry (GenAI attributes are still evolving: teach the idea, show what Langfuse maps); see each request's prompt, model, tokens, latency and cost; trace an agent's tool calls; a dashboard of p95 latency, error rate and cost per day; link to Prometheus/Grafana from the RAG stack lesson.
- **CR-066 Monitor Bedrock apps with CloudWatch: invocations, tokens, latency, alarms and cost:** Bedrock's CloudWatch metrics and model invocation logging, a dashboard and an alarm on errors and token spikes, a budget alert, and cleanup.
- **CR-067 Monitor Foundry apps with Azure Monitor and Application Insights:** Foundry tracing to Application Insights, the Foundry observability dashboard, an alert on errors and token spikes, a budget alert, and cleanup.
- **CR-068 Secure an LLM application: secrets, least privilege, prompt injection, PII and audit logs:** Threat model of an LLM app; secrets out of code (Kubernetes secrets, Secrets Manager/Key Vault shown briefly); prompt-injection demo (direct and indirect) and defences; PII redaction before the model; audit logs. Cloud-native guardrails are covered in CR-029 (Bedrock Guardrails) and CR-039 (Azure Content Safety and Prompt Shields).
- **CR-069 CI/CD for LLM apps: test, evaluate, build, deploy with approvals and rollback:** Extend a normal pipeline: unit tests → eval gate (CR-063) → Docker image → Terraform → deploy to staging → approval → production → rollback of image or prompt. Shows LLMOps extending DevOps, not replacing it.
- **CR-070 Control LLM cost and keep it up: caching, rate limits, retries and fallbacks (LiteLLM):** Token pricing and a cost-per-answer calculation; a LiteLLM proxy with caching, per-key budgets, rate limits, retries and a fallback model (cloud model → local Ollama); measuring the savings in the observability dashboard.
- **CR-071 Project 2: LLMOps with Amazon Bedrock, end to end:** Terraform: least-privilege IAM, the app, logging; Bedrock model; prompt evaluation in CI; CloudWatch tokens and cost; deliberate failures (throttling, access denied, bad prompt) and how to troubleshoot; cleanup and a check that nothing is left.
- **CR-072 Project 3: LLMOps with Microsoft Foundry, end to end:** Terraform: managed identity (no keys), Key Vault, Foundry deployment, the app on Container Apps, Application Insights; automated evaluation; cost monitoring; deliberate failures and troubleshooting; cleanup.
- **CR-073 Project 4: LLMOps on Kubernetes with Helm and Argo CD:** Containerised LLM app with a Helm chart, ConfigMaps, secrets, readiness/liveness probes, HPA, Prometheus/Grafana, GitHub Actions building the image, Argo CD syncing, a bad release and an automated rollback. Minikube first; the managed-cluster variant only if approved.
- **CR-074 Project 6: operate an enterprise RAG app with LLMOps:** Take the existing production-style RAG stack and operate it: ingestion and re-indexing, Ragas evaluation, retrieval accuracy monitoring, prompt versions, Langfuse traces, cost per answer, security and continuous deployment.
- **CR-075 LLMOps review and assessment:** A short recap video and `assessments/llmops.json` (12–15 questions with explanations) over the whole module.
- **CR-076 LLMOps automation with n8n: failure alerts, cost alerts, evaluation reports and health checks:** n8n workflows that post LLM app failures to Mattermost, token/cost alerts to Slack, a daily evaluation report from the CI results, and an AI app health check; reuses the n8n stack lab. In the masterclasses it points to the complete n8n course.

### CR-077 … CR-104 Prompt engineering (owner 2026-11-28, "Comprehensive Prompt Engineering Training")
Every lesson follows the 13 steps (docs/COURSE_STANDARD.md §8e) and the prompt rule (§8f): **a poor prompt and a
professional prompt, both executed live, results compared, real failures shown**, and every generated artefact
validated with real tools. Each ships a PDF, a lab ZIP (prompts as files, sample data or repo, validation scripts,
`.env.example`, README with prerequisites, cost and cleanup) and 3–5 spoken quiz questions. Techniques taught are the
ones the providers document for all current models (clear instructions and context, examples, structure, decomposition,
structured outputs, self-review); model-specific features are labelled as such. Budget: owner's $100/month for training
labs, local first; ask the owner before any run over ~$5 or any EKS/AKS. **Recommended order:** CR-077, CR-078, CR-096
(basics + Project 1) → CR-079–CR-082 → CR-085–CR-088 (DevOps prompting) → CR-089, CR-090 (coding agents + Project 2) →
CR-091, CR-092 (agents + Project 6) → CR-097, CR-098, CR-099 (cloud and Kubernetes projects) → CR-093, CR-094 (with the
LLMOps evaluation lessons) → CR-095 (security) → CR-083, CR-084 → CR-103 (toolkit) → CR-100 (n8n) → CR-101, CR-102
(free intro) → CR-104 (assessment).

| CR | Title | Courses | Position | Priority | Est. cost per run | Depends on |
|---|---|---|---|---|---|---|
| CR-077 | What prompt engineering is: same AI, two people, two very different answers | AWS, Azure | Prompt engineering module, after 'Prompts, tokens…' | P1 | tokens < $0.20 | — |
| CR-078 | Anatomy of a professional prompt: role, context, constraints, deliverables and acceptance criteria | AWS, Azure | after CR-077 | P1 | $0 (Minikube); tokens < $0.20 | CR-077 |
| CR-079 | Prompting techniques you'll use daily: zero-, one- and few-shot, role, context and instruction prompting | AWS, Azure | after CR-078 | P1 | tokens < $0.30 | CR-078 |
| CR-080 | Structured output and prompt templates: JSON schema answers your scripts can trust | AWS, Azure | after CR-079 | P1 | tokens < $0.30 | CR-079 |
| CR-081 | Break big tasks down: decomposition, iterative prompting, chaining and asking AI to clarify | AWS, Azure | after CR-080 | P1 | tokens < $0.50 | CR-080 |
| CR-082 | Reasoning you can check, and prompts with images and documents | AWS, Azure | after CR-081 | P2 | tokens < $0.50 | CR-081 |
| CR-083 | Master prompts for complex work: requirements, constraints, checkpoints and reusable templates | AWS, Azure | after CR-082 | P1 | tokens < $1 | CR-081 |
| CR-084 | One prompt, many models: ChatGPT, Claude, Bedrock, Foundry and Ollama compared | AWS, Azure (cloud part per course) | after CR-083 | P1 | tokens < $1; Ollama local $0 | CR-083 |
| CR-085 | Prompt AI for infrastructure code: Terraform, Dockerfiles, Compose, Kubernetes and Helm, validated | AWS, Azure | Prompt engineering module, DevOps section | P1 | $0 locally (terraform validate/plan only, Minikube); tokens < $1 | CR-078 |
| CR-086 | Prompt AI for pipelines and scripts: GitHub Actions, Argo CD, Bash and Python | AWS, Azure | after CR-085 | P1 | $0 (GitHub Actions free tier, Argo CD on Minikube); tokens < $1 | CR-085 |
| CR-087 | Prompt AI to investigate: logs, Kubernetes failures, CI/CD failures and incident reports | AWS, Azure | after CR-086 | P1 | $0 (Minikube); tokens < $1 | CR-085 |
| CR-088 | Prompt AI to review: pull requests, documentation, security and cost of your infrastructure | AWS, Azure | after CR-087 | P2 | tokens < $1 | CR-087 |
| CR-089 | Work with AI coding agents professionally: study, plan, branch, change little, test, ask first | AWS, Azure; VS Code reuses it | Prompt engineering module, after the Claude Code instruction-file lessons | P1 | $0 (local repo); agent subscription/tokens < $2 | CR-083 |
| CR-090 | Project 2: build a complete app from one master prompt | AWS, Azure | after CR-089 | P1 | $0 locally; tokens < $3 | CR-089 |
| CR-091 | Instructions for AI agents: system prompts, tools, memory, AGENTS.md, skills, handover and approvals | AWS, Azure | Prompt engineering module, agents section | P1 | tokens < $1 | CR-083 |
| CR-092 | Project 6: build a reusable DevOps AI agent | AWS, Azure | after CR-091 | P1 | $0 locally; tokens < $3 | CR-091 |
| CR-093 | Prompts for RAG: answer only from approved sources, cite them, and say when you don't know | AWS, Azure | Prompt engineering module, after CR-092 (links to the RAG and LLMOps modules) | P1 | tokens < $0.50 (reuses the RAG stack lab) | CR-080 |
| CR-094 | Project 7: compare prompt versions automatically and ship only the better one | AWS, Azure | after CR-093 | P1 | GitHub Actions free tier; tokens < $1 per run | CR-063 (LLMOps eval gate), CR-061 |
| CR-095 | Prompt security and reliability: hallucinations, injection, secrets and validating AI output | AWS, Azure | Prompt engineering module, last lesson before the projects | P1 | $0 locally | CR-068 (LLMOps security) |
| CR-096 | Project 1: from a vague prompt to a professional one, step by step | AWS, Azure | after CR-078 | P1 | tokens < $0.50 | CR-078 |
| CR-097 | Project 3: AI-assisted AWS infrastructure with Terraform, reviewed and destroyed | AWS | Prompt engineering module, projects | P1 | ≈ $0.50–1 per run (small VPC, EC2 t3.micro or App Runner, S3; under 1 h); terraform destroy + verification | CR-085 |
| CR-098 | Project 4: AI-assisted Azure infrastructure with Terraform, reviewed and destroyed | Azure | Prompt engineering module, projects | P1 | ≈ $0.50–1 per run (resource group, VNet, Container Apps or a B-series VM, Key Vault; under 1 h); terraform destroy + verification | CR-085 |
| CR-099 | Project 5: troubleshoot Kubernetes with AI, without blindly running its commands | AWS, Azure | Prompt engineering module, projects | P1 | $0 on Minikube (main path); EKS/AKS variant only with the owner's OK | CR-087 |
| CR-100 | Project 8: prompts that change how an n8n AI workflow behaves | n8n course; AWS and Azure (n8n module) | n8n course module 4; masterclass n8n module after the AI ops agent | P2 | $0 locally; tokens < $0.50 | CR-080 |
| CR-101 | Same AI, better prompt: one question asked two ways | Intro (free) | Intro module 3, before 'Your next step' | P1 | tokens < $0.10 | — |
| CR-102 | Give AI the right context: fix a broken Dockerfile in one prompt | Intro (free) | after CR-101 | P2 | $0 locally; tokens < $0.10 | CR-101 |
| CR-103 | The Prompt Engineering Toolkit (downloadable ZIP) | AWS, Azure, n8n | Attached as a lesson file to the first prompt engineering lesson of each masterclass (CR-077) and to the n8n prompting lesson (CR-100) | P1 | $0 | CR-078, CR-085, CR-091 |
| CR-104 | Prompt engineering review and assessment | AWS, Azure | end of the prompt engineering module | P2 | $0 | the module's lessons |

What each one teaches and demonstrates:
- **CR-077 What prompt engineering is: same AI, two people, two very different answers:** Two people ask the same model for the same thing: one vague prompt, one professional prompt; run both live and compare. How an LLM reads instructions (tokens, context window, what it cannot know), why it misunderstands or invents, and the limits no prompt removes. Poor vs professional prompt, executed live.
- **CR-078 Anatomy of a professional prompt: role, context, constraints, deliverables and acceptance criteria:** The 11 parts (role, objective, background, instructions, technical requirements, constraints, deliverables, output format, examples, acceptance criteria, validation). The owner's example: 'Create a Kubernetes deployment' vs a structured prompt (image, namespace, resources, probes, security context, environment); both outputs applied to Minikube and checked with kubeconform and kubectl.
- **CR-079 Prompting techniques you'll use daily: zero-, one- and few-shot, role, context and instruction prompting:** Each technique on one DevOps task (classify alerts, write a runbook step): when it helps, when it hurts, and how to tell from the output. Common mistakes and how to fix them.
- **CR-080 Structured output and prompt templates: JSON schema answers your scripts can trust:** Free text vs JSON mode vs schema-constrained output (provider structured outputs); validate with a JSON schema in Python; templates with variables; what still breaks (refusals, truncation) and how the code must handle it.
- **CR-081 Break big tasks down: decomposition, iterative prompting, chaining and asking AI to clarify:** Turn a large request into steps; iterate on a weak answer; chain prompts where each output feeds the next; tell the AI to ask clarifying questions first. Shown on writing and testing a small Bash/Python tool.
- **CR-082 Reasoning you can check, and prompts with images and documents:** Ask for verifiable intermediate results (assumptions, a plan, numbers you can check) rather than hidden reasoning; multimodal prompts: an architecture diagram screenshot, a PDF runbook, a log file. Flag model-specific features (extended thinking, file inputs) as such.
- **CR-083 Master prompts for complex work: requirements, constraints, checkpoints and reusable templates:** Write a master prompt for a real multi-step job: architecture and business constraints, reference documents, 'list missing requirements first', 'review and improve your own plan', implementation and validation checkpoints, 'do not change what works', reusable template. Managing large context; prompts for autonomous agents.
- **CR-084 One prompt, many models: ChatGPT, Claude, Bedrock, Foundry and Ollama compared:** Run the same professional prompt in ChatGPT, Claude, Amazon Bedrock (AWS course) or Microsoft Foundry (Azure course) and a local Ollama model; compare quality, format adherence, cost and latency; adjust the prompt per model without locking students to one provider. **Absorbs CR-019's chat-assistant and Ollama parts.**
- **CR-085 Prompt AI for infrastructure code: Terraform, Dockerfiles, Compose, Kubernetes and Helm, validated:** Poor vs professional prompt for each artefact; every output validated with real tools: terraform fmt/validate/plan, hadolint, docker build, docker compose config, kubeconform, helm lint, then deployed to Minikube. Show a wrong answer and how the prompt fixes it.
- **CR-086 Prompt AI for pipelines and scripts: GitHub Actions, Argo CD, Bash and Python:** Generate a GitHub Actions workflow, an Argo CD Application and two scripts from structured prompts; actionlint, shellcheck and a real run prove them; fix a failing step by giving the AI the right context.
- **CR-087 Prompt AI to investigate: logs, Kubernetes failures, CI/CD failures and incident reports:** What context to give (logs, events, manifests, versions) and what to keep out (secrets); ask for ranked hypotheses with evidence and a structured troubleshooting plan; write the incident report. Feeds Project 5 (CR-099).
- **CR-088 Prompt AI to review: pull requests, documentation, security and cost of your infrastructure:** Review a PR diff with a checklist prompt; generate docs from code; find security issues in Terraform/Kubernetes (cross-checked with checkov/tfsec); suggest cost optimisations and monitoring/alerting configs; every claim verified.
- **CR-089 Work with AI coding agents professionally: study, plan, branch, change little, test, ask first:** With Claude Code and Codex CLI on a real repository: make the agent study the repo and architecture, find the right files/services, write a plan, work on a feature branch, avoid unrelated changes, run tests, verify, document, and request approval before anything sensitive. **Absorbs CR-019's Claude Code/Codex CLI parts** (VS Code keeps its own CR-045 lesson).
- **CR-090 Project 2: build a complete app from one master prompt:** Master prompt → AI coding agent designs a small website, writes the code, Dockerfile, Compose, docs and tests, runs it locally, verifies it in the browser and fixes what fails; the instructor shows every step and every mistake.
- **CR-091 Instructions for AI agents: system prompts, tools, memory, AGENTS.md, skills, handover and approvals:** System vs user prompts for agents, roles and limits, tool descriptions that steer tool choice, memory and context management, AGENTS.md and CLAUDE.md, reusable skills (SKILL.md), handover files, multi-agent roles, human approval checkpoints, MCP tools and permissions; keep instructions improving. Builds on the three existing instruction-file lessons.
- **CR-092 Project 6: build a reusable DevOps AI agent:** Turn a general assistant into a DevOps agent with instruction files, skills and authorised tools: review code, analyse infrastructure, write docs, help troubleshoot, run allowed tests, keep project context, coordinate with a second agent, write an implementation report.
- **CR-093 Prompts for RAG: answer only from approved sources, cite them, and say when you don't know:** Retrieved documents as context, 'use only these sources', citations and evidence, handling missing information, structured RAG answers, fewer unsupported claims. Then hands off to LLMOps: prompt versions in Git (CR-061), evaluation (CR-062), the CI gate (CR-063) and token cost (CR-070) are reused, not repeated.
- **CR-094 Project 7: compare prompt versions automatically and ship only the better one:** Prompt-specific extension of the LLMOps gate: three versions of one prompt, a test dataset, expected formats, scores per version, a quality threshold, approval, rollback and a Slack/Mattermost message. Reuses CR-063's pipeline; only the prompt-comparison part is new.
- **CR-095 Prompt security and reliability: hallucinations, injection, secrets and validating AI output:** A good prompt raises the odds, it never guarantees correctness: hallucinations; direct and indirect prompt injection (live); keeping credentials and confidential data out of prompts; reviewing AI-generated code and infrastructure; human approval; stopping unauthorised agent actions; checking facts against trusted sources. Coordinated with CR-068 to avoid overlap.
- **CR-096 Project 1: from a vague prompt to a professional one, step by step:** A vague prompt gets an unusable answer; add context, requirements, constraints and acceptance criteria one at a time, run each version and show what changed and why.
- **CR-097 Project 3: AI-assisted AWS infrastructure with Terraform, reviewed and destroyed:** Requirements, architecture, security → Terraform from a structured prompt → human review → validate/plan → deploy approved training infrastructure → verify → troubleshoot an error with the AI → destroy and prove nothing is left.
- **CR-098 Project 4: AI-assisted Azure infrastructure with Terraform, reviewed and destroyed:** The same flow, with prompts adapted to Azure networking, managed identity, RBAC and Key Vault; show where an AWS-shaped prompt goes wrong on Azure.
- **CR-099 Project 5: troubleshoot Kubernetes with AI, without blindly running its commands:** A Minikube app with planted faults (bad image, missing ConfigMap, failing probe, resource limits); collect the right evidence, ask for root causes and a plan, review it, apply and validate the fix, document the resolution.
- **CR-100 Project 8: prompts that change how an n8n AI workflow behaves:** Same n8n workflow, different prompts: AI agent behaviour, PR review comments, incident summaries, notification quality, structured JSON for decisions, reliability. Ends by pointing to the complete n8n course (link, no price).
- **CR-101 Same AI, better prompt: one question asked two ways:** 4–6 min: a vague request and a professional prompt for the same DevOps task, run live; the three changes that made the difference; invitation to the masterclasses' prompt engineering module (no prices).
- **CR-102 Give AI the right context: fix a broken Dockerfile in one prompt:** 4–6 min: the AI guesses without the error message and versions; with the right context it fixes the build; docker build proves it.
- **CR-103 The Prompt Engineering Toolkit (downloadable ZIP):** Markdown templates: master prompt, DevOps, AWS, Azure, Kubernetes troubleshooting, Terraform, CI/CD, code review, documentation, AI agent instructions (AGENTS.md/CLAUDE.md/skill skeletons), RAG, LLM evaluation, n8n automation; prompt-improvement and security/validation checklists; poor-vs-improved examples; a README on adapting each template (never copy blindly). Delivered as `prompt-engineering-toolkit.zip` next to CR-077's video.
- **CR-104 Prompt engineering review and assessment:** Short recap video and `assessments/prompt-engineering.json` (12–15 questions with explanations).


### CR-105 … CR-128 AI website development and digital entrepreneurship (owner 2026-11-28)
Strand rules (docs/COURSE_STANDARD.md §8g): simplest first (beginner static site → intermediate dynamic → advanced AI
and payments → enterprise Kubernetes); the real process on screen (the prompt, the AI's answer, mistakes, fixes, the
browser); every site reviewed for security; honest entrepreneurship (skills and responsibilities, no income promises);
Stripe in **test mode only**; original or licensed assets only. Each lesson: video, captions, PDF, lab ZIP (source,
master prompt, Dockerfile/Compose where used, .env.example, README with costs, troubleshooting and cleanup), 3–5 quiz
questions. Budget: $100/month total; estimate, log, destroy (no owner pause; the $80/$100 alarms remain).
**Domains:** CR-111, CR-112 and the custom-domain parts of CR-116/117 are **blocked on the owner's choice**; recommended:
one training domain (~$12–15/yr) with one subdomain per project (`shop.<domain>`, `portfolio.<domain>` …).

#### CR-105 From idea to website: requirements, audience, features and stack with AI
- Courses: AWS+Azure (shared) · Level: Beginner · Priority: P1 · Status: requested
- Position: Module "Build and ship websites with AI", lesson 1 · Depends on: CR-078 (anatomy of a prompt)
- Cost per run: $0 (local) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Turn a business idea into a one-page requirements brief with AI (purpose, audience, pages, features, stack, acceptance criteria); a simple diagram of front end, back end, database and hosting. Template: the requirements brief.

#### CR-106 Website master prompts: "build me a website" versus a professional master prompt
- Courses: AWS+Azure (shared) · Level: Beginner · Priority: P1 · Status: requested
- Position: after CR-105 · Depends on: CR-078, CR-090
- Cost per run: $0 (local; model usage < $1) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Run both prompts live in an AI coding agent, compare the results in the browser, then improve the prompt step by step (brand, palette, sections, responsive, a11y, stack, acceptance criteria). Links CR-090 (the master-prompt app) rather than repeating it.

#### CR-107 Project 1: build a professional business website with AI (technology consulting company)
- Courses: AWS+Azure (shared) · Level: Beginner · Priority: P1 · Status: requested
- Position: after CR-106 · Depends on: CR-106
- Cost per run: $0 (local) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Static site (home, about, services, testimonials, contact form, footer, light/dark, mobile) built with Claude Code/Codex in VS Code; show the prompts, wrong first attempts, reference screenshots and refinements; run it locally and verify in the browser. Ships **Template T1 (technology consulting)** with its master prompt, customise-with-AI guide, Dockerfile (nginx), README, screenshots.

#### CR-108 Host your AI-built website on Amazon S3 + CloudFront
- Courses: AWS only · Level: Beginner · Priority: P1 · Status: requested
- Position: after CR-107; the existing S3 help-site lab is the warm-up before it · Depends on: CR-107
- Cost per run: ~$0 (S3 cents; CloudFront free plan or 1 TB free tier); delete at the end · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Private S3 bucket + CloudFront with Origin Access Control (no public bucket), Terraform and console views, cache invalidation on update, verify the CloudFront URL in the browser, `terraform destroy`.

#### CR-109 Host your AI-built website on Azure Static Web Apps
- Courses: Azure only · Level: Beginner · Priority: P1 · Status: requested
- Position: after CR-107 · Depends on: CR-107
- Cost per run: $0 (Free plan); delete at the end · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Static Web Apps Free plan from GitHub (built-in GitHub Actions), Terraform alternative, preview environments for pull requests, verify the azurestaticapps.net URL, delete.

#### CR-110 Domains, DNS and HTTPS explained: what happens when someone types your address
- Courses: AWS+Azure (shared) · Level: Beginner · Priority: P1 · Status: requested
- Position: before the custom-domain demos · Depends on: —
- Cost per run: $0 · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Domain registration, registrars vs DNS hosting, A/AAAA/CNAME/ALIAS records, TTL and propagation, TLS certificates, HTTP→HTTPS redirect, Let's Encrypt vs managed certificates, with everyday analogies and animations. Concept lesson, no domain needed.

#### CR-111 Connect a custom domain with HTTPS on AWS: Route 53 + ACM + CloudFront
- Courses: AWS only · Level: Beginner · Priority: P1 · Status: blocked: owner's domain choice
- Position: after CR-108 and CR-110 · Depends on: CR-108, CR-110, owner's domain
- Cost per run: ~$0.50/month hosted zone + the training domain (~$12–15/yr, owner) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Hosted zone, ACM certificate in us-east-1 with DNS validation, CloudFront alternate domain, ALIAS records, open `https://<project>.<training-domain>` in the browser, show the padlock and the HTTP redirect, clean up records and certificate.

#### CR-112 Connect a custom domain with HTTPS on Azure: Azure DNS + Static Web Apps managed certificate
- Courses: Azure only · Level: Beginner · Priority: P1 · Status: blocked: owner's domain choice
- Position: after CR-109 and CR-110 · Depends on: CR-109, CR-110, owner's domain
- Cost per run: ~$0.50/month DNS zone + the training domain (owner) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: CNAME/TXT validation, the free managed certificate, apex vs subdomain, verify HTTPS in the browser, clean up.

#### CR-113 Project 2: your DevOps portfolio website, built and kept up to date with AI
- Courses: AWS+Azure (shared) · Level: Beginner · Priority: P1 · Status: requested
- Position: after the custom-domain lessons · Depends on: CR-107, CR-108/CR-109
- Cost per run: $0 (local) + hosting as CR-108/109 · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Introduction, skills, certifications, projects (pulled from GitHub at build time), experience, downloadable CV, contact; deploy with the student's chosen static host; GitHub Actions deploy on push. Ships **Template T2 (portfolio)**.

#### CR-114 Containerise an AI-built website: Dockerfile, Compose, env vars and a database
- Courses: AWS+Azure (shared) · Level: Intermediate · Priority: P1 · Status: requested
- Position: start of the intermediate level · Depends on: CR-107
- Cost per run: $0 (local) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Ask AI for a Dockerfile and Compose file, review them (non-root, small image, health check), front end + API + Postgres, .env.example, common failures (ports, env, DB not ready) and fixes, verify in the browser.

#### CR-115 Project 3: a service booking website with a backend, database and sign-in
- Courses: AWS+Azure (shared) · Level: Intermediate · Priority: P2 · Status: requested
- Position: after CR-114 · Depends on: CR-114
- Cost per run: $0 (local) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Services, pricing, inquiries, appointment booking, admin view, email-free local notifications; customise the same template for a cleaning, landscaping or IT-support business with prompts. Ships **Template T3 (small business / booking)**.

#### CR-116 Run a dynamic website on AWS: a small VM with nginx and Let's Encrypt, then ECS Express Mode
- Courses: AWS only · Level: Intermediate · Priority: P2 · Status: requested (domain parts blocked: owner's domain choice)
- Position: after CR-115 · Depends on: CR-115, CR-111 for the domain part
- Cost per run: EC2 t4g.small/Lightsail ~$0.02/h for ~1 h; ECS Express Mode ~$0.10 per run; delete · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Terraform VM, security group (80/443 only, SSH from your IP), Docker Compose, nginx reverse proxy, certbot, then the same container on ECS Express Mode (App Runner closed to new customers on 2026-04-30). Compare effort and cost; destroy.

#### CR-117 Run a dynamic website on Azure: App Service and Container Apps
- Courses: Azure only · Level: Intermediate · Priority: P2 · Status: requested (domain parts blocked: owner's domain choice)
- Position: after CR-115 · Depends on: CR-115, CR-112 for the domain part
- Cost per run: App Service B1 ~ $0.02/h or Container Apps consumption (free grant); delete · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Deploy the booking site's container to App Service (custom container) and to Container Apps, app settings and secrets, managed certificate on a custom domain, Azure Database for PostgreSQL flexible (smallest tier, stopped after), compare; delete.

#### CR-118 Ship website changes with AI and CI/CD: request, review, merge, deploy, roll back
- Courses: AWS+Azure (shared; cloud-specific deploy step) · Level: Intermediate · Priority: P2 · Status: requested
- Position: after CR-116/CR-117 · Depends on: CR-114, CR-116/117
- Cost per run: $0 (GitHub Actions free minutes) + hosting already running · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Ask an AI agent for a change on a feature branch, review the diff, tests in GitHub Actions, image build, deploy to the student's host, automatic notification, roll back a bad change, back up and restore the database.

#### CR-119 Website security essentials: secrets, firewall, sign-in, database and backups
- Courses: AWS+Azure (shared) · Level: Intermediate · Priority: P2 · Status: requested
- Position: after CR-118 · Depends on: CR-114
- Cost per run: $0 · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Keys out of the repo, least-privilege DB user, firewall/security groups, HTTPS everywhere, password hashing and sessions basics, OWASP top issues in AI-generated code (with a review prompt), backups, dependency updates.

#### CR-120 Automate your website with n8n: contact forms, inquiries and AI triage
- Courses: AWS+Azure (shared); also the n8n course · Level: Intermediate · Priority: P2 · Status: requested
- Position: after CR-118 · Depends on: n8n course lessons 02–06
- Cost per run: $0 (local n8n) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Contact form → n8n webhook (signed) → Mattermost/Slack message + email draft, AI classifies the inquiry and drafts a reply a human sends. Ends with the link to the complete n8n course.

#### CR-121 Project 6: an AI-powered business website with a document-aware support chatbot
- Courses: AWS+Azure (Bedrock and Foundry variants) · Level: Advanced · Priority: P2 · Status: requested
- Position: after CR-119 · Depends on: RAG module, LLMOps CR-062/065
- Cost per run: ~$1–3 per run (model + vector store); delete · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Business site + FAQ + RAG chatbot over the company's documents, answers with sources and refuses outside them, monitoring (tokens, latency, cost) and a human handover to the contact workflow. Ships **Template T10 (AI-powered business)**.

#### CR-122 Project 4: an online store with cart, accounts, orders and Stripe test mode
- Courses: AWS+Azure (shared) · Level: Advanced · Priority: P2 · Status: requested
- Position: after CR-121 · Depends on: CR-114, CR-119
- Cost per run: $0 (local; Stripe test mode only) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Catalog, product pages, cart, checkout in **Stripe test mode only** (test cards, webhooks), customer accounts, order admin; the extra responsibilities of a store (payments, privacy, tax, refunds, security). Ships **Template T7 (e-commerce)**.

#### CR-123 Project 5: a subscription SaaS app with plans, feature access and Stripe test mode
- Courses: AWS+Azure (shared; cloud deploy variant) · Level: Advanced · Priority: P2 · Status: requested
- Position: after CR-122 · Depends on: CR-122
- Cost per run: $0 local; hosting as CR-116/117 · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Sign-up, sign-in, dashboard, plans and feature flags, admin dashboard, Stripe Billing in **test mode**, automated deployment. Ships **Template T9 (SaaS landing + app)**.

#### CR-124 Project 7 capstone: a business directory and marketplace
- Courses: AWS+Azure (shared; cloud deploy variant) · Level: Advanced · Priority: P3 · Status: requested
- Position: after CR-123 · Depends on: CR-121–CR-123
- Cost per run: ~$0–2 per run; delete · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Business sign-up, listings, categories, search and filters, profiles with image uploads (object storage), admin approval, user dashboards, responsive. Also ships **Template T8 (online learning)** as the second capstone variant.

#### CR-125 Websites at scale: Kubernetes, Helm and GitOps for an AI-built app
- Courses: AWS+Azure (Minikube first; EKS/AKS only with the owner's OK) · Level: Enterprise · Priority: P3 · Status: requested
- Position: last lesson of the module · Depends on: CR-118, LLMOps CR-073
- Cost per run: $0 on Minikube; EKS/AKS ~$5–10 per run (owner's OK first) · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Helm chart, Ingress with TLS, autoscaling, health checks, Argo CD sync and rollback; when Kubernetes is worth it and when it isn't.

#### CR-126 From idea to MVP: building digital products responsibly
- Courses: AWS+Azure (shared) · Level: All levels · Priority: P2 · Status: requested
- Position: after Project 2 · Depends on: CR-105
- Cost per run: $0 · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Find a problem worth solving, define an MVP, estimate hosting costs, maintenance and support, accessibility, privacy and basic legal duties, when to charge, building sites for small businesses. Skills and responsibilities only: **no income promises**.

#### CR-127 Template pack A: real estate (T4), restaurant (T5), professional services (T6)
- Courses: AWS+Azure (downloads) · Level: Beginner–Intermediate · Priority: P2 · Status: requested
- Position: attached to CR-107/CR-115 · Depends on: CR-107
- Cost per run: $0 · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: Three distinct visual identities (not recolours), original or licensed assets only; each with source, master prompt, customise-with-AI guide, Dockerfile/Compose, deploy steps, .env.example, README, screenshots, troubleshooting. One short lesson tours the pack.

#### CR-128 Module assessment: build and ship websites with AI
- Courses: AWS+Azure · Level: — · Priority: P3 · Status: requested
- Position: end of the module · Depends on: the module's lessons
- Cost per run: $0 · Cleanup: destroy everything created (Terraform destroy or listed manual steps) and verify nothing is left
- What: 10 questions with explanations (q/options/correct/why), drawn from the module's videos.

**Production order:** CR-105 → CR-106 → CR-107 → CR-108/CR-109 → CR-110 → (CR-111/CR-112 when the domain is decided) → CR-113 → CR-114 → CR-115 + CR-127 → CR-116/CR-117 → CR-118 → CR-119 → CR-120 → CR-126 → CR-121 → CR-122 → CR-123 → CR-124 → CR-125 → CR-128.

### CR-129 … CR-281 Terraform masterclasses: AI-Powered Terraform on AWS / on Azure (planned 2026-11-28)
Plan: `courses/terraform/TERRAFORM_MASTERCLASS_PLAN.md` · curricula (full detail and the quiz questions with answers):
`courses/terraform/TERRAFORM_AWS_CURRICULUM.md`, `TERRAFORM_AZURE_CURRICULUM.md` (same lesson ids) · deck and repo
inventory: `courses/terraform/CONTENT_INVENTORY.md` · ready lab code: `courses/terraform/code/` (AWS) and `code/azure/`.
**Foundation:** the owner's deck `/home/tia/work/terraform-course/Terraform.pptx` (624 slides) and repo
`devopstia/terraform-course-del` (`aws-terraform/`, `azure-terraform/`) are the foundation of the owner's teaching:
use them, do not replace them; fix only what is marked outdated; never reuse the repo's committed keys or passwords.
**Shared videos** (cloud-neutral, local/random/terraform_data providers) are one request used by both courses; every
cloud lesson has an AWS request and an Azure request, recorded back to back. Budget: the training cloud budget rule above
($100/month AWS + Azure: estimate, log, destroy; no owner pause; the $80/$100 alarms remain). **Status: planning. The production
order (fundamentals block CR-133–CR-137, CR-140–CR-143, CR-146, CR-156–CR-158 first, then weekly alternation with the AI masterclasses)
waits for the owner's OK; nothing sent to GEN yet.** CR-222/CR-223 (11.6) need the training domain.

#### CR-129 Course introduction: what you will build and how to learn here (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 0 Welcome and safe set-up · lesson 0.1, first in the module · [new, proposed]
- Learning objectives: Describe the path from first resource to the enterprise capstone; Explain how lessons, labs, quizzes and the AI strand fit together; Plan a study rhythm that includes destroying every lab
- Slides: owner's deck: slides 1–8 (table of contents) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The finished capstone pipeline first (a pull request, the plan, the AI review comment, a person approving, apply), then the module map and how labs and cleanup work. Shown on AWS (S3 state, GitHub OIDC, Bedrock).
- Lab ZIP / code: no lab (introduction video); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- Depends on: — · Length guide: ~5 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 0.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-130 Course introduction: what you will build and how to learn here (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 0 Welcome and safe set-up · lesson 0.1, first in the module · [new, proposed]
- Learning objectives: Describe the path from first resource to the enterprise capstone; Explain how lessons, labs, quizzes and the AI strand fit together; Plan a study rhythm that includes destroying every lab
- Slides: owner's deck: slides 1–8 (table of contents) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The finished capstone pipeline first (a pull request, the plan, the AI review comment, a person approving, apply), then the module map and how labs and cleanup work. Shown on Azure (Storage state, workload identity, Foundry).
- Lab ZIP / code: no lab (introduction video); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- Depends on: — · Length guide: ~5 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 0.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-131 Your training account, safely: budgets, MFA and the cleanup habit (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 0 Welcome and safe set-up · lesson 0.2, after 0.1 · [new, proposed]
- Learning objectives: Turn on MFA and avoid long-lived admin keys; Create a budget alert below the training budget; Find and delete leftover resources
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: AWS: root MFA, IAM Identity Center user, AWS Budgets alert at $20 (student) and the Cost Explorer view; a Resource Groups tag search on Course=terraform-aws-masterclass.
- Lab ZIP / code: checklist PDF and the CLI commands for budgets and tag searches (no Terraform); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: AWS Budgets, IAM Identity Center · Cost per run: $0 · Cleanup: keep the budget alert (free); nothing else is created
- Depends on: 0.1 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 0.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-132 Your training account, safely: budgets, MFA and the cleanup habit (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 0 Welcome and safe set-up · lesson 0.2, after 0.1 · [new, proposed]
- Learning objectives: Turn on MFA and avoid long-lived admin keys; Create a budget alert below the training budget; Find and delete leftover resources
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Azure: MFA on the account, a dedicated subscription or resource-group convention, a Cost Management budget alert at $20, and an Azure Resource Graph query on the Course tag.
- Lab ZIP / code: checklist PDF and the CLI commands for budgets and tag searches (no Terraform); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Cost Management budget, Resource Graph · Cost per run: $0 · Cleanup: keep the budget alert (free); nothing else is created
- Depends on: 0.1 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 0.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-133 From click-ops to code: how infrastructure used to be managed (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 1 Why Infrastructure as Code · lesson 1.1, after 0.2 · [owner original] · one video for both courses
- Learning objectives: Describe the manual way of building servers and networks; Name three problems it causes (drift, slowness, no history); Explain what changes when infrastructure is code
- Slides: owner's deck: slides 15–22 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The owner's diagrams (slides 17–22): ticket, manual console clicks, configuration drift, then the same environment rebuilt from code in minutes.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/from-click-ops-to-code-how-infrastructure-used-t/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 0.2 · Length guide: ~8 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 1.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-134 What IaC is and why it pays off (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 1 Why Infrastructure as Code · lesson 1.2, after 1.1 · [owner original] · one video for both courses
- Learning objectives: Define Infrastructure as Code; Explain disaster recovery, consistency and visibility benefits; Connect IaC to code review and version control
- Slides: owner's deck: slides 23–27 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Slides 24–27 with one example per benefit: rebuild after a deleted network, two identical environments, the code as documentation.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/what-iac-is-and-why-it-pays-off/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 1.1 · Length guide: ~7 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 1.2 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-135 IaC tools compared: Terraform, OpenTofu, CloudFormation, Bicep and Pulumi (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 1 Why Infrastructure as Code · lesson 1.3, after 1.2 · [owner original, updated] · one video for both courses
- Learning objectives: Compare declarative multi-cloud tools with cloud-native ones; Explain Terraform's BSL licence and the OpenTofu fork in one minute; Choose a tool for a given team
- Slides: owner's deck: slides 28–32 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The owner's Terraform vs CloudFormation slide (32) extended with Bicep (Azure), Pulumi and OpenTofu; a decision table.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/iac-tools-compared-terraform-opentofu-cloudforma/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 1.2 · Length guide: ~10 min · Priority: P1 · Owner: GEN · Status: requested
- Notes: Outdated: deck calls Terraform "open-source" (slide 29). Since Aug 2023 it is BSL 1.1 (source-available); OpenTofu (Linux Foundation, MPL) is the open-source fork (v1.13.10, 2026-11-23).
- Quiz: 3 spoken questions with answers in both curricula › 1.3 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-136 VS Code and the Terraform extensions (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 2 Set up your workstation · lesson 2.1, after 1.3 · [owner original] · one video for both courses
- Learning objectives: Install the HashiCorp Terraform extension; Turn on format-on-save; Use completion and hover docs
- Slides: owner's deck: slides 33–36 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/youtube/vs-code-plugins`
- Live demonstration: Slide 36's plugin list reduced to the official HashiCorp Terraform extension (others are optional); format on save; hover docs. Links the free VS Code masterclass.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/vs-code-and-the-terraform-extensions/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 1.3 · Length guide: ~7 min · Priority: P1 · Owner: GEN · Status: requested
- Notes: Improve: slide 36 lists several overlapping plugins; recommend the official one plus format-on-save.
- Quiz: 3 spoken questions with answers in both curricula › 2.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-137 Install Terraform the right way: versions, tfenv and Docker (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 2 Set up your workstation · lesson 2.2, after 2.1 · [owner original, updated] · one video for both courses
- Learning objectives: Install a pinned Terraform version on Windows, macOS or Linux; Switch versions with tfenv; Run Terraform in Docker
- Slides: owner's deck: slides 43–57 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-installation, Dockerfile in slide 49/54`
- Live demonstration: The owner's three platforms (slides 45–53) and Docker (54–55) with today's version; tfenv to switch; the official HashiCorp package repositories as an option.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/install-terraform-the-right-way-versions-tfenv-a/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 2.1 · Length guide: ~12 min · Priority: P1 · Owner: GEN · Status: requested
- Notes: Outdated: slides 46–51 download 0.12/0.13 and slide 49 pins 1.0.0; current is 1.17.2 (2026-11-27). Terragrunt install (56–57) moves to lesson 9.4.
- Quiz: 3 spoken questions with answers in both curricula › 2.2 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-138 Your cloud CLI and credentials (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 2 Set up your workstation · lesson 2.3, after 2.2 · [owner original, updated]
- Learning objectives: Install the cloud CLI; Sign in without long-lived admin keys; Check which identity Terraform will use
- Slides: owner's deck: slides 37–42 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/aws-cli-installation`, `aws-terraform/youtube/manage-credentials`
- Live demonstration: AWS CLI v2 install (slides 39–41), then `aws configure sso` and `aws sso login`, `aws sts get-caller-identity`; why slide 42's admin user with access keys is replaced.
- Lab ZIP / code: GEN builds `courses/terraform/code/your-cloud-cli-and-credentials/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: IAM Identity Center · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 0.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Improve: slide 42 creates an IAM admin user and downloads access keys; use IAM Identity Center (or short-lived role credentials) instead.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 2.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-139 Your cloud CLI and credentials (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 2 Set up your workstation · lesson 2.3, after 2.2 · [owner original, updated]
- Learning objectives: Install the cloud CLI; Sign in without long-lived admin keys; Check which identity Terraform will use
- Slides: owner's deck: slides 37–42 (PDF next to the PPTX, course standard) · Owner's repo: no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-concepts/aws-cli-installation`, `aws-terraform/youtube/manage-credentials`)
- Live demonstration: Azure CLI install, `az login`, `az account set`, `az account show`; how the azurerm provider picks up the CLI login; service principals saved for CI (module 13).
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/your-cloud-cli-and-credentials/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Microsoft Entra ID sign-in · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 0.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Improve: slide 42 creates an IAM admin user and downloads access keys; use IAM Identity Center (or short-lived role credentials) instead.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 2.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-140 HCL: blocks, arguments and resources (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 3 The Terraform language and workflow · lesson 3.1, after 2.3 · [owner original] · one video for both courses
- Learning objectives: Read a resource block (type, local name, arguments); Tell blocks, arguments and expressions apart; Explain what tags/labels are for
- Slides: owner's deck: slides 58–69 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Slides 61–69 annotated on screen with a cloud-neutral resource (local_file, random_pet), then the same anatomy on an aws_instance and an azurerm_resource_group.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/hcl-blocks-arguments-and-resources/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 2.3 · Length guide: ~10 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 3.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-141 The core workflow: init, fmt, validate, plan, apply, destroy (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 3 The Terraform language and workflow · lesson 3.2, after 3.1 · [owner original] · one video for both courses
- Learning objectives: Run the six core commands in order; Read a plan's create/change/destroy summary; Destroy safely
- Slides: owner's deck: slides 80–97 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/learning-basic-commands, terraform-commands`
- Live demonstration: The owner's command slides (82–93) and workflow (95–97) with a local_file and random_pet project: init downloads providers, fmt, validate, plan, apply, change, destroy.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/the-core-workflow-init-fmt-validate-plan-apply-d/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 3.1 · Length guide: ~12 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 3.2 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-142 Comments and code style (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 3 The Terraform language and workflow · lesson 3.3, after 3.2 · [owner original] · one video for both courses
- Learning objectives: Use #, // and /* */ comments; Comment out a block safely; Keep comments useful
- Slides: owner's deck: slides 98–104 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-comments`
- Live demonstration: The owner's comments example; commenting out a resource and what plan does next (it plans a destroy).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/comments-and-code-style/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 3.2 · Length guide: ~5 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 3.3 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-143 Terraform files and project layout (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 3 The Terraform language and workflow · lesson 3.4, after 3.3 · [owner original] · one video for both courses
- Learning objectives: Split a configuration into main, variables, outputs and versions files; Explain terraform.tfvars and the .terraform folder; Write a .gitignore for Terraform
- Slides: owner's deck: slides 163–170 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terrafrom-files`
- Live demonstration: Slides 165–170 on a real folder; a .gitignore that excludes .terraform/, *.tfstate*, *.tfvars (keep *.tfvars.example).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/terraform-files-and-project-layout/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 3.3 · Length guide: ~8 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 3.4 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-144 Providers and version constraints (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 3 The Terraform language and workflow · lesson 3.5, after 3.4 · [owner original, updated]
- Learning objectives: Declare required_version and required_providers; Use ~>, >= and exact constraints; Explain the provider's role between Terraform and the API
- Slides: owner's deck: slides 70–79, 460–466 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-providers, youtube/terraform-providers-version-block`
- Live demonstration: hashicorp/aws ~> 6.0 (6.74.0 on 2026-11-27); region; default_tags; what the v6 major changed (per-resource `region` argument).
- Lab ZIP / code: GEN builds `courses/terraform/code/providers-and-version-constraints/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 3.4 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: repo pins aws ~> 4.0 (269 folders) and ~> 3.0 (49), required_version >= 1.0.0; Azure folder azurerm >= 3.0.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 3.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-145 Providers and version constraints (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 3 The Terraform language and workflow · lesson 3.5, after 3.4 · [owner original, updated]
- Learning objectives: Declare required_version and required_providers; Use ~>, >= and exact constraints; Explain the provider's role between Terraform and the API
- Slides: owner's deck: slides 70–79, 460–466 (PDF next to the PPTX, course standard) · Owner's repo: no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-concepts/terraform-providers, youtube/terraform-providers-version-block`)
- Live demonstration: hashicorp/azurerm ~> 5.0 (5.15.0) with `features {}` and `subscription_id` (required since 4.0); azure/azapi ~> 2.0 for brand-new Azure APIs.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/providers-and-version-constraints/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 3.4 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: repo pins aws ~> 4.0 (269 folders) and ~> 3.0 (49), required_version >= 1.0.0; Azure folder azurerm >= 3.0.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 3.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-146 The dependency lock file (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 3 The Terraform language and workflow · lesson 3.6, after 3.5 · [owner original] · one video for both courses
- Learning objectives: Explain what .terraform.lock.hcl records; Commit it; Upgrade providers with init -upgrade
- Slides: owner's deck: slides 151–156 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-lock-file`
- Live demonstration: Slides 153–156; delete .terraform, init again (same version from the lock); init -upgrade; terraform providers lock for several platforms.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/the-dependency-lock-file/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 3.5 · Length guide: ~6 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 3.6 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-147 Your first resources on the cloud (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 3 The Terraform language and workflow · lesson 3.7, after 3.6 · [owner original]
- Learning objectives: Create, change and destroy a first real resource; Find it in the console; Read the plan for a change versus a replacement
- Slides: owner's deck: slides 80–97 (applied) (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/learning-basic-commands`
- Live demonstration: The owner's learning-basic-commands: an EC2 instance (t3.micro, AMI from SSM), tag change (update in place) vs AMI change (replace), destroy.
- Lab ZIP / code: GEN builds `courses/terraform/code/your-first-resources-on-the-cloud/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro · Cost per run: ~$0.01 (t3.micro for under an hour; free tier eligible) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 2.3, 3.5 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Repo fix: learning-basic-commands fails `terraform init` today (Unsupported Terraform Core version: required_version ~> 1.0.0).
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 3.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-148 Your first resources on the cloud (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 3 The Terraform language and workflow · lesson 3.7, after 3.6 · [owner original]
- Learning objectives: Create, change and destroy a first real resource; Find it in the console; Read the plan for a change versus a replacement
- Slides: owner's deck: slides 80–97 (applied) (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/terraform-concepts/learning-basic-commands`
- Live demonstration: The owner's Azure learning-basic-commands: resource group + virtual network + subnet; rename a tag (update) vs change the address space (replace or update), destroy.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/your-first-resources-on-the-cloud/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource group, VNet · Cost per run: $0 (resource groups and VNets are free) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 2.3, 3.5 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Repo fix: learning-basic-commands fails `terraform init` today (Unsupported Terraform Core version: required_version ~> 1.0.0).
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 3.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-149 Resource references: connect resources together (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 4 References, data sources and naming · lesson 4.1, after 3.7 · [owner original]
- Learning objectives: Reference another resource's attribute; Explain how references create the dependency order; Build a small connected stack
- Slides: owner's deck: slides 131–138 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-resources-reference (example-01…06)`
- Live demonstration: The owner's six examples: EIP attached to an instance, VPC → subnet → instance, AMI lookup → instance, security group → instance, IAM user → group with a policy.
- Lab ZIP / code: GEN builds `courses/terraform/code/resource-references-connect-resources-together/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC, subnet, EC2, EIP, security group, IAM user/group · Cost per run: ~$0.02 per run (t3.micro + EIP for under an hour) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 3.7 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 4.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-150 Resource references: connect resources together (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 4 References, data sources and naming · lesson 4.1, after 3.7 · [owner original]
- Learning objectives: Reference another resource's attribute; Explain how references create the dependency order; Build a small connected stack
- Slides: owner's deck: slides 131–138 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/resources-example/virtual-machine`
- Live demonstration: Resource group → VNet → subnet → NIC → Linux VM (B1s), each referencing the previous one; the graph with `terraform graph`.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/resource-references-connect-resources-together/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource group, VNet, subnet, NIC, B1s VM · Cost per run: ~$0.02 per run (B1s VM for under an hour) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 3.7 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 4.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-151 Data sources: read what already exists (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 4 References, data sources and naming · lesson 4.2, after 4.1 · [owner original]
- Learning objectives: Write a data block with filters; Use data sources for images, networks and identities; Explain when to use a data source instead of a resource
- Slides: owner's deck: slides 139–150, 472–482 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-data-source (example-01…03)`
- Live demonstration: The owner's examples: latest Ubuntu/Amazon Linux/RHEL/Windows AMIs, a security group found by tag, the default VPC's subnets, aws_caller_identity.
- Lab ZIP / code: GEN builds `courses/terraform/code/data-sources-read-what-already-exists/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro (optional) · Cost per run: $0–0.02 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 4.1 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Duplicate: slides 472–482 repeat 141–150 word for word (Terraform Blocks section); record once.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 4.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-152 Data sources: read what already exists (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 4 References, data sources and naming · lesson 4.2, after 4.1 · [owner original]
- Learning objectives: Write a data block with filters; Use data sources for images, networks and identities; Explain when to use a data source instead of a resource
- Slides: owner's deck: slides 139–150, 472–482 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/terraform-concepts/data-parameters`
- Live demonstration: The owner's data-parameters: an existing resource group and subnet, azurerm_client_config, a platform image lookup; launch a VM into the found subnet.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/data-sources-read-what-already-exists/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: B1s VM (optional) · Cost per run: $0–0.02 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 4.1 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Duplicate: slides 472–482 repeat 141–150 word for word (Terraform Blocks section); record once.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 4.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-153 Interpolation and the format function (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 4 References, data sources and naming · lesson 4.3, after 4.2 · [owner original] · one video for both courses
- Learning objectives: Build strings with ${} interpolation; Use format() with 1–4 arguments; Apply a naming convention
- Slides: owner's deck: slides 105–121 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-interpolation, terraform-format`
- Live demonstration: The owner's naming convention (2560-dev-del-private-01-us-east-1a, slides 111–121) built with interpolation and format() in terraform console and on local_file names.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/interpolation-and-the-format-function/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 4.2 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 4.3 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-154 Tags: merge, default tags and a tagging standard (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 4 References, data sources and naming · lesson 4.4, after 4.3 · [owner original, updated]
- Learning objectives: Combine common and resource-specific tags with merge(); Set organisation-wide tags once; Find resources by tag
- Slides: owner's deck: slides 122–130 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-merge-tags`
- Live demonstration: The owner's merge-tags examples (bastion host names, slides 124–129) plus provider `default_tags` (no merge needed for common tags) and a tag-based cost report.
- Lab ZIP / code: GEN builds `courses/terraform/code/tags-merge-default-tags-and-a-tagging-standard/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 4.3 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 4.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-155 Tags: merge, default tags and a tagging standard (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 4 References, data sources and naming · lesson 4.4, after 4.3 · [owner original, updated]
- Learning objectives: Combine common and resource-specific tags with merge(); Set organisation-wide tags once; Find resources by tag
- Slides: owner's deck: slides 122–130 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/resource-group`
- Live demonstration: The owner's merge pattern with a `local.common_tags` map (azurerm has no default_tags), and Azure Policy "require a tag" as a preview of policy (module 12).
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/tags-merge-default-tags-and-a-tagging-standard/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 4.3 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 4.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-156 Input variables, types and .tfvars files (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 5 Variables and outputs · lesson 5.1, after 4.4 · [owner original] · one video for both courses
- Learning objectives: Declare variables with type, default and description; Pass values with -var, -var-file and TF_VAR_; Explain variable precedence
- Slides: owner's deck: slides 171–176, 193–195, 500–502 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-variables`
- Live demonstration: Slides 173–176; the same variable set four ways (default, terraform.tfvars, -var-file=dev.tfvars, TF_VAR_); precedence order on screen.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/input-variables-types-and-tfvars-files/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 4.4 · Length guide: ~10 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 5.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-157 Locals: name an expression once (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 5 Variables and outputs · lesson 5.2, after 5.1 · [owner original] · one video for both courses
- Learning objectives: Define locals; Use them to avoid repetition; Choose between a variable and a local
- Slides: owner's deck: slides 177–179, 497–499 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-variables/local-variables`
- Live demonstration: The owner's local-variables example rewritten with local_file; a naming local reused in three places.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/locals-name-an-expression-once/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 5.1 · Length guide: ~6 min · Priority: P1 · Owner: GEN · Status: requested
- Notes: Duplicate: slides 497–499 repeat 177–179.
- Quiz: 3 spoken questions with answers in both curricula › 5.2 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-158 String, number and bool variables (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 5 Variables and outputs · lesson 5.3, after 5.2 · [owner original] · one video for both courses
- Learning objectives: Use string, number and bool types; Turn a resource on or off with a bool; Catch wrong types early
- Slides: owner's deck: slides 180–192 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-variables/{string,number,boolean}-variable`
- Live demonstration: The owner's examples (create_instance = true/false, instance counts) shown with random_pet and count so they run anywhere.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/string-number-and-bool-variables/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 5.2 · Length guide: ~8 min · Priority: P1 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 5.3 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-159 Collections: list, set and tuple (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 5 Variables and outputs · lesson 5.4, after 5.3 · [owner original] · one video for both courses
- Learning objectives: Use list, set and tuple variables; Explain order and duplicates; Pick the right collection
- Slides: owner's deck: slides 196–209, 226–231 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-variables/{list,set,tuple}-variable`
- Live demonstration: The owner's comparison slides (204–206, 227–229) as a table; each type in terraform console; allowed IP set example.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/collections-list-set-and-tuple/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 5.3 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 5.4 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-160 Structures: map, object, any and optional attributes (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 5 Variables and outputs · lesson 5.5, after 5.4 · [owner original, updated] · one video for both courses
- Learning objectives: Use map, object and map(object) types; Make object attributes optional with defaults; Explain why any should be rare
- Slides: owner's deck: slides 210–225 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-variables/{map,object,map-of-object,any}-variable`
- Live demonstration: The owner's object and map-of-object examples (slides 217–223) with try(); then optional(type, default) which replaces most try() workarounds (Terraform >= 1.3).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/structures-map-object-any-and-optional-attribute/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 5.4 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Improve: slides 218–220 use try() for optional attributes; optional() is the modern way.
- Quiz: 3 spoken questions with answers in both curricula › 5.5 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-161 Outputs: share results (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 5 Variables and outputs · lesson 5.6, after 5.5 · [owner original] · one video for both courses
- Learning objectives: Declare outputs; Read them with terraform output (-raw, -json); Mark an output sensitive
- Slides: owner's deck: slides 493–495 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-top-level-blocks/output`
- Live demonstration: Slides 494–495; terraform output -json piped to jq; a sensitive output hidden in the CLI but present in state (link to lesson 8.8).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/outputs-share-results/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 5.5 · Length guide: ~6 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 5.6 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-162 Variable validation and sensitive values (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 5 Variables and outputs · lesson 5.7, after 5.6 · [owner original] · one video for both courses
- Learning objectives: Write validation blocks with clear error messages; Validate with regex, contains and length; Mark inputs sensitive
- Slides: owner's deck: slides 366–371 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-resource-validation`
- Live demonstration: The owner's validation examples (allowed environments, instance types) plus a regex naming rule; sensitive = true on a password variable.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/variable-validation-and-sensitive-values/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 5.6 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 5.7 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-163 Variables in practice on the cloud (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 5 Variables and outputs · lesson 5.8, after 5.7 · [owner original]
- Learning objectives: Drive a real resource from variables and tfvars per environment; Use a map of objects to create differently sized machines; Keep secrets out of tfvars in Git
- Slides: owner's deck: slides 179–225 (applied) (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-variables (EC2 examples)`
- Live demonstration: The owner's EC2 examples: string/list/object variables launch instances; dev.tfvars and prod.tfvars; a map of objects for three instance profiles.
- Lab ZIP / code: GEN builds `courses/terraform/code/variables-in-practice-on-the-cloud/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro x1–3 · Cost per run: ~$0.03 per run · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 5.7 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 5.8 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-164 Variables in practice on the cloud (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 5 Variables and outputs · lesson 5.8, after 5.7 · [owner original]
- Learning objectives: Drive a real resource from variables and tfvars per environment; Use a map of objects to create differently sized machines; Keep secrets out of tfvars in Git
- Slides: owner's deck: slides 179–225 (applied) (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/terraform-concepts/variables`, `azure-terraform/map-off-objects`
- Live demonstration: The owner's Azure variables and map-off-objects folders: VMs or storage accounts from a map of objects; dev.tfvars and prod.tfvars.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/variables-in-practice-on-the-cloud/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Storage accounts (or B1s VM) · Cost per run: ~$0.01 per run · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 5.7 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 5.8 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-165 terraform console: test expressions safely (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 6 The console and functions · lesson 6.1, after 5.8 · [owner original] · one video for both courses
- Learning objectives: Open the console with variables loaded; Explore maps, lists and nested objects; Test an expression before putting it in code
- Slides: owner's deck: slides 232–262 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-console`
- Live demonstration: The owner's var.context examples (slides 235–262): EKS-style map of any, map of objects, try, lookup, element, length, format.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/terraform-console-test-expressions-safely/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 5.8 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 6.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-166 count, length and element (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 6 The console and functions · lesson 6.2, after 6.1 · [owner original] · one video for both courses
- Learning objectives: Create N copies with count and count.index; Use length() to size count; Use element() to wrap around a list
- Slides: owner's deck: slides 298–317 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-count-argument-and-lenght-function, terraform-element-function`
- Live demonstration: The owner's examples (subnets across AZs with element) on local_file names; the risk of count when an item is removed from the middle (preview of for_each).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/count-length-and-element/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 6.1 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 6.2 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-167 split and join (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 6 The console and functions · lesson 6.3, after 6.2 · [owner original] · one video for both courses
- Learning objectives: Turn a string into a list with split; Turn a list into a string with join; Combine them with other functions
- Slides: owner's deck: slides 318–330 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-slipt-function, terraform-join-function`
- Live demonstration: The owner's examples: CIDR lists from a comma string, a join for names and security group descriptions.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/split-and-join/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 6.2 · Length guide: ~6 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 6.3 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-168 lookup and try: safe access to maps and objects (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 6 The console and functions · lesson 6.4, after 6.3 · [owner original] · one video for both courses
- Learning objectives: Read a map key with a default; Use try() to fall back when an attribute is missing; Choose between them and optional()
- Slides: owner's deck: slides 331–358 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-lookup-function, terraform-try-function`
- Live demonstration: The owner's console examples (slides 245–253) and folders; when to prefer optional() (lesson 5.5).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/lookup-and-try-safe-access-to-maps-and-objects/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 6.3 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 6.4 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-169 contains and conditional expressions (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 6 The console and functions · lesson 6.5, after 6.4 · [owner original] · one video for both courses
- Learning objectives: Test membership with contains(); Write condition ? a : b; Use conditions to switch settings per environment
- Slides: owner's deck: slides 359–365, 379–389 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-contains-function, terraform-contitions`
- Live demonstration: The owner's examples (Route 53 only in prod, RDS backup retention, blue/green node sizes) shown with neutral values, then nested conditions and why to keep them readable.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/contains-and-conditional-expressions/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 6.4 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 6.5 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-170 yamldecode: keep configuration in YAML (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 6 The console and functions · lesson 6.6, after 6.5 · [owner original] · one video for both courses
- Learning objectives: Load YAML with yamldecode(file(...)); Use path.module; Validate what you load
- Slides: owner's deck: slides 372–378 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-yamldecode-function`
- Live demonstration: The owner's variable.yaml examples; a YAML list of users turned into resources with for_each.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/yamldecode-keep-configuration-in-yaml/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 6.5 · Length guide: ~7 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 6.6 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-171 Splat expressions (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 6 The console and functions · lesson 6.7, after 6.6 · [owner original] · one video for both courses
- Learning objectives: Collect one attribute from many resources with [*]; Use it in outputs; Compare with a for expression
- Slides: owner's deck: slides 271–276 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-splat-expression`
- Live demonstration: The owner's splat examples on several random_pet resources; the same with [for x in ... : x.id].
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/splat-expressions/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 6.6 · Length guide: ~6 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 6.7 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-172 Loops: count, for_each and dynamic blocks (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 7 Meta-arguments and lifecycle · lesson 7.1, after 6.7 · [owner original, updated]
- Learning objectives: Create many resources with count and with for_each; Explain why for_each is safer for named items; Generate nested blocks with dynamic
- Slides: owner's deck: slides 402–414 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-loops (for-each`, `aws-terraform/for-loop-with-count`, `aws-terraform/others-examples)`
- Live demonstration: The owner's examples: IAM users with count and with for_each, Secrets Manager secrets from a list, a set and a map, instances from a map of objects (slides 407–414); then a dynamic ingress block in a security group.
- Lab ZIP / code: GEN builds `courses/terraform/code/loops-count-for-each-and-dynamic-blocks/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: IAM users, Secrets Manager secrets, security group · Cost per run: ~$0.01 (Secrets Manager $0.40/secret/month, prorated; destroy the same day) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 6.7 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Gap: dynamic blocks are not in the deck. Secrets Manager names are reserved 7–30 days after delete: use recovery_window_in_days = 0 in labs.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 7.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-173 Loops: count, for_each and dynamic blocks (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 7 Meta-arguments and lifecycle · lesson 7.1, after 6.7 · [owner original, updated]
- Learning objectives: Create many resources with count and with for_each; Explain why for_each is safer for named items; Generate nested blocks with dynamic
- Slides: owner's deck: slides 402–414 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/terraform-concepts/loops`, `azure-terraform/count`
- Live demonstration: The owner's Azure loops: resource groups and subnets with count and for_each; a dynamic security_rule block in an NSG.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/loops-count-for-each-and-dynamic-blocks/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource groups, subnets, NSG · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 6.7 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Gap: dynamic blocks are not in the deck. Secrets Manager names are reserved 7–30 days after delete: use recovery_window_in_days = 0 in labs.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 7.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-174 depends_on: hidden dependencies (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 7 Meta-arguments and lifecycle · lesson 7.2, after 7.1 · [owner original] · one video for both courses
- Learning objectives: Explain implicit vs explicit dependencies; Use depends_on only when there is no reference; Spot overuse
- Slides: owner's deck: slides 277–281 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-depend-on`
- Live demonstration: The owner's depends_on examples; a case with no reference (a policy that must exist before use) shown with terraform_data.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/depends-on-hidden-dependencies/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 7.1 · Length guide: ~6 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 7.2 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-175 Lifecycle rules: create_before_destroy, prevent_destroy, ignore_changes (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 7 Meta-arguments and lifecycle · lesson 7.3, after 7.2 · [owner original]
- Learning objectives: Replace without downtime using create_before_destroy; Protect critical resources with prevent_destroy; Ignore changes made outside Terraform
- Slides: owner's deck: slides 282–292 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-lifcycle`
- Live demonstration: The owner's lifecycle examples: instance replaced create-before-destroy, prevent_destroy on an S3 bucket, ignore_changes on tags/password; replace_triggered_by.
- Lab ZIP / code: GEN builds `courses/terraform/code/lifecycle-rules-create-before-destroy-prevent-de/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro, S3 bucket · Cost per run: ~$0.01 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 7.2 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 7.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-176 Lifecycle rules: create_before_destroy, prevent_destroy, ignore_changes (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 7 Meta-arguments and lifecycle · lesson 7.3, after 7.2 · [owner original]
- Learning objectives: Replace without downtime using create_before_destroy; Protect critical resources with prevent_destroy; Ignore changes made outside Terraform
- Slides: owner's deck: slides 282–292 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: The same three rules on a storage account (prevent_destroy), a VM (ignore_changes on tags set by Azure Policy), and a public IP (create_before_destroy).
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/lifecycle-rules-create-before-destroy-prevent-de/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Storage account, public IP · Cost per run: ~$0.01 (public IP prorated) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 7.2 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 7.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-177 Preconditions, postconditions and check blocks (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 7 Meta-arguments and lifecycle · lesson 7.4, after 7.3 · [new, proposed]
- Learning objectives: Add a precondition that stops a bad plan; Add a postcondition that guarantees a result; Use a check block for health warnings
- Slides: owner's deck: extends slides 366–371 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The lesson code: free-tier precondition on the instance type, IMDSv2 postcondition, a check block on a website URL.
- Lab ZIP / code: `courses/terraform/code/courses/terraform/terraform-checks-and-conditions` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro (optional) · Cost per run: $0 (plan only by default) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 7.3 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 7.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-178 Preconditions, postconditions and check blocks (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 7 Meta-arguments and lifecycle · lesson 7.4, after 7.3 · [new, proposed]
- Learning objectives: Add a precondition that stops a bad plan; Add a postcondition that guarantees a result; Use a check block for health warnings
- Slides: owner's deck: extends slides 366–371 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Mirror: a precondition that the VM size is in an allowed list, a postcondition that the storage account is private, a check block on an App Service URL.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/preconditions-postconditions-and-check-blocks/` (reuses `courses/terraform/code/terraform-checks-and-conditions`); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Storage account · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 7.3 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 7.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-179 Provider aliases: several regions and subscriptions (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 7 Meta-arguments and lifecycle · lesson 7.5, after 7.4 · [owner original]
- Learning objectives: Configure a second provider with alias; Pass a provider to a resource and a module; Explain the AWS v6 per-resource region option
- Slides: owner's deck: slides 390–394 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-alias`
- Live demonstration: The owner's alias example (us-east-1 and us-west-2 buckets); then provider v6's `region` argument on a resource as a simpler alternative for single-account multi-region.
- Lab ZIP / code: GEN builds `courses/terraform/code/provider-aliases-several-regions-and-subscriptio/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: S3 buckets in two regions · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 7.4 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 7.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-180 Provider aliases: several regions and subscriptions (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 7 Meta-arguments and lifecycle · lesson 7.5, after 7.4 · [owner original]
- Learning objectives: Configure a second provider with alias; Pass a provider to a resource and a module; Explain the AWS v6 per-resource region option
- Slides: owner's deck: slides 390–394 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/terraform-concepts/multiple-providers`
- Live demonstration: The owner's multiple-providers example: two azurerm providers for two subscriptions (or one subscription and two features blocks), a resource in each.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/provider-aliases-several-regions-and-subscriptio/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource groups in two subscriptions or regions · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 7.4 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 7.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-181 Bootstrap servers: user data and cloud-init (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 7 Meta-arguments and lifecycle · lesson 7.6, after 7.5 · [owner original]
- Learning objectives: Pass a script at first boot; Use templatefile() for variables; Check the boot log
- Slides: owner's deck: slides 293–297 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-user-data`
- Live demonstration: The owner's user-data example installing nginx on Amazon Linux 2023; templatefile; /var/log/cloud-init-output.log; user_data_replace_on_change.
- Lab ZIP / code: GEN builds `courses/terraform/code/bootstrap-servers-user-data-and-cloud-init/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro, security group · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 7.5 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 7.6 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-182 Bootstrap servers: user data and cloud-init (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 7 Meta-arguments and lifecycle · lesson 7.6, after 7.5 · [owner original]
- Learning objectives: Pass a script at first boot; Use templatefile() for variables; Check the boot log
- Slides: owner's deck: slides 293–297 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: custom_data with cloud-init on a B1s Ubuntu VM installing nginx; templatefile; base64encode; checking with the serial console.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/bootstrap-servers-user-data-and-cloud-init/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: B1s VM, NSG, public IP · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 7.5 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 7.6 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-183 Provisioners and terraform_data: the last resort (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 7 Meta-arguments and lifecycle · lesson 7.7, after 7.6 · [owner original, updated]
- Learning objectives: Run local-exec and remote-exec; Use terraform_data instead of null_resource; Explain why provisioners are a last resort
- Slides: owner's deck: slides 395–401, 504–508 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-provisioner`
- Live demonstration: The owner's remote-exec and null_resource examples, rewritten: the SSH key generated with tls_private_key (never committed), terraform_data, and the SSM Session Manager alternative.
- Lab ZIP / code: GEN builds `courses/terraform/code/provisioners-and-terraform-data-the-last-resort/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro, key pair (generated) · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 7.6 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Security: the repo commits private keys (provisioner/example-01,02 *.pem, testing/ssh-key, base-code/eks-mix, azure ssh-keys). Not reused; labs generate keys at run time. Duplicate: slides 504–508 repeat 397–401.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 7.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-184 Provisioners and terraform_data: the last resort (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 7 Meta-arguments and lifecycle · lesson 7.7, after 7.6 · [owner original, updated]
- Learning objectives: Run local-exec and remote-exec; Use terraform_data instead of null_resource; Explain why provisioners are a last resort
- Slides: owner's deck: slides 395–401, 504–508 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: The same on a B1s VM: local-exec calling az CLI, remote-exec over SSH with a generated key, and the Run Command alternative.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/provisioners-and-terraform-data-the-last-resort/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: B1s VM, public IP · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 7.6 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Security: the repo commits private keys (provisioner/example-01,02 *.pem, testing/ssh-key, base-code/eks-mix, azure ssh-keys). Not reused; labs generate keys at run time. Duplicate: slides 504–508 repeat 397–401.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 7.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-185 The state file: current vs desired state (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 8 State · lesson 8.1, after 7.7 · [owner original] · one video for both courses
- Learning objectives: Explain what state records and why; Compare desired, current and recorded state; Name the risks of local state
- Slides: owner's deck: slides 157–162, 430–431 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-local-state`
- Live demonstration: Slides 159–162 and 431; open terraform.tfstate of a neutral project; why it must not be edited by hand or committed.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/the-state-file-current-vs-desired-state/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 7.7 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Fix: the repo's terraform-local-state/main.tf has a database password in plain text; the lesson shows it as the problem, not as code to copy.
- Quiz: 3 spoken questions with answers in both curricula › 8.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-186 Remote state with locking (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 8 State · lesson 8.2, after 8.1 · [owner original, updated]
- Learning objectives: Create a secure state bucket or storage account; Configure the backend with partial configuration; Show locking and versioning
- Slides: owner's deck: slides 429–440, 467–471 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-remote-state`, `aws-terraform/modules/s3-backend`
- Live demonstration: Lesson code: bucket with versioning, encryption and public access block; backend "s3" with use_lockfile = true; two applies at once to show the lock.
- Lab ZIP / code: `courses/terraform/code/terraform-remote-state` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: S3 bucket, SSM parameter · Cost per run: ~$0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 8.1, 3.7 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: the repo's 78 backend configs use a DynamoDB lock table; dynamodb_table is deprecated since Terraform 1.11 (S3 native locking, use_lockfile).
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 8.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-187 Remote state with locking (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 8 State · lesson 8.2, after 8.1 · [owner original, updated]
- Learning objectives: Create a secure state bucket or storage account; Configure the backend with partial configuration; Show locking and versioning
- Slides: owner's deck: slides 429–440, 467–471 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/storage-backend`
- Live demonstration: Lesson code: storage account (Entra ID only, versioning, soft delete) and container; backend "azurerm" with use_azuread_auth; the blob lease lock.
- Lab ZIP / code: `courses/terraform/code/azure/terraform-remote-state` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource group, storage account, container · Cost per run: ~$0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 8.1, 3.7 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: the repo's 78 backend configs use a DynamoDB lock table; dynamodb_table is deprecated since Terraform 1.11 (S3 native locking, use_lockfile).
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 8.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-188 Change and delete resources safely (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 8 State · lesson 8.3, after 8.2 · [owner original, updated] · one video for both courses
- Learning objectives: Remove a resource by deleting its code; Replace one with -replace; Explain why editing or deleting the state file is dangerous
- Slides: owner's deck: slides 415–422 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/deleting-resources-in-terraform`
- Live demonstration: The owner's options (slides 417–422) on a neutral project, ranked from safest to riskiest: remove the code, destroy -target (exceptional), apply -replace, removed block (8.5), state rm, editing state (never).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/change-and-delete-resources-safely/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 8.2 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Improve: slides 421–422 show editing and deleting the state file; kept only as "what not to do".
- Quiz: 3 spoken questions with answers in both curricula › 8.3 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-189 Import existing resources (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 8 State · lesson 8.4, after 8.3 · [owner original, updated]
- Learning objectives: Import with an import block and review the plan; Generate configuration with -generate-config-out; Compare with the terraform import command
- Slides: owner's deck: slides 423–428 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-import`
- Live demonstration: Lesson code: an IAM user created by hand, then import block, plan (1 to import), apply, generated config.
- Lab ZIP / code: `courses/terraform/code/terraform-import` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: IAM user · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 8.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 8.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-190 Import existing resources (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 8 State · lesson 8.4, after 8.3 · [owner original, updated]
- Learning objectives: Import with an import block and review the plan; Generate configuration with -generate-config-out; Compare with the terraform import command
- Slides: owner's deck: slides 423–428 (PDF next to the PPTX, course standard) · Owner's repo: no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-concepts/terraform-import`)
- Live demonstration: Lesson code: a resource group created with az CLI, imported by its full resource id; aztfexport shown for whole groups.
- Lab ZIP / code: `courses/terraform/code/azure/terraform-import` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource group · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 8.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 8.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-191 Refactor without destroying: moved and removed blocks (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 8 State · lesson 8.5, after 8.4 · [new, proposed]
- Learning objectives: Rename or restructure resources with moved blocks; Stop managing a resource with removed; Read "has moved to" in a plan
- Slides: owner's deck: extends slides 415–422 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: two SSM parameters refactored into one for_each resource; a third forgotten with removed { lifecycle { destroy = false } }.
- Lab ZIP / code: `courses/terraform/code/terraform-moved-removed` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: SSM parameters · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 8.4 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 8.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-192 Refactor without destroying: moved and removed blocks (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 8 State · lesson 8.5, after 8.4 · [new, proposed]
- Learning objectives: Rename or restructure resources with moved blocks; Stop managing a resource with removed; Read "has moved to" in a plan
- Slides: owner's deck: extends slides 415–422 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Mirror: two resource groups refactored into one for_each resource; a storage account forgotten with removed.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/refactor-without-destroying-moved-and-removed-bl/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource groups, storage account · Cost per run: ~$0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 8.4 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 8.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-193 State commands: list, show, mv, rm and pull (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 8 State · lesson 8.6, after 8.5 · [owner original] · one video for both courses
- Learning objectives: Inspect state with list and show; Move and remove items safely; Back up state before surgery
- Slides: owner's deck: slides 535–542 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-commands`
- Live demonstration: The owner's commands section on a neutral project; why moved blocks (8.5) are preferred over state mv in a team.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/state-commands-list-show-mv-rm-and-pull/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 8.5 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 8.6 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-194 Read another stack's outputs: terraform_remote_state (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 8 State · lesson 8.7, after 8.6 · [owner original]
- Learning objectives: Expose outputs from a network stack; Read them from an app stack; Choose between remote state and data sources
- Slides: owner's deck: slides 526–534 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-remote-state-data-source`
- Live demonstration: The owner's examples: a VPC stack's outputs read by an EC2 stack through the S3 backend.
- Lab ZIP / code: GEN builds `courses/terraform/code/read-another-stack-s-outputs-terraform-remote-st/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC, subnets, EC2 t3.micro · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 8.6 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 8.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-195 Read another stack's outputs: terraform_remote_state (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 8 State · lesson 8.7, after 8.6 · [owner original]
- Learning objectives: Expose outputs from a network stack; Read them from an app stack; Choose between remote state and data sources
- Slides: owner's deck: slides 526–534 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: The same with a VNet stack and a VM stack through the azurerm backend.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/read-another-stack-s-outputs-terraform-remote-st/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VNet, subnets, B1s VM · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 8.6 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 8.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-196 Keep secrets out of state: ephemeral values and write-only arguments (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 8 State · lesson 8.8, after 8.7 · [new, proposed]
- Learning objectives: Generate a secret with an ephemeral resource; Send it with a write-only argument; Rotate it with a version number
- Slides: owner's deck: extends slides 157–162 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: ephemeral random_password → aws_ssm_parameter value_wo; the same pattern for RDS password_wo and Secrets Manager secret_string_wo; compare the state file.
- Lab ZIP / code: `courses/terraform/code/terraform-ephemeral-write-only` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: SSM SecureString parameter · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 8.7 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 8.8 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-197 Keep secrets out of state: ephemeral values and write-only arguments (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 8 State · lesson 8.8, after 8.7 · [new, proposed]
- Learning objectives: Generate a secret with an ephemeral resource; Send it with a write-only argument; Rotate it with a version number
- Slides: owner's deck: extends slides 157–162 (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: ephemeral random_password → azurerm_key_vault_secret value_wo with RBAC Key Vault.
- Lab ZIP / code: `courses/terraform/code/azure/terraform-ephemeral-write-only` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Key Vault, secret · Cost per run: ~$0.01 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 8.7 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 8.8 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-198 Workspaces (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 9 Environments and accounts · lesson 9.1, after 8.8 · [owner original] · one video for both courses
- Learning objectives: Create and switch workspaces; Use terraform.workspace in names; Explain when workspaces are not enough
- Slides: owner's deck: slides 441–446 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-workspace`
- Live demonstration: The owner's dev.tfvars/prod.tfvars workspace example on a neutral project; why separate state per environment folder or account is safer for production (lesson 9.3).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/workspaces/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 8.8 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 9.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-199 Several environments and accounts (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 9 Environments and accounts · lesson 9.2, after 9.1 · [owner original, updated]
- Learning objectives: Point Terraform at different accounts or subscriptions; Assume a role per environment; Prevent applying to the wrong one
- Slides: owner's deck: slides 447–458 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/deploy-in-multiple-env`
- Live demonstration: The owner's AWS_PROFILE method (slides 448–458) with SSO profiles; then provider assume_role into a dev and a prod account, and allowed_account_ids as a safety net.
- Lab ZIP / code: GEN builds `courses/terraform/code/several-environments-and-accounts/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 9.1 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Improve: slides 449–450 store access keys per profile; use SSO profiles or roles.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 9.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-200 Several environments and accounts (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 9 Environments and accounts · lesson 9.2, after 9.1 · [owner original, updated]
- Learning objectives: Point Terraform at different accounts or subscriptions; Assume a role per environment; Prevent applying to the wrong one
- Slides: owner's deck: slides 447–458 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: Subscriptions per environment: subscription_id per tfvars, az account set, and a check that fails the plan on the wrong subscription.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/several-environments-and-accounts/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 9.1 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Improve: slides 449–450 store access keys per profile; use SSO profiles or roles.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 9.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-201 One folder per environment (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 9 Environments and accounts · lesson 9.3, after 9.2 · [new, proposed] · one video for both courses
- Learning objectives: Lay out modules/ and envs/dev, envs/prod; Give each environment its own backend key; Promote a change from dev to prod
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A neutral layout used by the capstone: modules/, envs/dev, envs/prod with their own backend.hcl and tfvars; the same module version promoted.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/one-folder-per-environment/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 9.2 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 9.3 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-202 Terragrunt: keep environments DRY (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 9 Environments and accounts · lesson 9.4, after 9.3 · [owner original, updated]
- Learning objectives: Generate backends and providers with Terragrunt; Share inputs across environments; Order stacks with dependencies
- Slides: owner's deck: slides 574–583, 56–57 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terragrunt/live (development`, `aws-terraform/staging`, `aws-terraform/production)`
- Live demonstration: The owner's terragrunt/live layout (VPC, EC2, bastion, EKS control plane) with root.hcl, remote_state with use_lockfile, dependency blocks; terragrunt run --all plan.
- Lab ZIP / code: GEN builds `courses/terraform/code/terragrunt-keep-environments-dry/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC, EC2 t3.micro (EKS folder skipped) · Cost per run: ~$0.03 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 9.3 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: Terragrunt is now 1.x (v1.2.3, 2026-11-25): `run --all` replaces `run-all`, root.hcl replaces a root terragrunt.hcl, find_in_parent_folders("root.hcl"). Check commands at recording.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 9.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-203 Terragrunt: keep environments DRY (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 9 Environments and accounts · lesson 9.4, after 9.3 · [owner original, updated]
- Learning objectives: Generate backends and providers with Terragrunt; Share inputs across environments; Order stacks with dependencies
- Slides: owner's deck: slides 574–583, 56–57 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: The same layout for Azure: resource group, VNet, VM; remote_state backend azurerm generated per folder.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/terragrunt-keep-environments-dry/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Resource group, VNet, B1s VM · Cost per run: ~$0.03 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 9.3 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: Terragrunt is now 1.x (v1.2.3, 2026-11-25): `run --all` replaces `run-all`, root.hcl replaces a root terragrunt.hcl, find_in_parent_folders("root.hcl"). Check commands at recording.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 9.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-204 What modules are and how to call them (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 10 Modules · lesson 10.1, after 9.4 · [owner original] · one video for both courses
- Learning objectives: Explain root and child modules; Call a module with source and inputs; Read its outputs
- Slides: owner's deck: slides 509–521, 483–492 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-module`
- Live demonstration: Slides 511–514 with a local neutral module (a naming module); source types (local, Git with ?ref=, registry).
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/what-modules-are-and-how-to-call-them/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 9.4 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Duplicate: slides 483–492 repeat 509–521.
- Quiz: 3 spoken questions with answers in both curricula › 10.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-205 Use registry modules (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 10 Modules · lesson 10.2, after 10.1 · [owner original, updated]
- Learning objectives: Find a trustworthy module in the registry; Pin its version; Read its inputs and outputs before use
- Slides: owner's deck: slides 518–521 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-module (aws-vpc-01`, `aws-terraform/aws-vpc-02`, `aws-terraform/ec2)`
- Live demonstration: The owner's examples with terraform-aws-modules/vpc and ec2-instance, updated to current versions; reading the module's examples and changelog.
- Lab ZIP / code: GEN builds `courses/terraform/code/use-registry-modules/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC (no NAT), EC2 t3.micro · Cost per run: ~$0.02 (NAT gateway disabled) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 10.1 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 10.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-206 Use registry modules (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 10 Modules · lesson 10.2, after 10.1 · [owner original, updated]
- Learning objectives: Find a trustworthy module in the registry; Pin its version; Read its inputs and outputs before use
- Slides: owner's deck: slides 518–521 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: Azure Verified Modules (AVM): avm-res-network-virtualnetwork and a VM module; pinning, telemetry setting, reading inputs.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/use-registry-modules/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VNet, B1s VM · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 10.1 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 10.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-207 Write your own network module (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 10 Modules · lesson 10.3, after 10.2 · [owner original]
- Learning objectives: Design a module's inputs and outputs; Create subnets across zones with for_each; Document the module
- Slides: owner's deck: slides 509–521, 544 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/vpc-01`, `aws-terraform/vpc-02`, `aws-terraform/vpc-03`
- Live demonstration: The owner's VPC modules (vpc-01 → vpc-03): public and private subnets across AZs, route tables, optional NAT; README with inputs/outputs.
- Lab ZIP / code: GEN builds `courses/terraform/code/write-your-own-network-module/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC, subnets, IGW, route tables (NAT optional) · Cost per run: $0 without NAT; NAT gateway ~$0.05/hour if turned on · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 10.2 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 10.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-208 Write your own network module (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 10 Modules · lesson 10.3, after 10.2 · [owner original]
- Learning objectives: Design a module's inputs and outputs; Create subnets across zones with for_each; Document the module
- Slides: owner's deck: slides 509–521, 544 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/vnet`, `azure-terraform/aks-vnet`
- Live demonstration: The owner's vnet module: VNet, subnets from a map, NSG association, optional NAT gateway.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/write-your-own-network-module/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VNet, subnets, NSGs (NAT optional) · Cost per run: $0 without NAT; NAT gateway ~$0.05/hour if turned on · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 10.2 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 10.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-209 Version, source and publish modules (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 10 Modules · lesson 10.4, after 10.3 · [owner original] · one video for both courses
- Learning objectives: Version a module with Git tags; Publish to the public registry from GitHub; Use a private registry
- Slides: owner's deck: slides 522–525 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-module-publish`, devopstia/terraform-aws-vpc-module
- Live demonstration: The owner's publish steps (slides 524–525): repo name terraform-<provider>-<name>, semantic version tags, registry sign-in; HCP Terraform private registry as the team option.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/version-source-and-publish-modules/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 10.3 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 10.4 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-210 Compose modules: network, compute and data (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 10 Modules · lesson 10.5, after 10.4 · [new, proposed]
- Learning objectives: Wire modules together through outputs; Keep each module small; Avoid passing whole objects around
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/vpc-02`, `aws-terraform/ec2`, `aws-terraform/sg`, `aws-terraform/postgres-db`
- Live demonstration: The owner's VPC, security group and EC2 modules composed in one root module; outputs flow from network to compute.
- Lab ZIP / code: GEN builds `courses/terraform/code/compose-modules-network-compute-and-data/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC, SG, EC2 t3.micro · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 10.4 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 10.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-211 Compose modules: network, compute and data (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 10 Modules · lesson 10.5, after 10.4 · [new, proposed]
- Learning objectives: Wire modules together through outputs; Keep each module small; Avoid passing whole objects around
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/vnet`, `azure-terraform/virtual-machine`, `azure-terraform/azure-mysql`
- Live demonstration: The owner's vnet and virtual-machine modules composed; outputs flow from network to compute.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/compose-modules-network-compute-and-data/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VNet, NSG, B1s VM · Cost per run: ~$0.02 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 10.4 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 10.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-212 Project: a production-style network (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 11 Projects from the owner's deck · lesson 11.1, after 10.5 · [owner original]
- Learning objectives: Build the network module to the owner's requirement list; Tag and name it with the convention; Test it with terraform test
- Slides: owner's deck: slide 544 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/vpc-03`, `aws-terraform/resources/vpc-03`
- Live demonstration: Slide 544's requirements: 3 public and 3 private subnets in 3 AZs, IGW, optional NAT per AZ, outputs for the next projects.
- Lab ZIP / code: GEN builds `courses/terraform/code/project-a-production-style-network/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC, 6 subnets, IGW, (NAT optional) · Cost per run: $0 without NAT; ~$0.15 per hour with 3 NAT gateways (turn on only for the demo minute) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 10.3 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 11.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-213 Project: a production-style network (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 11 Projects from the owner's deck · lesson 11.1, after 10.5 · [owner original]
- Learning objectives: Build the network module to the owner's requirement list; Tag and name it with the convention; Test it with terraform test
- Slides: owner's deck: slide 544 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/vnet`, `azure-terraform/aks-vnet`
- Live demonstration: Same requirements in Azure: VNet with public/private subnets, NSGs, optional NAT gateway, outputs.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/project-a-production-style-network/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VNet, subnets, NSGs, (NAT optional) · Cost per run: $0 without NAT; ~$0.05 per hour with one NAT gateway · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 10.3 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 11.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-214 Project: virtual machines and a secure jump host (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 11 Projects from the owner's deck · lesson 11.2, after 11.1 · [owner original, updated]
- Learning objectives: Build a VM module with optional public IP and user data; Build a jump host that only your IP can reach; Prefer keyless access where the cloud offers it
- Slides: owner's deck: slides 545–546 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/ec2`, `aws-terraform/bastion-host`, `aws-terraform/ec2-simple`
- Live demonstration: The owner's EC2 and bastion modules (slides 545–546): instance profile, IMDSv2, SG from your IP only; then Session Manager as the keyless alternative.
- Lab ZIP / code: GEN builds `courses/terraform/code/project-virtual-machines-and-a-secure-jump-host/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.micro x2, SG, IAM instance profile · Cost per run: ~$0.03 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 11.1 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Security: replace committed .pem keys with tls_private_key or ssh-keygen at run time.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 11.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-215 Project: virtual machines and a secure jump host (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 11 Projects from the owner's deck · lesson 11.2, after 11.1 · [owner original, updated]
- Learning objectives: Build a VM module with optional public IP and user data; Build a jump host that only your IP can reach; Prefer keyless access where the cloud offers it
- Slides: owner's deck: slides 545–546 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/virtual-machine`
- Live demonstration: The VM module with SSH key generated at run time, NSG from your IP only; Azure Bastion Developer (free tier where available) or just-in-time access as alternatives.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/project-virtual-machines-and-a-secure-jump-host/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: B1s VM x2, NSG, public IP · Cost per run: ~$0.03 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 11.1 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Security: replace committed .pem keys with tls_private_key or ssh-keygen at run time.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 11.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-216 Project: firewall rules and a container registry with loops (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 11 Projects from the owner's deck · lesson 11.3, after 11.2 · [owner original]
- Learning objectives: Generate firewall rules from a map; Create several registries with for_each; Add lifecycle and scan settings
- Slides: owner's deck: slides 551–552 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/sg`, `aws-terraform/aws-ecr`
- Live demonstration: The owner's security group module (loops, slide 551) and ECR module (one repo per app, scan on push, lifecycle policy, slide 552).
- Lab ZIP / code: GEN builds `courses/terraform/code/project-firewall-rules-and-a-container-registry/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Security groups, ECR repositories · Cost per run: ~$0 (ECR storage cents) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 11.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 11.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-217 Project: firewall rules and a container registry with loops (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 11 Projects from the owner's deck · lesson 11.3, after 11.2 · [owner original]
- Learning objectives: Generate firewall rules from a map; Create several registries with for_each; Add lifecycle and scan settings
- Slides: owner's deck: slides 551–552 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/acr`
- Live demonstration: An NSG module from a rules map and the owner's ACR module (Basic SKU), admin user off, RBAC pull.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/project-firewall-rules-and-a-container-registry/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: NSG, ACR Basic · Cost per run: ~$0.17 per day (ACR Basic); destroy the same day · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 11.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 11.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-218 Project: a database with secrets done right (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 11 Projects from the owner's deck · lesson 11.4, after 11.3 · [owner original, updated]
- Learning objectives: Create a managed database in private subnets; Generate its password with write-only arguments; Store connection details in a secret store
- Slides: owner's deck: slides 553–558 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/aws-secret-manager`, `aws-terraform/mysql-db`, `aws-terraform/postgres-db (aurora modules: slides only)`
- Live demonstration: The owner's Secrets Manager and Postgres modules (slides 553–556) on db.t4g.micro, password_wo from an ephemeral password, Secrets Manager secret_string_wo; Aurora variants (557–558) explained, not deployed.
- Lab ZIP / code: GEN builds `courses/terraform/code/project-a-database-with-secrets-done-right/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: RDS PostgreSQL db.t4g.micro, Secrets Manager secret, subnet group · Cost per run: ~$0.05 per run (db.t4g.micro free tier eligible; under an hour) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 8.8, 11.1 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Fix: base-code/aurora-mysql-cluster and others hard-code master passwords; replaced by write-only arguments. Aurora clusters cost more per hour than the lab needs: explained on the owner's slides, not deployed.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 11.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-219 Project: a database with secrets done right (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 11 Projects from the owner's deck · lesson 11.4, after 11.3 · [owner original, updated]
- Learning objectives: Create a managed database in private subnets; Generate its password with write-only arguments; Store connection details in a secret store
- Slides: owner's deck: slides 553–558 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/azure-mysql`, `azure-terraform/key-vault`
- Live demonstration: Azure Database for PostgreSQL Flexible Server (B1ms) with administrator_password_wo, Key Vault secret value_wo, private access.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/project-a-database-with-secrets-done-right/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: PostgreSQL Flexible Server B1ms, Key Vault · Cost per run: ~$0.05 per run (B1ms under an hour) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 8.8, 11.1 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Fix: base-code/aurora-mysql-cluster and others hard-code master passwords; replaced by write-only arguments. Aurora clusters cost more per hour than the lab needs: explained on the owner's slides, not deployed.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 11.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-220 Project: a state backend module with replication (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 11 Projects from the owner's deck · lesson 11.5, after 11.4 · [owner original]
- Learning objectives: Package the state backend as a module; Add cross-region replication; Lock down who can read state
- Slides: owner's deck: slides 549–550 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/s3-backend`, `aws-terraform/s3-backend-with-replication`, `aws-terraform/base-code/s3-backend-with-backup`
- Live demonstration: The owner's s3-backend-with-replication module updated: use_lockfile, replication role, bucket policy that denies non-TLS and unknown principals.
- Lab ZIP / code: GEN builds `courses/terraform/code/project-a-state-backend-module-with-replication/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: 2 S3 buckets, IAM replication role · Cost per run: ~$0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 11.4 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 11.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-221 Project: a state backend module with replication (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 11 Projects from the owner's deck · lesson 11.5, after 11.4 · [owner original]
- Learning objectives: Package the state backend as a module; Add cross-region replication; Lock down who can read state
- Slides: owner's deck: slides 549–550 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/storage-backend`
- Live demonstration: The owner's storage-backend module updated: GRS or object replication to a second region, Entra ID only, resource lock (CanNotDelete).
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/project-a-state-backend-module-with-replication/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: 2 storage accounts (or GRS), management lock · Cost per run: ~$0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 11.4 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 11.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-222 Project: TLS certificates and DNS (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 11 Projects from the owner's deck · lesson 11.6, after 11.5 · [owner original]
- Learning objectives: Request a wildcard certificate; Validate it with DNS records created by Terraform; Wait for validation in the plan
- Slides: owner's deck: slide 559 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/acm`
- Live demonstration: The owner's ACM module: wildcard certificate, Route 53 validation records with for_each over domain_validation_options, aws_acm_certificate_validation.
- Lab ZIP / code: GEN builds `courses/terraform/code/project-tls-certificates-and-dns/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: ACM certificate, Route 53 records (hosted zone $0.50/month) · Cost per run: ~$0.50 (hosted zone month) — needs the training domain (blocked, same owner decision as CR-111) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 11.5 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 11.6 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-223 Project: TLS certificates and DNS (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 11 Projects from the owner's deck · lesson 11.6, after 11.5 · [owner original]
- Learning objectives: Request a wildcard certificate; Validate it with DNS records created by Terraform; Wait for validation in the plan
- Slides: owner's deck: slide 559 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/azure-dns-zone`, `azure-terraform/cert-manager`
- Live demonstration: Azure DNS zone (owner's module) and an App Service managed certificate (or Key Vault certificate) validated by a TXT record.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/project-tls-certificates-and-dns/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: DNS zone, App Service managed certificate · Cost per run: ~$0.50 (DNS zone month) — needs the training domain · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 11.5 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 11.6 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-224 Project: Jenkins on the cloud with an agent (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 11 Projects from the owner's deck · lesson 11.7, after 11.6 · [owner original]
- Learning objectives: Launch a Jenkins controller and an agent from modules; Reach it safely; Tear it down completely
- Slides: owner's deck: slides 547–548 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/jenkins-master`, `aws-terraform/packer/005-jenkins-master`
- Live demonstration: The owner's jenkins-master module and agent requirements (slides 547–548), the Packer-built AMI from lesson 13.4, access from your IP only.
- Lab ZIP / code: GEN builds `courses/terraform/code/project-jenkins-on-the-cloud-with-an-agent/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EC2 t3.small x2, SG, EBS · Cost per run: ~$0.10 per run (two small instances under two hours) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 11.2 (13.4 optional) · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 11.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-225 Project: Jenkins on the cloud with an agent (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 11 Projects from the owner's deck · lesson 11.7, after 11.6 · [owner original]
- Learning objectives: Launch a Jenkins controller and an agent from modules; Reach it safely; Tear it down completely
- Slides: owner's deck: slides 547–548 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: A Jenkins controller VM and agent VM with cloud-init, NSG from your IP only, managed identity for agents.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/project-jenkins-on-the-cloud-with-an-agent/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: B2s VM x2 (or B1ms), NSG, public IP · Cost per run: ~$0.15 per run · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 11.2 (13.4 optional) · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 11.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-226 fmt, validate and TFLint before every commit (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 12 Code quality, testing and policy · lesson 12.1, after 11.7 · [new, proposed] · one video for both courses
- Learning objectives: Run fmt, validate and TFLint locally; Add them to a pre-commit hook; Read and fix lint findings
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A neutral project with mistakes (unused variable, deprecated syntax, wrong type); TFLint core rules, then where the AWS and Azure rulesets plug in; pre-commit-terraform hooks.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/fmt-validate-and-tflint-before-every-commit/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 11.7 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 12.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-227 Test modules with terraform test (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 12 Code quality, testing and policy · lesson 12.2, after 12.1 · [new, proposed]
- Learning objectives: Write .tftest.hcl run blocks with asserts; Mock the provider so tests are free; Test validation with expect_failures
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: an S3 module tested for naming, public access block and versioning, with mock_provider "aws".
- Lab ZIP / code: `courses/terraform/code/terraform-test` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (mocked) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 10.3 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 12.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-228 Test modules with terraform test (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 12 Code quality, testing and policy · lesson 12.2, after 12.1 · [new, proposed]
- Learning objectives: Write .tftest.hcl run blocks with asserts; Mock the provider so tests are free; Test validation with expect_failures
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: a storage-account module tested for naming, privacy and TLS, with mock_provider "azurerm".
- Lab ZIP / code: `courses/terraform/code/azure/terraform-test` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (mocked) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 10.3 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 12.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-229 Policy as code: Checkov, OPA and Sentinel (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 12 Code quality, testing and policy · lesson 12.3, after 12.2 · [new, proposed]
- Learning objectives: Scan code with Checkov and read the findings; Skip a check only with a written reason; Check a plan with OPA and know where Sentinel fits
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: a weak S3 bucket (Checkov 2026-11-27: 5 passed, 11 failed), fixed step by step; conftest on terraform show -json; HCP Terraform policy sets as the team option.
- Lab ZIP / code: `courses/terraform/code/terraform-policy-checkov` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 12.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 12.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-230 Policy as code: Checkov, OPA and Sentinel (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 12 Code quality, testing and policy · lesson 12.3, after 12.2 · [new, proposed]
- Learning objectives: Scan code with Checkov and read the findings; Skip a check only with a written reason; Check a plan with OPA and know where Sentinel fits
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Mirror: a weak storage account and Key Vault scanned (CKV_AZURE checks), fixed; Azure Policy as the cloud-side guardrail.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/policy-as-code-checkov-opa-and-sentinel/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 12.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 12.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-231 GitHub Actions with OIDC: plan on pull request, apply on approval (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 13 CI/CD and team workflows · lesson 13.1, after 12.3 · [owner original, updated]
- Learning objectives: Trust GitHub's OIDC token in the cloud; Plan on pull requests and comment the plan; Apply only after merge and a reviewer's approval
- Slides: owner's deck: slides 614–616 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-with-github-action`
- Live demonstration: Lesson code: OIDC provider, a read-only plan role and an apply role limited to the production environment; plan comment; approval gate.
- Lab ZIP / code: `courses/terraform/code/terraform-with-github-action` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: IAM OIDC provider, 2 roles, SSM parameter · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 8.2 · Length guide: ~18 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: the owner's workflows use AWS access keys as GitHub secrets, setup-terraform@v2.0.2 and Terraform 1.0.0.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 13.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-232 GitHub Actions with OIDC: plan on pull request, apply on approval (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 13 CI/CD and team workflows · lesson 13.1, after 12.3 · [owner original, updated]
- Learning objectives: Trust GitHub's OIDC token in the cloud; Plan on pull requests and comment the plan; Apply only after merge and a reviewer's approval
- Slides: owner's deck: slides 614–616 (PDF next to the PPTX, course standard) · Owner's repo: no Azure exercise in the owner's repo (mirrors `aws-terraform/terraform-with-github-action`)
- Live demonstration: Lesson code: two user-assigned managed identities with federated credentials (pull_request and environment:production), ARM_USE_OIDC, the approval gate.
- Lab ZIP / code: `courses/terraform/code/azure/terraform-with-github-action` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: 2 managed identities, federated credentials, role assignments · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 8.2 · Length guide: ~18 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: the owner's workflows use AWS access keys as GitHub secrets, setup-terraform@v2.0.2 and Terraform 1.0.0.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 13.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-233 HCP Terraform: remote runs, variable sets and dynamic credentials (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 13 CI/CD and team workflows · lesson 13.2, after 13.1 · [owner original, updated]
- Learning objectives: Create an organisation, project and workspace; Run plans from VCS; Use dynamic provider credentials instead of stored keys
- Slides: owner's deck: slides 584–599 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-cloud (example-01…)`
- Live demonstration: The owner's Terraform Cloud examples renamed to HCP Terraform; AWS credentials replaced by dynamic provider credentials (OIDC role); variable sets; the VPC module run.
- Lab ZIP / code: GEN builds `courses/terraform/code/hcp-terraform-remote-runs-variable-sets-and-dyna/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (free tier; resources from the run are destroyed) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 13.1 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: "Terraform Cloud" is now HCP Terraform; slides 593 and 597 store AWS keys as variables (use dynamic credentials). Check the free plan's current limits before recording.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 13.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-234 HCP Terraform: remote runs, variable sets and dynamic credentials (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 13 CI/CD and team workflows · lesson 13.2, after 13.1 · [owner original, updated]
- Learning objectives: Create an organisation, project and workspace; Run plans from VCS; Use dynamic provider credentials instead of stored keys
- Slides: owner's deck: slides 584–599 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: The same with Azure dynamic credentials (federated identity), variable sets and a VNet module run.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/hcp-terraform-remote-runs-variable-sets-and-dyna/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 13.1 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: "Terraform Cloud" is now HCP Terraform; slides 593 and 597 store AWS keys as variables (use dynamic credentials). Check the free plan's current limits before recording.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 13.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-235 Terraform with Jenkins and Terragrunt pipelines (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 13 CI/CD and team workflows · lesson 13.3, after 13.2 · [owner original]
- Learning objectives: Write a Jenkinsfile with plan, approval and apply stages; Use the agent's role instead of keys; Run Terragrunt from Jenkins
- Slides: owner's deck: slides 617–622 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/no pipeline code in the repo)`, `aws-terraform/terraform-concepts/terraform-with-jenkins`, `aws-terraform/terraform-with-jenkins-and-terragrunt (READMEs`
- Live demonstration: A Jenkinsfile on the lesson 11.7 Jenkins: instance profile credentials, plan, input step, apply; a Terragrunt variant.
- Lab ZIP / code: GEN builds `courses/terraform/code/terraform-with-jenkins-and-terragrunt-pipelines/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Jenkins EC2 (from 11.7) · Cost per run: ~$0.10 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 11.7 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Gap: the repo's Jenkins folders have no Jenkinsfile; written new.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 13.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-236 Terraform with Jenkins and Terragrunt pipelines (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 13 CI/CD and team workflows · lesson 13.3, after 13.2 · [owner original]
- Learning objectives: Write a Jenkinsfile with plan, approval and apply stages; Use the agent's role instead of keys; Run Terragrunt from Jenkins
- Slides: owner's deck: slides 617–622 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: The same on the Azure Jenkins VM with its managed identity (ARM_USE_MSI) and the azurerm backend.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/terraform-with-jenkins-and-terragrunt-pipelines/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Jenkins VM (from 11.7) · Cost per run: ~$0.15 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 11.7 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Gap: the repo's Jenkins folders have no Jenkinsfile; written new.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 13.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-237 Machine images with Packer (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 13 CI/CD and team workflows · lesson 13.4, after 13.3 · [owner original]
- Learning objectives: Write a Packer HCL template with variables; Build an image with provisioners; Use the image from Terraform
- Slides: owner's deck: slides 600–609 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/packer/001…007`
- Live demonstration: The owner's Packer folders: inline and script provisioners, Jenkins and bastion images, variables; the AMI found by a data source in Terraform; deregister afterwards.
- Lab ZIP / code: GEN builds `courses/terraform/code/machine-images-with-packer/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Temporary EC2 build instance, AMI, EBS snapshot · Cost per run: ~$0.05 per build; delete the AMI and snapshot · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 13.3 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 13.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-238 Machine images with Packer (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 13 CI/CD and team workflows · lesson 13.4, after 13.3 · [owner original]
- Learning objectives: Write a Packer HCL template with variables; Build an image with provisioners; Use the image from Terraform
- Slides: owner's deck: slides 600–609 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: azure-arm builder to a managed image (or Azure Compute Gallery), the same provisioners; the image used by an azurerm VM; delete afterwards.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/machine-images-with-packer/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Temporary build VM, managed image · Cost per run: ~$0.05 per build; delete the image · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 13.3 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 13.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-239 Upgrade Terraform and providers safely (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 13 CI/CD and team workflows · lesson 13.5, after 13.4 · [owner original, updated]
- Learning objectives: Read upgrade guides and changelogs; Upgrade one version step in a branch with a clean plan; Handle provider major versions
- Slides: owner's deck: slides 610–613 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/terraform-concepts/terraform-upgrade`
- Live demonstration: The owner's upgrade method (state pull | grep terraform_version) from 1.0-era code to 1.17, then AWS provider 4 → 5 → 6 with the upgrade guides and a no-change plan as the goal.
- Lab ZIP / code: GEN builds `courses/terraform/code/upgrade-terraform-and-providers-safely/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (plan only) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 13.4 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: README targets Terraform 1.0 and the 0.14 changelog.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 13.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-240 Upgrade Terraform and providers safely (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 13 CI/CD and team workflows · lesson 13.5, after 13.4 · [owner original, updated]
- Learning objectives: Read upgrade guides and changelogs; Upgrade one version step in a branch with a clean plan; Handle provider major versions
- Slides: owner's deck: slides 610–613 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: The same with azurerm 3 → 4 → 5 (features, subscription_id, renamed arguments) on the owner's Azure modules.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/upgrade-terraform-and-providers-safely/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 13.4 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Outdated: README targets Terraform 1.0 and the 0.14 changelog.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 13.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-241 OpenTofu: what changes and how to try it (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 13 CI/CD and team workflows · lesson 13.6, after 13.5 · [new, proposed] · one video for both courses
- Learning objectives: Explain the licence history; Run a project with tofu; List the features that differ
- Slides: owner's deck: slides 28–32 (extends) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A neutral project with tofu init/plan; state encryption (an OpenTofu feature); where the two differ and how to stay compatible.
- Lab ZIP / code: GEN builds `courses/terraform/code/shared/opentofu-what-changes-and-how-to-try-it/` (cloud-neutral providers: local, random, terraform_data); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 13.5 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 13.6 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-242 AI drafts, Terraform verifies: the rules of AI-assisted IaC (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 14 AI-Powered Terraform · lesson 14.1, after 13.6 · [new, proposed: AI] · one video for both courses
- Learning objectives: State the rules (AI drafts; fmt, validate, tests, policy, plan and a person verify; never auto-apply); Name what never goes into a prompt; Explain why AI gets provider details wrong
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The verification ladder on one slide; a real AI answer with an outdated argument caught by validate; what not to paste (state, tfvars with secrets, keys).
- Lab ZIP / code: `courses/terraform/code/ai-terraform-prompts`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 13.6 · Length guide: ~8 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 14.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-243 Prompt AI to write HCL: poor vs professional prompts (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 14 AI-Powered Terraform · lesson 14.2, after 14.1 · [new, proposed: AI]
- Learning objectives: Write a professional prompt (role, context, task, constraints, output, checks); Compare results of a poor and a professional prompt live; Prove the result with fmt, validate, Checkov and plan
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/links CR-077–CR-082`
- Live demonstration: Both prompts run live in an AI coding agent for a private S3 log bucket; the poor one misses the public access block and pins nothing; the professional one passes after one fix.
- Lab ZIP / code: `courses/terraform/code/ai-terraform-prompts/01-write-hcl-professional.md` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (plan only; model use under $0.50) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 14.1, CR-077–CR-082 (prompt engineering) · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 14.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-244 Prompt AI to write HCL: poor vs professional prompts (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 14 AI-Powered Terraform · lesson 14.2, after 14.1 · [new, proposed: AI]
- Learning objectives: Write a professional prompt (role, context, task, constraints, output, checks); Compare results of a poor and a professional prompt live; Prove the result with fmt, validate, Checkov and plan
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: no Azure exercise in the owner's repo (mirrors `aws-terraform/links CR-077–CR-082`)
- Live demonstration: The same for a private storage account with Key Vault; the poor answer uses storage keys and azurerm 3.x syntax.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/prompt-ai-to-write-hcl-poor-vs-professional-prom/` (reuses `code/ai-terraform-prompts/01-write-hcl-professional.md`); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 14.1, CR-077–CR-082 (prompt engineering) · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 14.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-245 AI explains plans and errors (and when it is wrong) (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 14 AI-Powered Terraform · lesson 14.3, after 14.2 · [new, proposed: AI]
- Learning objectives: Ask AI to summarise a plan with risks; Troubleshoot an error with AI and confirm against the docs; Recognise a confident wrong answer
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A plan that replaces an RDS instance because of a changed engine version explained by AI; an IAM error diagnosed; one case where the AI invents an argument and validate proves it wrong.
- Lab ZIP / code: `courses/terraform/code/ai-terraform-prompts/02-explain-plan.md` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (plan only) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 14.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 14.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-246 AI explains plans and errors (and when it is wrong) (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 14 AI-Powered Terraform · lesson 14.3, after 14.2 · [new, proposed: AI]
- Learning objectives: Ask AI to summarise a plan with risks; Troubleshoot an error with AI and confirm against the docs; Recognise a confident wrong answer
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A plan that replaces a storage account because of a changed replication type; a 403 from missing data-plane roles; one wrong AI answer caught by the docs.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/ai-explains-plans-and-errors-and-when-it-is-wron/` (reuses `code/ai-terraform-prompts/02-explain-plan.md`); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 14.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 14.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-247 AI writes tests and refactors modules with moved blocks (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 14 AI-Powered Terraform · lesson 14.4, after 14.3 · [new, proposed: AI]
- Learning objectives: Have AI write terraform test cases and keep only those that catch a broken rule; Have AI refactor a module into for_each with moved blocks; Prove the refactor plans with no destroy
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: AI adds tests to the S3 module (one useless test removed after the break-it check); AI refactors the owner's count-based IAM users into for_each with moved blocks; plan shows only moves.
- Lab ZIP / code: `courses/terraform/code/ai-terraform-prompts/04-write-tests.md` (ready, validated), `courses/terraform/code/terraform-test` (ready, validated), `courses/terraform/code/terraform-moved-removed` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (mocked tests, plan) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 12.2, 8.5 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 14.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-248 AI writes tests and refactors modules with moved blocks (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 14 AI-Powered Terraform · lesson 14.4, after 14.3 · [new, proposed: AI]
- Learning objectives: Have AI write terraform test cases and keep only those that catch a broken rule; Have AI refactor a module into for_each with moved blocks; Prove the refactor plans with no destroy
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The same on the storage module and a count-based resource-group set.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/ai-writes-tests-and-refactors-modules-with-moved/` (reuses `code/ai-terraform-prompts/04-write-tests.md`); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 12.2, 8.5 · Length guide: ~14 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 14.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-249 The Terraform MCP server: an agent that reads current docs (shared)
- Course / module / position: Terraform AWS + Azure (shared video) · Module 14 AI-Powered Terraform · lesson 14.5, after 14.4 · [new, proposed: AI] · one video for both courses
- Learning objectives: Connect an AI agent to the Terraform MCP server; Let it look up current provider and module docs; Keep its permissions read-only
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The registry toolset in Claude Code or VS Code (Docker image hashicorp/terraform-mcp-server:1.4.1), the same question asked with and without MCP; HCP Terraform tools with a read-only token; destructive tools left off.
- Lab ZIP / code: `courses/terraform/code/terraform-mcp-server`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none (local, random, terraform_data providers) · Cost per run: $0 (cloud-neutral demo, runs locally) · Cleanup: `terraform destroy` (local files only); nothing in any cloud
- Depends on: 14.1 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in both curricula › 14.5 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-250 AI review of a pull request's plan in GitHub Actions (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 14 AI-Powered Terraform · lesson 14.6, after 14.5 · [new, proposed: AI]
- Learning objectives: Add an AI review job that comments risks, cost and blast radius; Keep secrets out of what the AI sees; Keep the human approval as the gate
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The lesson 13.1 pipeline plus a review job: terraform show -json summarised, sent to a model with the review prompt, posted as a PR comment; a destroy of a bucket flagged HIGH RISK; a person still approves.
- Lab ZIP / code: `courses/terraform/code/ai-terraform-prompts/03-review-pr-plan.md` (ready, validated), `courses/terraform/code/terraform-with-github-action` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: ~$0.10 (model calls) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 13.1, 14.3 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 14.6 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-251 AI review of a pull request's plan in GitHub Actions (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 14 AI-Powered Terraform · lesson 14.6, after 14.5 · [new, proposed: AI]
- Learning objectives: Add an AI review job that comments risks, cost and blast radius; Keep secrets out of what the AI sees; Keep the human approval as the gate
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The same on the Azure pipeline; a storage account replacement flagged HIGH RISK.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/ai-review-of-a-pull-request-s-plan-in-github-act/` (reuses `code/ai-terraform-prompts/03-review-pr-plan.md`); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: ~$0.10 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 13.1, 14.3 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 14.6 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-252 An AI-generated module through the full gate (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 14 AI-Powered Terraform · lesson 14.7, after 14.6 · [new, proposed: AI]
- Learning objectives: Run AI output through fmt, TFLint, tests, Checkov and a reviewed plan; Fix what fails; Decide when to reject AI output
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: AI writes a CloudFront + S3 site module; the gate catches a public bucket and a missing test; fixed, then applied and destroyed.
- Lab ZIP / code: `courses/terraform/code/terraform-policy-checkov` (ready, validated), `courses/terraform/code/terraform-test` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: S3, CloudFront (optional apply) · Cost per run: ~$0 (free tiers) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 12.2, 12.3, 14.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 14.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-253 An AI-generated module through the full gate (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 14 AI-Powered Terraform · lesson 14.7, after 14.6 · [new, proposed: AI]
- Learning objectives: Run AI output through fmt, TFLint, tests, Checkov and a reviewed plan; Fix what fails; Decide when to reject AI output
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: AI writes a Static Web App + storage module; the gate catches shared keys enabled; fixed, applied, destroyed.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/an-ai-generated-module-through-the-full-gate/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Static Web App Free, storage account · Cost per run: ~$0 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 12.2, 12.3, 14.2 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 14.7 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-254 AI platform foundations as code: model access, identities and logging (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 15 Terraform for AI infrastructure · lesson 15.1, after 14.7 · [new, proposed: AI]
- Learning objectives: Provision the AI platform's identities and least-privilege access; Turn on invocation logging; Tag and budget AI resources
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: An IAM role that may invoke only chosen Bedrock models, model invocation logging to CloudWatch Logs and S3, a budget alert on Bedrock usage.
- Lab ZIP / code: GEN builds `courses/terraform/code/ai-platform-foundations-as-code-model-access-ide/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: IAM role, Bedrock invocation logging, CloudWatch log group · Cost per run: ~$0 (nothing runs by the hour) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 14.7 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 15.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-255 AI platform foundations as code: model access, identities and logging (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 15 Terraform for AI infrastructure · lesson 15.1, after 14.7 · [new, proposed: AI]
- Learning objectives: Provision the AI platform's identities and least-privilege access; Turn on invocation logging; Tag and budget AI resources
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A Foundry resource (AIServices, project_management_enabled) and project, local auth off, Entra roles (Cognitive Services OpenAI User), diagnostic settings to Log Analytics.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/ai-platform-foundations-as-code-model-access-ide/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Foundry resource and project, Log Analytics workspace · Cost per run: ~$0 (Log Analytics ingestion cents) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 14.7 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 15.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-256 A RAG stack as code (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 15 Terraform for AI infrastructure · lesson 15.2, after 15.1 · [new, proposed: AI]
- Learning objectives: Build documents storage, embeddings and a vector index as code; Connect a knowledge base to it; Ask a grounded question and see the cited source
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: S3 documents → Bedrock Knowledge Base (Titan Text Embeddings v2) → S3 Vectors index; ingestion job; retrieve-and-generate answer citing the runbook. Validated with provider 6.74.0.
- Lab ZIP / code: `courses/terraform/code/terraform-bedrock-knowledge-base` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: S3, S3 Vectors bucket and index, Bedrock Knowledge Base and data source, IAM role · Cost per run: < $0.50 per run (no OpenSearch Serverless) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 15.1 · Length guide: ~18 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Links the AI masterclasses' RAG module: there students use RAG, here they build its platform.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 15.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-257 A RAG stack as code (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 15 Terraform for AI infrastructure · lesson 15.2, after 15.1 · [new, proposed: AI]
- Learning objectives: Build documents storage, embeddings and a vector index as code; Connect a knowledge base to it; Ask a grounded question and see the cited source
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Lesson code: Foundry chat + embedding deployments, Azure AI Search Free tier, private Storage, Entra roles; import-and-vectorize; the playground answer citing the runbook.
- Lab ZIP / code: `courses/terraform/code/azure/terraform-foundry-ai-search` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Foundry resource, deployments, AI Search Free, storage account · Cost per run: < $0.50 per run (Search Free tier) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 15.1 · Length guide: ~18 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Links the AI masterclasses' RAG module: there students use RAG, here they build its platform.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 15.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-258 Guardrails as code (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 15 Terraform for AI infrastructure · lesson 15.3, after 15.2 · [new, proposed: AI]
- Learning objectives: Define content and PII filters as code; Deny topics with examples; Test the guardrail before an app uses it
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: aws_bedrock_guardrail with PII (block access keys, anonymise emails) and a denied topic (destructive commands); versioned with aws_bedrock_guardrail_version; tested in the console.
- Lab ZIP / code: `courses/terraform/code/terraform-bedrock-knowledge-base (guardrail)` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Bedrock Guardrail and version · Cost per run: ~$0.05 (guardrail checks) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 15.2 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 15.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-259 Guardrails as code (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 15 Terraform for AI infrastructure · lesson 15.3, after 15.2 · [new, proposed: AI]
- Learning objectives: Define content and PII filters as code; Deny topics with examples; Test the guardrail before an app uses it
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: An azurerm_cognitive_account_rai_policy (content filters) attached to the deployment and a blocklist; tested in the Foundry playground.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/guardrails-as-code/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: RAI policy, blocklist · Cost per run: ~$0.05 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 15.2 · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 15.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-260 Agents as code (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 15 Terraform for AI infrastructure · lesson 15.4, after 15.3 · [new, proposed: AI]
- Learning objectives: Provision an agent runtime and its identity as code; Limit its tools and permissions; Estimate and cap its cost
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: aws_bedrockagentcore_agent_runtime (container in ECR) with an execution role allowed one tool, an endpoint, invocation from the CLI; cost estimated before recording.
- Lab ZIP / code: GEN builds `courses/terraform/code/agents-as-code/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: AgentCore runtime and endpoint, ECR repo, IAM role · Cost per run: Estimate before recording (pay per use) and log it in CLOUD_BUDGET.md · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 15.3 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Fast-moving services: check resource names and pricing on the recording day.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 15.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-261 Agents as code (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 15 Terraform for AI infrastructure · lesson 15.4, after 15.3 · [new, proposed: AI]
- Learning objectives: Provision an agent runtime and its identity as code; Limit its tools and permissions; Estimate and cap its cost
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A Foundry project agent (azapi or azurerm where available) with the AI Search tool from 15.2, a managed identity, invocation from the CLI or SDK.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/agents-as-code/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Foundry project agent, managed identity · Cost per run: Estimate before recording (pay per use) and log it in CLOUD_BUDGET.md · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 15.3 · Length guide: ~15 min · Priority: P2 · Owner: GEN · Status: requested
- Notes: Fast-moving services: check resource names and pricing on the recording day.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 15.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-262 A managed Kubernetes control plane module (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 16 Kubernetes with Terraform · lesson 16.1, after 15.4 · [owner original]
- Learning objectives: Create a cluster in the module 11 network; Configure logging and endpoint access; Connect kubectl
- Slides: owner's deck: slides 560–561 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/eks-control-plane`, `aws-terraform/base-code/eks-with-vpc`
- Live demonstration: The owner's eks-control-plane module (slide 561) on the 11.1 VPC, current EKS version, endpoint access, control plane logs; aws eks update-kubeconfig.
- Lab ZIP / code: GEN builds `courses/terraform/code/a-managed-kubernetes-control-plane-module/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EKS cluster · Cost per run: ~$0.10/hour control plane + nodes (~$1–2 per two-hour session); estimate, log, destroy right after · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 11.1 · Length guide: ~15 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 16.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-263 A managed Kubernetes control plane module (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 16 Kubernetes with Terraform · lesson 16.1, after 15.4 · [owner original]
- Learning objectives: Create a cluster in the module 11 network; Configure logging and endpoint access; Connect kubectl
- Slides: owner's deck: slides 560–561 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/aks-controle-plane`, `azure-terraform/aks-all-in-one`
- Live demonstration: The owner's aks-controle-plane module: AKS with Entra ID integration, a system node pool, az aks get-credentials.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/a-managed-kubernetes-control-plane-module/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: AKS cluster (free tier control plane) · Cost per run: $0 control plane (Free tier) + nodes (~$0.50–1 per two-hour session); estimate, log, destroy right after · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 11.1 · Length guide: ~15 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 16.1 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-264 Node groups: simple, blue-green and spot (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 16 Kubernetes with Terraform · lesson 16.2, after 16.1 · [owner original]
- Learning objectives: Add node groups in private subnets; Do a blue-green node upgrade with the owner's green/blue variables; Use spot capacity safely
- Slides: owner's deck: slides 562–563 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/eks-node-group`, `aws-terraform/eks-blue-green-node-group`, `aws-terraform/base-code/eks-blue-green-node`
- Live demonstration: The owner's node group modules: simple group, blue-green switch with var.green / desired sizes (slides 384, 563), spot instances.
- Lab ZIP / code: GEN builds `courses/terraform/code/node-groups-simple-blue-green-and-spot/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EKS managed node groups (t3.medium) · Cost per run: ~$0.10/hour per small node; destroy right after · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 16.1 · Length guide: ~15 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 16.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-265 Node groups: simple, blue-green and spot (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 16 Kubernetes with Terraform · lesson 16.2, after 16.1 · [owner original]
- Learning objectives: Add node groups in private subnets; Do a blue-green node upgrade with the owner's green/blue variables; Use spot capacity safely
- Slides: owner's deck: slides 562–563 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/aks-linux-node-group`, `azure-terraform/aks-linux-spot-node-group`, `azure-terraform/aks-windows-node-group`
- Live demonstration: The owner's node pool modules: Linux user pool, spot pool with eviction policy, Windows pool explained; blue-green pool swap.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/node-groups-simple-blue-green-and-spot/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: AKS node pools (B2s) · Cost per run: ~$0.05/hour per B2s node; destroy right after · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 16.1 · Length guide: ~15 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 16.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-266 Serverless and mixed capacity (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 16 Kubernetes with Terraform · lesson 16.3, after 16.2 · [owner original]
- Learning objectives: Run pods without managing nodes; Mix serverless and node capacity; Know the limits
- Slides: owner's deck: slides 564–565 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/eks-fargate-only`, `aws-terraform/eks-and-fargate`, `aws-terraform/aws-fargate-profile`, `aws-terraform/base-code/eks-mix`
- Live demonstration: The owner's Fargate-only and EKS-plus-Fargate modules: kube-system on Fargate, a namespace profile, CoreDNS patch.
- Lab ZIP / code: GEN builds `courses/terraform/code/serverless-and-mixed-capacity/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EKS Fargate profiles · Cost per run: counted in the cluster session (16.1) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 16.2 · Length guide: ~12 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 16.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-267 Serverless and mixed capacity (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 16 Kubernetes with Terraform · lesson 16.3, after 16.2 · [owner original]
- Learning objectives: Run pods without managing nodes; Mix serverless and node capacity; Know the limits
- Slides: owner's deck: slides 564–565 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/new`
- Live demonstration: AKS virtual nodes (ACI) or node auto-provisioning explained and deployed on a test namespace.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/serverless-and-mixed-capacity/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: AKS virtual nodes / ACI · Cost per run: counted in the cluster session (16.1) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 16.2 · Length guide: ~12 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 16.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-268 Cluster access: identities and RBAC (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 16 Kubernetes with Terraform · lesson 16.4, after 16.3 · [owner original, updated]
- Learning objectives: Grant users and roles cluster access as code; Map them to Kubernetes RBAC; Remove access cleanly
- Slides: owner's deck: slides 566, 572–573 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/aws-auth-config`, `aws-terraform/rbac`
- Live demonstration: EKS access entries and access policies (aws_eks_access_entry) replace the owner's aws-auth ConfigMap module; RBAC roles for IAM users and IAM roles (slides 572–573).
- Lab ZIP / code: GEN builds `courses/terraform/code/cluster-access-identities-and-rbac/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: EKS access entries · Cost per run: counted in the cluster session (16.1) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 16.3 · Length guide: ~12 min · Priority: P3 · Owner: GEN · Status: requested
- Notes: Outdated: the aws-auth ConfigMap is deprecated in favour of EKS access entries.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 16.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-269 Cluster access: identities and RBAC (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 16 Kubernetes with Terraform · lesson 16.4, after 16.3 · [owner original, updated]
- Learning objectives: Grant users and roles cluster access as code; Map them to Kubernetes RBAC; Remove access cleanly
- Slides: owner's deck: slides 566, 572–573 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/aks-auth-config`
- Live demonstration: The owner's aks-auth-config: Entra ID groups, Azure RBAC for Kubernetes, a namespace-scoped role.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/cluster-access-identities-and-rbac/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: AKS role assignments · Cost per run: counted in the cluster session (16.1) · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 16.3 · Length guide: ~12 min · Priority: P3 · Owner: GEN · Status: requested
- Notes: Outdated: the aws-auth ConfigMap is deprecated in favour of EKS access entries.
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 16.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-270 Cluster add-ons with Terraform and Helm (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 16 Kubernetes with Terraform · lesson 16.5, after 16.4 · [owner original]
- Learning objectives: Install add-ons with the Helm provider and IRSA/Pod Identity or workload identity; Create namespaces with loops; Clean up load balancers before destroying the cluster
- Slides: owner's deck: slides 567–571 (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/eks-namespaces`, `aws-terraform/cluster-auto-scaler`, `aws-terraform/aws-load-balancer-controller`, `aws-terraform/aws-ebs-csi-driver`, `aws-terraform/external-dns`, `aws-terraform/metrics-server`, `aws-terraform/argo-cd-*`
- Live demonstration: The owner's add-on modules: namespaces, cluster autoscaler, AWS Load Balancer Controller, EBS CSI driver, External DNS, Argo CD; Pod Identity as the current alternative to IRSA.
- Lab ZIP / code: GEN builds `courses/terraform/code/cluster-add-ons-with-terraform-and-helm/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Add-ons, a load balancer (delete before cluster) · Cost per run: a full EKS lab is about $1–2 for two hours; destroy right after · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 16.4 · Length guide: ~18 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 16.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-271 Cluster add-ons with Terraform and Helm (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 16 Kubernetes with Terraform · lesson 16.5, after 16.4 · [owner original]
- Learning objectives: Install add-ons with the Helm provider and IRSA/Pod Identity or workload identity; Create namespaces with loops; Clean up load balancers before destroying the cluster
- Slides: owner's deck: slides 567–571 (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/azure-aks-name-space`, `azure-terraform/nginx-ingress`, `azure-terraform/cert-manager`, `azure-terraform/external-dns`
- Live demonstration: The owner's AKS modules: namespaces, NGINX ingress, cert-manager, External DNS with workload identity.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/cluster-add-ons-with-terraform-and-helm/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: Add-ons, a load balancer and public IP · Cost per run: a full AKS lab is about $0.50–1 for two hours; destroy right after · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 16.4 · Length guide: ~18 min · Priority: P3 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 16.5 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-272 Capstone design: environments, state, modules and pipeline (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 17 Capstone: an enterprise platform · lesson 17.1, after 16.5 · [new, proposed]
- Learning objectives: Read the capstone requirements; Draw the folder, state and pipeline design; Estimate the cost before building
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: dev and prod (two accounts or two prefixes), S3 state with use_lockfile per environment, modules network/app/data, GitHub Actions with OIDC; cost table.
- Lab ZIP / code: the capstone requirements and design PDF (no Terraform yet); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 (design) · Cleanup: nothing is created
- Depends on: all core modules · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 17.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-273 Capstone design: environments, state, modules and pipeline (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 17 Capstone: an enterprise platform · lesson 17.1, after 16.5 · [new, proposed]
- Learning objectives: Read the capstone requirements; Draw the folder, state and pipeline design; Estimate the cost before building
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: dev and prod (two subscriptions or resource-group sets), Storage state per environment, the same modules on Azure, workload identity pipeline; cost table.
- Lab ZIP / code: the capstone requirements and design PDF (no Terraform yet); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- Depends on: all core modules · Length guide: ~10 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 17.1 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-274 Build the modules and environments (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 17 Capstone: an enterprise platform · lesson 17.2, after 17.1 · [new, proposed]
- Learning objectives: Assemble the owner's modules into the capstone; Deploy dev; Prove it with tests and a reviewed plan
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: `aws-terraform/modules/vpc-03`, `aws-terraform/sg`, `aws-terraform/ec2`, `aws-terraform/postgres-db`
- Live demonstration: Network (no NAT, or one for the demo), an ALB in front of a small ASG or ECS Fargate service, RDS PostgreSQL with write-only password; dev applied.
- Lab ZIP / code: GEN builds `courses/terraform/code/build-the-modules-and-environments/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VPC, ALB, ASG t3.micro (or ECS Fargate), RDS db.t4g.micro · Cost per run: ~$0.50 per two-hour session (ALB and RDS by the hour); destroy the same day · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 10.5, 11.4, 8.2 · Length guide: ~20 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 17.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-275 Build the modules and environments (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 17 Capstone: an enterprise platform · lesson 17.2, after 17.1 · [new, proposed]
- Learning objectives: Assemble the owner's modules into the capstone; Deploy dev; Prove it with tests and a reviewed plan
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: `azure-terraform/modules/vnet`, `azure-terraform/virtual-machine`, `azure-terraform/azure-mysql`
- Live demonstration: VNet, Container Apps (consumption) or App Service B1, PostgreSQL Flexible B1ms with write-only password; dev applied.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/build-the-modules-and-environments/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: VNet, Container Apps environment, PostgreSQL Flexible B1ms · Cost per run: ~$0.40 per two-hour session; destroy the same day · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 10.5, 11.4, 8.2 · Length guide: ~20 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 17.2 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-276 The pipeline: OIDC, tests, policy, AI review and approval (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 17 Capstone: an enterprise platform · lesson 17.3, after 17.2 · [new, proposed]
- Learning objectives: Run fmt, TFLint, tests and Checkov in the pipeline; Add the AI review comment; Promote dev to prod through approvals
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The 13.1 pipeline extended per environment: PR → checks → plan → AI review → merge → dev apply → prod approval → prod apply.
- Lab ZIP / code: `courses/terraform/code/terraform-with-github-action` (ready, validated), `courses/terraform/code/ai-terraform-prompts` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: ~$0.20 (model calls; infra cost counted in 17.2) · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 13.1, 14.6, 12.2, 12.3 · Length guide: ~18 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 17.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-277 The pipeline: OIDC, tests, policy, AI review and approval (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 17 Capstone: an enterprise platform · lesson 17.3, after 17.2 · [new, proposed]
- Learning objectives: Run fmt, TFLint, tests and Checkov in the pipeline; Add the AI review comment; Promote dev to prod through approvals
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The same on the Azure pipeline with workload identity per environment.
- Lab ZIP / code: `courses/terraform/code/azure/terraform-with-github-action` (ready, validated); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: ~$0.20 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 13.1, 14.6, 12.2, 12.3 · Length guide: ~18 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 17.3 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-278 Operate it: drift, promotion and destroy (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 17 Capstone: an enterprise platform · lesson 17.4, after 17.3 · [new, proposed]
- Learning objectives: Detect drift with plan -refresh-only and a scheduled pipeline; Promote a module version to prod; Destroy everything and prove it is gone
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: A console change detected by the nightly drift job; a module tag promoted to prod; destroy prod then dev, state buckets last; a tag search shows nothing left.
- Lab ZIP / code: GEN builds `courses/terraform/code/operate-it-drift-promotion-and-destroy/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: counted in 17.2 · Cleanup: `terraform destroy`, then check nothing is left (Resource Groups Tag Editor, tag `Course=terraform-aws-masterclass`; the README lists the exact check)
- Depends on: 17.3 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 17.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-279 Operate it: drift, promotion and destroy (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 17 Capstone: an enterprise platform · lesson 17.4, after 17.3 · [new, proposed]
- Learning objectives: Detect drift with plan -refresh-only and a scheduled pipeline; Promote a module version to prod; Destroy everything and prove it is gone
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: The same with a portal change, a module tag promotion, destroy, and a Resource Graph query that shows nothing left.
- Lab ZIP / code: GEN builds `courses/terraform/code/azure/operate-it-drift-promotion-and-destroy/`; README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: counted in 17.2 · Cleanup: `terraform destroy`, then check nothing is left (Azure Resource Graph on tag `Course=terraform-azure-masterclass`, `az group list`; purge soft-deleted Key Vaults/AI accounts)
- Depends on: 17.3 · Length guide: ~12 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 4 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 17.4 ("Question N of 4 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-280 Course wrap-up, final assessment and what to learn next (AWS)
- Course / module / position: AI-Powered Terraform on AWS · Module 17 Capstone: an enterprise platform · lesson 17.5, after 17.4 · [new, proposed]
- Learning objectives: Review the skills gained; Take the final assessment; Choose the next course
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Recap of the AWS path; final assessment (20 questions); next: the AI for DevOps on AWS masterclass (its AI apps run on the infrastructure built here), n8n automation, and the Azure Terraform masterclass for multi-cloud.
- Lab ZIP / code: no lab (wrap-up; final assessment JSON); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- Depends on: 17.4 · Length guide: ~6 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in `courses/terraform/TERRAFORM_AWS_CURRICULUM.md` › 17.5 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")

#### CR-281 Course wrap-up, final assessment and what to learn next (Azure)
- Course / module / position: AI-Powered Terraform on Azure · Module 17 Capstone: an enterprise platform · lesson 17.5, after 17.4 · [new, proposed]
- Learning objectives: Review the skills gained; Take the final assessment; Choose the next course
- Slides: owner's deck: none in the deck (new lesson) (PDF next to the PPTX, course standard) · Owner's repo: — (none in the owner's repo)
- Live demonstration: Recap of the Azure path; final assessment; next: the AI for DevOps on Azure masterclass, n8n automation, and the AWS Terraform masterclass for multi-cloud.
- Lab ZIP / code: no lab (wrap-up; final assessment JSON); README with requirements, cost, steps, cleanup; `.tfvars.example` only
- Cloud resources: none or free resources only · Cost per run: $0 · Cleanup: nothing is created
- Depends on: 17.4 · Length guide: ~6 min · Priority: P2 · Owner: GEN · Status: requested
- Quiz: 3 spoken questions with answers in `courses/terraform/TERRAFORM_AZURE_CURRICULUM.md` › 17.5 ("Question N of 3 … A: …; B: …; or C: …?" / "The answer is X: …")
