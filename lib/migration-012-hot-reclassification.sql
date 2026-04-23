-- migration-012-hot-reclassification.sql
-- Applied: 2026-04-23
--
-- Realigns SA Spine's HOT tier definition: page-view signals no longer
-- reach HOT. HOT is reserved for leads who have opened or clicked an
-- Instantly outreach email (first_engaged_at IS NOT NULL).
--
-- Run these in order in the Neon console. Each step is idempotent.

-- ─────────────────────────────────────────────────────────────────
-- Step 1: PREVIEW — how many SA Spine HOTs will be demoted?
-- ─────────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                           AS current_hots,
  COUNT(*) FILTER (WHERE first_engaged_at IS NULL)   AS to_demote,
  COUNT(*) FILTER (WHERE first_engaged_at IS NOT NULL) AS keep_hot
FROM visitors
WHERE client_key = 'sa-spine'
  AND intent_tier = 'HOT';

-- ─────────────────────────────────────────────────────────────────
-- Step 2: DEMOTE — SA Spine HOTs with no email engagement → High
-- ─────────────────────────────────────────────────────────────────
UPDATE visitors
SET intent_tier = 'High',
    -- Clear the alerted stamp so they don't sit in limbo; the morning
    -- digest filters on intent_tier='HOT' anyway so they simply drop
    -- out of it.
    hot_alerted_at = NULL
WHERE client_key = 'sa-spine'
  AND intent_tier = 'HOT'
  AND first_engaged_at IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- Step 3: BACKFILL — stamp 'email-re-engaged' on existing engagement-HOTs
-- ─────────────────────────────────────────────────────────────────
-- Any SA Spine visitor already HOT with email engagement deserves the
-- umbrella tag so GHL segmentation and the digest's Engagement column
-- pick them up consistently.
UPDATE visitors
SET tags = COALESCE(tags, '[]'::jsonb) || to_jsonb('email-re-engaged'::text)
WHERE client_key = 'sa-spine'
  AND intent_tier = 'HOT'
  AND first_engaged_at IS NOT NULL
  AND NOT (tags ? 'email-re-engaged');

-- ─────────────────────────────────────────────────────────────────
-- Step 4: VERIFY — post-migration tier distribution
-- ─────────────────────────────────────────────────────────────────
SELECT
  intent_tier,
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE first_engaged_at IS NOT NULL)  AS with_engagement,
  COUNT(*) FILTER (WHERE tags ? 'email-re-engaged')     AS tagged_re_engaged
FROM visitors
WHERE client_key = 'sa-spine'
GROUP BY intent_tier
ORDER BY CASE intent_tier
  WHEN 'HOT' THEN 1
  WHEN 'High' THEN 2
  WHEN 'Medium' THEN 3
  WHEN 'Low' THEN 4
  ELSE 5
END;
