# Receipts (owner 2026-11-27)

The official receipt is **"Corporate Professional"** (option 1 of `docs/research/receipts/options-2026-11-27.html`,
chosen by the owner). Every paid order gets one automatically; the web page and the PDF are drawn from the same view
model, so they always agree. Receipts are **private**: only the buyer and admins with the `orders.view` permission can
open them (unlike certificates, there is no public link).

## What it shows
- **Header:** DEL logo and company name, support email · website; on the right "Receipt", the receipt number and a status
  pill (Paid / Paid · partly refunded / Refunded); a strong rule.
- **Facts row:** purchase date, payment date, payment method ("Visa ending in 4242", "Apple Pay (Visa ending in 4242)",
  "Test payment", "Free"), order reference (`ORD-XXXXXXXX`).
- **From / Billed to:** company details from Super Admin › Settings › *Company details on receipts* (registered name,
  business address, tax ID, support email, website). Address and tax ID appear only once set; nothing is invented.
  Billed to = the buyer's name and email.
- **Course table:** Course · Qty · Unit price · Discount · Amount (sale label under the title, "Refunded <date>" on a
  refunded line). Long titles wrap; a long order continues on page 2 with the header repeated.
- **References and totals:** transaction reference (Stripe PaymentIntent id) and currency on the left; Subtotal,
  Discounts, Tax ("Tax" when added, "Includes tax" when inside the prices), **Total paid** (large), then each refund
  with its date and **Net paid**.
- **Footer:** "Thank you for choosing DevOps Easy Learning." + the help email; one line: 12 months of access, terms and
  refund policy accepted at checkout apply. The acceptance records (version, time, IP) stay in the database.

## Numbers and references
- **Receipt number** `DEL-RCP-<payment year>-<6 digits>` from the Postgres sequence `receipt_number_seq`, stored in
  `orders.receiptNumber` (unique). Assigned **once**, inside the fulfilment transaction right after the order flips to
  paid (`apps/api/src/receipts/receipt-number.ts › assignReceiptNumber`, called from `commerce/fulfilment.service.ts`).
  A duplicate webhook never flips the order again, and the `receiptNumber: null` guard makes even a repeated call
  harmless. Paid orders from before 2026-11-27 were numbered by the migration in payment order
  (`20261127150000_order_receipts`).
- **Order reference** `ORD-` + 8 Crockford base32 characters = the first 40 bits of the order uuid (`orderRef`);
  deterministic, not stored, reversible to the uuid prefix for search (`orderRefToIdPrefix`). The uuid stays the key.

## Amounts and Stripe
- Amounts come only from what was recorded at purchase: order lines (`priceCents`, `listPriceCents`, `saleKind`),
  `orders.taxCents`, `orders.totalCents`, and refunded lines (`refundedAt`). Today's course price is never used.
- **Payment method:** `orders.paymentBrand`, `paymentLast4`, `paymentWallet` are read from the Stripe charge's
  `payment_method_details` after payment (`ReceiptsService.capturePaymentMethod`, called after fulfilment), and again on
  first view if missing. Only the last four digits are ever stored or shown.
- The receipt feature only reads money; payment processing, commission, pricing and revenue logic are unchanged.
- Currency: USD today; the receipt prints the order's currency code.

## Files and endpoints
| Piece | Path |
|---|---|
| View model, totals, method label | `apps/api/src/receipts/receipt-model.ts` |
| Numbers and references | `apps/api/src/receipts/receipt-number.ts` |
| PDF (pdf-lib, vector text, embedded Atkinson Hyperlegible Next, Schibsted Grotesk, JetBrains Mono; Letter 612×792 / A4 595×842 pt) | `apps/api/src/receipts/receipt-pdf.ts` (`RECEIPT_PDF_VERSION`) |
| Service (company details, access, resend, Stripe method) | `apps/api/src/receipts/receipts.service.ts` |
| Routes | `apps/api/src/receipts/receipts.controller.ts` |
| Web document (same design, fixed white in both themes, print rules) | `apps/web/src/components/receipt/ReceiptDocument.tsx` |
| Buyer page | `apps/web/src/app/student/purchases/[id]/page.tsx` (Download Receipt, Letter/A4; Print Receipt) |
| Admin | `apps/web/src/app/admin/orders/page.tsx` (receipt no., search, Download receipt, Resend receipt email), `admin/settings/page.tsx` (company details) |
| Tests | `apps/api/src/receipts/receipts.spec.ts`, `apps/api/test/receipts.e2e-spec.ts`, `commerce/fulfilment.service.spec.ts` |

| Endpoint | Who |
|---|---|
| `GET /api/orders/:id/receipt` · `GET /api/orders/:id/receipt.pdf?paper=letter\|a4` | the buyer only (others: 404; signed out: 401) |
| `GET /api/admin/orders/:id/receipt` · `.pdf` · `POST …/receipt/resend` | admins with `orders.view` (resend is audited, `order.receipt_resent`) |
| `GET/PUT /api/admin/settings/company` | super admin (audited, `settings.company_updated`) |
| `GET /api/admin/orders?q=` | also finds `DEL-RCP-…` numbers and `ORD-…` references |
Pending and failed orders have no receipt (404). PDFs are sent `Cache-Control: private, no-store`.

## Email
The purchase confirmation (`order-receipt` template) shows the receipt number and the link
`/student/purchases/<order id>` (sign-in required, no public token). No PDF attachment.

## Changing the design
Change both `ReceiptDocument.tsx` and `receipt-pdf.ts` together, bump `RECEIPT_PDF_VERSION`, and re-run the checks
below. Keep the owner's rules: white document in both themes, actions outside the document, no policy paragraphs.

## QA (every change)
- `npm run test:unit -w apps/api -- receipts` (numbering, totals, refunds, method label, PDF 1 page Letter/A4, long
  names, a 26-course order on 2 pages) and `test/receipts.e2e-spec.ts` (privacy, duplicates, PDF, refunds, search,
  company details, resend).
- On a test stack: a single, multi-course, sale, refunded order; open `/student/purchases/<id>` at 390/1440/1920 in
  light and dark; download both PDFs (`pdfinfo`: 1 page, right size; look at page 1); print preview shows only the
  document; `node scripts/qa-dark.mjs --as student /student/purchases/<id>`.
