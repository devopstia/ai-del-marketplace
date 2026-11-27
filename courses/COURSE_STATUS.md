# Course status

One row per course, kept current by the Course Upload Agent after every sync (owner 2026-11-27). Details per course:
`courses/<slug>/plan.json` (the source of truth), `state.<env>.json` (ids), `reports/` (each run). Open requests:
`courses/CONTENT_REQUESTS.md`. How to continue: `courses/HANDOVER.md`.

## AI-Powered DevOps Automation with n8n (`courses/n8n-automation`, source `18-automation-n8n`)
| | Staging | Production |
|---|---|---|
| Course id | `cc53b627-6390-44e1-97c6-577eaa88fd9d` | `bd30f93e-293d-42b4-89b8-121f1826531c` |
| URL | https://staging.ai-devopseasylearning.com/courses/ (draft revision pending) | https://ai-devopseasylearning.com/courses/ai-powered-devops-automation-with-n8n |
| Status | published; update (new title, lesson 18, quizzes) waiting as a draft revision | **published** 2026-11-27 (owner approved) |
| Price | $15 | **$29.99** (owner 2026-11-27, after the live test at $4.99); plan: **$49.99** once the new AI lessons (CR-001, CR-004–CR-010) are in and there are ~10 good reviews |
| Content | 4 modules, 15 video lessons (3 h 53 min), 12 quizzes (48 questions), 15 slide PDFs, 12 labs, captions on all | same |
| Previews | 01 and 06 | same |
| Last sync | 2026-11-27 02:06 UTC | 2026-11-27 02:53 UTC |
| Waiting | lesson 01 lab (CR-002); new course copy (merged to main 2026-11-27) | "Designed by Tia" and the description fix are live (release 2b84e9593d77); the new copy, Quiz names and lab 01 need a production sync (owner sign-in) → draft revision → owner approves |
| Live payments | — | **Live purchase test passed 2026-11-27**: $4.99 order paid, enrolment created (source purchase), DEL keeps 100% (Stripe fee $0.44, net $4.55, instructor share $0). Checkout now turns off Stripe Managed Payments per session (release 2b84e9593d77). Receipt email unconfirmed: SES still in sandbox (IMPROVEMENTS #1) |

Gaps and new content: CR-001 … CR-013 in `CONTENT_REQUESTS.md`. New folders in the source (2026-11-27): the intro
`00-n0-n8n-course-intro`, `09-n7-n8n-github-pr-live` and `11-n11-n8n-aws-automation-live` (the last two still without
labs): to be reviewed, added to the plan in their place, synced to staging, then production.

Production update **submitted 2026-11-27 05:59 UTC** (draft revision f2088294, in the Review queue): price $4.99 → **$29.99**,
rewritten course page, module renames, lesson renames and summaries, re-recorded 01–03 videos with 12 new quiz
questions (15 quizzes, 60 questions), lesson 01's lab, previews 01 + 17. Goes live when the owner approves.

# AI for DevOps catalogue (owner brief 2026-11-27)
Catalog: `COURSE_CATALOG.md`; source inventory: `INVENTORY.md`. Shared videos are uploaded once per environment (`media.<env>.json`).

## AI for DevOps on AWS: From Fundamentals to Production (`courses/ai-for-devops-aws`)
| | Staging | Production |
|---|---|---|
| Course id | `f26f445e-5f71-48ff-b68d-92d8b6db5a71` | not created |
| Studio | https://staging.ai-devopseasylearning.com/studio/courses/f26f445e-5f71-48ff-b68d-92d8b6db5a71 | — |
| Status | **draft** (not submitted) | — |
| Price | $99.99 (planned; paid enrolment only after the owner approves) | same |
| Content now | 31 lessons from the source groups (see `COURSE_CATALOG.md`); planned lessons in `CONTENT_REQUESTS.md` | — |
| Cover | `blueprint-aws` (template arrives with the covers release) | — |
| Waiting | owner preview; the CRs listed in the catalog; production categories | owner sign-in, categories, approval |

## AI for DevOps on Azure: From Fundamentals to Production (`courses/ai-for-devops-azure`)
| | Staging | Production |
|---|---|---|
| Course id | `6324aab5-2d84-4d12-b32d-74ba1bd85d0f` | not created |
| Studio | https://staging.ai-devopseasylearning.com/studio/courses/6324aab5-2d84-4d12-b32d-74ba1bd85d0f | — |
| Status | **draft** (not submitted) | — |
| Price | $99.99 (same) | same |
| Content now | 30 lessons from the source groups (see `COURSE_CATALOG.md`); planned lessons in `CONTENT_REQUESTS.md` | — |
| Cover | `blueprint-azure` (template arrives with the covers release) | — |
| Waiting | owner preview; the CRs listed in the catalog; production categories | owner sign-in, categories, approval |

## Introduction to Artificial Intelligence for DevOps (`courses/intro-ai-for-devops`)
| | Staging | Production |
|---|---|---|
| Course id | `5b3a97b2-344c-4bc8-bc50-9afad66f4383` | not created |
| Studio | https://staging.ai-devopseasylearning.com/studio/courses/5b3a97b2-344c-4bc8-bc50-9afad66f4383 | — |
| Status | **draft** (not submitted) | — |
| Price | Free | same |
| Content now | 23 lessons from the source groups (see `COURSE_CATALOG.md`); planned lessons in `CONTENT_REQUESTS.md` | — |
| Cover | `blueprint-ai` (template arrives with the covers release) | — |
| Waiting | owner preview; the CRs listed in the catalog; production categories | owner sign-in, categories, approval |

## Visual Studio Code Masterclass for DevOps and AI (`courses/vscode-masterclass`)
| | Staging | Production |
|---|---|---|
| Course id | `c773897e-e8e8-4c11-a4e3-c75ece5f69dd` | not created |
| Studio | https://staging.ai-devopseasylearning.com/studio/courses/c773897e-e8e8-4c11-a4e3-c75ece5f69dd | — |
| Status | **draft** (not submitted) | — |
| Price | Free | same |
| Content now | 6 lessons from the source groups (see `COURSE_CATALOG.md`); planned lessons in `CONTENT_REQUESTS.md` | — |
| Cover | `blueprint-vscode` (template arrives with the covers release) | — |
| Waiting | owner preview; the CRs listed in the catalog; production categories | owner sign-in, categories, approval |

## Gateway restructure (2026-11-27, branch feat/intro-gateway)
- Free **Introduction to AI for DevOps**: 12 videos (1.4 h) in 3 modules + the text lesson "Your next step" linking to
  both masterclasses. Production currently holds the earlier 23-lesson draft: re-sync with `--prune` (draft only) after
  this branch is merged; the article is written once the AWS and Azure courses have production ids.
- **AWS** and **Azure** masterclasses: 40 videos each (5.0 h / 5.2 h), self-contained foundations, module "Automate it
  with n8n" (06, 12, 17). Re-sync production after merge (no prune needed: lessons are only added and re-ordered).
- n8n: CR-001 intro added to the plan (first lesson, preview, promo); sync after the pending revision is decided.

## LLMOps (owner 2026-11-28)
Both masterclasses' last module is now **"LLMOps: run AI applications in production"** (available: LLMOps day to day, who builds and who runs, managed or self-hosted, operating and securing) and their descriptions have an LLMOps section (available now / coming next). 21 LLMOps videos requested (CR-056–076), training cloud budget $100/month. Plan changes need a production sync (session) to go live.

## Prompt engineering (owner 2026-11-28)
Module "Prompt engineering for DevOps" added to both masterclass plans (after the vocabulary, before the cloud
services): available now tm4 plus the three instruction-file lessons from 21-claude-code (shared with VS Code); a
"Prompt engineering" section with available-now and coming-next added to both descriptions. Not yet synced to
production. Planned lessons CR-077–CR-104 (28), with the free-intro teasers CR-101/102 and the n8n lesson CR-100.
