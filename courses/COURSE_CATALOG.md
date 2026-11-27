# Course catalog: AI for DevOps

The DevOps Easy Learning catalogue (owner brief 2026-11-27). Source of truth for titles, prices and curricula; each
course's `courses/<slug>/plan.json` holds the page copy and the lessons that exist now. Standards: `docs/COURSE_STANDARD.md`
(design, naming, page copy, hands-on lessons), QA: `courses/QA_CHECKLIST.md`, upload workflow: the publisher skill
(`.claude/skills/del-course-publisher/SKILL.md`), covers: the night-blueprint catalog family in `apps/api/src/covers`
(rule 17): each plan sets `cover` to its template key (`blueprint-aws`, `blueprint-azure`, `blueprint-ai`,
`blueprint-vscode`, `blueprint-n8n`), independent of the category. No separate COURSE_DESIGN_STANDARDS / QUALITY_ASSURANCE / COURSE_UPLOAD_WORKFLOW files: those
would duplicate the three above.

## Titles and prices

| Course | Slug | Price | Category | Level |
|---|---|---:|---|---|
| AI for DevOps on AWS: From Fundamentals to Production | `ai-for-devops-aws` | $99.99 (paid enrolment only after the owner approves) | cloud-ai | intermediate |
| AI for DevOps on Azure: From Fundamentals to Production | `ai-for-devops-azure` | $99.99 (same) | cloud-ai | intermediate |
| Introduction to Artificial Intelligence for DevOps | `intro-ai-for-devops` | Free | ai-foundations | beginner |
| Visual Studio Code Masterclass for DevOps and AI | `vscode-masterclass` | Free | developer-tools | beginner |
| AI-Powered DevOps Automation with n8n | `n8n-automation` | $29.99 now, $49.99 after the AI lessons | automation-n8n | intermediate |

**Titles:** the owner's titles are kept. They already lead with AI and DevOps, are under 60 characters, and the two
cloud courses share one pattern (`AI for DevOps on <cloud>: From Fundamentals to Production`) that reads as a series.
**Naming convention** for future courses: `docs/COURSE_STANDARD.md` §3b.

**Production needs these categories** (production has only `automation-n8n`): `cloud-ai` (Cloud AI (AWS & Azure), icon
cloud), `ai-foundations` (AI Foundations, sparkles), `developer-tools` (Developer Tools, code; created on staging
2026-11-27). Create them in Super Admin before the first production sync.

## Service names (checked 2026-11-27, re-check at recording)
- AWS: Amazon Bedrock; **Amazon Bedrock AgentCore** for agents (Bedrock Agents is now 'Agents Classic', closed to new
  customers since 2026-07-30); Bedrock Knowledge Bases and Guardrails unchanged; Amazon SageMaker AI; **Kiro** is the
  successor of Amazon Q Developer (IDE plugins end of support announced).
- Azure: **Microsoft Foundry** (formerly Azure AI Foundry), Foundry Agent Service, Azure OpenAI in Foundry Models,
  Azure AI Search, Azure Machine Learning. Two existing videos still say "Azure AI Foundry"; their summaries note the rename (owner declined re-recording, CR-033).

## Shared videos
Each video is uploaded once per environment (`courses/media.<env>.json`) and attached to each course's own lesson;
each course keeps its own lessons, quizzes, progress, access and certificate. Playback is authorised per lesson and course,
so a shared video never opens a paid course. Purging a course keeps media another course still uses.

