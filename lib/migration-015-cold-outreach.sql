-- migration-015-cold-outreach.sql
-- Applied: 2026-04-24
--
-- Adds the schema needed to run a SECOND outreach pipeline (cold) alongside
-- the existing pixel-driven warm pipeline, using Audience Lab "cold"
-- segments as the source.
--
-- WARM pipeline (pre-existing):
--   - Audience Lab "pixel" segment -> visitor on the client's site
--   - Identified, scored, follow-up email sequence
--   - acquisition_source = 'pixel', campaigns.kind = 'warm'
--
-- COLD pipeline (new):
--   - Audience Lab "cold" segment of older founders / CEOs (filtered in AL)
--   - NOT a website visitor; ICP-validated on import
--   - Separate Instantly campaign / sending accounts
--   - acquisition_source = 'al_cold', campaigns.kind = 'cold'
--
-- A given (client, bucket) can therefore have BOTH a warm and a cold
-- campaign row. The unique constraint is widened to include kind.
--
-- Run in Neon SQL Editor in TWO parts.
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════
-- PART 1: visitors.acquisition_source
-- ═══════════════════════════════════════

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT NOT NULL DEFAULT 'pixel';

-- Constrain to the two known sources. Add via DO block so the migration
-- is re-runnable (ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS isn't
-- universally supported on older Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_visitors_acquisition_source'
  ) THEN
    ALTER TABLE visitors
      ADD CONSTRAINT chk_visitors_acquisition_source
      CHECK (acquisition_source IN ('pixel', 'al_cold'));
  END IF;
END$$;

-- Lookup index for the push-instantly join (filter by client + source).
CREATE INDEX IF NOT EXISTS idx_visitors_acquisition_source
  ON visitors(client_key, acquisition_source);


-- ═══════════════════════════════════════
-- PART 2: campaigns.kind + widened unique key
-- ═══════════════════════════════════════

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'warm';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_campaigns_kind'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT chk_campaigns_kind
      CHECK (kind IN ('warm', 'cold'));
  END IF;
END$$;

-- Drop the old (client_key, bucket) unique and replace with
-- (client_key, bucket, kind) so warm and cold can coexist.
ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS uq_campaigns_client_bucket;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_campaigns_client_bucket_kind'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT uq_campaigns_client_bucket_kind
      UNIQUE (client_key, bucket, kind);
  END IF;
END$$;


-- ═══════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════

-- Visitor source distribution
SELECT acquisition_source, COUNT(*) AS visitors
FROM visitors
GROUP BY acquisition_source
ORDER BY acquisition_source;

-- Campaign kind distribution
SELECT client_key, bucket, kind, active, instantly_campaign_id
FROM campaigns
ORDER BY client_key, bucket, kind;

-- Confirm the new unique constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'campaigns'::regclass
  AND conname IN ('uq_campaigns_client_bucket', 'uq_campaigns_client_bucket_kind');
