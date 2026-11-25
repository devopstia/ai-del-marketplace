-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "coverHash" TEXT,
ADD COLUMN     "coverKey" TEXT,
ADD COLUMN     "coverTemplateId" TEXT;

-- CreateTable
CREATE TABLE "cover_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "palette" JSONB NOT NULL,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "group" TEXT NOT NULL DEFAULT 'generic',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cover_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cover_templates_key_key" ON "cover_templates"("key");

-- CreateIndex
CREATE INDEX "cover_templates_active_sort_idx" ON "cover_templates"("active", "sort");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_coverTemplateId_fkey" FOREIGN KEY ("coverTemplateId") REFERENCES "cover_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

