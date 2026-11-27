# Quiz audit (2026-11-28)

Owner brief 2026-11-28: no fixed four questions; the count follows the lesson's duration and content (docs/COURSE_STANDARD.md §8a).
Method: every lesson in `courses/*/plan.json`; duration by ffprobe on the source video; questions = what the publisher imports today
(the in-video questions parsed from the captions, `parseQuiz` in `tools/mcp-server/src/publish.ts`); recommended range from the owner's table
(<5 min 3–5 · 5–10 5–8 · 10–20 8–12 · 20–30 10–15 · 30–45 15–20 · 45–60 20–25 · >60 25–30+). Gap = questions missing to reach the low end.

## Totals

| Course | Video lessons | Minutes | Questions today | Lessons without a quiz | Questions to add (min) | Module assessments | Final assessment |
|---|---:|---:|---:|---:|---:|---|---|
| AI for DevOps on AWS: From Fundamentals to Production | 48 | 428 | 89 | 26 | 166 | none | none |
| AI for DevOps on Azure: From Fundamentals to Production | 48 | 434 | 89 | 26 | 172 | none | none |
| Introduction to Artificial Intelligence for DevOps | 13 | 87 | 8 | 11 | 47 | none | none |
| AI-Powered DevOps Automation with n8n | 21 | 321 | 80 | 1 | 80 | none | none |
| Visual Studio Code Masterclass for DevOps and AI | 6 | 77 | 24 | 0 | 21 | none | none |
| **All courses** (shared lessons counted per course) | 136 | 1347 | 290 | 64 | 486 | none | none |

Findings:
- Every imported quiz has **3–5 questions** (almost always 4), whatever the length: a 30-minute lab gets the same four as a 5-minute explainer.
- **Lessons without any quiz**: mostly the earlier foundation videos (`01-before-ai`, `02-ai-foundations`, cloud labs) whose videos have no spoken quiz; the free intro has quizzes on only 2 of 13 lessons.
- Questions are good scenario questions but have **3 options and one short `why`**: no explanation per wrong option, no takeaway, no difficulty, topic or timestamp.
- **No course has module or final assessments yet** (standard §8a already asks for them).
- Answer check: an automatic word-overlap check between each answer and its explanation flagged many questions, but a manual read of a sample (n8n lesson 10, AWS RAG, VS Code) found the explanations paraphrase the right answer correctly; no wrong answer key found. The full re-check happens when GEN's `quiz.json` banks are validated by the publisher.

## Banks delivered since (GEN `quiz.json`)
| Course | Lessons with `quiz.json` | Questions | Publisher check |
|---|---:|---:|---|
| AI-Powered DevOps Automation with n8n | 21 of 21 video lessons (2026-11-28) | 239 (7–12 per lesson, all with explanations per option, takeaway, difficulty, type, topic, timestamp) | 0 errors; every count within the range for its video length |

The table below is the caption-only count before these banks (the baseline the brief asked for).

## Per lesson

### AI for DevOps on AWS: From Fundamentals to Production

