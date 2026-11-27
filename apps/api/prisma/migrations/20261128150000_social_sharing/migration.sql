-- Sharing banners (owner 2026-11-28, docs/SOCIAL_SHARING.md)
ALTER TABLE "courses" ADD COLUMN "shareFamily" TEXT,
  ADD COLUMN "shareTemplate" TEXT,
  ADD COLUMN "shareHeadline" TEXT,
  ADD COLUMN "shareUploadKey" TEXT,
  ADD COLUMN "shareKey" TEXT,
  ADD COLUMN "shareHash" TEXT;
