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

## Now (2026-11-27)
- Production course is live at $4.99; the live purchase test passed (see COURSE_STATUS). Production runs release
  `2b84e9593d77` (Designed by Tia, description rendering, preview button, Managed Payments fix).
- Waiting for a production sign-in: sync the new course copy, "Quiz: …" names and lesson 01's lab → submit → owner
  approves in the Review queue.
- GEN is producing CR-001, CR-003, CR-004, CR-005; CR-006–CR-013 requested.
