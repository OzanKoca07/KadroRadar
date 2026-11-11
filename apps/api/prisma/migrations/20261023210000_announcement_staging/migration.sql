-- Additive only: no historical table changes or data removal.
CREATE TABLE "AnnouncementImportRow" (
 "id" TEXT PRIMARY KEY,
 "sourceUrl" TEXT NOT NULL UNIQUE,
 "contentHash" TEXT NOT NULL,
 "raw" JSONB NOT NULL,
 "parsed" JSONB NOT NULL,
 "issues" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
 "version" INTEGER NOT NULL DEFAULT 1,
 "announcementId" TEXT UNIQUE REFERENCES "Announcement"("id"),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "AnnouncementReviewAudit" (
 "id" TEXT PRIMARY KEY,
 "rowId" TEXT NOT NULL REFERENCES "AnnouncementImportRow"("id"),
 "actor" TEXT NOT NULL,
 "action" TEXT NOT NULL,
 "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
