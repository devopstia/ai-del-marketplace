-- Manual enrollment, external payments, invitations (owner 2026-11-25).
ALTER TYPE "EnrollmentSource" ADD VALUE IF NOT EXISTS 'manual';
ALTER TABLE "access_periods" ADD COLUMN "manualItemId" TEXT;
CREATE UNIQUE INDEX "access_periods_manualItemId_key" ON "access_periods"("manualItemId");

CREATE TABLE "manual_enrollments" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "studentEmail" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentId" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "reviewNote" TEXT,
    "complimentary" BOOLEAN NOT NULL DEFAULT false,
    "complimentaryReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "manual_enrollments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "manual_enrollments_number_key" ON "manual_enrollments"("number");
CREATE INDEX "manual_enrollments_status_idx" ON "manual_enrollments"("status");
CREATE INDEX "manual_enrollments_requestedById_idx" ON "manual_enrollments"("requestedById");
CREATE INDEX "manual_enrollments_studentEmail_idx" ON "manual_enrollments"("studentEmail");
ALTER SEQUENCE "manual_enrollments_number_seq" RESTART WITH 1001;

CREATE TABLE "manual_enrollment_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "listPriceCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "manual_enrollment_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "manual_enrollment_items_requestId_courseId_key" ON "manual_enrollment_items"("requestId", "courseId");
CREATE INDEX "manual_enrollment_items_courseId_idx" ON "manual_enrollment_items"("courseId");
ALTER TABLE "manual_enrollment_items" ADD CONSTRAINT "manual_enrollment_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "manual_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "external_payments" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "usdRate" TEXT NOT NULL,
    "grossUsdCents" INTEGER NOT NULL,
    "feeUsdCents" INTEGER NOT NULL,
    "netUsdCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_payments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_payments_method_reference_key" ON "external_payments"("method", "reference");
ALTER TABLE "external_payments" ADD CONSTRAINT "external_payments_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "manual_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "external_payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "grossUsdCents" INTEGER NOT NULL,
    "feeUsdCents" INTEGER NOT NULL,
    "netUsdCents" INTEGER NOT NULL,
    "instructorCents" INTEGER NOT NULL,
    "platformCents" INTEGER NOT NULL,
    "payoutStatus" TEXT NOT NULL DEFAULT 'earnings_recorded',
    "payoutReference" TEXT,
    "payoutAt" TIMESTAMP(3),
    "payoutById" TEXT,
    CONSTRAINT "external_payment_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "external_payment_allocations_paymentId_itemId_key" ON "external_payment_allocations"("paymentId", "itemId");
CREATE INDEX "external_payment_allocations_instructorId_idx" ON "external_payment_allocations"("instructorId");
ALTER TABLE "external_payment_allocations" ADD CONSTRAINT "external_payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "external_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_payment_allocations" ADD CONSTRAINT "external_payment_allocations_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "manual_enrollment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeTries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");
CREATE INDEX "invitations_requestId_idx" ON "invitations"("requestId");
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "manual_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