| Module | Lesson | Min | Questions | Range | Add |
|---:|---|---:|---:|---|---:|
| 1 | How computers solved problems before AI | 3.6 | 0 | 3–5 | 3 |
| 1 | A short history of AI, from rules to agents | 4.3 | 0 | 3–5 | 3 |
| 1 | What machine learning is: a spam filter, step by step | 4.2 | 0 | 3–5 | 3 |
| 1 | AI, machine learning, deep learning and generative AI | 5.9 | 0 | 5–8 | 5 |
| 1 | DevOps, MLOps, LLMOps, RAG and agentic AI, sorted | 5.3 | 0 | 5–8 | 5 |
| 2 | Models: parameters, training, inference and model cards | 4.7 | 0 | 3–5 | 3 |
| 2 | Hallucinations, grounding and judging AI answers | 4.3 | 0 | 3–5 | 3 |
| 2 | Running models: GPUs, VRAM, quantisation and licences | 4.4 | 0 | 3–5 | 3 |
| 3 | Prompts, tokens, context windows and temperature | 4.6 | 0 | 3–5 | 3 |
| 3 | Agent instruction files in depth: how CLAUDE.md tells a coding agent your rules | 11.8 | 5 | 8–12 | 3 |
| 3 | Write instruction files for a coding agent, live | 13.6 | 4 | 8–12 | 4 |
| 3 | Set an AI coding agent's permissions and project settings | 17.7 | 4 | 8–12 | 4 |
| 4 | The AWS AI services map | 8.3 | 4 | 5–8 | 1 |
| 4 | Choosing the right AI service on AWS or Azure | 6.6 | 4 | 5–8 | 1 |
| 4 | Amazon Bedrock explained | 7.9 | 0 | 5–8 | 5 |
| 5 | Build an AI chatbot on Amazon Bedrock, the DevOps way | 11.5 | 4 | 8–12 | 4 |
| 6 | Fix a 3 a.m. outage the classic way | 9.2 | 0 | 5–8 | 5 |
| 6 | The same outage, fixed with an AI helper on Amazon Bedrock | 12.6 | 0 | 8–12 | 8 |
| 7 | Publish an AI assistant's help site on Amazon S3 | 6.9 | 0 | 5–8 | 5 |
| 8 | Preparing knowledge for RAG: parsing, chunks and indexing | 5.2 | 0 | 5–8 | 5 |
| 8 | Embeddings and vectors: matching meaning, not words | 4.1 | 0 | 3–5 | 3 |
| 8 | RAG search: keyword, vector, hybrid and reranking | 4.8 | 0 | 3–5 | 3 |
| 8 | Where RAG data lives: object storage and vector databases | 4.0 | 0 | 3–5 | 3 |
| 8 | One RAG architecture, three implementations | 4.1 | 0 | 3–5 | 3 |
| 8 | Run a production-style RAG chatbot with Docker Compose | 10.7 | 0 | 8–12 | 8 |
| 8 | Build a RAG system on AWS with Bedrock Knowledge Bases | 9.0 | 4 | 5–8 | 1 |
| 9 | AI agents: tools, the agent loop, memory and guardrails | 4.2 | 0 | 3–5 | 3 |
| 9 | AI chatbot versus AI agent, side by side | 19.0 | 4 | 8–12 | 4 |
| 9 | Skill-based agents: one job, clear limits | 4.6 | 0 | 3–5 | 3 |
| 9 | Three skill agents fix 502s, crash loops and full disks | 5.7 | 0 | 5–8 | 5 |
| 9 | An AI agent that fixes Kubernetes workloads | 8.4 | 4 | 5–8 | 1 |
| 9 | AI agents inside Kubernetes with kagent | 4.1 | 0 | 3–5 | 3 |
| 10 | Where AI fits in a CI/CD pipeline | 8.1 | 4 | 5–8 | 1 |
| 11 | Deployment notifications from CI with n8n | 15.3 | 4 | 8–12 | 4 |
| 11 | Send GitHub pull request updates to your team chat | 16.0 | 4 | 8–12 | 4 |
| 11 | Incident management with n8n: severity, escalation, resolution | 16.8 | 4 | 8–12 | 4 |
| 11 | Intelligent alerting: grouping, suppression and urgency scoring | 16.7 | 4 | 8–12 | 4 |
| 11 | AI summaries in n8n workflows, safely | 16.3 | 4 | 8–12 | 4 |
| 11 | AI incident triage: ranked hypotheses a human confirms | 16.3 | 4 | 8–12 | 4 |
| 11 | Build an AI ops agent in n8n with tools, memory and guardrails | 15.9 | 4 | 8–12 | 4 |
| 11 | AI in CI/CD: explain a failed pipeline and suggest the fix | 17.1 | 4 | 8–12 | 4 |
| 12 | What MCP is and why every platform adopted it | 8.7 | 4 | 5–8 | 1 |
| 12 | Inside MCP: tools, resources, prompts and transports | 8.9 | 4 | 5–8 | 1 |
| 12 | Build your first MCP server and connect real agents | 19.8 | 4 | 8–12 | 4 |
| 13 | LLMOps day to day: what you manage once an AI app is live | 3.6 | 4 | 3–5 | 0 |
| 13 | Who builds a RAG system, and who runs it | 4.2 | 0 | 3–5 | 3 |
| 13 | Managed AI or self-hosted: Bedrock, Foundry or Ollama | 3.7 | 0 | 3–5 | 3 |
| 13 | Operating and securing AI in production | 5.0 | 0 | 5–8 | 5 |

