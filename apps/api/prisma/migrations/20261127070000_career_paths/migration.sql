-- Career paths (owner 2026-11-26, idea 4): docs/CAREER_PATHS.md.

-- CreateTable
CREATE TABLE "career_paths" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_path_steps" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "career_path_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_path_follows" (
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "hoursPerWeek" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "career_path_follows_pkey" PRIMARY KEY ("userId","pathId")
);

-- CreateIndex
CREATE UNIQUE INDEX "career_paths_slug_key" ON "career_paths"("slug");

-- CreateIndex
CREATE INDEX "career_paths_status_idx" ON "career_paths"("status");

-- CreateIndex
CREATE INDEX "career_path_steps_pathId_position_idx" ON "career_path_steps"("pathId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "career_path_steps_pathId_courseId_key" ON "career_path_steps"("pathId", "courseId");

-- CreateIndex
CREATE INDEX "career_path_follows_pathId_idx" ON "career_path_follows"("pathId");

-- AddForeignKey
ALTER TABLE "career_path_steps" ADD CONSTRAINT "career_path_steps_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "career_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_steps" ADD CONSTRAINT "career_path_steps_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_follows" ADD CONSTRAINT "career_path_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_path_follows" ADD CONSTRAINT "career_path_follows_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "career_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
