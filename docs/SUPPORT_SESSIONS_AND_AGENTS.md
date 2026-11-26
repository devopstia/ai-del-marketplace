# Support sessions and AI agents (owner 2026-11-26)

The owner's brief ("Super Admin User Impersonation and AI-Assisted Course Management", prompts.md) asks for two things:

- A super admin can open any student's, instructor's or admin's dashboard to help them, without their password.
- An authorised AI agent (Claude or any MCP client) can build and upload a course for one instructor and submit it for
  approval.

Both are audited end to end, and nothing is ever attributed to the person being helped.

Code:
- API (`apps/api/src`):
  - `assist/`: support sessions, request resolution, the audit interceptor;
  - `agents/`: tokens, the agent API, resumable uploads, course validation;
  - `common/audit.service.ts`, `common/auth.guard.ts`, `common/csrf.ts`.
- Web (`apps/web/src`):
  - `components/assist/SupportBanner.tsx` (every page);
  - `components/assist/SwitchToUser.tsx` (Admin › Users › a user);
  - `app/admin/agents`.
- MCP server: `tools/mcp-server`.
- Agent skill: `.claude/skills/del-course-agent/SKILL.md`.
- Migration: `20261127100000_support_sessions_agents`.
- Tests:
  - `src/assist/assist.spec.ts`, `src/agents/course-validation.spec.ts`;
  - `test/support-agents.e2e-spec.ts` (owner's scenarios 1–14);
  - `tools/mcp-server/src/mcp.test.ts`.

## 1. What existed before (audit, 2026-11-26)

| Area | Before this change | Gap closed here |
| --- | --- | --- |
| Acting for someone | **DEL Studio** only: a super admin could work in the instructor studio as DEL's own platform account (`act_as` cookie, `/api/instructor/*` only, audit names the real person). | Any non-super-admin account, whole site, time-limited, with reason, banner, email to the person and restrictions. |
| Users | Users and roles: roles, admin permissions, suspend or reactivate, MFA reset, account history (`/admin/users`). | "Switch to user dashboard" from the same dialog, plus the list of earlier support sessions. |
| Courses | Instructor Studio: course details, one-screen curriculum (drag and drop), several videos at once, files per lesson, course package, quizzes, cover templates, draft revisions for published courses, submit, admin review queue. | Reused as is: a super admin in a support session uses the instructor's own studio. Agents call the same services. |
| Uploads | Browser: one presigned PUT per file (video ≤ provider limit, files ≤ 200 MB); progress in the studio. | Agents: resumable multipart (64 MB parts, resume after a dropped connection, retries), SHA-256 duplicate detection, size verified on completion. |
| "Ready to publish" | `readinessProblems` (description, category, every video processed) on Submit. | `GET /agent/courses/:id/validation`: the same rules, plus failed videos, files missing from storage, empty quizzes and articles, duplicates, missing subtitle, objectives and cover. |
| Audit | `audit_logs(actorId, action, target, ip, meta)`. | Adds `onBehalfOfId`, `agentTokenId`, `supportSessionId` and `status` (ok/failed). Every state-changing request in a support session or with an agent token is logged (`support.request` / `agent.request`) next to the service's own entries. |
| AI | AI learning features for learners (assistant, notes, video search). | Scoped agent tokens, the `/api/agent` API and the MCP server. |

## 2. Support sessions ("Switch to user dashboard")

**Start.** Super Admin › Users and roles › open a user › *Help in their dashboard*.
1. Enter a reason (shown to the person) and your authenticator code.
2. Choose 30 or 60 minutes, or 2 hours (`POST /api/support-session/start`).
3. You land on their main dashboard: `/student`, `/studio` or `/admin`.

The person receives the email `security-support-session`, with your name, the reason and the times.

**While it runs:**
- **Banner:** a dark bar at the bottom of every page, in the site and in every studio. It shows "Support session", the person's name, email and role, the running time, the time left, the reason, and **Return to Super Admin**.
- **Identity:** the API resolves `support_sid` together with your own `sid`, so `req.user` is the person and `req.realUser` is you. Everything you see and do uses their data and their permissions.
- **Their own sessions:** untouched and not counted. The session-security rule (one active session) ignores support sessions.
- **Not available:**
  - **Account security, reads included:** password, email, two-step sign-in, sessions and linked sign-in methods (all of `/api/auth/*` except `me` and `csrf`). Sign out is blocked too: use Return.
  - **Money:** purchases, the cart, checkout, orders and refund requests; instructor Stripe and payout settings.
  - **Their name on public or learning records:** watching progress and quiz answers (so refund facts stay exact), reviews, certificates, the AI assistant, review replies, instructor applications, support tickets, invitations, manual enrollment requests.
  - **Admin changes:** any `POST/PUT/PATCH/DELETE /api/admin/*`. Do admin work as yourself, after Return.

  Blocked calls answer `403 support_restricted` with the reason, and are audited as `support.request_blocked`.
- **Instructor help:** create and edit courses, curriculum, uploads, files, quizzes, covers, pricing and promotions, preview, drafts, submit. The course stays the instructor's. Publishing still goes through the review queue.

**End.**
- **Return:** `POST /api/support-session/end`. Back in your own dashboard, on that person's account dialog (`/admin/users?open=<id>`), with no new sign-in.
- **Automatically:** at the time limit, when you sign out, or when your own session ends.
- **By another super admin:** `POST /api/support-session/:id/revoke`.

History: `GET /api/support-session/history?userId=` lists who, why, how long, how many actions and the status (active, returned, expired, revoked).

**Never:**
- another super admin's dashboard;
- a suspended account;
- your own account;
- an admin's admin powers beyond their own permissions.

## 3. AI agents

**Issue a token.** Super Admin › **AI agents** (`/admin/agents`, super admin only).
1. Search the instructor and name the agent.
2. Pick scopes, expiry (1–30 days) and a reason, then enter your authenticator code.
3. The token (`del_agent_…`) is shown **once**. It is stored hashed.

The instructor is emailed (`security-agent-access`). The page lists tokens (status, last use, number of actions), lets you **Revoke** one immediately, shows what agents did, and lists courses agents submitted that wait for your approval.

| Scope | Allows |
| --- | --- |
| `courses:read` | list and read the instructor's courses, videos and processing status, validation, preview, cover templates |
| `courses:write` | create courses; edit details, sections, lessons, quizzes and the cover template (published courses: into the draft revision) |
| `uploads` | resumable uploads; attach files to lessons |
| `submit` | submit a course for review, only when validation passes |

**Never possible with a token:**
- publish, delete, or touch payments, students, enrollments or other instructors;
- reach any path outside `/api/agent/*` (403 `agent_scope`);
- use admin powers the instructor's account may also have.

The request runs as the instructor, so ownership and the review rules are exactly the studio's. Audit rows name the issuing super admin (`actorId`), the instructor (`onBehalfOfId`) and the token (`agentTokenId`).

### Agent API (`Authorization: Bearer del_agent_…`, no cookies, no CSRF)
`GET  /agent/whoami` · `GET /agent/categories`
`GET  /agent/courses` · `GET /agent/courses/:id` · `POST /agent/courses` · `PATCH /agent/courses/:id`
`POST /agent/courses/:id/sections` · `PATCH /agent/courses/:id/sections/:sid`
`POST /agent/courses/:id/sections/:sid/lectures` · `PATCH /agent/courses/:id/lectures/:lid` · `PUT /agent/courses/:id/curriculum`
`PUT  /agent/courses/:id/lectures/:lid/quiz` · `GET /agent/courses/:id/covers` · `PUT /agent/courses/:id/cover`
`POST /agent/courses/:id/lectures/:lid/resources` (attach an uploaded file)
`GET  /agent/videos` · `GET /agent/videos/:assetId`
`POST /agent/uploads` `{kind: video|resource, filename, contentType, sizeBytes, sha256?, courseId?}`. It returns one of:
- `{id, partSize, partCount, assetId?}` for a new upload;
- the same plus `resume: true` for an unfinished upload of the same file;
- `{duplicate: true, assetId | storageKey}` when this file was already uploaded.

`GET  /agent/uploads/:id/parts?from=1&count=20` → presigned part URLs plus the parts already stored
`POST /agent/uploads/:id/complete`:
- refuses (`400 upload_incomplete`, with the missing parts) until every byte arrived;
- for a video, starts processing.

`POST /agent/uploads/:id/abort`
`GET  /agent/courses/:id/validation` → `{ready, errors[], warnings[], stats}` · `GET /agent/courses/:id/preview` (outline, lesson status, studio link)
`POST /agent/courses/:id/submit` → `400 not_ready` with the validation unless ready

Limits: videos MP4/WebM/MOV up to 20 GB; files up to 200 MB. Videos then go through the normal processing (ffprobe, encrypted HLS, captions index).

### Connect Claude (MCP server)
```bash
cd tools/mcp-server && npm ci && npm run build
claude mcp add del-courses \
  --env DEL_API_URL=https://ai-devopseasylearning.com/api \
  --env DEL_AGENT_TOKEN=del_agent_… \
  --env DEL_UPLOAD_ROOTS=/path/to/the/instructor/recordings \
  -- node /absolute/path/to/tools/mcp-server/dist/index.js
```
- **Other MCP clients:** any MCP client works the same way (stdio command `node …/dist/index.js` with the same three variables).
- **Shared folders:** `DEL_UPLOAD_ROOTS` lists the only folders the server will read (`:`-separated; `;` on Windows). Paths outside them, including through symlinks, are refused.
- **Local:** use `DEL_API_URL=http://127.0.0.1:4000/api`.

Tools:
- **Account:** `whoami`, `list_categories`.
- **Courses:** `list_courses`, `get_course`, `create_course`, `update_course`, `add_section`, `rename_section`, `add_lesson`, `update_lesson`, `arrange_curriculum`, `set_quiz`.
- **Covers:** `list_cover_templates`, `set_cover`.
- **Files:**
  - `list_local_files`;
  - `upload_file` (resumable, checksummed, retried);
  - `upload_files` (bulk; each file reported separately);
  - `attach_file`, `video_status`.
- **Review:** `validate_course`, `preview_course`, `submit_for_review`.

### Example prompts for Claude
- **Full build:** "Use the del-courses tools. The recordings for Nadia's *Kubernetes basics* course are in the shared folder. List them, propose sections and lesson order from the file names (01-, 02-…), and show me the plan before creating anything. Then create the course as a draft, upload every video and the PDFs, attach each PDF to its lesson, pick a suggested cover, write the description and 5 learning objectives from the lesson titles, and run validate_course. Don't submit; tell me what is missing."
- **Re-upload:** "Some uploads failed yesterday. Check video_status for course <id>, re-upload only the files whose lesson has no ready video, and validate again."
- **Submit:** "Validation is clean. Submit course <id> for review and give me the studio link."

**Rules for agents** (also in the skill file):
- never invent recordings or content that isn't in the files;
- never report an upload as done before `upload_file` returns `completed` or `duplicate`, and the video is `ready`;
- ask before `submit_for_review`;
- touch only the courses you were asked about.

## 4. Security controls
- **Who can start what:** support sessions and agent tokens are super-admin only, need a step-up authenticator code (the same rule as role changes), a written reason, and an expiry (support 5–120 min; tokens ≤ 30 days).
- **What is stored:** tokens are stored as a SHA-256 hash, shown once, and revocable at once. Support cookies are httpOnly, SameSite=Lax, and valid only together with the admin's own session.
- **Where it is enforced:** everything in the API (guard plus service-layer ownership), never by hiding menus. In a support session admin permissions are the person's, not yours. Agent tokens only reach `/api/agent/*`, and only with the instructor role.
- **Notification:** the person is emailed when a support session starts or an agent gets access.
- **Audit:**
  - every support session start, end and revoke, and every blocked call;
  - every state-changing request in a support session or with an agent token, with status;
  - every token issue and revoke;
  - entries always name the real person; `onBehalfOfId` names whom.
- **Uploads:** checked for type, size and ownership; completion is verified against storage, so a missing or short file is never reported as done.

## 5. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `step_up_required` | Enter your Google Authenticator code (each code works once; wait for the next one if you just used it). |
| `support_restricted` | That area is the account owner's (see §2). Return, then do it as yourself, or ask the person. |
| Banner gone, you're yourself again | The session expired, was revoked, or you signed out. Start a new one. |
| `agent_token_invalid` (401) | Token revoked or expired, or the instructor is no longer active. Issue a new one. |
| `agent_scope` (403) | Missing scope, or a path outside `/api/agent`. |
| `upload_incomplete` | Some parts didn't arrive. `upload_file` resumes: run it again with the same file. |
| Validation: "still processing" | The worker is packaging the video; check `video_status` in a few minutes. `failed` means: upload it again. |
| `not_ready` on submit | Fix the validation errors first. |
| `course_locked` | The course's changes are in review; wait for the decision. |
