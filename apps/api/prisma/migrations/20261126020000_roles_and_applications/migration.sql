-- Four roles with explicit admin permissions, instructor applications, registration method and email verification.
ALTER TYPE "InstructorStatus" ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE "InstructorStatus" ADD VALUE IF NOT EXISTS 'needs_info';

ALTER TABLE "users" ADD COLUMN "adminPermissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "signupMethod" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "instructor_profiles" ADD COLUMN "expertise" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "instructor_profiles" ADD COLUMN "experience" TEXT NOT NULL DEFAULT '';
ALTER TABLE "instructor_profiles" ADD COLUMN "plannedCourses" TEXT NOT NULL DEFAULT '';
ALTER TABLE "instructor_profiles" ADD COLUMN "extraInfo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "instructor_profiles" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "instructor_profiles" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "instructor_profiles" ADD COLUMN "reviewedAt" TIMESTAMP(3);
UPDATE "instructor_profiles" SET "submittedAt" = "createdAt";

CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_verifications_userId_idx" ON "email_verifications"("userId");
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing admins keep everything they could do before (every operational permission).
UPDATE "users" SET "adminPermissions" = ARRAY['users.view','users.manage','instructors.review','courses.review','reviews.moderate','support.manage','enrollments.manage','orders.view','finance.view','refunds.decide','content.manage','promotions.view','audit.view']
WHERE 'admin' = ANY("roles") AND NOT ('super_admin' = ANY("roles"));

-- Registration method: provider-only accounts came from their first linked provider (which verified the email).
UPDATE "users" u SET "signupMethod" = i."provider", "emailVerifiedAt" = u."createdAt"
FROM (SELECT DISTINCT ON ("userId") "userId", "provider" FROM "auth_identities" ORDER BY "userId", "createdAt") i
WHERE i."userId" = u."id" AND u."passwordHash" IS NULL;
