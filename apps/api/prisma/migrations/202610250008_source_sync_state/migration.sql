-- Additive operational metadata only. No changes to historical placements or announcements.
CREATE TABLE "SourceSyncState" (
 "id" TEXT NOT NULL,
 "lastAttemptAt" TIMESTAMP(3),
 "lastSuccessAt" TIMESTAMP(3),
 "nextAttemptAt" TIMESTAMP(3),
 "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
 "status" TEXT NOT NULL DEFAULT 'NEVER_RUN',
 "metrics" JSONB,
 "errorCode" TEXT,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SourceSyncState_pkey" PRIMARY KEY ("id")
);
