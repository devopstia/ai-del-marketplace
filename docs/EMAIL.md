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
| Two-step sign-in reset, sign-in method linked/removed, roles changed | `security-mfa-reset`, `security-identity-linked`, `security-identity-unlinked`, `security-role-changed` |
| Purchase receipt (with access dates, renewals marked) | `order-receipt` |
| Access ends in 30/7/1 days, ended | `access-expiring`, `access-expired` |
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
