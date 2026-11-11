-- Additive migration. No historical placement modifications.
ALTER TABLE "CandidateProfile" ADD COLUMN "kpssScore" DOUBLE PRECISION,
 ADD COLUMN "kpssScoreType" TEXT, ADD COLUMN "examYear" INTEGER,
 ADD COLUMN "preferredCities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "ydsScore" DOUBLE PRECISION,
 ADD COLUMN "certificates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 ADD COLUMN "notificationConsent" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "CandidateSession" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "expiresAt" TIMESTAMP(3) NOT NULL, "csrfHash" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "SavedAnnouncement" (
 "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "announcementId" TEXT NOT NULL REFERENCES "Announcement"("id") ON DELETE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("userId", "announcementId")
);
CREATE TABLE "AnnouncementPosition" (
 "id" TEXT PRIMARY KEY, "announcementId" TEXT NOT NULL REFERENCES "Announcement"("id") ON DELETE CASCADE,
 "title" TEXT NOT NULL, "city" TEXT, "quota" INTEGER,
 "requirements" JSONB NOT NULL, "sourceUrl" TEXT NOT NULL,
 "verifiedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
