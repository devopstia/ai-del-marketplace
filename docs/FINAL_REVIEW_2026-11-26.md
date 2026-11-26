# Final review before release (2026-11-26)

Branch `feat/final-review`, merged into `main`. Restore point: tag `checkpoint-2026-11-25-final-review` (7ae0a6c) and branch
`backup/pre-final-review-2026-11-25`. Previous stable production release: `release-2026-11-26-launch-prep` (images `80a2549306af`).

## 1. Requirement review (all instruction files, prompts.md, AGENTS.md, docs, memory)

A requirement-by-requirement audit compared every documented requirement with the code and the tests.

| Area | Result |
| --- | --- |
| Auth, MFA, passwords, roles, studios, catalogue, player, cart, refunds, one-year access, manual enrollment, moderation, support, PWA, CI | Verified by tests (API e2e, unit, smoke, Playwright) |
| **Defects found and fixed** | Course FAQ promised access "for life" (rule 20) → 12 months; refund wording "less than 25%" → "25% or less" everywhere; Buy/Checkout led to an error while card payments are off → "Contact us to enrol"; no Terms of use / Privacy policy pages → added; player showed the access end date only in the last 30 days → always; amber badges unreadable in light → fixed |
| **Implemented but untested before, now tested** | Contact and support emails (confirmation + support inbox), sign-in methods settings, theme default and toggle, payments-off state, policy pages |
| **Still untested in the browser** (API covered) | Manual-enrollment and invitation screens, curriculum drag-and-drop UI, Admin › Refunds and Users UI, player double-click full screen and idle hide |
| **Partial** | Filters by instructor/course/date on manual enrollments and review moderation; preview of a draft revision of a live course; no automated smoke/Playwright step after the staging deploy in `release.yml`; no dependency audit in CI |
| **Missing (owner's ordered list)** | ⌘K search (item 5) and terms acceptance on purchase (item 11): never built; confirm whether still wanted |

## 2. This release

- **Social sign-in:** Google, GitHub, Facebook and LinkedIn were already implemented and tested end to end with the test
  provider and mocked provider exchanges (account creation as Student, Google Authenticator step, matching by provider id,
  never merging by email, linking from Account › Security). Production shows no buttons because **no provider app exists
  yet**. New: Super Admin › Sign-in methods to paste the keys (checked with the provider, sealed, step-up code, audited).
  **Missing to switch them on:** the owner creates an OAuth app with each provider (Google Cloud, GitHub, Meta for
  Developers with business verification, LinkedIn with a Company Page) and pastes the client ID and secret.
- **Support emails:** Contact page and Help and support both send a confirmation to the sender and a notification with
  name, email, subject and message to support@devopseasylearning.com (tested in the API e2e and seen in the test inbox).
- **Light theme** is the default everywhere; dark stays available and remembered.
- **Emails** use one dark design in every client.

## 3. Tests (fresh `del-test` stack, `MFA_REQUIRED=true`)

| Suite | Result |
| --- | --- |
| API unit + end to end | 223 / 223 |
| API smoke script | 147 / 147 (also on the Debian 13 image) |
| Playwright | 48 / 48 |
| Contrast and overflow scan | 156 checks clean: light at 390/768/1440/1920 on public pages, all studios as student, instructor and super admin; dark on public and admin pages |
| Web typecheck + lint, API typecheck | clean (lint: 6 warnings, 0 errors) |
| GitHub CI | green |

## 4. Release status

See the summary given to the owner and docs/AWS_COSTS.md for the cost estimate.
