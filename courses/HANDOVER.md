# Handover: course creation and publishing

Read this first when you pick up course work (any agent, any session). Owner 2026-11-27: nothing important may live only
in a chat or a context window.

1. **Read, in order:** `docs/COURSE_STANDARD.md` (the standard, incl. §3a presentation) →
   `docs/COURSE_PLATFORM_REFERENCE.md` (how it is built) → `courses/COURSE_STATUS.md` (where
   each course is) → `courses/CONTENT_REQUESTS.md` (open requests and who owns them) → `courses/LESSONS_LEARNED.md` → the
   course's `plan.json`. Skill: `.claude/skills/del-course-publisher/SKILL.md`.
2. **Talk to the other agent through the register.** Write or update the request in `CONTENT_REQUESTS.md` first, then send
   the other session a short message naming the request ids (Claude Code `SendMessage`; `ListAgents` shows the sessions:
   the generation agent's session is named `ai-videos…`). Record its answer in the request's Log.
3. **Production access:** see the skill's "Production upload: how it works". Never store passwords, one-time codes or
   recovery codes anywhere; ask the owner to sign in.
4. **Before "done":** every line of `courses/QA_CHECKLIST.md`. Ideas for the platform: `docs/IMPROVEMENTS.md`.
5. **Before you stop:** update `COURSE_STATUS.md`, the request statuses, `LESSONS_LEARNED.md`; commit; say in your final
   message what is waiting and on whom.

## Now (2026-11-27, night): AI for DevOps catalogue
- Four new courses are planned (`courses/COURSE_CATALOG.md`) and exist on **staging as drafts** with every lesson that
  exists today (ids in `COURSE_STATUS.md`); nothing in production yet. Production needs the categories `cloud-ai`,
  `ai-foundations` and `developer-tools` first, then a sync with the owner's sign-in, then the owner's approval.
- Paid prices ($99.99 AWS/Azure) need the owner's go-ahead before enrolment opens; the cloud courses' exclusive content is
  still thin (~45–50 min each) until CR-021–CR-041 arrive.
- GEN accepted CR-014–CR-047 (order and throughput in `CONTENT_REQUESTS.md`); VS Code follows the owner-approved 32-lesson
  curriculum in GEN's repo; CR-033 declined; CR-006 waits for the owner's GitHub token.
- Covers: plans name `blueprint-*` templates; they render once the covers release is deployed (staging reported
  "no cover template found" until then).

## Earlier (2026-11-27, evening)
- **Production** runs release `2b84e9593d77`; live purchase test passed ($4.99). The owner set the price to **$29.99**
  ($49.99 later); the production sync for price + new copy + quiz names + lab 01 needs a fresh owner sign-in (the
  owner signing in in a browser ends the upload session: ask them to stay signed out during uploads).
- **main** (local only, not pushed, not released) now also holds: Academic certificate, Corporate receipt, login logo
  (white disc), Teach page without public earnings, dashboard phase 1 (/studio). The owner's local site
  (127.0.0.1:3000) runs it. Next release needs the owner's "deploy to production".
- Dashboard phase 3 (/admin) is being built on `feat/dashboard-admin`; phase 2 (Student) waits.
- New course folders arrived: intro, GitHub PR, AWS automation (see COURSE_STATUS).
