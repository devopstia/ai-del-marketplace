# Certificates (owner brief 2026-11-27, in progress)

Status: **five designs proposed, waiting for the owner's choice** (`docs/research/certificates/options-2026-11-27.html`,
also published as a private claude.ai page). Production keeps the current certificate until the owner approves one.

## Requirements (owner)
- One landscape page (US Letter and A4), fixed colours (never follow light/dark), PDF identical to the preview, no site
  navigation or buttons on the certificate; long names and titles must fit.
- Content only: DEL logo, "Certificate of Completion", student's full name and course title (most prominent), completion
  statement, completion date, course length, the **official DEL seal + "Authorized Representative · DevOps Easy
  Learning"** (applied automatically; never an imitation of a person's handwriting), certificate ID, QR code, short
  verification URL. Never "certified"/"accredited".
- QR → `https://ai-devopseasylearning.com/certificates/<ID>` (existing public page, checked against the database; no
  login, no typing). Manual check: `/certificates/verify` ("Verify a certificate" in the footer). States: valid,
  invalid, revoked. Shows only status, name, course, issuer, date, ID; no email, payments or account data.
- Fully automatic issuance on completion (existing `learning.service.ts`: certificate created when every lesson is
  complete, code `DEL-…`); issued certificates survive new lessons and access expiry.
- Student: view, PDF, PNG, print, copy link, LinkedIn, list in the Student Studio; actions outside the certificate.
- Super Admin (where supported): template preview/selection, seal settings, search, reissue/revoke, audit.
- PDF digital signature where supported.

## Existing implementation (reuse)
API `catalogue.service.ts` (public certificate by code), `learning.service.ts` (issuance), web
`app/(site)/certificates/[code]/page.tsx`, `/certificates/verify`, `components/CertificateShare.tsx`, `PrintButton`.
