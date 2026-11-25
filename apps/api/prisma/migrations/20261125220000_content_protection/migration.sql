-- AlterTable
ALTER TABLE "video_assets" ADD COLUMN     "hlsAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hlsError" TEXT,
ADD COLUMN     "hlsIv" TEXT,
ADD COLUMN     "hlsKey" TEXT,
ADD COLUMN     "hlsPackagedAt" TIMESTAMP(3),
ADD COLUMN     "hlsPlaylist" TEXT,
ADD COLUMN     "hlsPrefix" TEXT,
ADD COLUMN     "hlsStatus" TEXT NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "playback_sessions" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "lectureId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playback_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "playback_sessions_ref_key" ON "playback_sessions"("ref");

-- CreateIndex
CREATE INDEX "playback_sessions_userId_createdAt_idx" ON "playback_sessions"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_sessions" ADD CONSTRAINT "playback_sessions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "video_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

