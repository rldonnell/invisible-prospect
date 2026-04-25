-- migration-016-four-winds-cold-campaign.sql
-- Applied: 2026-04-24
--
-- Inserts the Four Winds COLD outreach campaign row. This is the
-- counterpart to migration-014's warm row - they share (client_key,
-- bucket) but differ on kind, which is why migration-015 widened the
-- unique constraint to include kind.
--
-- Pipeline summary:
--   AL "cold" segment (older founders/CEOs, age-filtered upstream)
--     -> pull-audiencelab kind='al_cold' branch
--     -> ICP-validated + cross-pipeline-deduped
--     -> visitors row with acquisition_source='al_cold',
--        campaign_bucket='general_interest', email_eligible per ICP,
--        intent_tier='High', processed=true
--     -> push-instantly cron picks it up via THIS campaign row
--        (matching on (client_key='four-winds', bucket='general_interest',
--        kind='cold'))
--
-- PREREQUISITES:
--   1. Run migration-015 first (adds visitors.acquisition_source and
--      campaigns.kind columns + the widened unique constraint).
--   2. Create a SEPARATE Instantly campaign for cold outreach. Use
--      different sending accounts than the warm Four Winds campaign so
--      cold deliverability problems can't blow up the warm pipeline.
--      Suggested name: "Four Winds COLD - General Interest - v1"
--   3. Grab the campaign UUID from the Instantly URL.
--   4. Replace the placeholder INSTANTLY_CAMPAIGN_ID below.
--   5. ENSURE Link Tracking is ON in the Instantly UI for this campaign
--      AND that the campaign-level unsubscribe footer is enabled (CAN-SPAM).
--   6. Once the [REPLACE: ...] markers in lib/sequences/four-winds-cold-v1.js
--      are filled in, push the sequence via:
--        POST /api/admin/push-four-winds-cold-sequences
--   7. Set active=true here only after everything above is verified.
--
-- Run in Neon console. ON CONFLICT makes it safe to re-run if you need
-- to update variables or activate later.

-- ─────────────────────────────────────────────────────────────────
-- STEP 1: Replace the placeholder UUID with the real cold campaign ID
-- ─────────────────────────────────────────────────────────────────

INSERT INTO campaigns (
  client_key,
  bucket,
  kind,
  instantly_campaign_id,
  confidence_min,
  min_tier,
  active,
  variables
) VALUES (
  'four-winds',
  'general_interest',
  'cold',
  '75c09b88-bcd2-4327-9cf0-19c4815a199f',
  0,                                               -- confidence_min: cold leads bypass scoring; ICP gating happens at ingest
  'High',                                          -- min_tier: cold rows are inserted at intent_tier='High' so this passes trivially
  false,                                           -- active=false until copy is finalized AND sequence is pushed
  jsonb_build_object(
    'booking_link',     'https://fourwindscmms.com/talktotom/',
    'phone',            '+16199215845',
    'resource_link',    'https://fourwindscmms.com/cmms-demo/',
    -- CAN-SPAM compliance fields. Verify the postal address with Tom
    -- before flipping active=true.
    'sender_address',   'Four Winds Software, Inc., 13398 Sunshine Path, Rancho Penasquitos, CA 92129, United States',
    'unsubscribe_link', '{{instantly_unsubscribe_url}}'
  )
)
ON CONFLICT (client_key, bucket, kind) DO UPDATE
  SET instantly_campaign_id = EXCLUDED.instantly_campaign_id,
      confidence_min        = EXCLUDED.confidence_min,
      min_tier              = EXCLUDED.min_tier,
      variables             = campaigns.variables || EXCLUDED.variables;
      -- NOTE: active is intentionally NOT updated on conflict. Flip it
      -- manually with a separate UPDATE once you're ready to go live:
      --   UPDATE campaigns SET active = true
      --   WHERE client_key='four-winds' AND bucket='general_interest' AND kind='cold';

-- ─────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────
SELECT
  bucket,
  kind,
  instantly_campaign_id,
  confidence_min,
  min_tier,
  active,
  variables->>'booking_link'     AS booking_link,
  variables->>'phone'            AS phone,
  variables->>'resource_link'    AS resource_link,
  variables->>'sender_address'   AS sender_address,
  variables->>'unsubscribe_link' AS unsubscribe_link
FROM campaigns
WHERE client_key = 'four-winds'
ORDER BY bucket, kind;
