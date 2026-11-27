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
| `02-ai-foundations/01-tm1-big-words` AI, machine learning, deep learning and generative AI | AWS, Azure, Intro |
| `02-ai-foundations/04-tm4-talking-to-a-model` Prompts, tokens, context windows and temperature | AWS, Azure, Intro |
| `02-ai-foundations/05-tm5-answer-quality` Hallucinations, grounding and judging AI answers | AWS, Azure, Intro |
| `02-ai-foundations/06-tm6-rag-words-preparing` Preparing knowledge for RAG: parsing, chunks and indexing | AWS, Azure, Intro |
| `02-ai-foundations/07-tm7-embeddings-vectors` Embeddings and vectors: matching meaning, not words | AWS, Azure, Intro |
| `02-ai-foundations/08-tm8-rag-search-answer` RAG search: keyword, vector, hybrid and reranking | AWS, Azure, Intro |
| `02-ai-foundations/09-tm9-where-data-lives` Where RAG data lives: object storage and vector databases | AWS, Azure, Intro |
| `02-ai-foundations/10-tm10-agent-words` AI agents: tools, the agent loop, memory and guardrails | AWS, Azure, Intro |
| `02-ai-foundations/12-tm12-operating-securing` Operating and securing AI in production | AWS, Azure, Intro |
| `05-agents-rag-ideas/19-agent-vs-chatbot` AI chatbot versus AI agent, side by side | AWS, Azure, Intro |
| `05-agents-rag-ideas/20-s1-skill-based-agents` Skill-based agents: one job, clear limits | AWS, Azure, Intro |
| `08-ai-production/21-r8-managed-or-self-hosted` Managed AI or self-hosted: Bedrock, Foundry or Ollama | AWS, Azure, Intro |
| `17-cloud-ai/03-choosing-ai-service` Choosing the right AI service on AWS or Azure | AWS, Azure, Intro |
| `19-ai-cicd/01-ci1-ai-in-cicd` Where AI fits in a CI/CD pipeline | AWS, Azure, Intro |
| `20-mcp/01-m1-what-is-mcp` What MCP is and why every platform adopted it | AWS, Azure, Intro |
| `04-by-hand-vs-ai/01-devops-with-ai` The same outage, fixed with an AI helper on Amazon Bedrock | AWS, Intro |
| `05-agents-rag-ideas/21-r10-kagent-explained` AI agents inside Kubernetes with kagent | AWS, Azure |
| `07-building-rag/20-r7-one-architecture-three-implementations` One RAG architecture, three implementations | AWS, Azure |
| `08-ai-production/19-r1-llmops-day-to-day` LLMOps day to day: what you manage once an AI app is live | AWS, Azure |
| `08-ai-production/20-r6-who-builds-who-runs` Who builds a RAG system, and who runs it | AWS, Azure |
| `16-cloud-labs/06-rag-stack-live` Run a production-style RAG chatbot with Docker Compose | AWS, Azure |
| `16-cloud-labs/09-k8s-doctor-live` An AI agent that fixes Kubernetes workloads | AWS, Azure |
| `16-cloud-labs/10-s2-docker-skill-agents-live` Three skill agents fix 502s, crash loops and full disks | AWS, Azure |
| `18-automation-n8n/17-n17-n8n-ai-assisted-live` AI summaries in automation workflows, safely (n8n) | AWS, Azure |
| `20-mcp/02-m2-inside-mcp` Inside MCP: tools, resources, prompts and transports | AWS, Azure |
| `20-mcp/03-m3-first-mcp-server-live` Build your first MCP server and connect real agents | AWS, Azure |

Selected n8n lesson in both cloud courses: `18-automation-n8n/17-n17-n8n-ai-assisted-live` (AI summaries, safely).
When delivered, n8n CR-004 (GitHub PR notifications) is the second candidate. The n8n course itself is never copied in.

## AI for DevOps on AWS: From Fundamentals to Production
Available now: **31 lessons, 3.9 h**. Planned lessons in *italics* with their request id.

