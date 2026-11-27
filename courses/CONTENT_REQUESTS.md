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
- Ask the owner before any single lab over ~$5 per run, any EKS/AKS cluster, or going past $100 in a month.
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
| CR-005 | n8n | Module 3 | AWS automation (CloudWatch, S3, SQS) — proposed by GEN | GEN | 2026-11-27 | P2 | in-progress (re-record + QA; early copy in Dropbox, ignore) | `11-n11-n8n-aws-automation-live` | hold until ready-for-review |
| CR-006 | n8n; also in both masterclasses' n8n module | Module 4 (AI) | AI pull request review assistant | GEN | 2026-11-27 | P1 | blocked: owner creates the GitHub token | — | — |
| CR-007 | n8n; also in both masterclasses' n8n module | Module 4 (AI) | AI agents in n8n (AI Agent node, tools, guardrails, human approval) | GEN | 2026-11-27 | P1 | completed (published 2026-11-28: n8n module 4 after AI summaries; both masterclasses' n8n module) | `19-n19-n8n-ai-agent-live` | — |
| CR-008 | n8n | Module 4 (AI) | AI incident triage and root-cause suggestions | GEN | 2026-11-27 | P1 | in-progress (written, build queued) | — | — |
| CR-009 | n8n | Module 4 (AI) | AI in CI/CD (explain failed pipelines, suggest fixes; never auto-deploy) | GEN | 2026-11-27 | P1 | in-progress (written, build queued) | — | — |
| CR-010 | n8n | Module 3 or 4 | Intelligent alerting (grouping, noise reduction, rules first, AI second) | GEN | 2026-11-27 | P2 | in-progress (written, build queued) | — | — |
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
| CR-051 | Introduction to AI for DevOps (last lesson) | — | Short video: "Your next step in AI-powered DevOps" (recommends the AWS and Azure masterclasses and the n8n course) | GEN | 2026-11-28 | P1 | accepted (after the n8n batch; CR-051 first) | `99-next-<course>/` in the course's source folder group | — |
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
questions. Budget: $100/month total; ask the owner before any lab over ~$5 per run or any EKS/AKS cluster.
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
