-- CreateTable
CREATE TABLE "UserValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "valueId" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "rank" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserValue_userId_idx" ON "UserValue"("userId");

-- CreateIndex
CREATE INDEX "UserValue_userId_rank_idx" ON "UserValue"("userId", "rank");
