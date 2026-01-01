-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "clientDeviceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "safetyFlags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "threadId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'collecting',
    "intentSummary" TEXT,
    "affirmationCount" INTEGER NOT NULL DEFAULT 6,
    "affirmations" TEXT NOT NULL,
    "voiceMode" TEXT NOT NULL DEFAULT 'male',
    "brainTrackMode" TEXT NOT NULL DEFAULT 'default',
    "brainTrackId" TEXT,
    "backgroundId" TEXT,
    "rerollCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanDraft_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intentSummary" TEXT,
    "affirmationCount" INTEGER NOT NULL,
    "affirmations" TEXT NOT NULL,
    "voiceConfig" TEXT NOT NULL,
    "audioConfig" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanSave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanSave_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "dateKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "refId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsageLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChatThread_userId_idx" ON "ChatThread"("userId");

-- CreateIndex
CREATE INDEX "ChatThread_userId_status_idx" ON "ChatThread"("userId", "status");

-- CreateIndex
CREATE INDEX "ChatThread_createdAt_idx" ON "ChatThread"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_idx" ON "ChatMessage"("threadId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanDraft_userId_idx" ON "PlanDraft"("userId");

-- CreateIndex
CREATE INDEX "PlanDraft_threadId_idx" ON "PlanDraft"("threadId");

-- CreateIndex
CREATE INDEX "PlanDraft_userId_state_idx" ON "PlanDraft"("userId", "state");

-- CreateIndex
CREATE INDEX "PlanDraft_createdAt_idx" ON "PlanDraft"("createdAt");

-- CreateIndex
CREATE INDEX "Plan_userId_idx" ON "Plan"("userId");

-- CreateIndex
CREATE INDEX "Plan_source_idx" ON "Plan"("source");

-- CreateIndex
CREATE INDEX "Plan_userId_source_idx" ON "Plan"("userId", "source");

-- CreateIndex
CREATE INDEX "Plan_createdAt_idx" ON "Plan"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSave_userId_planId_key" ON "PlanSave"("userId", "planId");

-- CreateIndex
CREATE INDEX "PlanSave_userId_idx" ON "PlanSave"("userId");

-- CreateIndex
CREATE INDEX "PlanSave_planId_idx" ON "PlanSave"("planId");

-- CreateIndex
CREATE INDEX "UsageLedger_userId_dateKey_idx" ON "UsageLedger"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "UsageLedger_userId_dateKey_eventType_idx" ON "UsageLedger"("userId", "dateKey", "eventType");

-- CreateIndex
CREATE INDEX "UsageLedger_dateKey_idx" ON "UsageLedger"("dateKey");

-- CreateIndex
CREATE INDEX "UsageLedger_refId_idx" ON "UsageLedger"("refId");

-- CreateIndex
CREATE INDEX "UsageLedger_createdAt_idx" ON "UsageLedger"("createdAt");

-- Add planId to Session table (backward compatibility for V4 Plans)
-- Note: This assumes Session table already exists from previous migrations
ALTER TABLE "Session" ADD COLUMN "planId" TEXT;
CREATE INDEX IF NOT EXISTS "Session_planId_idx" ON "Session"("planId");
