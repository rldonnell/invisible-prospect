-- Migration 011: Cleanup Instantly support
--
-- Adds `cleaned_up_at` to email_enrollments so the cleanup cron can stamp
-- when a lead was reclaimed from Instantly. Status is set to 'cleaned_up'
-- at the same time (no CHECK constraint on status, so no constraint update
-- is needed — we just document the allowed values here):
--
--   'sent'        - enrolled + pushed to Instantly (default)
--   'failed'      - push to Instantly failed (won't be retried)
--   'cleaned_up'  - lead was DELETE'd from Instantly by cleanup-instantly
--                   cron because it finished the sequence with zero
--                   engagement. Kept in our DB for audit.

ALTER TABLE email_enrollments
  ADD COLUMN IF NOT EXISTS cleaned_up_at TIMESTAMPTZ;

-- Index supports admin dashboard "reclaimed this week" tile
CREATE INDEX IF NOT EXISTS idx_enrollments_cleaned_up
  ON email_enrollments (cleaned_up_at DESC)
  WHERE cleaned_up_at IS NOT NULL;
