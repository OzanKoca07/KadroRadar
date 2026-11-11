-- Widen integer capacity only. Preserve all five fractional digits and records.
-- Required by observed official scores of 100,00000 (2025/1).
ALTER TABLE "HistoricalPlacement"
 ALTER COLUMN "minScore" TYPE DECIMAL(8,5),
 ALTER COLUMN "maxScore" TYPE DECIMAL(8,5);
