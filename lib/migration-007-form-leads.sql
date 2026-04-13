-- Migration 007: Form Leads table for CYR-MD (and future client) contact form submissions
-- Source: Formspree webhook → /api/webhook/formspree-cyrmd
-- Run once against Neon Postgres

CREATE TABLE IF NOT EXISTS form_leads (
  id            SERIAL PRIMARY KEY,
  client_key    TEXT NOT NULL,
  source        TEXT NOT NULL DEFAULT 'formspree',
  form_id       TEXT DEFAULT '',
  name          TEXT DEFAULT '',
  email         TEXT NOT NULL,
  phone         TEXT DEFAULT '',
  company       TEXT DEFAULT '',
  message       TEXT DEFAULT '',
  raw_payload   JSONB DEFAULT '{}'::jsonb,
  notified      BOOLEAN DEFAULT FALSE,
  notified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_leads_client
  ON form_leads(client_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_form_leads_email
  ON form_leads(email);
