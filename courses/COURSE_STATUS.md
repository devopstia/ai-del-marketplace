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
| Price | $15 | **$4.99** (owner wanted $1 for the live Stripe test; the API minimum is $4.99 and the owner accepted it) — keep until the owner says testing is done |
| Content | 4 modules, 15 video lessons (3 h 53 min), 12 quizzes (48 questions), 15 slide PDFs, 12 labs, captions on all | same |
| Previews | 01 and 06 | same |
| Last sync | 2026-11-27 02:06 UTC | 2026-11-27 02:53 UTC |
| Waiting | lesson 01 lab (CR-002); presentation rewrite (owner 2026-11-27) on branch `feat/designed-by-description` | the same, then "Designed by Tia", the description fix and the new copy go out as a draft revision → owner approves |
| Live payments | — | Stripe live mode on; checkout failed on Stripe "Managed Payments" (owner turns it off in the Stripe Dashboard) |

Gaps and new content: CR-001 … CR-013 in `CONTENT_REQUESTS.md`.
