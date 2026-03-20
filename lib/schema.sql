-- P5 Pixel Intelligence Pipeline — Neon Postgres Schema
-- Run this once per database to initialize tables.

-- ══════════════════════════════════════════════════════════
-- VISITORS: Core table — one row per unique visitor per client
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS visitors (
  id              SERIAL PRIMARY KEY,
  client_key      TEXT NOT NULL,
  email           TEXT NOT NULL,
  first_name      TEXT DEFAULT '',
  last_name       TEXT DEFAULT '',
  phone           TEXT DEFAULT '',
  city            TEXT DEFAULT '',
  state           TEXT DEFAULT '',
  age_range       TEXT DEFAULT '',
  gender          TEXT DEFAULT '',
  income          TEXT DEFAULT '',
  net_worth       TEXT DEFAULT '',
  linkedin        TEXT DEFAULT '',

  -- Accumulation fields (updated on each webhook hit)
  visit_count     INTEGER DEFAULT 1,
  first_visit     TIMESTAMPTZ,
  last_visit      TIMESTAMPTZ,
  pages_visited   JSONB DEFAULT '[]'::jsonb,
  referrers       JSONB DEFAULT '[]'::jsonb,

  -- Processing fields (set by the cron processor)
  intent_score    INTEGER DEFAULT 0,
  intent_tier     TEXT DEFAULT 'Low',
  interests       JSONB DEFAULT '[]'::jsonb,
  referrer_source TEXT DEFAULT 'Direct',
  tags            JSONB DEFAULT '[]'::jsonb,
  processed       BOOLEAN DEFAULT FALSE,
  processed_at    TIMESTAMPTZ,

  -- GHL push tracking
  ghl_pushed      BOOLEAN DEFAULT FALSE,
  ghl_pushed_at   TIMESTAMPTZ,
  ghl_contact_id  TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one record per email per client
  UNIQUE(client_key, email)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_visitors_client_processed
  ON visitors(client_key, processed);

CREATE INDEX IF NOT EXISTS idx_visitors_client_tier
  ON visitors(client_key, intent_tier);

CREATE INDEX IF NOT EXISTS idx_visitors_client_ghl
  ON visitors(client_key, ghl_pushed)
  WHERE processed = TRUE;

CREATE INDEX IF NOT EXISTS idx_visitors_email
  ON visitors(email);

CREATE INDEX IF NOT EXISTS idx_visitors_last_visit
  ON visitors(last_visit DESC);

-- ══════════════════════════════════════════════════════════
-- PROCESSING_RUNS: Log of each processing cron execution
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS processing_runs (
  id              SERIAL PRIMARY KEY,
  client_key      TEXT NOT NULL,
  run_type        TEXT NOT NULL,  -- 'process' or 'ghl_push'
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  total_visitors  INTEGER DEFAULT 0,
  processed       INTEGER DEFAULT 0,
  skipped         INTEGER DEFAULT 0,
  errors          INTEGER DEFAULT 0,
  tier_counts     JSONB DEFAULT '{}'::jsonb,
  details         JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_runs_client_type
  ON processing_runs(client_key, run_type, started_at DESC);

-- ══════════════════════════════════════════════════════════
-- INGESTION_STATS: Daily webhook ingestion counters
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ingestion_stats (
  id              SERIAL PRIMARY KEY,
  client_key      TEXT NOT NULL,
  stat_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  total_received  INTEGER DEFAULT 0,
  new_visitors    INTEGER DEFAULT 0,
  updated_visitors INTEGER DEFAULT 0,
  skipped         INTEGER DEFAULT 0,

  UNIQUE(client_key, stat_date)
);

-- ══════════════════════════════════════════════════════════
-- HELPER: Auto-update updated_at on visitors
-- ══════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS visitors_updated_at ON visitors;
CREATE TRIGGER visitors_updated_at
  BEFORE UPDATE ON visitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