1. **AI foundations for DevOps**
   - AI, machine learning, deep learning and generative AI — available (`02-ai-foundations/01-tm1-big-words`)
   - Prompts, tokens, context windows and temperature — available (`02-ai-foundations/04-tm4-talking-to-a-model`)
   - Hallucinations, grounding and judging AI answers — available (`02-ai-foundations/05-tm5-answer-quality`)
   - AI agents: tools, the agent loop, memory and guardrails — available (`02-ai-foundations/10-tm10-agent-words`)
   - *planned: CR-015 Course introduction (first lesson)*
   - *planned: CR-018 Prompt engineering for DevOps (4 lessons, shared)*
2. **The AWS AI services**
   - The AWS AI services map — available (`17-cloud-ai/01-aws-ai-services-map`)
   - Choosing the right AI service on AWS or Azure — available (`17-cloud-ai/03-choosing-ai-service`)
   - Amazon Bedrock explained — available (`17-cloud-ai/04-amazon-bedrock-explained`) · free preview
   - *planned: CR-021 Amazon SageMaker AI for DevOps engineers*
   - *planned: CR-022 Kiro (formerly Amazon Q Developer) for DevOps*
3. **Getting started with Amazon Bedrock**
   - Publish an AI assistant's help site on Amazon S3 — available (`16-cloud-labs/02-s3-help-site-live`)
   - Build an AI chatbot on Amazon Bedrock, the DevOps way — available (`16-cloud-labs/04-bedrock-chatbot-live`) · free preview
   - *planned: CR-023 Bedrock from code: SDK, Converse API and model comparison*
4. **AI applications on AWS**
   - The same outage, fixed with an AI helper on Amazon Bedrock — available (`04-by-hand-vs-ai/01-devops-with-ai`)
   - *planned: CR-024 Build and deploy an AI-powered web app on AWS*
5. **Retrieval-Augmented Generation on AWS**
   - Preparing knowledge for RAG: parsing, chunks and indexing — available (`02-ai-foundations/06-tm6-rag-words-preparing`)
   - Embeddings and vectors: matching meaning, not words — available (`02-ai-foundations/07-tm7-embeddings-vectors`)
   - RAG search: keyword, vector, hybrid and reranking — available (`02-ai-foundations/08-tm8-rag-search-answer`)
   - Where RAG data lives: object storage and vector databases — available (`02-ai-foundations/09-tm9-where-data-lives`)
   - One RAG architecture, three implementations — available (`07-building-rag/20-r7-one-architecture-three-implementations`)
   - Run a production-style RAG chatbot with Docker Compose — available (`16-cloud-labs/06-rag-stack-live`)
   - Build a RAG system on AWS with Bedrock Knowledge Bases — available (`16-cloud-labs/08-aws-rag-live`)
6. **AI agents for DevOps**
   - AI chatbot versus AI agent, side by side — available (`05-agents-rag-ideas/19-agent-vs-chatbot`)
   - Skill-based agents: one job, clear limits — available (`05-agents-rag-ideas/20-s1-skill-based-agents`)
   - Three skill agents fix 502s, crash loops and full disks — available (`16-cloud-labs/10-s2-docker-skill-agents-live`)
   - An AI agent that fixes Kubernetes workloads — available (`16-cloud-labs/09-k8s-doctor-live`)
   - AI agents inside Kubernetes with kagent — available (`05-agents-rag-ideas/21-r10-kagent-explained`)
   - *planned: CR-025 A DevOps agent with Amazon Bedrock AgentCore*
7. **AI-powered DevOps automation**
   - Where AI fits in a CI/CD pipeline — available (`19-ai-cicd/01-ci1-ai-in-cicd`)
   - AI summaries in automation workflows, safely (n8n) — available (`18-automation-n8n/17-n17-n8n-ai-assisted-live`)
   - *planned: CR-026 AI pull request review in GitHub Actions with Bedrock*
   - *planned: n8n CR-004 GitHub PR notifications (when delivered)*
