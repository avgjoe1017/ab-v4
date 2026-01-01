-- CreateTable
CREATE TABLE "SessionAudioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lineIndex" INTEGER,
    "storageKey" TEXT NOT NULL,
    "audioAssetId" TEXT,
    "durationMs" INTEGER,
    "codec" TEXT,
    "sampleRate" INTEGER,
    "channels" INTEGER,
    "fileSize" INTEGER,
    "checksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionAudioAsset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SessionAudio" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionAudioAsset_audioAssetId_fkey" FOREIGN KEY ("audioAssetId") REFERENCES "AudioAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SessionAudioAsset_sessionId_idx" ON "SessionAudioAsset"("sessionId");

-- CreateIndex
CREATE INDEX "SessionAudioAsset_sessionId_kind_idx" ON "SessionAudioAsset"("sessionId", "kind");

-- CreateIndex
CREATE INDEX "SessionAudioAsset_sessionId_kind_lineIndex_idx" ON "SessionAudioAsset"("sessionId", "kind", "lineIndex");