| Video | Used in |
|---|---|
| `01-before-ai/01-computers-before-ai` How computers solved problems before AI | Intro, AWS, Azure |
| `01-before-ai/02-devops-before-ai` Fix a 3 a.m. outage the classic way | Intro, AWS, Azure |
| `01-before-ai/04-what-is-machine-learning` What machine learning is: a spam filter, step by step | Intro, AWS, Azure |
| `02-ai-foundations/01-tm1-big-words` AI, machine learning, deep learning and generative AI | Intro, AWS, Azure |
| `02-ai-foundations/03-tm3-model-words` Models: parameters, training, inference and model cards | Intro, AWS, Azure |
| `02-ai-foundations/04-tm4-talking-to-a-model` Prompts, tokens, context windows and temperature | Intro, AWS, Azure |
| `02-ai-foundations/05-tm5-answer-quality` Hallucinations, grounding and judging AI answers | Intro, AWS, Azure |
| `02-ai-foundations/07-tm7-embeddings-vectors` Embeddings and vectors: matching meaning, not words | Intro, AWS, Azure |
| `02-ai-foundations/10-tm10-agent-words` AI agents: tools, the agent loop, memory and guardrails | Intro, AWS, Azure |
| `04-by-hand-vs-ai/01-devops-with-ai` The same outage, fixed with an AI helper on Amazon Bedrock | Intro, AWS, Azure |
| `05-agents-rag-ideas/19-agent-vs-chatbot` AI chatbot versus AI agent, side by side | Intro, AWS, Azure |
| `20-mcp/01-m1-what-is-mcp` What MCP is and why every platform adopted it | Intro, AWS, Azure |
| `01-before-ai/03-short-history-of-ai` A short history of AI, from rules to agents | AWS, Azure |
| `02-ai-foundations/02-tm2-practice-architecture-application` DevOps, MLOps, LLMOps, RAG and agentic AI, sorted | AWS, Azure |
| `02-ai-foundations/06-tm6-rag-words-preparing` Preparing knowledge for RAG: parsing, chunks and indexing | AWS, Azure |
| `02-ai-foundations/08-tm8-rag-search-answer` RAG search: keyword, vector, hybrid and reranking | AWS, Azure |
| `02-ai-foundations/09-tm9-where-data-lives` Where RAG data lives: object storage and vector databases | AWS, Azure |
| `02-ai-foundations/11-tm11-running-models` Running models: GPUs, VRAM, quantisation and licences | AWS, Azure |
| `02-ai-foundations/12-tm12-operating-securing` Operating and securing AI in production | AWS, Azure |
| `05-agents-rag-ideas/20-s1-skill-based-agents` Skill-based agents: one job, clear limits | AWS, Azure |
| `05-agents-rag-ideas/21-r10-kagent-explained` AI agents inside Kubernetes with kagent | AWS, Azure |
| `07-building-rag/20-r7-one-architecture-three-implementations` One RAG architecture, three implementations | AWS, Azure |
| `08-ai-production/19-r1-llmops-day-to-day` LLMOps day to day: what you manage once an AI app is live | AWS, Azure |
| `08-ai-production/20-r6-who-builds-who-runs` Who builds a RAG system, and who runs it | AWS, Azure |
| `08-ai-production/21-r8-managed-or-self-hosted` Managed AI or self-hosted: Bedrock, Foundry or Ollama | AWS, Azure |
| `16-cloud-labs/06-rag-stack-live` Run a production-style RAG chatbot with Docker Compose | AWS, Azure |
| `16-cloud-labs/09-k8s-doctor-live` An AI agent that fixes Kubernetes workloads | AWS, Azure |
| `16-cloud-labs/10-s2-docker-skill-agents-live` Three skill agents fix 502s, crash loops and full disks | AWS, Azure |
| `17-cloud-ai/03-choosing-ai-service` Choosing the right AI service on AWS or Azure | AWS, Azure |
| `18-automation-n8n/06-n6-n8n-deploy-notifications-live` Deployment notifications from CI with n8n | AWS, Azure |
| `18-automation-n8n/12-n12-n8n-incident-management-live` Incident management with n8n: severity, escalation, resolution | AWS, Azure |
| `18-automation-n8n/17-n17-n8n-ai-assisted-live` AI summaries in n8n workflows, safely | AWS, Azure |
| `19-ai-cicd/01-ci1-ai-in-cicd` Where AI fits in a CI/CD pipeline | AWS, Azure |
| `20-mcp/02-m2-inside-mcp` Inside MCP: tools, resources, prompts and transports | AWS, Azure |
| `20-mcp/03-m3-first-mcp-server-live` Build your first MCP server and connect real agents | AWS, Azure |

Selected n8n lessons in both masterclasses, in one module 'Automate it with n8n': 06 deployment notifications from CI, 12 incident management, 17 AI summaries (available); 09 GitHub PR notifications (CR-004), AI agents in n8n (CR-007) and AI PR review with n8n (CR-006) when delivered. The n8n course itself is never copied in.

