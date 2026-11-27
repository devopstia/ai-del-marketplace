# Email notifications

Owner, 2026-11-25: reuse Insurance Hub's email approach and templates, with the marketplace's own branding.

## How it works

1. Services queue an email: `jobs.sendEmail({ to, template, data, replyTo?, attachments?, dedupeKey? })`
   (`apps/api/src/common/jobs.ts`). Queuing never fails a business action.
2. The worker (`apps/api/src/worker/email.processor.ts`) renders the template and sends it; BullMQ retries 4 times
   with exponential back-off. `dedupeKey` becomes the job id, so a retried approval or webhook never emails twice.
3. Templates: `apps/api/src/email/templates.ts`; layout: `apps/api/src/email/layout.ts`, adapted from the Hub's
   `services/notification-service/app/templates/_base.html` (560px card, brand rule, logo + name in type,
   preheader, support footer, tables and inline styles). Added for DEL: DevOps Easy Learning branding and colours,
   **one dark design for every email** (owner, 2026-11-25: independent of the website's light default; colours inline and as
   `bgcolor` for Outlook, `color-scheme: dark` so dark-mode clients leave it alone), and a plain-text version of every email.
4. Providers (`apps/api/src/email/sender.ts`, `EMAIL_PROVIDER`): `ses` in production (Amazon SES through the server's instance role; `resend` also supported), `smtp`
   locally (the Mailpit container: **http://127.0.0.1:8025** shows every email), `console` in tests.
   Logs show only the template name and a masked address; bodies, codes and links are never logged.

## Settings (`.env`)

`EMAIL_PROVIDER`, `SMTP_URL`, `EMAIL_FROM` (`DevOps Easy Learning <no-reply@devopseasylearning.com>`),
`EMAIL_REPLY_TO` (`support@devopseasylearning.com`), `RESEND_API_KEY` (production only, never committed),
`CONTACT_EMAIL` (Contact page messages, default `support@devopseasylearning.com`).

## Emails

| Event | Template |
| --- | --- |
| Email sign-up (welcome + confirm address) / provider sign-up | `verify-email` / `welcome` |
| Password reset, password changed | `password-reset`, `security-password-changed` |
| Two-step sign-in reset, sign-in method linked/removed, roles changed, email changed by a super admin (to the old address) | `security-mfa-reset`, `security-identity-linked`, `security-identity-unlinked`, `security-role-changed`, `security-email-changed` |
| Email sign-in or confirmation code; new-device sign-in; account locked after wrong attempts (docs/AUTH.md §7) | `auth-email-code`, `security-new-device`, `security-account-locked` |
| A super admin opened your dashboard (support session); an AI agent got access to your courses | `security-support-session`, `security-agent-access` |
| Purchase receipt (with access dates, renewals marked) | `order-receipt` |
| Access ends in 30/7/1 days, ended | `access-expiring`, `access-expired` |
| **Free-course learning series** (owner 2026-11-28; `learning/nudges.ts`, hourly job `learning-nudges`): day 0–2 welcome + first lesson; day 3–5 "keep going" only under 20% progress; day 7–10 the paid courses the free course links to in its "continue your learning journey" lesson, minus owned ones (skipped when there are none). Only published free courses, active learners, not finished (no certificate), not the course's instructor, and not opted out. Each step once (`enrollments.nudgesSent` + `dedupeKey`); a step whose window has passed is skipped, never sent late | `learn-welcome`, `learn-keep-going`, `learn-next-courses` |
| **Course completed** (certificate issued automatically): certificate link, verify URL, Add to LinkedIn, and a rating request (`/learn/<slug>?tab=review`) when not yet reviewed. Once per certificate (`dedupeKey completed:<certificate id>`) | `course-completed` |
| Manual enrollment: one course / several, date extended | `course-access-activated`, `courses-assigned`, `course-access-extended` |
| Invitation, its confirmation code | `student-invitation`, `invitation-code` |
| Instructor request received / submitted to staff / approved / rejected / needs info | `manual-enrollment-request-received`, `manual-enrollment-submitted`, `manual-enrollment-approved`, `manual-enrollment-rejected`, `manual-enrollment-needs-info` |
| Refund received (waits for a person), approved and being processed, complete (provider confirmed), payment delayed, declined (the exact decision text with purchase date, deadline, period, consumption and limit, policy link and support), review received, declined after review. The Super Admin can add one paragraph per kind in Refunds › Policy | `refund-received`, `refund-processing`, `refund-approved`, `refund-delayed`, `refund-declined`, `refund-review-received`, `refund-declined-after-review` |
| Instructor application received / approved / rejected / needs info | `instructor-application-received`, `instructor-approved`, `instructor-rejected`, `instructor-needs-info` |
| Staff (optional, Super Admin › Settings) | `staff-new-registration` (off by default), `staff-instructor-application` (on) |
| Support replies | `support-reply`, `support-info-requested`, `support-resolved` |
| Contact page (to support, with screenshots attached; confirmation to the sender) | `contact-message`, `contact-received` |

Routine sign-ins never send email (owner). `npx jest src/email` renders every template and checks branding,
escaping and that nothing reads `undefined`.

## Learning tips opt-out (owner 2026-11-28)
The free-course series carries a one-click link (`/email/learning-emails?u=<user>&t=<HMAC of the user id with
SESSION_SECRET>`). The page asks for a click before changing anything, so mail scanners that open links never
unsubscribe anyone (`POST /api/email/learning-emails/link`, public, signed, rate-limited, audited). Signed-in learners
switch it in Student Studio › Account (`GET|POST /api/email/learning-emails`). Stored as `users.learningEmailsOptOutAt`.
Receipts, access, security and account emails are not affected.

**Reaching real buyers:** these emails go out through Amazon SES; until SES production access is granted (owner action,
`docs/IMPROVEMENTS.md` #1) SES only delivers to verified addresses, so real learners won't receive them yet.
