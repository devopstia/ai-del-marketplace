-- Super Admin portal (owner 2026-11-26, docs/SUPER_ADMIN.md): account states, temporary passwords, course archive and
-- soft deletion, featured courses. Role Management settings live in platform_settings (key role_permissions).
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'disabled';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'deleted';

ALTER TABLE "users"
  ADD COLUMN "suspendedUntil" TIMESTAMP(3),
  ADD COLUMN "statusReason" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "courses"
  ADD COLUMN "featuredAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archiveReason" TEXT,
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "statusBeforeArchive" "CourseStatus",
  ADD COLUMN "deleteRequestedAt" TIMESTAMP(3),
  ADD COLUMN "deleteAfter" TIMESTAMP(3),
  ADD COLUMN "purgedAt" TIMESTAMP(3);

CREATE INDEX "courses_archivedAt_idx" ON "courses"("archivedAt");
CREATE INDEX "courses_deleteAfter_idx" ON "courses"("deleteAfter");
