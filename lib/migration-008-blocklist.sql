-- Migration 008: Global blocklist for bots and known bad actors
-- Applies across ALL clients — checked during ingestion and processing
-- Run once against Neon Postgres

CREATE TABLE IF NOT EXISTS blocklist (
  id            SERIAL PRIMARY KEY,
  match_type    TEXT NOT NULL,          -- 'email', 'email_domain', 'name', 'phone', 'ip'
  match_value   TEXT NOT NULL,          -- the pattern to match (case-insensitive)
  reason        TEXT DEFAULT '',        -- why this was blocked (e.g. "known bot", "spam")
  added_by      TEXT DEFAULT 'manual',  -- who added it: 'manual', 'auto', 'admin'
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate entries
  UNIQUE(match_type, match_value)
);

CREATE INDEX IF NOT EXISTS idx_blocklist_type
  ON blocklist(match_type);

CREATE INDEX IF NOT EXISTS idx_blocklist_value
  ON blocklist(lower(match_value));

-- Seed with known bots
INSERT INTO blocklist (match_type, match_value, reason, added_by) VALUES
  ('email', 'fordtruck@cox.internet.com', 'Known bot — appears on every client site', 'manual'),
  ('name', 'michael wahlberg', 'Known bot identity associated with fordtruck@cox.internet.com', 'manual')
ON CONFLICT (match_type, match_value) DO NOTHING;
