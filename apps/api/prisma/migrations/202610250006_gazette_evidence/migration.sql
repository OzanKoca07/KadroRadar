-- Additive evidence metadata; existing historical data is unchanged.
ALTER TABLE "Announcement" ALTER COLUMN "sourceUrl" DROP NOT NULL;
ALTER TABLE "Announcement" ADD COLUMN "sourceEvidence" JSONB;
ALTER TABLE "AnnouncementPosition" ALTER COLUMN "sourceUrl" DROP NOT NULL;
ALTER TABLE "AnnouncementPosition" ADD COLUMN "sourceEvidence" JSONB;
ALTER TABLE "AnnouncementImportRow" ADD COLUMN "sourceDocumentId" TEXT;
ALTER TABLE "AnnouncementImportRow" ADD CONSTRAINT "AnnouncementImportRow_sourceDocumentId_fkey"
 FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL;
