-- Additive only. Production deployment requires separate migration approval.
BEGIN;
CREATE TABLE "AccountChallenge" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "purpose" TEXT NOT NULL CHECK ("purpose" IN ('VERIFY_EMAIL','RESET_PASSWORD')),
  "tokenHash" TEXT NOT NULL CHECK ("tokenHash" ~ '^[a-f0-9]{64}$'),
  "emailHash" TEXT NOT NULL CHECK ("emailHash" ~ '^[a-f0-9]{64}$'),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" +
    CASE WHEN "purpose" = 'RESET_PASSWORD' THEN INTERVAL '15 minutes' ELSE INTERVAL '24 hours' END),
  CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt")
);
CREATE UNIQUE INDEX "AccountChallenge_one_pending" ON "AccountChallenge"("userId","purpose") WHERE "consumedAt" IS NULL;
CREATE INDEX "AccountChallenge_expiresAt_idx" ON "AccountChallenge"("expiresAt");
CREATE TABLE "AccountEmailVerification" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "emailHash" TEXT NOT NULL CHECK ("emailHash" ~ '^[a-f0-9]{64}$'),
  "verifiedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "AccountChallenge_tokenHash_key" ON "AccountChallenge"("tokenHash");
CREATE TABLE "AccountRecoveryRate" (
 "id" TEXT PRIMARY KEY, "count" INTEGER NOT NULL, "until" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "AccountRecoveryRate_until_idx" ON "AccountRecoveryRate"("until");
CREATE TABLE "AccountRecoveryAudit" (
 "id" TEXT PRIMARY KEY, "userId" TEXT, "action" TEXT NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AccountRecoveryAudit_createdAt_idx" ON "AccountRecoveryAudit"("createdAt");

COMMIT;
