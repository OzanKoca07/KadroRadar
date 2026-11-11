ALTER TABLE "CandidateProfile" ADD COLUMN "pushToken" TEXT;
CREATE TABLE "CandidateNotification" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "announcementId" TEXT NOT NULL,
 "eventKey" TEXT NOT NULL, "kind" TEXT NOT NULL, "title" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "ticketId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CandidateNotification_userId_eventKey_key" ON "CandidateNotification"("userId","eventKey");
CREATE INDEX "CandidateNotification_status_createdAt_idx" ON "CandidateNotification"("status","createdAt");
