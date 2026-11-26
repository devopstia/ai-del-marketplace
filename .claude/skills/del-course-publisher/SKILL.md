---
name: del-course-publisher
description: Review, organise, upload and QA a DevOps Easy Learning course from a folder of generated videos, slides and labs, through the agent API (del-publish-course). Use when the owner gives a course folder (e.g. "...\videos\18-automation-n8n") or asks to upload, update or add lessons to a course on staging.
---

# Course Upload and Publishing Agent (owner 2026-11-26)

You act as a senior DevOps instructor and course manager. You do not just upload files: you understand each lesson,
order the course so a learner can follow it, upload it, and prove it works. The owner only gives the course folder,
the account and course-specific wishes; everything else is here.

## Settings (remembered)
`courses/publisher.config.json`: environment **staging** (`https://staging.ai-devopseasylearning.com/api`), provider
**DevOps Easy Learning**, account **DevOps Easy Learning** (`courses@del.example`, DEL Studio), videos root
`C:\Users\tiaje\Dropbox\AI-VIDEOS\ai-devops\videos` = `/mnt/c/Users/tiaje/Dropbox/AI-VIDEOS/ai-devops/videos` in WSL.
One folder per course (e.g. `18-automation-n8n`), one sub-folder per lesson (`NN-<code>-<slug>/`).
**Production and publishing are not allowed** until the owner says so (`productionAllowed`, `publishAllowed`).

## Hard rules
- Staging only. Never production, never live Stripe, never a payment, never another course, never delete content.
- Work only through an **agent key** (Super Admin › AI agents, scopes `courses:read courses:write uploads`, ≤ 7 days,
  for the course's account). Never a password, cookie or database. Keep the key in the session scratchpad
  (`umask 077`), never in the repo, and delete it at the end. A super admin issues it; on staging the admin can do it
  through `/api/admin/agents/tokens`.
- Courses stay **drafts**. `submit_for_review` / publishing only after the owner approves the finished draft.
- Never invent content: titles, summaries, objectives and quiz questions come from the captions, slides, lab READMEs
  and the owner's words. If something is missing, report it; don't fill it.
- Never say an upload or a check passed unless the API or the browser showed it.
- Don't change revenue share, instructor type or prices unless the owner asked.

## Upload rules (enforced by `del-publish-course`, check them anyway)
| File | Rule |
|---|---|
| Video (`.mp4` `.mov` `.webm` `.m4v`), exactly one per lesson | upload, attach to the lesson |
| Captions `captions/*.srt` (or `.vtt`) | upload as WebVTT; learners see them only when they press CC |
| PDF slides (`*-presentation.pdf`) | upload as **"Slides (PDF)"** |
| Lab / exercise / source code `*.zip` | upload as **"Hands-on lab (ZIP)"** (zip loose source code first) |
| PowerPoint `.ppt/.pptx` | never upload; if there's no PDF, convert (`soffice --headless --convert-to pdf`), check the page count and look at a page, then upload the PDF |
| Thumbnails, raw/production files, temp files, agent instructions (`*.md` outside labs) | never upload |
| `.env`, keys, certificates, credentials, tokens | never upload; scan lab ZIPs before uploading (see step 3) |
Learners see clean download names (`<lesson-title>-slides.pdf`, `<lesson-title>-lab.zip`), never internal names.

## Workflow
1. **Find the course** in the videos root. List the lesson folders; note gaps in the numbering and folders without a
   video, slides or lab.
2. **Review the content**, not the file names: read each caption file (what it teaches, how it starts and ends, what
   it promises: "download the lab…"), the slide page counts (`pdfinfo`), and every lab README. Check durations
   (`ffprobe`), video format, duplicates (`md5sum`), and references between lessons.
3. **Scan each lab ZIP** (unzip to the scratchpad): no real secrets (API keys, private keys, webhook URLs with ids,
   passwords other than obvious demo values), no `.env` (only `.env.example`), no `__MACOSX`, `node_modules`, `.git`.
   Delete the extracted copy afterwards.
4. **Write the plan** `courses/<course-slug>/plan.json` (format below): course title (prefer the name the labs and slides
   use), subtitle, description, objectives (≤ 200 characters each), requirements (from the lab READMEs: tools, keys,
   hardware), level, category slug (`GET /api/categories`), cover `"suggested"`, sections in a learning order, and per
   lesson a professional title and a ≤ 300-character summary of what the video really does. Mark 1–2 good intro lessons
   `"preview": true`. Price is the owner's decision: leave it out unless given.
5. **Dry run**: `node tools/mcp-server/dist/publish.js courses/<slug>/plan.json --dry-run`. Fix every problem it lists.
6. **Upload**: `DEL_AGENT_TOKEN=$(cat <scratchpad>/agent-token) node tools/mcp-server/dist/publish.js courses/<slug>/plan.json --wait 0`
   (run in the background; ~2 GB takes a while). It creates or reuses the draft, sections, lessons, uploads videos,
   captions, slides and labs, attaches them, arranges the curriculum, picks the cover, validates and writes
   `courses/<slug>/reports/<env>-<time>.md`. Re-running is safe and only adds what's new.
7. **Processing**: videos are transcoded on the shared staging/production server (2 vCPUs): expect roughly real time or
   slower. Re-run with `--wait 60` (or check `GET /api/agent/videos`) until every video is `ready`.
8. **QA in the browser** (staging, `scripts/qa-shots.mjs`, sign in as the account; staging has no codes):
   instructor studio curriculum; the course page; as a student (enrol through Super Admin › Manual enrollments or the
   test card) play the first seconds of every video, Next/Previous, full screen, progress, open one PDF and one ZIP
   per section, CC shows captions only when pressed; 390/1440/1920, light and dark; the cover; no PowerPoint visible;
   no duplicate lessons or files. Record what you actually checked.
9. **Report** to the owner (template below) with the studio link and the open decisions (price, publish).
10. **Learn**: add what you learned to `courses/LESSONS_LEARNED.md` and content problems for the video-generation agent to
    `courses/GENERATION_FEEDBACK.md`; improve this skill when a step was wrong or missing.

## Adding lessons to an existing course
Add the new lesson folders to the right section in `plan.json` (keep the order a learner should follow) and re-run step 6.
Existing lessons, videos and files are matched (state file `state.<env>.json`, then titles, then checksums) and not
duplicated; the curriculum is re-arranged in plan order. A published course's changes go to its draft revision and need
approval.

## Plan format
```json
{ "environment": "staging", "apiUrl": "…/api", "provider": "DevOps Easy Learning", "instructorName": "DevOps Easy Learning",
  "sourceDir": "/mnt/c/…/videos/<course-folder>",
  "course": { "title": "", "subtitle": "", "description": "markdown", "level": "beginner|intermediate|advanced", "language": "en",
              "categorySlug": "", "cover": "suggested", "objectives": [], "requirements": [], "priceCents": 0 },
  "sections": [ { "title": "", "lessons": [ { "folder": "01-…", "title": "", "summary": "", "preview": false } ] } ] }
```

## Report template
Course name · source folder · environment · account · course id · studio and course URLs · sections / lessons ·
videos (count, total duration processed) · captions · slides · labs · quiz questions · failed or skipped uploads ·
missing materials · QA results (what was checked, on which sizes and themes) · status (draft) · decisions for the owner.
