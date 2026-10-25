CREATE TABLE "AnnouncementSourceReference" (
 "id" TEXT PRIMARY KEY,
 "announcementId" TEXT NOT NULL REFERENCES "Announcement"("id") ON DELETE CASCADE,
 "importRowId" TEXT NOT NULL UNIQUE REFERENCES "AnnouncementImportRow"("id"),
 "evidence" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