## AI for DevOps on AWS: From Fundamentals to Production

Self-contained (owner 2026-11-27): it teaches the complete AI foundations itself, so a student who skips the free course misses nothing, then goes deep on AWS with hands-on builds. Selected n8n lessons sit in one module, 'Automate it with n8n'.

Available now: **40 videos, 5.0 h**. Planned additions are marked with their request id.

- **1 · AI foundations for DevOps**
   - How computers solved problems before AI — available (`01-before-ai/01-computers-before-ai`, 4 min)
   - A short history of AI, from rules to agents — available (`01-before-ai/03-short-history-of-ai`, 4 min)
   - What machine learning is: a spam filter, step by step — available (`01-before-ai/04-what-is-machine-learning`, 4 min)
   - AI, machine learning, deep learning and generative AI — available (`02-ai-foundations/01-tm1-big-words`, 6 min)
   - DevOps, MLOps, LLMOps, RAG and agentic AI, sorted — available (`02-ai-foundations/02-tm2-practice-architecture-application`, 5 min)
   - *planned: CR-015 course introduction (first lesson, free preview)*
   - *planned: CR-019 AI tools tour: chat assistants, Claude Code, Codex CLI, Ollama (optional)*
- **2 · The vocabulary of AI models**
   - Models: parameters, training, inference and model cards — available (`02-ai-foundations/03-tm3-model-words`, 5 min)
   - Prompts, tokens, context windows and temperature — available (`02-ai-foundations/04-tm4-talking-to-a-model`, 5 min)
   - Hallucinations, grounding and judging AI answers — available (`02-ai-foundations/05-tm5-answer-quality`, 4 min)
   - Running models: GPUs, VRAM, quantisation and licences — available (`02-ai-foundations/11-tm11-running-models`, 4 min)
   - *planned: CR-018 prompt engineering for DevOps (after 'Prompts, tokens…')*
- **3 · The AWS AI services**
   - The AWS AI services map — available (`17-cloud-ai/01-aws-ai-services-map`, 8 min)
   - Choosing the right AI service on AWS or Azure — available (`17-cloud-ai/03-choosing-ai-service`, 7 min)
   - Amazon Bedrock explained — available (`17-cloud-ai/04-amazon-bedrock-explained`, 8 min) · free preview
   - *planned: CR-021 Amazon SageMaker AI for DevOps engineers*
   - *planned: CR-022 Kiro (formerly Amazon Q Developer) for DevOps*
- **4 · Getting started with Amazon Bedrock**
   - Build an AI chatbot on Amazon Bedrock, the DevOps way — available (`16-cloud-labs/04-bedrock-chatbot-live`, 11 min) · free preview
   - Publish an AI assistant's help site on Amazon S3 — available (`16-cloud-labs/02-s3-help-site-live`, 7 min)
   - *planned: CR-023 Amazon Bedrock from code: SDK, Converse API and model comparison*
- **5 · AI applications on AWS: a real outage**
   - Fix a 3 a.m. outage the classic way — available (`01-before-ai/02-devops-before-ai`, 9 min)
   - The same outage, fixed with an AI helper on Amazon Bedrock — available (`04-by-hand-vs-ai/01-devops-with-ai`, 13 min)
   - *planned: CR-024 build and deploy an AI-powered web app on AWS*
- **6 · Retrieval-Augmented Generation (RAG)**
   - Preparing knowledge for RAG: parsing, chunks and indexing — available (`02-ai-foundations/06-tm6-rag-words-preparing`, 5 min)
   - Embeddings and vectors: matching meaning, not words — available (`02-ai-foundations/07-tm7-embeddings-vectors`, 4 min)
   - RAG search: keyword, vector, hybrid and reranking — available (`02-ai-foundations/08-tm8-rag-search-answer`, 5 min)
   - Where RAG data lives: object storage and vector databases — available (`02-ai-foundations/09-tm9-where-data-lives`, 4 min)
   - One RAG architecture, three implementations — available (`07-building-rag/20-r7-one-architecture-three-implementations`, 4 min)
   - Run a production-style RAG chatbot with Docker Compose — available (`16-cloud-labs/06-rag-stack-live`, 11 min)
   - Build a RAG system on AWS with Bedrock Knowledge Bases — available (`16-cloud-labs/08-aws-rag-live`, 9 min)
