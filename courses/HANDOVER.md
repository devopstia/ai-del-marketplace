# Handover: course creation and publishing

Read this first when you pick up course work (any agent, any session). Owner 2026-11-27: nothing important may live only
in a chat or a context window.

1. **Read, in order:** `docs/COURSE_STANDARD.md` (the standard, incl. §3a presentation) → `courses/COURSE_STATUS.md` (where
   each course is) → `courses/CONTENT_REQUESTS.md` (open requests and who owns them) → `courses/LESSONS_LEARNED.md` → the
   course's `plan.json`. Skill: `.claude/skills/del-course-publisher/SKILL.md`.
2. **Talk to the other agent through the register.** Write or update the request in `CONTENT_REQUESTS.md` first, then send
   the other session a short message naming the request ids (Claude Code `SendMessage`; `ListAgents` shows the sessions:
   the generation agent's session is named `ai-videos…`). Record its answer in the request's Log.
3. **Production access:** see the skill's "Production upload: how it works". Never store passwords, one-time codes or
   recovery codes anywhere; ask the owner to sign in.
4. **Before you stop:** update `COURSE_STATUS.md`, the request statuses, `LESSONS_LEARNED.md`; commit; say in your final
   message what is waiting and on whom.

## Now (2026-11-27)
- Production course is live at $4.99; the owner is testing live payments (blocked on Stripe "Managed Payments").
- Branch `feat/designed-by-description`: "Designed by Tia", description rendering fix, preview button at the bottom of
  the cover, the presentation rewrite of the n8n plan. Needs the owner's "deploy to production", then a production
  sync (owner signs in) → draft revision → owner approves in the Review queue.
- GEN is producing CR-001, CR-003, CR-004, CR-005; CR-006–CR-013 requested.