### AI for DevOps on Azure: From Fundamentals to Production

| Module | Lesson | Min | Questions | Range | Add |
|---:|---|---:|---:|---|---:|
| 1 | How computers solved problems before AI | 3.6 | 0 | 3–5 | 3 |
| 1 | A short history of AI, from rules to agents | 4.3 | 0 | 3–5 | 3 |
| 1 | What machine learning is: a spam filter, step by step | 4.2 | 0 | 3–5 | 3 |
| 1 | AI, machine learning, deep learning and generative AI | 5.9 | 0 | 5–8 | 5 |
| 1 | DevOps, MLOps, LLMOps, RAG and agentic AI, sorted | 5.3 | 0 | 5–8 | 5 |
| 2 | Models: parameters, training, inference and model cards | 4.7 | 0 | 3–5 | 3 |
| 2 | Hallucinations, grounding and judging AI answers | 4.3 | 0 | 3–5 | 3 |
| 2 | Running models: GPUs, VRAM, quantisation and licences | 4.4 | 0 | 3–5 | 3 |
| 3 | Prompts, tokens, context windows and temperature | 4.6 | 0 | 3–5 | 3 |
| 3 | Agent instruction files in depth: how CLAUDE.md tells a coding agent your rules | 11.8 | 5 | 8–12 | 3 |
| 3 | Write instruction files for a coding agent, live | 13.6 | 4 | 8–12 | 4 |
| 3 | Set an AI coding agent's permissions and project settings | 17.7 | 4 | 8–12 | 4 |
| 4 | The Azure AI services map | 7.7 | 4 | 5–8 | 1 |
| 4 | Choosing the right AI service on AWS or Azure | 6.6 | 4 | 5–8 | 1 |
| 4 | Microsoft Foundry explained | 5.4 | 0 | 5–8 | 5 |
| 5 | Deploy your first model in Microsoft Foundry | 15.9 | 0 | 8–12 | 8 |
| 6 | Fix a 3 a.m. outage the classic way | 9.2 | 0 | 5–8 | 5 |
| 6 | The same outage, fixed with an AI helper on Amazon Bedrock | 12.6 | 0 | 8–12 | 8 |
| 7 | Deploy a full-stack AI chat app on Microsoft Foundry | 10.7 | 4 | 8–12 | 4 |
| 8 | Preparing knowledge for RAG: parsing, chunks and indexing | 5.2 | 0 | 5–8 | 5 |
| 8 | Embeddings and vectors: matching meaning, not words | 4.1 | 0 | 3–5 | 3 |
| 8 | RAG search: keyword, vector, hybrid and reranking | 4.8 | 0 | 3–5 | 3 |
| 8 | Where RAG data lives: object storage and vector databases | 4.0 | 0 | 3–5 | 3 |
| 8 | One RAG architecture, three implementations | 4.1 | 0 | 3–5 | 3 |
| 8 | Run a production-style RAG chatbot with Docker Compose | 10.7 | 0 | 8–12 | 8 |
| 8 | Build a RAG system on Azure with Terraform | 10.1 | 4 | 8–12 | 4 |
| 9 | AI agents: tools, the agent loop, memory and guardrails | 4.2 | 0 | 3–5 | 3 |
| 9 | AI chatbot versus AI agent, side by side | 19.0 | 4 | 8–12 | 4 |
| 9 | Skill-based agents: one job, clear limits | 4.6 | 0 | 3–5 | 3 |
| 9 | Three skill agents fix 502s, crash loops and full disks | 5.7 | 0 | 5–8 | 5 |
| 9 | An AI agent that fixes Kubernetes workloads | 8.4 | 4 | 5–8 | 1 |
| 9 | AI agents inside Kubernetes with kagent | 4.1 | 0 | 3–5 | 3 |
| 10 | Where AI fits in a CI/CD pipeline | 8.1 | 4 | 5–8 | 1 |
| 11 | Deployment notifications from CI with n8n | 15.3 | 4 | 8–12 | 4 |
| 11 | Send GitHub pull request updates to your team chat | 16.0 | 4 | 8–12 | 4 |
| 11 | Incident management with n8n: severity, escalation, resolution | 16.8 | 4 | 8–12 | 4 |
| 11 | Intelligent alerting: grouping, suppression and urgency scoring | 16.7 | 4 | 8–12 | 4 |
| 11 | AI summaries in n8n workflows, safely | 16.3 | 4 | 8–12 | 4 |
| 11 | AI incident triage: ranked hypotheses a human confirms | 16.3 | 4 | 8–12 | 4 |
| 11 | Build an AI ops agent in n8n with tools, memory and guardrails | 15.9 | 4 | 8–12 | 4 |
| 11 | AI in CI/CD: explain a failed pipeline and suggest the fix | 17.1 | 4 | 8–12 | 4 |
| 12 | What MCP is and why every platform adopted it | 8.7 | 4 | 5–8 | 1 |
| 12 | Inside MCP: tools, resources, prompts and transports | 8.9 | 4 | 5–8 | 1 |
| 12 | Build your first MCP server and connect real agents | 19.8 | 4 | 8–12 | 4 |
| 13 | LLMOps day to day: what you manage once an AI app is live | 3.6 | 4 | 3–5 | 0 |
| 13 | Who builds a RAG system, and who runs it | 4.2 | 0 | 3–5 | 3 |
| 13 | Managed AI or self-hosted: Bedrock, Foundry or Ollama | 3.7 | 0 | 3–5 | 3 |
| 13 | Operating and securing AI in production | 5.0 | 0 | 5–8 | 5 |

