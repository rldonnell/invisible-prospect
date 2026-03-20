-- Migration 002: Add Audience Lab enrichment columns
-- Run this in Neon SQL Editor after the initial schema is in place.

-- ══════════════════════════════════════════════════════════
-- DEMOGRAPHICS & ADDRESS
-- ══════════════════════════════════════════════════════════
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS address       TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS zip           TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS homeowner     TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS married       TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS children      TEXT DEFAULT '';

-- ══════════════════════════════════════════════════════════
-- EMPLOYER / B2B CONTEXT
-- ══════════════════════════════════════════════════════════
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS company_name      TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS job_title         TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS company_industry  TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS company_size      TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS company_revenue   TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS department        TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS seniority_level   TEXT DEFAULT '';

-- ══════════════════════════════════════════════════════════
-- ADDITIONAL EMAILS & IDENTITY
-- ══════════════════════════════════════════════════════════
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS all_emails        TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS business_email    TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS pixel_id          TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS edid              TEXT DEFAULT '';

-- ══════════════════════════════════════════════════════════
-- SOCIAL & ENRICHMENT
-- ══════════════════════════════════════════════════════════
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS facebook_url  TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS twitter_url   TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS skills        TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS al_interests  TEXT DEFAULT '';

-- Index on company for B2B reporting
CREATE INDEX IF NOT EXISTS idx_visitors_company
  ON visitors(company_name) WHERE company_name != '';
