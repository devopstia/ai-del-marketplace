-- Contact page messages (with optional screenshots), emailed to DEL support.
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userId" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contact_messages_number_key" ON "contact_messages"("number");
CREATE INDEX "contact_messages_createdAt_idx" ON "contact_messages"("createdAt");
ALTER SEQUENCE "contact_messages_number_seq" RESTART WITH 1001;
