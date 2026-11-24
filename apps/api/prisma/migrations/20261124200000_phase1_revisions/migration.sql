-- Phase 1: revisions for published courses, last-verified date.

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('draft', 'in_review', 'changes_requested', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "lectures" ADD COLUMN "summary" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "course_revisions" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'draft',
    "snapshot" JSONB NOT NULL,
    "reviewNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_revisions_courseId_status_idx" ON "course_revisions"("courseId", "status");

-- CreateIndex
CREATE INDEX "course_revisions_status_submittedAt_idx" ON "course_revisions"("status", "submittedAt");

-- AddForeignKey
ALTER TABLE "course_revisions" ADD CONSTRAINT "course_revisions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
