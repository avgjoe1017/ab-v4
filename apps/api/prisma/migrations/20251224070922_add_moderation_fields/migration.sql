-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SessionAffirmation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "moderationStatus" TEXT NOT NULL DEFAULT 'pending',
    "moderationReason" TEXT,
    "moderatedBy" TEXT,
    "moderatedAt" DATETIME,
    "originalText" TEXT,
    "autoFlagged" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SessionAffirmation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SessionAffirmation" ("id", "idx", "sessionId", "text") SELECT "id", "idx", "sessionId", "text" FROM "SessionAffirmation";
DROP TABLE "SessionAffirmation";
ALTER TABLE "new_SessionAffirmation" RENAME TO "SessionAffirmation";
CREATE INDEX "SessionAffirmation_sessionId_idx" ON "SessionAffirmation"("sessionId");
CREATE INDEX "SessionAffirmation_moderationStatus_idx" ON "SessionAffirmation"("moderationStatus");
CREATE INDEX "SessionAffirmation_sessionId_moderationStatus_idx" ON "SessionAffirmation"("sessionId", "moderationStatus");
CREATE UNIQUE INDEX "SessionAffirmation_sessionId_idx_key" ON "SessionAffirmation"("sessionId", "idx");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
