-- Migration 004: Add confidence scoring columns
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS confidence_flags JSONB DEFAULT '[]'::jsonb;

-- Index for filtering by confidence
CREATE INDEX IF NOT EXISTS idx_visitors_confidence
  ON visitors(client_key, confidence);