### Introduction to Artificial Intelligence for DevOps

| Module | Lesson | Min | Questions | Range | Add |
|---:|---|---:|---:|---|---:|
| 1 | How computers solved problems before AI | 3.6 | 0 | 3–5 | 3 |
| 1 | What machine learning is: a spam filter, step by step | 4.2 | 0 | 3–5 | 3 |
| 1 | AI, machine learning, deep learning and generative AI | 5.9 | 0 | 5–8 | 5 |
| 1 | Fix a 3 a.m. outage the classic way | 9.2 | 0 | 5–8 | 5 |
| 1 | The same outage, fixed with an AI helper on Amazon Bedrock | 12.6 | 0 | 8–12 | 8 |
| 2 | Models: parameters, training, inference and model cards | 4.7 | 0 | 3–5 | 3 |
| 2 | Prompts, tokens, context windows and temperature | 4.6 | 0 | 3–5 | 3 |
| 2 | Hallucinations, grounding and judging AI answers | 4.3 | 0 | 3–5 | 3 |
| 2 | Embeddings and vectors: matching meaning, not words | 4.1 | 0 | 3–5 | 3 |
| 3 | AI agents: tools, the agent loop, memory and guardrails | 4.2 | 0 | 3–5 | 3 |
| 3 | AI chatbot versus AI agent, side by side | 19.0 | 4 | 8–12 | 4 |
| 3 | What MCP is and why every platform adopted it | 8.7 | 4 | 5–8 | 1 |
| 4 | Your next step in AI-powered DevOps | 1.6 | 0 | 3–5 | 3 |

