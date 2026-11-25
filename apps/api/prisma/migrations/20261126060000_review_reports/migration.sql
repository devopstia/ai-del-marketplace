-- Review moderation: instructor reports on reviews of their own courses.
CREATE TABLE "review_reports" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "review_reports_status_idx" ON "review_reports"("status");
CREATE INDEX "review_reports_reviewId_idx" ON "review_reports"("reviewId");
