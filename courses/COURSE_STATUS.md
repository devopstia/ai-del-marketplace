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

Gaps and new content: CR-001 … CR-013 in `CONTENT_REQUESTS.md`.
