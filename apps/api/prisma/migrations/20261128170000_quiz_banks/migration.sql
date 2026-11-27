-- Quiz banks and assessments (owner 2026-11-28): quiz-level settings and per-student bookmarks.
ALTER TABLE "quizzes" ADD COLUMN "settings" JSONB;

CREATE TABLE "quiz_bookmarks" (
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_bookmarks_pkey" PRIMARY KEY ("userId","quizId","questionId")
);

ALTER TABLE "quiz_bookmarks" ADD CONSTRAINT "quiz_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_bookmarks" ADD CONSTRAINT "quiz_bookmarks_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
