-- ═══════════════════════════════════════════════════════════════
-- Migration 006: Intent-Based Email Outreach Tables
-- ═══════════════════════════════════════════════════════════════
-- Run in Neon SQL Editor in THREE parts (paste each block separately)
--
-- Part 1: campaigns table + indexes
-- Part 2: email_enrollments table + indexes
-- Part 3: New columns on visitors table
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════
-- PART 1: campaigns table
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS campaigns (
  id            SERIAL PRIMARY KEY,
  client_key    TEXT NOT NULL,
  bucket        TEXT NOT NULL,
  instantly_campaign_id TEXT,
  confidence_min INT NOT NULL DEFAULT 40,
  min_tier      TEXT NOT NULL DEFAULT 'High',
  active        BOOLEAN NOT NULL DEFAULT false,
  variables     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  -- One campaign per client per bucket
  CONSTRAINT uq_campaigns_client_bucket UNIQUE (client_key, bucket),

  -- Validate bucket values
  CONSTRAINT chk_campaigns_bucket CHECK (
    bucket IN ('ready_to_book', 'provider_research', 'procedure_treatment',
               'condition_research', 'return_visitor', 'general_interest')
  ),

  -- Validate tier values
  CONSTRAINT chk_campaigns_tier CHECK (
    min_tier IN ('HOT', 'High', 'Medium', 'Low')
  )
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaigns_updated ON campaigns;
CREATE TRIGGER trg_campaigns_updated
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

-- Index for quick lookups by client
CREATE INDEX IF NOT EXISTS idx_campaigns_client_active
  ON campaigns(client_key) WHERE active = true;


-- ═══════════════════════════════════════
-- PART 2: email_enrollments table
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_enrollments (
  id              SERIAL PRIMARY KEY,
  visitor_id      INT NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  campaign_id     INT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  instantly_lead_id TEXT,
  bucket          TEXT NOT NULL,
  primary_interest TEXT,
  variables_sent  JSONB,
  enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'sent',

  -- Prevent duplicate enrollments: same visitor, same campaign
  CONSTRAINT uq_enrollments_visitor_campaign UNIQUE (visitor_id, campaign_id)
);

-- Index for checking if a visitor has already been enrolled
CREATE INDEX IF NOT EXISTS idx_enrollments_visitor
  ON email_enrollments(visitor_id);

-- Index for campaign-level reporting
CREATE INDEX IF NOT EXISTS idx_enrollments_campaign_status
  ON email_enrollments(campaign_id, status);

-- Index for date-range reporting
CREATE INDEX IF NOT EXISTS idx_enrollments_enrolled_at
  ON email_enrollments(enrolled_at);


-- ═══════════════════════════════════════
-- PART 3: New columns on visitors table
-- ═══════════════════════════════════════

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS primary_interest TEXT,
  ADD COLUMN IF NOT EXISTS campaign_bucket TEXT,
  ADD COLUMN IF NOT EXISTS email_eligible BOOLEAN NOT NULL DEFAULT false;

-- Index for the push-instantly cron query
CREATE INDEX IF NOT EXISTS idx_visitors_email_eligible
  ON visitors(client_key) WHERE email_eligible = true;
