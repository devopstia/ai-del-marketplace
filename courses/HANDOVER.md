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

## Now (2026-11-28): Terraform masterclasses and Terragrunt (planning)
- **AI-Powered Terraform on AWS / on Azure: From Beginner to Advanced**: titles, 95 videos per course and the price
  ($49.99 → $69.99) are **approved** by the owner. Plan, inventory, curricula and lab code in `courses/terraform/` (start at
  `TERRAFORM_MASTERCLASS_PLAN.md`). Built on the owner's deck and repo (use them, never replace them). Azure is a full
  mirror: 37 shared videos + 58 lessons × 2 clouds = 153 videos.
- **Latest versions everywhere** (owner: "use new Terraform version"): Terraform 1.17.x, aws ~> 6.0, azurerm ~> 5.0,
  Terragrunt 1.x, `use_lockfile`, HCP Terraform, EKS access entries; a Versions line in every lesson and request. The
  owner's failing folders: 24 fixed in `code/owner-updated/`, all 45 fixes listed in `CONTENT_INVENTORY.md` › Fixes.
- **Third course, AI-Powered Terragrunt on AWS / on Azure: Terraform at Scale** (`TERRAGRUNT_CURRICULUM.md`, code
  `code/terragrunt/`, requests CR-282 … CR-299): two listings recommended (certificates need every lesson), price
  suggested $39.99 → $49.99.
- Requests CR-129 … CR-299 are `requested (planning)`; CR-129/130 superseded by the coordinator's premium introduction
  request (CR-300 onward). **Not sent to GEN**: the recording order waits for the owner's OK (draft message: plan § 11).
- **Waiting on the owner:** the recording order, the training domain (lesson 11.6), Terragrunt as one or two listings
  and its price. Budget: estimate, log, destroy; no owner pause; the $100/month alarms remain.

## Earlier (2026-11-28): AI website development
- Both masterclass plans have a new module "Build and ship websites with AI" (after the cloud's AI applications
  module; the S3 help-site lab (AWS) and the Foundry full-stack chat app (Azure) moved into it with their ids) and a
  "Build websites and digital products with AI" description section. Sync AWS and Azure to production and publish
  together with the prompt-engineering and LLMOps changes (owner asked to publish updates). New sections are created;
  moved lessons keep their ids.
- Requests CR-105–CR-128 sent to the video agent. **Blocked on the owner:** the training domain (CR-111, CR-112 and the
  custom-domain parts of CR-116/117); recommended one training domain (~$12–15/yr) with a subdomain per project.
- A **global priority order** across all open CRs is proposed to the owner (see `CONTENT_REQUESTS.md` › Status) and
  not yet sent to the video agent.

## Earlier (2026-11-28): prompt engineering
- Both masterclass plans have a new module "Prompt engineering for DevOps" and a description section (commit on
  `feat/course-catalog`); sync AWS and Azure to production and publish (owner asked to publish updates). The section
  rename/insert is safe: new section, tm4 moves with its id.
- Requests CR-077–CR-104 sent to the video agent; CR-018/019 merged into them.

## Earlier (2026-11-27, night): AI for DevOps catalogue
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
- **LLMOps (2026-11-28):** curriculum in `COURSE_CATALOG.md` › LLMOps, requests CR-056–076 with the $100/month budget rule; AWS/Azure plans have the renamed LLMOps module and description section (state files carry the section id under the new title); sync to production with a session, then publish.
