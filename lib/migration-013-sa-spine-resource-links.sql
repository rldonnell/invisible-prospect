-- migration-013-sa-spine-resource-links.sql
-- Applied: 2026-04-23
--
-- Seeds the per-bucket `resource_link` custom variable used by the
-- SA Spine v2 email sequences (deliverables/SA_Spine_Email_Sequences_v2.md).
-- Each bucket's email bodies reference {{resource_link}} as a softer
-- secondary CTA. Without this, the anchor tag renders with a broken href.
--
-- Run in Neon console. Each statement is idempotent - jsonb || overwrites
-- the existing key.

UPDATE campaigns
SET variables = variables || jsonb_build_object(
  'resource_link', 'https://saspine.com/patient-resources/'
)
WHERE client_key = 'sa-spine' AND bucket = 'ready_to_book';

UPDATE campaigns
SET variables = variables || jsonb_build_object(
  'resource_link', 'https://saspine.com/about/'
)
WHERE client_key = 'sa-spine' AND bucket = 'provider_research';

UPDATE campaigns
SET variables = variables || jsonb_build_object(
  'resource_link', 'https://saspine.com/procedures/'
)
WHERE client_key = 'sa-spine' AND bucket = 'procedure_treatment';

UPDATE campaigns
SET variables = variables || jsonb_build_object(
  'resource_link', 'https://saspine.com/what-we-treat/'
)
WHERE client_key = 'sa-spine' AND bucket = 'condition_research';

UPDATE campaigns
SET variables = variables || jsonb_build_object(
  'resource_link', 'https://saspine.com/patient-stories/'
)
WHERE client_key = 'sa-spine' AND bucket = 'return_visitor';

UPDATE campaigns
SET variables = variables || jsonb_build_object(
  'resource_link', 'https://saspine.com/what-we-treat/'
)
WHERE client_key = 'sa-spine' AND bucket = 'general_interest';

-- ─────────────────────────────────────────────────────────────────
-- VERIFY
-- ─────────────────────────────────────────────────────────────────
SELECT
  bucket,
  variables->>'resource_link' AS resource_link
FROM campaigns
WHERE client_key = 'sa-spine'
ORDER BY
  CASE bucket
    WHEN 'ready_to_book'       THEN 1
    WHEN 'provider_research'   THEN 2
    WHEN 'procedure_treatment' THEN 3
    WHEN 'condition_research'  THEN 4
    WHEN 'return_visitor'      THEN 5
    WHEN 'general_interest'    THEN 6
    ELSE 99
  END;
