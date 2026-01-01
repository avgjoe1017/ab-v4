-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "sessionId" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Job" ("createdAt", "error", "id", "payload", "result", "status", "type", "updatedAt") SELECT "createdAt", "error", "id", "payload", "result", "status", "type", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE INDEX "Job_status_idx" ON "Job"("status");
CREATE INDEX "Job_type_idx" ON "Job"("type");
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");
CREATE INDEX "Job_sessionId_idx" ON "Job"("sessionId");
CREATE INDEX "Job_userId_idx" ON "Job"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
