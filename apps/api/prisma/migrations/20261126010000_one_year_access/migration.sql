-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RefundRequestStatus" ADD VALUE 'auto_approved';
ALTER TYPE "RefundRequestStatus" ADD VALUE 'auto_declined';

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "remindersSent" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "lecture_progress" ADD COLUMN     "watchedRanges" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "watchedSec" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "refund_requests" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "access_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_periods_orderLineId_key" ON "access_periods"("orderLineId");

-- CreateIndex
CREATE INDEX "access_periods_userId_courseId_idx" ON "access_periods"("userId", "courseId");

-- CreateIndex
CREATE INDEX "enrollments_accessExpiresAt_idx" ON "enrollments"("accessExpiresAt");


-- Owner 2026-11-25: purchases give one year of access, not lifetime. Everyone already enrolled through a purchase gets
-- one year from today (nobody loses access suddenly). Free and admin enrolments keep no expiry.
UPDATE "enrollments" SET "accessExpiresAt" = CURRENT_TIMESTAMP + INTERVAL '1 year'
WHERE "source" = 'purchase' AND "revokedAt" IS NULL AND "accessExpiresAt" IS NULL;
INSERT INTO "access_periods" ("id", "userId", "courseId", "orderLineId", "startsAt", "endsAt")
SELECT gen_random_uuid()::text, e."userId", e."courseId", e."orderLineId", CURRENT_TIMESTAMP, e."accessExpiresAt"
FROM "enrollments" e WHERE e."source" = 'purchase' AND e."revokedAt" IS NULL AND e."accessExpiresAt" IS NOT NULL;
-- Existing progress: a completed lecture counts as watched in full, otherwise up to the saved position.
UPDATE "lecture_progress" lp SET "watchedSec" = LEAST(l."durationSec", CASE WHEN lp."completed" THEN l."durationSec" ELSE lp."positionSec" END),
  "watchedRanges" = jsonb_build_array(jsonb_build_array(0, LEAST(l."durationSec", CASE WHEN lp."completed" THEN l."durationSec" ELSE lp."positionSec" END)))
FROM "lectures" l WHERE l."id" = lp."lectureId";
