-- Receipts (owner 2026-11-27, docs/RECEIPTS.md): a short customer-facing receipt number per paid order and the masked
-- payment method. Additive only: payment, commission and revenue logic are unchanged.
ALTER TABLE "orders" ADD COLUMN "receiptNumber" TEXT;
ALTER TABLE "orders" ADD COLUMN "paymentBrand" TEXT;
ALTER TABLE "orders" ADD COLUMN "paymentLast4" TEXT;
ALTER TABLE "orders" ADD COLUMN "paymentWallet" TEXT;
CREATE UNIQUE INDEX "orders_receiptNumber_key" ON "orders"("receiptNumber");

-- One sequence for all receipts; the year in the number is the payment year.
CREATE SEQUENCE IF NOT EXISTS "receipt_number_seq" START 1;

-- Already-paid orders get numbers in payment order; the sequence then continues after them.
UPDATE "orders" o
SET "receiptNumber" = 'DEL-RCP-' || to_char(COALESCE(b."paidAt", b."createdAt"), 'YYYY') || '-' || lpad(b.n::text, 6, '0')
FROM (
  SELECT id, "paidAt", "createdAt", row_number() OVER (ORDER BY COALESCE("paidAt", "createdAt"), id) AS n
  FROM "orders" WHERE status IN ('paid', 'refunded', 'partially_refunded') AND "receiptNumber" IS NULL
) b
WHERE o.id = b.id;
SELECT setval('receipt_number_seq', GREATEST((SELECT count(*) FROM "orders" WHERE "receiptNumber" IS NOT NULL), 1), (SELECT count(*) FROM "orders" WHERE "receiptNumber" IS NOT NULL) > 0);
