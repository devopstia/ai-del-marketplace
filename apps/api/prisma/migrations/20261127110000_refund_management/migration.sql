-- Refund management (owner 2026-11-26; docs/ACCESS_AND_REFUNDS.md): versioned refund policy, payment state on refund
-- requests, the paid-video length at purchase, study material downloads and in-platform notifications.

CREATE TABLE "refund_policies" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "maxWatchedPercent" DOUBLE PRECISION NOT NULL,
    "autoCheck" BOOLEAN NOT NULL DEFAULT true,
    "autoReject" BOOLEAN NOT NULL DEFAULT true,
    "autoApprove" BOOLEAN NOT NULL DEFAULT true,
    "allowExceptions" BOOLEAN NOT NULL DEFAULT true,
    "selfServicePerYear" INTEGER NOT NULL DEFAULT 3,
    "messages" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refund_policies_version_key" ON "refund_policies"("version");
CREATE INDEX "refund_policies_effectiveFrom_idx" ON "refund_policies"("effectiveFrom");

-- Version 1 = the rules every existing order was sold under (14 days, 25 %, decided automatically, 3 a year).
INSERT INTO "refund_policies" ("id", "version", "windowDays", "maxWatchedPercent", "note", "effectiveFrom")
VALUES ('00000000-0000-4000-8000-000000000001', 1, 14, 25, 'Launch policy (owner 2026-11-25)', '2020-01-01T00:00:00Z');

ALTER TABLE "orders" ADD COLUMN "refundPolicyId" TEXT;
UPDATE "orders" SET "refundPolicyId" = '00000000-0000-4000-8000-000000000001' WHERE "paidAt" IS NOT NULL;
ALTER TABLE "orders" ADD CONSTRAINT "orders_refundPolicyId_fkey" FOREIGN KEY ("refundPolicyId") REFERENCES "refund_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_lines" ADD COLUMN "paidVideoSecAtPurchase" INTEGER;

ALTER TABLE "refund_requests" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "stripeRefundId" TEXT,
ADD COLUMN "paymentError" TEXT,
ADD COLUMN "investigation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "message" TEXT,
ADD COLUMN "policyVersion" INTEGER,
ADD COLUMN "override" BOOLEAN NOT NULL DEFAULT false;
-- Requests refunded before this change were confirmed at the time.
UPDATE "refund_requests" SET "paymentStatus" = 'succeeded', "policyVersion" = 1 WHERE "status" IN ('approved', 'auto_approved');
UPDATE "refund_requests" SET "policyVersion" = 1 WHERE "policyVersion" IS NULL;

CREATE TABLE "resource_downloads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "resourceId" TEXT,
    "courseResourceId" TEXT,
    "title" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_downloads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "resource_downloads_userId_courseId_at_idx" ON "resource_downloads"("userId", "courseId", "at");

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
