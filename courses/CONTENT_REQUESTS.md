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

## Register

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
| CR-018 | AI for DevOps on AWS and on Azure (changed 2026-11-27: not in the free intro, which stays concise) | Module 2 'The vocabulary of AI models', after 'Prompts, tokens…' | Prompt engineering for DevOps (4 lessons) | GEN | 2026-11-27 | P1 | accepted | — | — |
| CR-019 | AI for DevOps on AWS and on Azure (optional, end of Module 1; changed 2026-11-27); VS Code reuses the CLI parts | Masterclass Module 1, last | AI tools tour: ChatGPT and Claude, Claude Code and Codex CLI, Ollama (3 lessons) | GEN | 2026-11-27 | P2 | accepted | — | — |
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
