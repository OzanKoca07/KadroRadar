CREATE TABLE "ReviewAudit" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "batchId" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "actor" TEXT NOT NULL,
 "count" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ReviewAudit_batchId_createdAt_idx" ON "ReviewAudit"("batchId", "createdAt");
