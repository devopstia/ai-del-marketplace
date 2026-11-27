# How courses work on DevOps Easy Learning: the technical reference

For every agent that creates, uploads, publishes or maintains courses. **What** to do and the quality bar:
`docs/COURSE_STANDARD.md`. **How** (this page): where things are and how they connect. Day-to-day state:
`courses/HANDOVER.md`. Checklist before "done": `courses/QA_CHECKLIST.md`. Keep this page true when you change the code.

## 1. Who does what
| Agent | Session | Works in | Never |
|---|---|---|---|
| Course Generation Agent (GEN) | Claude Code session `ai-videos…` (`ListAgents`) | Dropbox videos root `C:\Users\tiaje\Dropbox\AI-VIDEOS\ai-devops\videos` = `/mnt/c/Users/tiaje/Dropbox/AI-VIDEOS/ai-devops/videos`, its own repo | touches the marketplace (owner: "just handle videos") |
| Course Upload and Publishing Agent (UPLOAD) | this repo's session; agent definition `.claude/agents/del-course-publisher.md`, skill `.claude/skills/del-course-publisher/SKILL.md` | `/home/tia/work/ai-del-marketplace` | regenerates content, invents quiz answers, publishes without the owner |
| Owner / Super Admin | browser | Super Admin › Review queue, AI agents, Payments | — |
Both agents act as **DEL instructors**: they own the educational quality, not just the files (standard §1).

## 2. The source folders (GEN → UPLOAD)
```
videos/<NN-course-folder>/                 e.g. 18-automation-n8n
  course.manifest.json                     GEN's structure + lesson metadata (schema courses/manifest.schema.json); a hint
  assessments/module-<n>.json, final.json  module and final assessments (q, options, correct, why)
  <NN-code-slug>/                          one lesson; 00-… = intro, 99-… = conclusion
    <name>.mp4                             exactly one video (1080p H.264/AAC)
    captions/<name>.en.srt                 English captions (also the source of the in-video quiz)
    <name>-presentation.pdf (+ .pptx)      slides: the PDF is uploaded, the PPTX never
    <name>-lab.zip                         hands-on exercise: README, .env.example only, no real secrets
    <name>-thumbnail.png, lesson.json      never uploaded / hints
```
GEN copies files as `*.part` and renames when complete; the watcher waits for that and a 10-minute quiet period.

## 3. The upload side (this repo)
| Piece | Path | What it does |
|---|---|---|
| Course plan (source of truth) | `courses/<slug>/plan.json` | title, subtitle, description (Markdown), objectives, requirements, level, category, price per environment, previews, sections → lessons (folder, title, short, summary, preview), quizzes `from-captions`, intro slot |
| State per environment | `courses/<slug>/state.<env>.json` | course, section, lesson and quiz ids, file checksums: makes every run idempotent |
| Reports | `courses/<slug>/reports/<env>-<time>.md` | per run: counts, validation, issues, skipped files |
| Publisher | `tools/mcp-server/src/publish.ts` → `node tools/mcp-server/dist/publish.js <plan> --env staging|production [--auth session] [--dry-run] [--wait N]` | creates/reuses the course, sections and lessons (never recreates), uploads video + captions + PDF + ZIP, attaches them, imports quizzes, arranges the curriculum in plan order, sets the cover, validates, reports |
| Watcher | `tools/mcp-server/src/watch.ts` → `del-watch-courses [--once] [--env] [--auth session]` | detects new/changed lesson folders; syncs planned ones; puts new ones in `courses/<slug>/inbox.json` for review |
| Sign-in for production | `scripts/del-signin.sh [site] <jar>` (owner runs it, or the owner gives password + fresh code) | session cookie jar in the scratchpad; `--logout` deletes it |
| API client | `tools/mcp-server/src/client.ts` | `DelClient` (agent key, `/api/agent/*`) and `SessionClient` (owner session acting as DEL Studio: cookie `act_as=platform`, `/api/instructor/*`) |
| MCP server for instructor agents | `tools/mcp-server/src/index.ts`, `tools.ts`; skill `.claude/skills/del-course-agent` | the same operations as tools |

