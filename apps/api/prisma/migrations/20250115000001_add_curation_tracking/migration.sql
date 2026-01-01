-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "metadata" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurationPreferences" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "primaryGoal" TEXT,
    "voicePreference" TEXT,
    "soundPreference" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CurationPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "pathName" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL,
    "lastCompletedAt" DATETIME,
    "lastActionDone" BOOLEAN NOT NULL DEFAULT false,
    "selfRating" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPath_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SessionEvent_userId_occurredAt_idx" ON "SessionEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_idx" ON "SessionEvent"("sessionId");

-- CreateIndex
CREATE INDEX "SessionEvent_eventType_idx" ON "SessionEvent"("eventType");

-- CreateIndex
CREATE INDEX "SessionEvent_userId_eventType_occurredAt_idx" ON "SessionEvent"("userId", "eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPath_userId_pathId_key" ON "UserPath"("userId", "pathId");

-- CreateIndex
CREATE INDEX "UserPath_userId_isActive_idx" ON "UserPath"("userId", "isActive");

