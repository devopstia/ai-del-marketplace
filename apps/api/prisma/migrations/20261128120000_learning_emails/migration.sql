-- Free-course learning emails (owner 2026-11-28): which nudges an enrolment received, and a per-user opt-out.
ALTER TABLE "enrollments" ADD COLUMN "nudgesSent" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "learningEmailsOptOutAt" TIMESTAMP(3);