8. **Model Context Protocol (MCP)**
   - What MCP is and why every platform adopted it — available (`20-mcp/01-m1-what-is-mcp`)
   - Inside MCP: tools, resources, prompts and transports — available (`20-mcp/02-m2-inside-mcp`)
   - Build your first MCP server and connect real agents — available (`20-mcp/03-m3-first-mcp-server-live`)
   - *planned: CR-027 MCP with AWS*
9. **Security, reliability and cost**
   - Operating and securing AI in production — available (`02-ai-foundations/12-tm12-operating-securing`)
   - LLMOps day to day: what you manage once an AI app is live — available (`08-ai-production/19-r1-llmops-day-to-day`)
   - Who builds a RAG system, and who runs it — available (`08-ai-production/20-r6-who-builds-who-runs`)
   - Managed AI or self-hosted: Bedrock, Foundry or Ollama — available (`08-ai-production/21-r8-managed-or-self-hosted`)
   - *planned: CR-029 Bedrock Guardrails, monitoring and cost control*
- **Infrastructure and production deployment (new module)**
   - *planned: CR-028 Ship an AI application to production on AWS (2 lessons)*
- **Capstone projects (new module)**
   - *planned: CR-030 Capstones and final assessment*
   - *planned: CR-047 Module assessments*

## AI for DevOps on Azure: From Fundamentals to Production
Available now: **30 lessons, 3.8 h**. Planned lessons in *italics* with their request id.

1. **AI foundations for DevOps**
   - AI, machine learning, deep learning and generative AI — available (`02-ai-foundations/01-tm1-big-words`)
   - Prompts, tokens, context windows and temperature — available (`02-ai-foundations/04-tm4-talking-to-a-model`)
   - Hallucinations, grounding and judging AI answers — available (`02-ai-foundations/05-tm5-answer-quality`)
   - AI agents: tools, the agent loop, memory and guardrails — available (`02-ai-foundations/10-tm10-agent-words`)
   - *planned: CR-016 Course introduction (first lesson)*
   - *planned: CR-018 Prompt engineering for DevOps (4 lessons, shared)*
2. **The Azure AI services**
   - The Azure AI services map — available (`17-cloud-ai/02-azure-ai-services-map`)
   - Choosing the right AI service on AWS or Azure — available (`17-cloud-ai/03-choosing-ai-service`)
   - Microsoft Foundry explained — available (`17-cloud-ai/11-azure-ai-foundry-explained`) · free preview
   - *planned: CR-040 Azure Machine Learning and Document Intelligence*
3. **Getting started with Microsoft Foundry**
   - Deploy your first model in Microsoft Foundry — available (`16-cloud-labs/03-azure-foundry-model-live`)
   - *planned: CR-034 Azure OpenAI in Foundry Models from code*
4. **AI applications on Azure**
   - Deploy a full-stack AI chat app on Microsoft Foundry — available (`16-cloud-labs/05-foundry-chat-live`) · free preview
5. **Retrieval-Augmented Generation on Azure**
   - Preparing knowledge for RAG: parsing, chunks and indexing — available (`02-ai-foundations/06-tm6-rag-words-preparing`)
   - Embeddings and vectors: matching meaning, not words — available (`02-ai-foundations/07-tm7-embeddings-vectors`)
   - RAG search: keyword, vector, hybrid and reranking — available (`02-ai-foundations/08-tm8-rag-search-answer`)
   - Where RAG data lives: object storage and vector databases — available (`02-ai-foundations/09-tm9-where-data-lives`)
   - One RAG architecture, three implementations — available (`07-building-rag/20-r7-one-architecture-three-implementations`)
   - Run a production-style RAG chatbot with Docker Compose — available (`16-cloud-labs/06-rag-stack-live`)
   - Build a RAG system on Azure with Terraform — available (`16-cloud-labs/07-azure-rag-live`)
6. **AI agents for DevOps**
   - AI chatbot versus AI agent, side by side — available (`05-agents-rag-ideas/19-agent-vs-chatbot`)
   - Skill-based agents: one job, clear limits — available (`05-agents-rag-ideas/20-s1-skill-based-agents`)
   - Three skill agents fix 502s, crash loops and full disks — available (`16-cloud-labs/10-s2-docker-skill-agents-live`)
   - An AI agent that fixes Kubernetes workloads — available (`16-cloud-labs/09-k8s-doctor-live`)
   - AI agents inside Kubernetes with kagent — available (`05-agents-rag-ideas/21-r10-kagent-explained`)
   - *planned: CR-035 A DevOps agent with Foundry Agent Service*
