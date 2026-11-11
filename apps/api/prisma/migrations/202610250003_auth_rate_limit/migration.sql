CREATE TABLE "AuthRateLimit" ("id" TEXT PRIMARY KEY, "count" INTEGER NOT NULL, "until" TIMESTAMP(3) NOT NULL);
CREATE INDEX "CandidateSession_userId_idx" ON "CandidateSession"("userId");
CREATE INDEX "CandidateSession_expiresAt_idx" ON "CandidateSession"("expiresAt");
