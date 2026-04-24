-- migration-014-four-winds-campaign.sql
-- Applied: 2026-04-24
--
-- Inserts the Four Winds CMMS campaign row and seeds all custom variables
-- needed by lib/sequences/four-winds-v1.js (booking_link, phone,
-- resource_link). This is a single-bucket rollout: one campaign for all
-- Four Winds leads under the 'general_interest' bucket.
--
-- PREREQUISITE:
--   Before running this migration, create the Four Winds campaign in the
--   Instantly UI (Campaigns -> New Campaign). Give it a descriptive name
--   like "Four Winds - General Interest - v1". Then grab the campaign ID
--   from the URL (it's the UUID after /campaign/). Replace the placeholder
--   INSTANTLY_CAMPAIGN_ID below with that real UUID before executing.
--
-- Run in Neon console. Uses ON CONFLICT so it's safe to re-run if you
-- need to update the variables after the initial insert.

-- ─────────────────────────────────────────────────────────────────
-- STEP 1: Replace this placeholder with the real Instantly campaign UUID
-- ─────────────────────────────────────────────────────────────────
-- Example: 'c4470569-9f19-48b9-a8a9-f44a7c169619'

INSERT INTO campaigns (
  client_key,
  bucket,
  instantly_campaign_id,
  confidence_min,
  min_tier,
  active,
  variables
) VALUES (
  'four-winds',
  'general_interest',
  'REPLACE_WITH_REAL_INSTANTLY_CAMPAIGN_UUID',
  40,                                              -- confidence_min
  'Low',                                           -- min_tier - B2B funnel is wider than healthcare, let Low leads through
  true,                                            -- active
  jsonb_build_object(
    'booking_link',  'https://fourwindscmms.com/talktotom/',
    'phone',         '+16199215845',
    'resource_link', 'https://fourwindscmms.com/cmms-demo/'
  )
)
ON CONFLICT (client_key, bucket) DO UPDATE
  SET instantly_campaign_id = EXCLUDED.instantly_campaign_id,
      confidence_min        = EXCLUDED.confidence_min,
      min_tier              = EXCLUDED.min_tier,
      active                = EXCLUDED.active,
      variables             = campaigns.variables || EXCLUDED.variables;

-- ─────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────
SELECT
  bucket,
  instantly_campaign_id,
  confidence_min,
  min_tier,
  active,
  variables->>'booking_link'  AS booking_link,
  variables->>'phone'         AS phone,
  variables->>'resource_link' AS resource_link
FROM campaigns
WHERE client_key = 'four-winds';
