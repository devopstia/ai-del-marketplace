# Course publishing: lessons learned

What the Course Upload and Publishing Agent learned on each course (skill: `.claude/skills/del-course-publisher`).
Read before every upload; add to it after every upload. Newest first.

## 2026-11-26 (later): production profile, quizzes, monitoring
- **One plan, two environments:** `environments.staging/production` hold the API and the price (staging $15, production
  $1 for the owner's live purchase test); `--env production` refuses unless `publisher.config.json` says
  `productionAllowed: true`. Each environment has its own state file, so ids never mix.
- **Check the title against the content.** The owner asked for "AI-Powered…"; only lesson 17 is AI. The description
  says exactly what lesson 17 does, and the missing AI lessons went to GENERATION_FEEDBACK. Never advertise a topic
  that no video covers (Slack, PR reviews and AI agents weren't).
- **Quizzes come from the captions**, joined across cues. Some videos say the options in words and then in symbols
  (the cron question in 13): use the last set. "Pause and think" questions have their options only on slide images:
  skip and report them, never invent options. 48 of 60 questions were imported.
- **New folders appear without warning** (18 arrived mid-session). `del-watch-courses` finds them and writes an inbox
  for review; the folder number isn't always the right position: read the captions first.
- **Changes to PowerPoint or thumbnails never trigger an upload**; the watcher hashes files only when size or mtime moved.
- **Never recreate a lesson to move it**: `PUT curriculum` with the existing ids keeps progress, completions and quiz
  results. The arrange helper keeps unknown lessons at the end and reports them.
- Lab ZIPs for cloud lessons: check for `.tfstate`, `.terraform/`, `keys/` and `*.pem` too (lesson 18 was clean:
  `.gitignore` covers them).

## 2026-11-26: DevOps Automation with n8n (first course)
- **Read captions, not file names.** Each lesson's opening and closing lines say what it teaches and what it promises
  ("download the lab"): that's how missing labs were found. Lab READMEs give the real course name ("Course: DevOps
  Automation with n8n") and the requirements (minikube/kubectl, an OpenAI key with a budget limit).
- **Labs can share one project** (02/03/04/06 are `n8n-mattermost` at different stages). Upload each lesson's own ZIP.
- **Secret scan needs judgement:** a secret-scanning exercise contains deliberate fake secrets (`Sup3rSecretDemo`,
  `not-a-real-key`). Read the hit before deciding; real-looking keys stop the upload.
- **Download names come from the uploaded file name** (`storageKey`), so the publisher uploads files under
  `<lesson-title>-slides.pdf` / `-lab.zip`. A file whose checksum was uploaded before keeps its first name.
- **Captions** needed an agent API route (`POST /api/agent/videos/:id/captions`, added 2026-11-26). Until a release
  has it, the publisher reports "captions not uploaded" and a re-run adds them.
- **Processing is the slow part:** staging and production share a 2-vCPU server; ~3.6 h of 1080p video takes hours to
  package. Upload with `--wait 0`, then check and re-run with `--wait`.
- **Staging has no sign-in codes**, so the admin can issue the agent key through the API; keep the key in the
  scratchpad (`umask 077`) and delete it when done.
- Deploying to staging needs the owner's explicit go-ahead in this environment (the permission check blocks it otherwise).
- **Idempotency confirmed:** the second run uploaded 0 files, reused 14, added only the 14 captions, 0 issues.
- **New courses default to $0 (free).** Ask for the price, or put `priceCents` in the plan before publishing.
- **QA as the Super Admin in DEL Studio** (cookie `act_as=platform`) sees a draft in the player; admins have access to
  every lesson, so all videos and downloads can be checked before publishing. Progress tracking and the public page
  need a published course and a student enrolment.
- Playwright sign-in on staging: wait for the URL with `waitUntil: "commit"` (the dashboard keeps loading).
- Revoke the agent key when the course is done (Super Admin › AI agents) and delete the scratchpad copy.
