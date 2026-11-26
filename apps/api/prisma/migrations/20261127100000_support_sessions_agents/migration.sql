-- Support sessions, AI agent tokens, resumable uploads; audit attribution (docs/SUPPORT_SESSIONS_AND_AGENTS.md)
ALTER TABLE "audit_logs" ADD COLUMN "onBehalfOfId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "agentTokenId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "supportSessionId" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ok';
CREATE INDEX "audit_logs_onBehalfOfId_idx" ON "audit_logs"("onBehalfOfId");
CREATE INDEX "audit_logs_agentTokenId_idx" ON "audit_logs"("agentTokenId");
CREATE INDEX "audit_logs_supportSessionId_idx" ON "audit_logs"("supportSessionId");

CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "adminSessionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_sessions_actorId_startedAt_idx" ON "support_sessions"("actorId", "startedAt");
CREATE INDEX "support_sessions_subjectId_startedAt_idx" ON "support_sessions"("subjectId", "startedAt");

CREATE TABLE "agent_tokens" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "scopes" TEXT[],
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "agent_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_tokens_tokenHash_key" ON "agent_tokens"("tokenHash");
CREATE INDEX "agent_tokens_instructorId_idx" ON "agent_tokens"("instructorId");

CREATE TABLE "upload_sessions" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT,
    "storageKey" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "partSize" INTEGER NOT NULL,
    "assetId" TEXT,
    "courseId" TEXT,
    "agentTokenId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "upload_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "upload_sessions_ownerId_sha256_idx" ON "upload_sessions"("ownerId", "sha256");
CREATE INDEX "upload_sessions_assetId_idx" ON "upload_sessions"("assetId");
