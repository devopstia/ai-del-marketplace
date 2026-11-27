-- Certificates can be revoked by a super admin (owner 2026-11-27); the record is kept and the public check shows "Revoked".
ALTER TABLE "certificates" ADD COLUMN "revokedAt" TIMESTAMP(3);
ALTER TABLE "certificates" ADD COLUMN "revokedReason" TEXT;
ALTER TABLE "certificates" ADD COLUMN "revokedById" TEXT;