## 4. The API (apps/api, NestJS)
- **Agent API** `apps/api/src/agents/agent-api.controller.ts` (`/api/agent/*`, bearer agent key, scopes `courses:read
  courses:write uploads submit`, one instructor, ≤ 30 days, revocable, audited): whoami, categories, courses
  (create/patch/detail/validation/preview/submit), sections, lectures (create/patch, quiz `PUT …/lectures/:lid/quiz`),
  curriculum `PUT …/curriculum`, covers, resources `POST …/lectures/:lid/resources`, resumable multipart uploads
  `POST /uploads` → parts → complete, captions `POST /videos/:id/captions`. Keys: Super Admin › AI agents
  (`/api/admin/agents/tokens`).
- **Studio API** (what DEL Studio and session mode use): `apps/api/src/instructor/instructor.controller.ts`,
  `media/media.controller.ts` (`instructor/uploads/video` → presigned PUT → complete; `…/captions`;
  `instructor/uploads/resource`).
- **Prices** `common/pricing.ts`: free or $4.99–$999.99. **Categories** are admin data (`POST /api/admin/categories`).
- **Published courses** change through a draft revision (`instructor/revisions.service.ts`, `course-tree.ts`); the
  owner approves it in **Super Admin › Review queue** (`/api/admin/review-queue`). Lesson ids are kept, so
  enrolments, progress and quiz results survive.
- **Storage keys** `instructors/<id>/courses/<courseId>/resources/<uuid>/<clean-name>` (`common/storage-keys.ts`);
  downloads are short-lived signed links for owners, admins and active enrolments only.
- **Covers** `apps/api/src/covers/` (templates per topic; rule 17). **Previews** `lectures.isPreview` →
  `catalogue.service.ts previewPlayback`. **Quizzes** `quizzes` per quiz lecture (3–5 options, `correct`, `why`).

## 5. What students see (apps/web, Next.js)
| Place | Component | Notes |
|---|---|---|
| Course page | `app/(site)/courses/[slug]/page.tsx` | header (title, subtitle, "Created by … · Designed by Tia"), What you'll learn (objectives), Course content (curriculum, Preview links), Requirements, About this course (`components/Markdown.tsx`: `##`, lists, bold), Course designer/instructor, FAQ |
| Buy box | `components/PurchaseCard.tsx` | cover with "Preview this course" (first preview), price, cart/buy, what's included (video hours, captions, quizzes, files) |
| Player | `components/learn/LearnPlayer.tsx` | video, Previous/Next, autoplay countdown; tabs; **Overview tab → "Files for this lesson"** (`ResourcesPanel`): the lesson's slides PDF and lab ZIP directly under the video, one Download button each; only shown when the lesson has files (owner approved this placement 2026-11-27) |
| Quiz | `components/learn/QuizPanel.tsx` | quiz lessons ("Quiz: …"), answers explained |
| Studio | `components/studio/*` (CurriculumStep, DetailsStep, PricingStep) | what instructors (and DEL Studio) edit by hand |
Resource titles the publisher uses: **"Slides (PDF)"** and **"Hands-on lab (ZIP)"**; download names
`<lesson-title>-slides.pdf`, `<lesson-title>-lab.zip`.

Receipts for course purchases: `docs/RECEIPTS.md` (private; `/student/purchases/<order id>`, PDF from `apps/api/src/receipts`).

## 6. Environments
Staging https://staging.ai-devopseasylearning.com (no sign-in codes; seed admin from SSM), production
https://ai-devopseasylearning.com (owner's sign-in with authenticator; no agent keys unless the owner says so). Code
releases: `scripts/deploy-aws.sh` (build → staging → verify → RDS snapshot → production), only on the owner's
"deploy to production". Course content: staging first, then production, through the publisher.
