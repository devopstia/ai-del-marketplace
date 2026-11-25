-- Payments v2 (owner-approved docs/PAYMENTS_PROPOSAL.md): after-fee split, payout hold, refunds, disputes, overrides.
-- CreateEnum
CREATE TYPE "Payee" AS ENUM ('instructor', 'platform', 'del_agreement');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'won', 'lost');

-- CreateEnum
CREATE TYPE "RefundRequestStatus" AS ENUM ('pending', 'approved', 'declined');

-- AlterTable
ALTER TABLE "instructor_profiles" ADD COLUMN     "commissionBps" INTEGER,
ADD COLUMN     "payToPlatform" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "termsNote" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "balanceTxnId" TEXT,
ADD COLUMN     "feeSource" TEXT,
ADD COLUMN     "immediateAccessConsentAt" TIMESTAMP(3),
ADD COLUMN     "refundEligibleUntil" TIMESTAMP(3),
ADD COLUMN     "stripeFeeCents" INTEGER,
ADD COLUMN     "taxCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "disputeStatus" "DisputeStatus",
ADD COLUMN     "feeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "netCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payee" "Payee" NOT NULL DEFAULT 'instructor',
ADD COLUMN     "transferDueAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "reason" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_requests" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lineIds" TEXT[],
    "reason" TEXT,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'pending',
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_instructorId_createdAt_idx" ON "ledger_entries"("instructorId", "createdAt");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "refund_requests_status_createdAt_idx" ON "refund_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: lines sold before this change were split on the gross price with no fee recorded.
UPDATE "order_lines" SET "netCents" = "priceCents" WHERE "netCents" = 0;
UPDATE "order_lines" SET "payee" = 'platform' WHERE "commissionBps" = 10000;
UPDATE "orders" SET "refundEligibleUntil" = "paidAt" + INTERVAL '14 days' WHERE "paidAt" IS NOT NULL AND "refundEligibleUntil" IS NULL;
UPDATE "orders" SET "feeSource" = 'none' WHERE "feeSource" IS NULL AND "status" <> 'pending';
