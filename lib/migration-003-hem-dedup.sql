-- Migration 003: Switch dedup key from email to HEM SHA256
-- This consolidates visitors who have multiple emails but the same identity hash.
--
-- IMPORTANT: Run these steps in order in the Neon SQL Editor.

-- Step 1: Add hem_sha256 column
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS hem_sha256 TEXT DEFAULT '';

-- Step 2: Delete SA Spine data (will be reloaded from CSV with proper HEM dedup)
DELETE FROM visitors WHERE client_key = 'sa-spine';

-- Step 3: Drop old unique constraint (email-based)
ALTER TABLE visitors DROP CONSTRAINT IF EXISTS visitors_client_key_email_key;

-- Step 4: Add new unique constraint (HEM-based)
-- For visitors without a HEM hash, the webhook will generate one from email
ALTER TABLE visitors ADD CONSTRAINT visitors_client_key_hem_unique UNIQUE(client_key, hem_sha256);

-- Step 5: Add index for HEM lookups
CREATE INDEX IF NOT EXISTS idx_visitors_hem ON visitors(hem_sha256);
