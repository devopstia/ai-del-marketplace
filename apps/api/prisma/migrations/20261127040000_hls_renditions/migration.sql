-- Adaptive playback: several qualities per packaged video (owner 2026-11-26).
ALTER TABLE "video_assets" ADD COLUMN "hlsVariants" JSONB;