### AI-Powered DevOps Automation with n8n

| Module | Lesson | Min | Questions | Range | Add |
|---:|---|---:|---:|---|---:|
| 1 | Welcome: what you'll build in this course | 3.6 | 0 | 3–5 | 3 |
| 1 | How n8n and Mattermost work together for DevOps | 7.9 | 4 | 5–8 | 1 |
| 1 | Deploy n8n and Mattermost with Docker Compose | 17.2 | 4 | 8–12 | 4 |
| 1 | Set up Mattermost channels and incoming webhooks | 18.6 | 4 | 8–12 | 4 |
| 1 | Tour n8n and build your first workflows | 19.1 | 4 | 8–12 | 4 |
| 1 | Run the lab on an AWS VM with Terraform | 15.9 | 4 | 8–12 | 4 |
| 2 | n8n vocabulary: workflows, triggers, nodes and executions | 11.1 | 4 | 8–12 | 4 |
| 2 | Send deployment notifications from your CI pipeline | 15.3 | 4 | 8–12 | 4 |
| 2 | Send GitHub pull request updates to your team chat | 16.0 | 4 | 8–12 | 4 |
| 2 | Handle failures with retries, fallbacks and debugging | 15.6 | 4 | 8–12 | 4 |
| 3 | Automation and ChatOps vocabulary | 12.3 | 4 | 8–12 | 4 |
| 3 | Alert on Kubernetes problems without the noise | 17.3 | 4 | 8–12 | 4 |
| 3 | Manage incidents: severity, escalation and resolution | 16.8 | 4 | 8–12 | 4 |
| 3 | Intelligent alerting: grouping, suppression and urgency scoring | 16.7 | 4 | 8–12 | 4 |
| 3 | Schedule a morning report for your team | 16.3 | 4 | 8–12 | 4 |
| 4 | Advanced patterns: signed webhooks, idempotency and more | 17.4 | 4 | 8–12 | 4 |
| 4 | Run n8n in production: Postgres, workers, backups, upgrades | 17.9 | 4 | 8–12 | 4 |
| 4 | Add AI summaries to your workflows, safely | 16.3 | 4 | 8–12 | 4 |
| 4 | AI incident triage: ranked hypotheses a human confirms | 16.3 | 4 | 8–12 | 4 |
| 4 | Build an AI ops agent in n8n with tools, memory and guardrails | 15.9 | 4 | 8–12 | 4 |
| 4 | AI in CI/CD: explain a failed pipeline and suggest the fix | 17.1 | 4 | 8–12 | 4 |

### Visual Studio Code Masterclass for DevOps and AI

| Module | Lesson | Min | Questions | Range | Add |
|---:|---|---:|---:|---|---:|
| 1 | Why VS Code is the DevOps engineer's editor | 8.0 | 3 | 5–8 | 2 |
| 1 | VS Code vocabulary: workspaces, extensions and Dev Containers | 11.1 | 4 | 8–12 | 4 |
| 2 | A complete tour of the VS Code interface | 14.3 | 4 | 8–12 | 4 |
| 3 | CLAUDE.md in depth: instructions for AI coding agents | 11.8 | 5 | 8–12 | 3 |
| 3 | Write CLAUDE.md for a real repository | 13.6 | 4 | 8–12 | 4 |
| 3 | The .claude folders: settings, permissions and deny rules | 17.7 | 4 | 8–12 | 4 |

## How this gets fixed
- GEN delivers a `quiz.json` bank per lesson (schema `courses/quiz.schema.json`), module and final assessments in the course's `assessments/` folder.
- The publisher prefers `quiz.json` over the captions, validates it (count vs duration, explanation per option, valid answer, no duplicates, timestamps inside the video) and replaces a lesson's quiz when the file changes, keeping the quiz lesson (and students' results).
- Status per lesson is tracked here: re-run the audit after each delivery.
