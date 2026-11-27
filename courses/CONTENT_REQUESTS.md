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

## Register

| Id | Course | Module / lesson | Request | Owner | Opened | Priority | Status | Delivered at | Upload |
|---|---|---|---|---|---|---|---|---|---|
| CR-001 | AI-Powered DevOps Automation with n8n | Module 1, first lesson | Course introduction / overview video | GEN | 2026-11-27 | P1 | generated | `00-n0-n8n-course-intro` (3 min 32 s, captions, PDF) | review + staging next |
| CR-002 | n8n | Module 1 · lesson 01 | Lab ZIP promised in the closing line | GEN | 2026-11-26 | P2 | ready-for-review | `01-n1-…/01-n1-n8n-mattermost-explained-lab.zip` | scanned 2026-11-27 (clean); upload on next sync |
| CR-003 | n8n | Lessons 01–03 | Quiz options read aloud so the 12 questions can be imported | GEN | 2026-11-26 | P2 | in-progress | same folders (re-recorded quiz scenes) | — |
| CR-004 | n8n | Module 3 (with notifications) | GitHub pull request notifications (signed webhooks) | GEN | 2026-11-27 | P1 | generated (no lab ZIP yet) | `09-n7-n8n-github-pr-live` (16 min, captions, PDF) | waiting for the lab |
| CR-005 | n8n | Module 3 | AWS automation (CloudWatch, S3, SQS) — proposed by GEN | GEN | 2026-11-27 | P2 | generated (no lab ZIP yet) | `11-n11-n8n-aws-automation-live` (18 min, captions, PDF) | waiting for the lab |
| CR-006 | n8n | Module 4 (AI) | AI pull request review assistant | GEN | 2026-11-27 | P1 | requested | — | — |
| CR-007 | n8n | Module 4 (AI) | AI agents in n8n (AI Agent node, tools, guardrails, human approval) | GEN | 2026-11-27 | P1 | in-progress | `19-n19-n8n-ai-agent-live` | — |
| CR-008 | n8n | Module 4 (AI) | AI incident triage and root-cause suggestions | GEN | 2026-11-27 | P1 | requested | — | — |
| CR-009 | n8n | Module 4 (AI) | AI in CI/CD (explain failed pipelines, suggest fixes; never auto-deploy) | GEN | 2026-11-27 | P1 | requested | — | — |
| CR-010 | n8n | Module 3 or 4 | Intelligent alerting (grouping, noise reduction, rules first, AI second) | GEN | 2026-11-27 | P2 | requested | — | — |
| CR-011 | n8n | Module 3 | Slack integration | GEN | 2026-11-27 | P2 | blocked: needs the owner's Slack webhook | — | — |
| CR-012 | n8n | End of each module | Module assessment (8–10 multiple-choice questions over the module, answers + explanations) | GEN | 2026-11-27 | P2 | requested | `18-automation-n8n/assessments/module-<n>.json` | — |
| CR-013 | n8n | Last lesson | Final course assessment (20 questions across the course) and a short conclusion video (recap, what to build next, certificate) | GEN | 2026-11-27 | P2 | requested | `assessments/final.json` + `99-conclusion…/` | — |

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
