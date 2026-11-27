# Course publishing: lessons learned

What the Course Upload and Publishing Agent learned on each course (skill: `.claude/skills/del-course-publisher`).
Read before every upload; add to it after every upload. Newest first.

## 2026-11-27: production without agent keys (session mode)
- **The owner doesn't want agent tokens for production** ("Please do not use agents"). The publisher now has
  `--auth session`: the owner signs in with `! scripts/del-signin.sh <site> <jar>` (email, hidden password, authenticator
  code, nothing stored but the cookie jar) and the publisher works as DEL Studio (`act_as=platform`) through the studio
  routes. Audit entries name the real super admin. Sign out with `scripts/del-signin.sh --logout` at the end.
- **No server-side checksum de-duplication in the studio**: idempotency comes from `state.<env>.json` → `files`
  (sha256 → asset id / storage key). Keep the state file; a lesson video that the state never saw is adopted, not
  uploaded again; a changed video (new checksum) is uploaded and replaces the old one.
- **Sessions end** (inactivity, maximum lifetime, a new sign-in elsewhere): the publisher sends the heartbeat every few
  minutes, and on a 401 it stops with "sign in again"; re-running resumes. Studio video uploads are one presigned PUT per
  file (no multipart resume): an interrupted video is sent again from the start on the re-run.
- Tested end to end on the del-test stack (sign-in script with the seed admin + TOTP, upload, captions, slides,
  re-run = 0 sent, sign-out).

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

## 2026-11-27: n8n course to production
- **Owner prefers no agent tokens in production**: session mode with `scripts/del-signin.sh` (the owner signs in;
  the skill's "Production upload: how it works" has every step).
- **Production starts with no categories**: the first run stopped at `Unknown category automation-n8n`; created the
  staging category in production through the admin API with the owner's session. Check categories before uploading.
- **Price limits**: the API allows free or $4.99–$999.99. The owner asked for $1, the API refused, the owner chose
  $4.99. Don't invent a temporary price and don't change the rule without the owner (the permission check blocks both).
- The owner pasted the password into the chat: use it once, and advise changing it. Ask for `!` next time.
- Release first (production needed the captions/Taught by/quiz release), staging sync second, production third.

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
