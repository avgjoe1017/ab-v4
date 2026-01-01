-- CreateTable
CREATE TABLE "AISourceVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promptTemplateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "voice" TEXT,
    "cachingPolicy" TEXT,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" DATETIME,
    CONSTRAINT "AISourceVersion_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "AISourcePromptTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AISourcePromptTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "AISourceVersion_promptTemplateId_idx" ON "AISourceVersion"("promptTemplateId");

-- CreateIndex
CREATE INDEX "AISourceVersion_promptTemplateId_isActive_idx" ON "AISourceVersion"("promptTemplateId", "isActive");

-- CreateIndex
CREATE INDEX "AISourceVersion_createdAt_idx" ON "AISourceVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AISourceVersion_promptTemplateId_version_key" ON "AISourceVersion"("promptTemplateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AISourcePromptTemplate_name_key" ON "AISourcePromptTemplate"("name");

-- CreateIndex
CREATE INDEX "AISourcePromptTemplate_name_idx" ON "AISourcePromptTemplate"("name");
