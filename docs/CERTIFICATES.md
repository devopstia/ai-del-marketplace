# Certificates

Official design: **Academic Excellence** (owner's choice, 2026-11-27, from the five options in
`docs/research/certificates/options-2026-11-27.html`). Every course on the marketplace uses this one template.

## What a certificate is
A certificate of course **completion** from DevOps Easy Learning, never an accredited qualification ("certified" or
"accredited" never appear). One landscape page, US Letter or A4, fixed colours (ivory paper, navy, gold; never follows the
viewer's light/dark theme). It shows only:
- the DEL logo and name, "Certificate of Completion";
- the learner's full name and the course title (the two most prominent elements; they shrink, then wrap to two lines,
  and never overflow);
- "is hereby presented to" / "for successfully completing the course", the completion date and the total video length;
- the **institutional signature**: "Issued and verified by / Authorized Representative / DevOps Easy Learning" and the
  official DEL seal in the centre, applied automatically to every certificate (`SIGNATURE` in the renderer). Nobody signs
  anything and no person's handwriting is imitated;
- the certificate ID, the short verification address (`ai-devopseasylearning.com/certificates`) and a QR code that
  opens `https://ai-devopseasylearning.com/certificates/<ID>`.

## Lifecycle (automatic)
1. **Issued** the moment an enrolled learner has completed every lesson (`LearningService.issueIfComplete`, called after
   lesson progress and after a passed quiz). The learner may also press "Get your certificate"; both give the same one.
   Code `DEL-` + 9 random characters; unique per learner and course. Audit: `certificate.issued`.
2. **Kept for good**: adding lessons to the course or the end of the 12-month access never removes or changes it.
3. **Verified** by anyone, without an account: scan the QR (opens `/certificates/<ID>`) or type the ID at
   `/certificates/verify` ("Verify a certificate" in the public footer, Learn column). Both read the database record:
   - **Valid**: green panel with the name, course, issuer, completion date and ID;
   - **Revoked**: red panel with the revocation date; the image and downloads carry a diagonal **REVOKED** mark
     (downloads stay possible so a holder can see what was revoked); LinkedIn sharing is hidden;
   - **Invalid**: no certificate has this ID (404).
   Never shown: email, quiz scores, payments, account details. The page is `noindex`.
4. **Revoked / restored** only by a super admin (Super Admin › Certificates): reason + authenticator code, audited
   (`certificate.revoked`, `certificate.restored`). The record is kept.
5. **Re-render** (Super Admin › Certificates): redraws with the current name, course title and template; the ID never
   changes (`certificate.rerendered`).

## Implementation
| Piece | Where |
|---|---|
| Renderer (single source of truth) | `apps/api/src/certificates/certificate-render.ts`: SVG with all text as paths (opentype.js, EB Garamond + Schibsted Grotesk from `apps/api/assets/fonts`), QR from `qrcode`; PNG at 300 dpi (resvg: 3300 px Letter, 3508 px A4); PDF = that PNG on one page of the exact size (792×612 pt / 841.89×595.28 pt), written without extra libraries. `RENDER_VERSION` = `a1` |
| Service | `certificates.service.ts`: data from the record, in-memory render cache (64 MB, keyed by code + paper + format + version + data hash), admin list/revoke/restore/re-render |
| Public endpoints (rate limited) | `GET /api/certificates/:code` (verification JSON: `status`, `valid`, `issuer`, `studentName`, `course`, `issuedAt`, `revokedAt`, `code`, `url`, `linkedInUrl`), `GET /api/certificates/:code/certificate.svg\|.png\|.pdf?paper=letter\|a4` (PNG/PDF as attachments named `DEL-certificate-<ID>[-A4].<ext>`) |
| Admin endpoints (super admin) | `GET /api/admin/certificates?q=` (student, course or ID), `GET /api/admin/certificates/template.svg` (sample data), `POST /api/admin/certificates/:code/revoke\|restore` `{reason, code}`, `POST …/rerender` |
| Database | `certificates`: `code`, `issuedAt`, `revokedAt`, `revokedReason`, `revokedById` (migration `20261127140000_certificate_revocation`) |
| Public page | `apps/web/src/app/(site)/certificates/[code]/page.tsx`: verification panel, the certificate image (`certificate.svg`), actions outside it (`components/CertificateActions.tsx`: PDF Letter, PDF A4, PNG, Print, Copy link, Add to LinkedIn) |
| Print | `/print/certificates/<ID>[?paper=a4]` (`app/print/…`): only the certificate, `@page` landscape with no margins, print dialog opens by itself |
| Student Studio | Learning progress: "View certificate" per course, and "Your certificates" (all earned, including expired courses) with View, PDF, PNG |
| Super Admin | `/admin/certificates` (menu: Platform › Certificates): template preview, search, revoke/restore, re-render |

### Changing the template
Edit `renderCertificateSvg` (layout, colours `C`, `SIGNATURE`, seal), keep every element inside the inner frame (the unit
test checks each text box and the footer), bump `RENDER_VERSION`, run `npx jest src/certificates` in apps/api (renders
Letter and A4 with short and long names and decodes the QR from the PNG), look at the PNGs, and get the owner's approval.
Only one template exists; choosing between several templates in the admin is not built (the owner picked one).

## PDF digital signature (investigated, not built)
A PDF signature (PAdES) proves the file wasn't changed, but readers only show it as trusted when the signing certificate
chains to Adobe's trust list (AATL) or a CA the reader trusts. Options:
1. **AATL document-signing certificate** (e.g. from a public CA, roughly USD 300–600 a year, delivered on a hardware token
   or a cloud HSM such as AWS KMS-backed signing): Acrobat shows "Signed by DevOps Easy Learning, valid". Needs the owner
   to buy and verify the organisation; signing would run in the API with the key in KMS, never in the repo.
2. **Self-signed certificate**: free, but Acrobat shows "validity unknown", which looks worse to an employer than no
   signature.
Recommendation: rely on the QR / ID check against the database (it is the authority and also shows revocations); add an
AATL signature later only if employers ask for signed PDFs.

## QA (every change to certificates)
`npx jest src/certificates` (apps/api) · the certificates e2e test in `test/app.e2e-spec.ts` · on a test stack: a
learner completes a course → the certificate appears automatically; open `/certificates/<ID>` (valid), revoke it in Super
Admin (revoked, REVOKED mark), restore it; `/certificates/verify?code=DEL-NOPE` (invalid); download PDF Letter and A4
(`pdfinfo`: 1 page, 792×612 / 842×595 pt) and PNG; print preview shows one page with nothing from the site; scan the QR
with a phone; `node scripts/qa-dark.mjs /certificates/<ID>` light and dark.