- **7 · AI agents for DevOps**
   - AI agents: tools, the agent loop, memory and guardrails — available (`02-ai-foundations/10-tm10-agent-words`, 4 min)
   - AI chatbot versus AI agent, side by side — available (`05-agents-rag-ideas/19-agent-vs-chatbot`, 19 min)
   - Skill-based agents: one job, clear limits — available (`05-agents-rag-ideas/20-s1-skill-based-agents`, 5 min)
   - Three skill agents fix 502s, crash loops and full disks — available (`16-cloud-labs/10-s2-docker-skill-agents-live`, 6 min)
   - An AI agent that fixes Kubernetes workloads — available (`16-cloud-labs/09-k8s-doctor-live`, 8 min)
   - AI agents inside Kubernetes with kagent — available (`05-agents-rag-ideas/21-r10-kagent-explained`, 4 min)
   - *planned: CR-025 a DevOps agent with Amazon Bedrock AgentCore*
   - *planned: CR-048 multi-agent collaboration with human approval on AWS*
- **8 · AI in CI/CD and operations**
   - Where AI fits in a CI/CD pipeline — available (`19-ai-cicd/01-ci1-ai-in-cicd`, 8 min)
   - *planned: CR-026 AI pull request review in GitHub Actions with Amazon Bedrock*
