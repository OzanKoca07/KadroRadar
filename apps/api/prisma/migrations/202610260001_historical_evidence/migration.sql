-- Additive provenance only. Existing 504 placements and approvals are unchanged.
ALTER TABLE "SourceDocument" ADD COLUMN "historicalEvidence" JSONB;
