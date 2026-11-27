# Platform improvement proposals

Agents add what they notice here (owner 2026-11-27: "Do not wait for me to discover every issue"): the current
limitation, the proposal, the benefit for students, why it is worth it, and the size. Significant architecture or new
features need the owner's approval before work starts. Newest first; mark items Approved / Done / Declined.

| # | Area | Limitation now | Proposal | Benefit | Size | Status |
|---|---|---|---|---|---|---|
| 1 | Email | Amazon SES is still in its sandbox: receipts and access emails reach only verified addresses, so a real buyer may get no receipt (checked 2026-11-27: `ProductionAccessEnabled=false`) | Owner requests SES production access (AWS console › SES › Get set up; the request form needs the owner) | Buyers get receipts, password resets, access reminders | owner, 10 min | Proposed |
| 2 | Course uploads | Production uploads need the owner's password + a fresh code every time a session ends | One agent key per month for the DEL account (courses only, revocable, audited), kept in `~/.config/del/prod-agent-key`; the watcher then runs on a schedule | New lessons go live for review without waiting for the owner to sign in | small (exists) | Proposed (owner to say "use an agent key for prod") |
| 3 | Checkout | If Stripe's webhook is late or misconfigured, the success page waits forever (happened on staging) | Success page confirms the Checkout Session with Stripe and fulfils idempotently (webhook stays the main path) | No buyer stuck on "Waiting for Stripe" | small | Proposed |
| 4 | Assessments | Quizzes exist per lesson; there's no module/final assessment yet and no score summary | Module + final assessments (content requested, CR-012/013) and a "Your quiz results" panel in the Student Studio, tied to the certificate | Students see what they mastered; certificate means more | medium | Content requested; UI proposed |
| 5 | Course page | Course-specific FAQ and "who it's for" live inside the description | Optional course FAQ entries (3–5) shown in the existing FAQ block and in FAQ structured data | Answers objections before purchase; SEO | small | Proposed |
| 6 | Player | Lesson files are under the Overview tab ("Files for this lesson") | An alternative bar of download buttons directly under the video was built and parked (branch `feat/lesson-downloads`); the owner prefers the current placement | — | done, not released | Declined for now |
| 8 | Dashboards | Phase 1 of the Option A design system (components + `/studio` for instructors and DEL Studio) is built on `feat/dashboard-enterprise` | Phase 2: Student dashboard (continue learning first, progress, expiry, quiz results, certificates). Phase 3: Admin and Super Admin (financial, platform and operational health) | One consistent, data-rich experience for every role | medium each | Pending the owner's review of phase 1 |
| 7 | Studio | An interrupted upload left one unattached "uploading" video in DEL Studio's library | Clean up stale uploads older than 24 h automatically (and the one from 2026-11-27) | Tidy library, no wasted storage | small | Proposed |
