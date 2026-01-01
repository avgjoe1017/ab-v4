-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Preferences" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "schemaVersion" INTEGER NOT NULL,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goalTag" TEXT,
    "durationSec" INTEGER,
    "voiceId" TEXT NOT NULL,
    "pace" TEXT,
    "affirmationSpacingMs" INTEGER,
    "affirmationsHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionAffirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "SessionAffirmation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "metaJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SessionAudio" (
    "sessionId" TEXT NOT NULL PRIMARY KEY,
    "mergedAudioAssetId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionAudio_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionAudio_mergedAudioAssetId_fkey" FOREIGN KEY ("mergedAudioAssetId") REFERENCES "AudioAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntitlementState" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "renewsAt" DATETIME,
    "source" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntitlementState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntitlementEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntitlementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_ownerUserId_idx" ON "Session"("ownerUserId");

-- CreateIndex
CREATE INDEX "Session_source_idx" ON "Session"("source");

-- CreateIndex
CREATE INDEX "Session_affirmationsHash_idx" ON "Session"("affirmationsHash");

-- CreateIndex
CREATE INDEX "SessionAffirmation_sessionId_idx" ON "SessionAffirmation"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionAffirmation_sessionId_idx_key" ON "SessionAffirmation"("sessionId", "idx");

-- CreateIndex
CREATE INDEX "AudioAsset_kind_idx" ON "AudioAsset"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "AudioAsset_kind_hash_key" ON "AudioAsset"("kind", "hash");

-- CreateIndex
CREATE INDEX "SessionAudio_mergedAudioAssetId_idx" ON "SessionAudio"("mergedAudioAssetId");

-- CreateIndex
CREATE INDEX "EntitlementEvent_userId_occurredAt_idx" ON "EntitlementEvent"("userId", "occurredAt");