7. **AI-powered DevOps automation**
   - Where AI fits in a CI/CD pipeline — available (`19-ai-cicd/01-ci1-ai-in-cicd`)
   - AI summaries in automation workflows, safely (n8n) — available (`18-automation-n8n/17-n17-n8n-ai-assisted-live`)
   - *planned: CR-036 AI PR review with Foundry in GitHub Actions and Azure DevOps*
8. **Model Context Protocol (MCP)**
   - What MCP is and why every platform adopted it — available (`20-mcp/01-m1-what-is-mcp`)
   - Inside MCP: tools, resources, prompts and transports — available (`20-mcp/02-m2-inside-mcp`)
   - Build your first MCP server and connect real agents — available (`20-mcp/03-m3-first-mcp-server-live`)
   - *planned: CR-037 MCP with Azure*
9. **Security, reliability and cost**
   - Operating and securing AI in production — available (`02-ai-foundations/12-tm12-operating-securing`)
   - LLMOps day to day: what you manage once an AI app is live — available (`08-ai-production/19-r1-llmops-day-to-day`)
   - Who builds a RAG system, and who runs it — available (`08-ai-production/20-r6-who-builds-who-runs`)
   - Managed AI or self-hosted: Bedrock, Foundry or Ollama — available (`08-ai-production/21-r8-managed-or-self-hosted`)
   - *planned: CR-039 Content safety, identity and cost on Azure*
- **Infrastructure and production deployment (new module)**
   - *planned: CR-038 Ship an AI application to production on Azure (2 lessons)*
- **Capstone projects (new module)**
   - *planned: CR-041 Capstones and final assessment*
   - *planned: CR-047 Module assessments*

## Introduction to Artificial Intelligence for DevOps
Available now: **23 lessons, 2.4 h**. Planned lessons in *italics* with their request id.

1. **What AI is, and what it changes for DevOps**
   - How computers solved problems before AI — available (`01-before-ai/01-computers-before-ai`) · free preview
   - A short history of AI, from rules to agents — available (`01-before-ai/03-short-history-of-ai`)
   - What machine learning is: a spam filter, step by step — available (`01-before-ai/04-what-is-machine-learning`)
   - AI, machine learning, deep learning and generative AI — available (`02-ai-foundations/01-tm1-big-words`)
   - Fix a 3 a.m. outage the classic way — available (`01-before-ai/02-devops-before-ai`)
   - The same outage, fixed with an AI helper on Amazon Bedrock — available (`04-by-hand-vs-ai/01-devops-with-ai`) · free preview
   - *planned: CR-014 Course introduction (first lesson)*
2. **The essential vocabulary**
   - DevOps, MLOps, LLMOps, RAG and agentic AI, sorted — available (`02-ai-foundations/02-tm2-practice-architecture-application`)
   - Models: parameters, training, inference and model cards — available (`02-ai-foundations/03-tm3-model-words`)
   - Prompts, tokens, context windows and temperature — available (`02-ai-foundations/04-tm4-talking-to-a-model`)
   - Hallucinations, grounding and judging AI answers — available (`02-ai-foundations/05-tm5-answer-quality`)
   - Preparing knowledge for RAG: parsing, chunks and indexing — available (`02-ai-foundations/06-tm6-rag-words-preparing`)
   - Embeddings and vectors: matching meaning, not words — available (`02-ai-foundations/07-tm7-embeddings-vectors`)
   - RAG search: keyword, vector, hybrid and reranking — available (`02-ai-foundations/08-tm8-rag-search-answer`)
   - Where RAG data lives: object storage and vector databases — available (`02-ai-foundations/09-tm9-where-data-lives`)
   - Running models: GPUs, VRAM, quantisation and licences — available (`02-ai-foundations/11-tm11-running-models`)
