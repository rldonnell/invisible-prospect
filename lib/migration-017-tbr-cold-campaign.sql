-- migration-017-tbr-cold-campaign.sql
-- Drafted: 2026-04-25
--
-- Inserts The Brilliance Revolution COLD outreach campaign row. Mirrors
-- migration-016 (Four Winds COLD) structurally. TBR is the second client
-- on the cold pipeline since the schema split in migration-015.
--
-- Pipeline summary:
--   AL "TBR cold" segment (founder/CEO of innovation-driven engineering
--   cos in aerospace/defense/mechanical/industrial/medical equipment;
--   $10-150M revenue band; pre-filtered upstream)
--     -> pull-audiencelab kind='al_cold' branch
--     -> ICP-validated by lib/icp/tbr-cold.js (title + revenue + email)
--     -> cross-pipeline-deduped against any existing TBR visitor row
--     -> visitors row with acquisition_source='al_cold',
--        campaign_bucket='general_interest', email_eligible per ICP,
--        intent_tier='High', processed=true
--     -> push-instantly cron picks it up via THIS campaign row
--        (matching on (client_key='tbr', bucket='general_interest',
--        kind='cold'))
--
-- PREREQUISITES:
--   1. Migration-015 already applied (schema for cold pipeline split).
--   2. Instantly cold campaign EXISTS (separate sending accounts from
--      any TBR warm/nurture sends so cold deliverability issues stay
--      isolated). UUID 344a40f3-42d7-4454-bbe9-b13971e82857 confirmed
--      by Robert 2026-04-25.
--   3. Link Tracking ON in the Instantly UI for this campaign AND
--      campaign-level unsubscribe footer enabled (CAN-SPAM).
--   4. AL cold segment registered in AL_SEGMENTS env (see
--      lib/al-segments.js parser; nest TBR as
--      {"tbr":{"pixel":"34e00e2c-...","al_cold":"<segment-id>"}}).
--   5. Validator registered in COLD_ICP_VALIDATORS in
--      app/api/cron/pull-audiencelab/route.js.
--   6. Once validated, push the sequence via:
--        POST /api/admin/push-tbr-cold-sequences
--   7. Set active=true here only after everything above is verified.
--
-- Run in Neon console. ON CONFLICT makes it safe to re-run if you need
-- to update variables or activate later.

-- ─────────────────────────────────────────────────────────────────
-- INSERT TBR cold campaign
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
  'tbr',
  'general_interest',
  'cold',
  '344a40f3-42d7-4454-bbe9-b13971e82857',
  0,                                               -- confidence_min: cold leads bypass scoring; ICP gating happens at ingest
  'High',                                          -- min_tier: cold rows are inserted at intent_tier='High' so this passes trivially
  false,                                           -- active=false until copy is verified AND sequence is pushed
  jsonb_build_object(
    'booking_link',     'https://thebrilliancerevolution.com/talk-to-stephie/',
    'phone',            '+17607079977',
    'resource_link',    'https://thebrilliancerevolution.com/field-manual-download-page/',
    -- CAN-SPAM compliance fields. Confirmed with Robert 2026-04-25.
    'sender_address',   'The Brilliance Revolution, 6610 Raintree Pl, Flower Mound, TX 75022, United States',
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
      --   WHERE client_key='tbr' AND bucket='general_interest' AND kind='cold';

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
WHERE client_key = 'tbr'
ORDER BY bucket, kind;