- **9 · Automate it with n8n**
   - Deployment notifications from CI with n8n — available (`18-automation-n8n/06-n6-n8n-deploy-notifications-live`, 15 min)
   - Incident management with n8n: severity, escalation, resolution — available (`18-automation-n8n/12-n12-n8n-incident-management-live`, 17 min)
   - AI summaries in n8n workflows, safely — available (`18-automation-n8n/17-n17-n8n-ai-assisted-live`, 16 min)
   - *planned: CR-004 GitHub pull request notifications with n8n (lesson 09 of the n8n course)*
   - *planned: CR-007 AI agents in n8n*
   - *planned: CR-006 AI pull request review with n8n (needs the owner's GitHub token)*
- **10 · Model Context Protocol (MCP)**
   - What MCP is and why every platform adopted it — available (`20-mcp/01-m1-what-is-mcp`, 9 min)
   - Inside MCP: tools, resources, prompts and transports — available (`20-mcp/02-m2-inside-mcp`, 9 min)
   - Build your first MCP server and connect real agents — available (`20-mcp/03-m3-first-mcp-server-live`, 20 min)
   - *planned: CR-027 MCP with AWS: connect agents to AWS services safely*
- **11 · Security, reliability and cost**
   - Operating and securing AI in production — available (`02-ai-foundations/12-tm12-operating-securing`, 5 min)
   - LLMOps day to day: what you manage once an AI app is live — available (`08-ai-production/19-r1-llmops-day-to-day`, 4 min)
   - Who builds a RAG system, and who runs it — available (`08-ai-production/20-r6-who-builds-who-runs`, 4 min)
   - Managed AI or self-hosted: Bedrock, Foundry or Ollama — available (`08-ai-production/21-r8-managed-or-self-hosted`, 4 min)
   - *planned: CR-029 Bedrock Guardrails, monitoring and cost control*
- *planned: **New module 'Ship AI to production on AWS'** (before Security): CR-028 Terraform, containers, EKS/ECS, GitHub Actions, Argo CD, secrets*
- *planned: **New module 'Capstone projects'** (last): CR-030 capstones and final assessment*
- *planned: CR-047 module assessments · CR-031 spoken quiz options · CR-032 promised labs*

## AI for DevOps on Azure: From Fundamentals to Production

Self-contained (owner 2026-11-27): the complete AI foundations first, then Microsoft Foundry, RAG on Azure, agents and MCP, with selected n8n lessons in one module. The outage lesson is shown with Amazon Bedrock; its summary says so.

Available now: **40 videos, 5.2 h**. Planned additions are marked with their request id.

- **1 · AI foundations for DevOps**
   - How computers solved problems before AI — available (`01-before-ai/01-computers-before-ai`, 4 min)
   - A short history of AI, from rules to agents — available (`01-before-ai/03-short-history-of-ai`, 4 min)
   - What machine learning is: a spam filter, step by step — available (`01-before-ai/04-what-is-machine-learning`, 4 min)
   - AI, machine learning, deep learning and generative AI — available (`02-ai-foundations/01-tm1-big-words`, 6 min)
   - DevOps, MLOps, LLMOps, RAG and agentic AI, sorted — available (`02-ai-foundations/02-tm2-practice-architecture-application`, 5 min)
   - *planned: CR-016 course introduction (first lesson, free preview)*
   - *planned: CR-019 AI tools tour: chat assistants, Claude Code, Codex CLI, Ollama (optional)*
- **2 · The vocabulary of AI models**
   - Models: parameters, training, inference and model cards — available (`02-ai-foundations/03-tm3-model-words`, 5 min)
   - Prompts, tokens, context windows and temperature — available (`02-ai-foundations/04-tm4-talking-to-a-model`, 5 min)
   - Hallucinations, grounding and judging AI answers — available (`02-ai-foundations/05-tm5-answer-quality`, 4 min)
   - Running models: GPUs, VRAM, quantisation and licences — available (`02-ai-foundations/11-tm11-running-models`, 4 min)
   - *planned: CR-018 prompt engineering for DevOps (after 'Prompts, tokens…')*
- **3 · The Azure AI services**
   - The Azure AI services map — available (`17-cloud-ai/02-azure-ai-services-map`, 8 min)
   - Choosing the right AI service on AWS or Azure — available (`17-cloud-ai/03-choosing-ai-service`, 7 min)
   - Microsoft Foundry explained — available (`17-cloud-ai/11-azure-ai-foundry-explained`, 5 min) · free preview
   - *planned: CR-040 Azure Machine Learning and Document Intelligence for DevOps*
- **4 · Getting started with Microsoft Foundry**
   - Deploy your first model in Microsoft Foundry — available (`16-cloud-labs/03-azure-foundry-model-live`, 16 min)
   - *planned: CR-034 Azure OpenAI in Foundry Models from code: SDK and model comparison*
- **5 · AI applications on Azure**
   - Deploy a full-stack AI chat app on Microsoft Foundry — available (`16-cloud-labs/05-foundry-chat-live`, 11 min) · free preview
   - Fix a 3 a.m. outage the classic way — available (`01-before-ai/02-devops-before-ai`, 9 min)
   - The same outage, fixed with an AI helper on Amazon Bedrock — available (`04-by-hand-vs-ai/01-devops-with-ai`, 13 min)
- **6 · Retrieval-Augmented Generation (RAG)**
   - Preparing knowledge for RAG: parsing, chunks and indexing — available (`02-ai-foundations/06-tm6-rag-words-preparing`, 5 min)
   - Embeddings and vectors: matching meaning, not words — available (`02-ai-foundations/07-tm7-embeddings-vectors`, 4 min)
   - RAG search: keyword, vector, hybrid and reranking — available (`02-ai-foundations/08-tm8-rag-search-answer`, 5 min)
   - Where RAG data lives: object storage and vector databases — available (`02-ai-foundations/09-tm9-where-data-lives`, 4 min)
   - One RAG architecture, three implementations — available (`07-building-rag/20-r7-one-architecture-three-implementations`, 4 min)
   - Run a production-style RAG chatbot with Docker Compose — available (`16-cloud-labs/06-rag-stack-live`, 11 min)
   - Build a RAG system on Azure with Terraform — available (`16-cloud-labs/07-azure-rag-live`, 10 min)
- **7 · AI agents for DevOps**
   - AI agents: tools, the agent loop, memory and guardrails — available (`02-ai-foundations/10-tm10-agent-words`, 4 min)
   - AI chatbot versus AI agent, side by side — available (`05-agents-rag-ideas/19-agent-vs-chatbot`, 19 min)
   - Skill-based agents: one job, clear limits — available (`05-agents-rag-ideas/20-s1-skill-based-agents`, 5 min)
   - Three skill agents fix 502s, crash loops and full disks — available (`16-cloud-labs/10-s2-docker-skill-agents-live`, 6 min)
   - An AI agent that fixes Kubernetes workloads — available (`16-cloud-labs/09-k8s-doctor-live`, 8 min)
   - AI agents inside Kubernetes with kagent — available (`05-agents-rag-ideas/21-r10-kagent-explained`, 4 min)
   - *planned: CR-035 a DevOps agent with Foundry Agent Service*
   - *planned: CR-049 multi-agent collaboration with human approval on Azure*
- **8 · AI in CI/CD and operations**
   - Where AI fits in a CI/CD pipeline — available (`19-ai-cicd/01-ci1-ai-in-cicd`, 8 min)
   - *planned: CR-036 AI pull request review with Foundry in GitHub Actions and Azure DevOps*
- **9 · Automate it with n8n**
   - Deployment notifications from CI with n8n — available (`18-automation-n8n/06-n6-n8n-deploy-notifications-live`, 15 min)
   - Incident management with n8n: severity, escalation, resolution — available (`18-automation-n8n/12-n12-n8n-incident-management-live`, 17 min)
   - AI summaries in n8n workflows, safely — available (`18-automation-n8n/17-n17-n8n-ai-assisted-live`, 16 min)
   - *planned: CR-004 GitHub pull request notifications with n8n (lesson 09 of the n8n course)*
   - *planned: CR-007 AI agents in n8n*
   - *planned: CR-006 AI pull request review with n8n (needs the owner's GitHub token)*
- **10 · Model Context Protocol (MCP)**
   - What MCP is and why every platform adopted it — available (`20-mcp/01-m1-what-is-mcp`, 9 min)
   - Inside MCP: tools, resources, prompts and transports — available (`20-mcp/02-m2-inside-mcp`, 9 min)
   - Build your first MCP server and connect real agents — available (`20-mcp/03-m3-first-mcp-server-live`, 20 min)
   - *planned: CR-037 MCP with Azure: connect agents to Azure safely*
- **11 · Security, reliability and cost**
   - Operating and securing AI in production — available (`02-ai-foundations/12-tm12-operating-securing`, 5 min)
   - LLMOps day to day: what you manage once an AI app is live — available (`08-ai-production/19-r1-llmops-day-to-day`, 4 min)
   - Who builds a RAG system, and who runs it — available (`08-ai-production/20-r6-who-builds-who-runs`, 4 min)
   - Managed AI or self-hosted: Bedrock, Foundry or Ollama — available (`08-ai-production/21-r8-managed-or-self-hosted`, 4 min)
   - *planned: CR-039 content safety, identity and cost on Azure*
- *planned: **New module 'Ship AI to production on Azure'** (before Security): CR-038 Terraform, Container Apps, AKS, GitHub Actions or Azure Pipelines, Argo CD, Key Vault*
- *planned: **New module 'Capstone projects'** (last): CR-041 capstones and final assessment*
- *planned: CR-047 module assessments · CR-031 spoken quiz options · CR-032 promised labs*

## Introduction to Artificial Intelligence for DevOps

The free gateway (owner 2026-11-27): about 90 minutes, twelve videos chosen for their hooks and live demos, the essential words, and a last lesson that introduces both masterclasses with direct links. The advanced lessons it used to hold now live only in the masterclasses.

Available now: **12 videos, 1.4 h**, plus 1 text lesson. Planned additions are marked with their request id.

- **1 · What AI is, and what it changes for DevOps**
   - How computers solved problems before AI — available (`01-before-ai/01-computers-before-ai`, 4 min) · free preview
   - What machine learning is: a spam filter, step by step — available (`01-before-ai/04-what-is-machine-learning`, 4 min)
   - AI, machine learning, deep learning and generative AI — available (`02-ai-foundations/01-tm1-big-words`, 6 min)
   - Fix a 3 a.m. outage the classic way — available (`01-before-ai/02-devops-before-ai`, 9 min)
   - The same outage, fixed with an AI helper on Amazon Bedrock — available (`04-by-hand-vs-ai/01-devops-with-ai`, 13 min) · free preview
   - *planned: CR-014 course introduction (first lesson, free preview)*
- **2 · The essential vocabulary**
   - Models: parameters, training, inference and model cards — available (`02-ai-foundations/03-tm3-model-words`, 5 min)
   - Prompts, tokens, context windows and temperature — available (`02-ai-foundations/04-tm4-talking-to-a-model`, 5 min)
   - Hallucinations, grounding and judging AI answers — available (`02-ai-foundations/05-tm5-answer-quality`, 4 min)
   - Embeddings and vectors: matching meaning, not words — available (`02-ai-foundations/07-tm7-embeddings-vectors`, 4 min)
- **3 · AI agents and MCP**
   - AI agents: tools, the agent loop, memory and guardrails — available (`02-ai-foundations/10-tm10-agent-words`, 4 min)
   - AI chatbot versus AI agent, side by side — available (`05-agents-rag-ideas/19-agent-vs-chatbot`, 19 min)
   - What MCP is and why every platform adopted it — available (`20-mcp/01-m1-what-is-mcp`, 9 min)
- **4 · Your next step**
   - Your next step: the AI for DevOps masterclasses on AWS and Azure — text lesson (links resolve to the paid courses' public pages)
   - *planned: CR-020 final assessment (before the next-step lesson)*
- *planned: CR-031 spoken quiz options for the vocabulary lessons (their quizzes can't be imported yet)*

## Visual Studio Code Masterclass for DevOps and AI
Follows the 32-lesson curriculum the owner approved on 2026-11-26 (kept by GEN: `/home/tia/work/ai-videos/projects/ai-devops/docs/courses/vscode-masterclass.md`),
plus the AI-assisted development lessons from the 2026-11-27 brief. Available now: **6 lessons, 1.3 h**. GEN mapped CR-017 and
CR-042–CR-046 onto the approved lessons (2026-11-27, below; GEN's numbering).

- **0 · Start here**
   - 0.1 Why DevOps engineers live in VS Code — available (`22-vscode/01-vsc-01-why-vscode`) · free preview
   - 0.2 VS Code words — available (`22-vscode/02-vsc-02-vscode-words`)
   - *planned: CR-017 → `vsc-00-course-intro`, a new course introduction before 0.1*
- **1 · Install and set up**
   - *planned: 1.1 Install VS Code on Windows, macOS and Linux*
   - 1.2 Tour of the interface — available (`22-vscode/03-vsc-03-interface-tour`)
   - *planned: 1.3 Settings and scopes, 1.4 Workspaces*
- **2 · Speed: shortcuts and navigation**
   - *planned (CR-042): 2.1 The 20 shortcuts that save hours, 2.2 Navigate any repo fast, 2.3 Search and bulk editing, 2.4 Custom keybindings*
- **3 · The integrated terminal and tasks**
   - *planned: 3.1–3.2 (CR-042)*
- **4 · Extensions the right way**
   - *planned: 4.1–4.2 (CR-044)*
- **5 · Code quality**
   - *planned: 5.1–5.2 (CR-044)*
- **6 · Git and GitHub**
   - *planned: 6.1–6.4 (CR-044)*
- **7 · Containers and Kubernetes**
   - *planned: 7.1 Docker, 7.2 Kubernetes (CR-044), 7.3 Helm (available at GEN), 7.4 Dev Containers (CR-043)*
- **8 · Infrastructure as code**
   - *planned: 8.1 Terraform (CR-044)*
- **9 · Scripting and debugging**
   - *planned: 9.1–9.2 (CR-044)*
- **10 · Remote work**
   - *planned (CR-043): 10.1 Remote SSH to a cloud VM (AWS EC2 + Terraform; Azure VM variant optional), 10.2 Many servers: SSH config and jump hosts, 10.3 WSL*
- **11 · Cloud and AI**
   - *planned: 11.1 AWS, 11.2 Azure; 11.3 AI coding assistants in VS Code (CR-045), plus a new Codex CLI / AGENTS.md lesson in `21-claude-code` (CR-045)*
   - CLAUDE.md in depth — available (`21-claude-code/01-cc1-claude-md-in-depth`)
   - Write CLAUDE.md for a real repository — available (`21-claude-code/02-cc1-claude-md-live`) · free preview
   - The .claude folders — available (`21-claude-code/03-cc2-claude-folder-live`)
- **12 · Your setup and real workflows**
   - *planned (CR-046): 12.1 Snippets, profiles and Settings Sync, 12.2 Capstone: fix a broken release in one editor, final assessment JSON*
   - *planned: CR-047 module assessments*
