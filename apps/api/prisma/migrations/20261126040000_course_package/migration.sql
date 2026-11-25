-- Complete course package: course-level downloads, next to per-lesson resources.
CREATE TABLE "course_resources" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_resources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "course_resources_courseId_position_idx" ON "course_resources"("courseId", "position");
ALTER TABLE "course_resources" ADD CONSTRAINT "course_resources_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
