-- Migration 009: Track which HOT leads have already been included in a morning digest email.
-- Prevents duplicate sends: a visitor's first HOT-tier digest stamps this column,
-- subsequent digests skip them.

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS hot_alerted_at TIMESTAMPTZ;

-- Partial index: only the unalerted HOT rows are what the digest cron queries.
CREATE INDEX IF NOT EXISTS idx_visitors_hot_unalerted
  ON visitors (client_key, last_visit DESC)
  WHERE intent_tier = 'HOT' AND hot_alerted_at IS NULL;
