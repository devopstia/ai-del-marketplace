-- CreateTable
CREATE TABLE "help_videos" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'everyone',
    "category" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "videoAssetId" TEXT,
    "coverKey" TEXT,
    "chapters" JSONB,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "help_videos_slug_key" ON "help_videos"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_videos_videoAssetId_key" ON "help_videos"("videoAssetId");

-- CreateIndex
CREATE INDEX "help_videos_published_category_sort_idx" ON "help_videos"("published", "category", "sort");

-- AddForeignKey
ALTER TABLE "help_videos" ADD CONSTRAINT "help_videos_videoAssetId_fkey" FOREIGN KEY ("videoAssetId") REFERENCES "video_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

