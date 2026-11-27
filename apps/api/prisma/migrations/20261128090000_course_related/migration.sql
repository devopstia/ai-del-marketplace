-- "Continue your learning journey" (owner 2026-11-28): recommended next courses per course.
CREATE TABLE "course_related" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "relatedCourseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "course_related_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_related_courseId_relatedCourseId_key" ON "course_related"("courseId", "relatedCourseId");
CREATE INDEX "course_related_courseId_position_idx" ON "course_related"("courseId", "position");

ALTER TABLE "course_related" ADD CONSTRAINT "course_related_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_related" ADD CONSTRAINT "course_related_relatedCourseId_fkey" FOREIGN KEY ("relatedCourseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
