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
- **Covers** `apps/api/src/covers/` (templates per topic; rule 17). Two approved catalog families (owner 2026-11-27):
  **Night blueprint** (default: layout `night-blueprint`, templates `blueprint-aws|azure|ai|vscode|n8n`, `sort` 1–5) and
  **Light editorial** (the alternative: layout `light-editorial`, paper ground, the accent block on the right third with
  the symbol in an ink circle, ink title, topic label in the accent darkened to 4.5:1 by `readableAccent`; templates
  `editorial-aws|azure|ai|vscode|n8n`, `sort` 6–10, offered right after the blueprint one in the cover picker). Both use
  original symbols only (no third-party logos without
  the owner's confirmed permission), one accent per technology. Category → template: `BLUEPRINT_TOPICS` in
  `cover-templates.ts` (aws: `ai-cloud-aws`, azure: `ai-cloud-azure`, ai: `ai-fundamentals`/`ai-foundations`, vscode:
  `developer-tools`, n8n: `automation-n8n`; adjust when the categories are created). New technology: add a palette in
  `PALETTES` (same ink ground, accent `a` and light `b`), a motif case in `cover-render.ts` drawn in ±100 units scaled by
  `u / 266`, a `blueprint-<tech>` template (sort 1–5 range) and an `editorial-<tech>` one right after it, then `npx jest src/covers` (set `COVER_SAMPLES_DIR` to save
  PNGs) and look at them. A course that already has a template keeps it; switch it in the studio's cover picker. **Previews** `lectures.isPreview` →
  `catalogue.service.ts previewPlayback`. **Quizzes** `quizzes` per quiz lecture: `questions` (1–60; `id`, `q`, 2–6 `options`, `correct`, `why`, and since 2026-11-28 `explanations` per option, `takeaway`, `difficulty`, `type`, `topic`, `timestamp`, `code`, `fixedOrder`) and `settings` (`kind` lesson/module/final/scenario, `scenario`, `sampleSize`, `pool`). `quiz_attempts.answers` is a number array (old) or `{ v: 2, mode, items: [{ id, chosen, correct }] }`; `quiz_bookmarks` per student. Model and checks: `apps/api/src/learning/quiz-model.ts`.

## 5. What students see (apps/web, Next.js)
| Place | Component | Notes |
|---|---|---|
| Course page | `app/(site)/courses/[slug]/page.tsx` | header (title, subtitle, "Created by … · Designed by Tia"), What you'll learn (objectives), Course content (curriculum, Preview links), Requirements, About this course (`components/Markdown.tsx`: `##`, lists, bold), Course designer/instructor, FAQ |
| Buy box | `components/PurchaseCard.tsx` | cover with "Preview this course" (first preview), price, cart/buy, what's included (video hours, captions, quizzes, files) |
| Player | `components/learn/LearnPlayer.tsx` | video, Previous/Next, autoplay countdown; tabs; **Overview tab → "Files for this lesson"** (`ResourcesPanel`): the lesson's slides PDF and lab ZIP directly under the video, one Download button each; only shown when the lesson has files (owner approved this placement 2026-11-27) |
| Quiz | `components/learn/QuizPanel.tsx` | quiz lessons ("Quiz: …") and assessments: questions and options shuffled per attempt (graded by id), progress bar, explanation of the chosen and the right option, takeaway, per-topic summary, "Watch this part" (seeks the lesson video), retry missed questions (practice, not recorded), bookmarks |
| Studio | `components/studio/*` (CurriculumStep, DetailsStep, PricingStep) | what instructors (and DEL Studio) edit by hand |
Resource titles the publisher uses: **"Slides (PDF)"** and **"Hands-on lab (ZIP)"**; download names
`<lesson-title>-slides.pdf`, `<lesson-title>-lab.zip`.

## 5a. Certificates
Automatic on completion of every lesson; one official template for every course (Academic Excellence). Renderer
`apps/api/src/certificates/certificate-render.ts` → `GET /api/certificates/:code/certificate.svg|.png|.pdf?paper=letter|a4`;
public check `GET /api/certificates/:code` and the page `/certificates/<ID>` (QR target) or `/certificates/verify`;
Student Studio › Learning progress lists them; Super Admin › Certificates revokes/restores. Full details:
`docs/CERTIFICATES.md`. Course agents never create or sign certificates; they make sure a course can be completed
(every lesson completable) and check the certificate once per new course.
Receipts for course purchases: `docs/RECEIPTS.md` (private; `/student/purchases/<order id>`, PDF from `apps/api/src/receipts`).

## 5b. Recommendations ("Continue your learning journey", owner 2026-11-28)
Each course has an ordered list of **related courses** (table `course_related`: course, related course, position, a
"why this course next" reason ≤ 200 characters; at most 6). They are not course content: the owner sets them directly
(no revision review) and every change is audited (`course.related_set`).
- **Where they appear** (component `apps/web/src/components/RelatedCourses.tsx`, one block per screen, never inside a
  video, never a pop-up, nothing when the list is empty):
  - **course page:** "Continue your learning journey", at the bottom, up to 3 cards (cover, title, reason, price or
    "Free", "View course");
  - **player:** "Where to go next" in the Overview tab of the course's **final lesson** only
    (`components/learn/NextCourses.tsx`);
  - **Student Studio dashboard:** related courses of the courses the student owns, minus owned ones, at most 3 (in
    place of the DEL program note when there are any).
  - A course the viewer already owns shows "Continue learning" (to the player), never a price. Only **published**
    related courses are shown; anonymous viewers never see "owned".
- **How to set them:** DEL Studio / instructor studio › course › Details › "Related courses" (pick from published
  courses, or your own); API `GET|PUT /api/instructor/courses/:id/related` (`{items:[{courseId, reason?}]}`, the full
  ordered list), candidates `GET /api/instructor/courses/:id/related/candidates`; agent API
  `GET|PUT /api/agent/courses/:id/related`; public `GET /api/courses/:slug` returns `related`; the student panel uses
  `GET /api/me/related-courses`.
- **From a course plan:** `"related": [{ "course": "<plan folder>", "reason": "…" }]` at the plan's top level. The
  publisher resolves each through `courses/<plan folder>/state.<env>.json`; a course not uploaded yet in that
  environment is skipped and reported, and set on the next run.

## 6. Environments
Staging https://staging.ai-devopseasylearning.com (no sign-in codes; seed admin from SSM), production
https://ai-devopseasylearning.com (owner's sign-in with authenticator; no agent keys unless the owner says so). Code
releases: `scripts/deploy-aws.sh` (build → staging → verify → RDS snapshot → production), only on the owner's
"deploy to production". Course content: staging first, then production, through the publisher.

## Quiz banks and assessments (owner 2026-11-28)
- **Counts follow the lesson**, not a fixed four (standard §8a; owner's table by video length). Audit and status: `courses/QUIZ_AUDIT.md`.
- **Lesson quiz**: GEN delivers `quiz.json` in the lesson folder (schema `courses/quiz.schema.json`): every option explained,
  takeaway, difficulty, type, topic, timestamp. It wins over the spoken questions in the captions (the caption parser stays the fallback).
- **Assessments**: plan field `"assessments": "<folder>"` (relative to `sourceDir`) with `module-<n>-assessment.json` (closes module n),
  `final-assessment.json` (closes the last module), `scenario-<name>.json` (closes module `section`, default the last). Settings:
  `sampleSize` (questions per attempt) and `pool` (`module`/`course`: also draw from those lesson quizzes).
- **Publisher** (`tools/mcp-server/src/quizfile.ts`): blocks on a wrong answer index, a missing explanation per option, repeated
  questions/ids, a timestamp past the video's end or an answer given away by the question; warns when the count is outside the range
  for the video's length. A changed file replaces the quiz in place (checksum in `state.<env>.json` › `quizFiles`), same quiz lesson,
  so students' results stay. **Switch**: full banks and assessments need the quiz-bank API release; until `"quizBanks": true` is set
  in `courses/publisher.config.json` (or `DEL_QUIZ_BANKS=1`), `quiz.json` is folded into today's format (`quizFromFile`: why +
  takeaway + why the others are wrong) and assessments are not uploaded.
- **Grading**: by question id with a signed draw (a sampled assessment is graded on exactly what was handed out); retry-missed is
  practice only; best and latest scores from full attempts; instructor insights count misses by question id.
