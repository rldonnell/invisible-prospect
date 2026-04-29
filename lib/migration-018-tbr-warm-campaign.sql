-- migration-018-tbr-warm-campaign.sql
-- Drafted: 2026-04-29
--
-- Inserts The Brilliance Revolution WARM (pixel-driven) outreach
-- campaign rows. Counterpart to migration-017 (TBR cold). Adds three
-- bucket rows (general_interest, return_visitor, ready_to_book) all
-- pointing at the SAME Instantly campaign UUID.
--
-- Why three rows pointing at one Instantly campaign:
--   The campaigns table is the routing layer for push-instantly's
--   bucketMap. A pixel-driven TBR visitor can land in any of the three
--   buckets depending on tier and visit history. We want all three to
--   feed into the same warm Instantly campaign (same sequence, same
--   sending accounts) but with different tier gates so we can monitor
--   per-bucket conversion separately. If we ever want different copy
--   per bucket, split into separate Instantly campaigns and add those
--   buckets to lib/sequences/tbr-warm-v1.js.
--
-- Pipeline summary:
--   Pixel hit on TBR site
--     -> visitor row with acquisition_source='pixel'
--     -> daily processor scores tier + assigns campaign_bucket
--     -> push-instantly cron picks it up via THIS campaign row
--        (matching on (client_key='tbr', bucket=<bucket>, kind='warm'))
--
-- PREREQUISITES:
--   1. Migration-015 already applied (schema for cold pipeline split,
--      including the kind column and the (client_key, bucket, kind)
--      uniqueness constraint).
--   2. Instantly WARM campaign EXISTS with separate sending accounts
--      from the TBR cold campaign. UUID goes in line below.
--      Suggested name: "TBR WARM - Pixel Follow-up - v1"
--   3. Replace [REPLACE-WITH-TBR-INSTANTLY-WARM-CAMPAIGN-UUID] with the
--      real UUID from the Instantly URL.
--   4. Link Tracking ON in the Instantly UI for this campaign AND
--      campaign-level unsubscribe footer enabled (CAN-SPAM applies even
--      though these are pixel-driven warm sends - safer to be tight).
--   5. Once the migration is run, push the sequence:
--        POST /api/admin/push-tbr-warm-sequences
--   6. Set active=true here only after everything above is verified:
--        UPDATE campaigns SET active = true
--        WHERE client_key='tbr' AND kind='warm';
--
-- Run in Neon console. ON CONFLICT makes it safe to re-run.

-- ─────────────────────────────────────────────────────────────────
-- INSERT TBR warm campaign rows (one per bucket, same Instantly UUID)
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
) VALUES
  -- general_interest: lowest tier gate, the volume bucket
  (
    'tbr',
    'general_interest',
    'warm',
    '31274d4d-bac8-482d-b6b8-6047e3dfc1d2',
    40,                                              -- confidence_min: same as FW warm
    'Low',                                           -- min_tier: catch any scored visitor
    false,                                           -- active=false until UUID + sequence verified
    jsonb_build_object(
      'booking_link',     'https://thebrilliancerevolution.com/talk-to-stephie/',
      'phone',            '+17607079977',
      'resource_link',    'https://thebrilliancerevolution.com/field-manual-download-page/',
      -- CAN-SPAM compliance fields. Same as cold (migration-017).
      'sender_address',   'The Brilliance Revolution, 6610 Raintree Pl, Flower Mound, TX 75022, United States',
      'unsubscribe_link', '{{instantly_unsubscribe_url}}'
    )
  ),
  -- return_visitor: visitor came back at least once after first hit
  (
    'tbr',
    'return_visitor',
    'warm',
    '31274d4d-bac8-482d-b6b8-6047e3dfc1d2',
    40,
    'Medium',                                        -- min_tier: stronger signal required
    false,
    jsonb_build_object(
      'booking_link',     'https://thebrilliancerevolution.com/talk-to-stephie/',
      'phone',            '+17607079977',
      'resource_link',    'https://thebrilliancerevolution.com/field-manual-download-page/',
      'sender_address',   'The Brilliance Revolution, 6610 Raintree Pl, Flower Mound, TX 75022, United States',
      'unsubscribe_link', '{{instantly_unsubscribe_url}}'
    )
  ),
  -- ready_to_book: highest-intent bucket
  (
    'tbr',
    'ready_to_book',
    'warm',
    '31274d4d-bac8-482d-b6b8-6047e3dfc1d2',
    40,
    'High',                                          -- min_tier: the converters
    false,
    jsonb_build_object(
      'booking_link',     'https://thebrilliancerevolution.com/talk-to-stephie/',
      'phone',            '+17607079977',
      'resource_link',    'https://thebrilliancerevolution.com/field-manual-download-page/',
      'sender_address',   'The Brilliance Revolution, 6610 Raintree Pl, Flower Mound, TX 75022, United States',
      'unsubscribe_link', '{{instantly_unsubscribe_url}}'
    )
  )
ON CONFLICT (client_key, bucket, kind) DO UPDATE
  SET instantly_campaign_id = EXCLUDED.instantly_campaign_id,
      confidence_min        = EXCLUDED.confidence_min,
      min_tier              = EXCLUDED.min_tier,
      variables             = campaigns.variables || EXCLUDED.variables;
      -- NOTE: active is intentionally NOT updated on conflict. Flip
      -- manually with a separate UPDATE once everything is verified.

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
ORDER BY kind, bucket;
