-- Session security (docs/AUTH.md §7): session kind, last activity, end reason, device id.
ALTER TABLE "sessions" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "sessions" ADD COLUMN "lastActiveAt" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN "endedReason" TEXT;
ALTER TABLE "sessions" ADD COLUMN "deviceId" TEXT;
UPDATE "sessions" SET "lastActiveAt" = "createdAt";
CREATE INDEX "sessions_userId_kind_revokedAt_idx" ON "sessions"("userId", "kind", "revokedAt");