3. **AI agents and MCP**
   - AI agents: tools, the agent loop, memory and guardrails — available (`02-ai-foundations/10-tm10-agent-words`)
   - AI chatbot versus AI agent, side by side — available (`05-agents-rag-ideas/19-agent-vs-chatbot`)
   - Skill-based agents: one job, clear limits — available (`05-agents-rag-ideas/20-s1-skill-based-agents`)
   - What MCP is and why every platform adopted it — available (`20-mcp/01-m1-what-is-mcp`)
4. **AI in cloud computing and DevOps**
   - Choosing the right AI service on AWS or Azure — available (`17-cloud-ai/03-choosing-ai-service`)
   - Managed AI or self-hosted: Bedrock, Foundry or Ollama — available (`08-ai-production/21-r8-managed-or-self-hosted`)
   - Where AI fits in a CI/CD pipeline — available (`19-ai-cicd/01-ci1-ai-in-cicd`)
   - Operating and securing AI in production — available (`02-ai-foundations/12-tm12-operating-securing`)
- **Prompt engineering (new module)**
   - *planned: CR-018 Prompt engineering for DevOps (4 lessons)*
- **Practical AI tools (new module)**
   - *planned: CR-019 ChatGPT and Claude, Claude Code and Codex CLI, Ollama (3 lessons)*
- **Final assessment and next steps (new module)**
   - *planned: CR-020 Next steps and final assessment*
   - *planned: CR-047 Module assessments*

## Visual Studio Code Masterclass for DevOps and AI
Follows the 32-lesson curriculum the owner approved on 2026-11-26 (kept by GEN: `/home/tia/work/ai-videos/projects/ai-devops/docs/courses/vscode-masterclass.md`),
plus the AI-assisted development lessons from the 2026-11-27 brief. Available now: **6 lessons, 1.3 h**. GEN maps CR-017 and
CR-042–CR-046 onto the approved lessons (mapping pending).

- **0 · Start here**
   - 0.1 Why DevOps engineers live in VS Code — available (`22-vscode/01-vsc-01-why-vscode`) · free preview
   - 0.2 VS Code words — available (`22-vscode/02-vsc-02-vscode-words`)
   - *planned: CR-017 course introduction*
- **1 · Install and set up**
   - *planned: 1.1 Install VS Code on Windows, macOS and Linux*
   - 1.2 Tour of the interface — available (`22-vscode/03-vsc-03-interface-tour`)
   - *planned: 1.3 Settings and scopes, 1.4 Workspaces*
- **2 · Speed: shortcuts and navigation**
   - *planned: 2.1–2.4 (CR-042)*
- **3 · The integrated terminal and tasks**
   - *planned: 3.1–3.2 (CR-042)*
- **4 · Extensions the right way**
   - *planned: 4.1–4.2 (CR-044)*
- **5 · Code quality**
   - *planned: 5.1–5.2 (CR-044)*
- **6 · Git and GitHub**
   - *planned: 6.1–6.4 (CR-044)*
- **7 · Containers and Kubernetes**
   - *planned: 7.1–7.4 incl. Dev Containers (CR-043/CR-044)*
- **8 · Infrastructure as code**
   - *planned: 8.1 Terraform in VS Code (CR-044)*
- **9 · Scripting and debugging**
   - *planned: 9.1–9.2 (CR-044)*
- **10 · Remote work**
   - *planned: 10.1–10.3 Remote SSH, jump hosts, WSL (CR-043)*
- **11 · Cloud and AI**
   - *planned: 11.1 AWS, 11.2 Azure, 11.3 AI coding assistants (CR-045)*
   - CLAUDE.md in depth — available (`21-claude-code/01-cc1-claude-md-in-depth`)
   - Write CLAUDE.md for a real repository — available (`21-claude-code/02-cc1-claude-md-live`) · free preview
   - The .claude folders — available (`21-claude-code/03-cc2-claude-folder-live`)
- **12 · Your setup and real workflows**
   - *planned: 12.1 Snippets, profiles and Settings Sync, 12.2 Capstone (CR-046)*
   - *planned: CR-047 module assessments*
