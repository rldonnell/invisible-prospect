-- Migration 010: Instantly engagement tracking
--
-- Captures every engagement event Instantly fires via webhook
-- (email_sent, email_opened, email_clicked, email_replied, email_bounced,
-- lead_unsubscribed, lead_interested, lead_meeting_booked, lead_not_interested).
--
-- Two layers:
--   1) instantly_engagement  - raw event log (one row per event)
--   2) denormalized counters and tier on visitors / email_enrollments
--      for fast dashboard queries and the cleanup cron's "unengaged" filter.


-- ═══════════════════════════════════════
-- PART 1: instantly_engagement event log
-- ═══════════════════════════════════════

CREATE TABLE IF NOT EXISTS instantly_engagement (
  id                    BIGSERIAL PRIMARY KEY,

  -- Normalized fields (indexed)
  event_type            TEXT NOT NULL,           -- email_opened, email_clicked, email_replied, etc.
  event_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instantly_campaign_id TEXT,
  instantly_lead_id     TEXT,
  lead_email            TEXT,

  -- Foreign keys populated when we can match the Instantly lead back
  -- to our internal records. Nullable because webhook may arrive for a
  -- lead that's since been deleted, or for an email we didn't source.
  visitor_id            INT REFERENCES visitors(id) ON DELETE SET NULL,
  campaign_id           INT REFERENCES campaigns(id) ON DELETE SET NULL,
  enrollment_id         INT REFERENCES email_enrollments(id) ON DELETE SET NULL,

  -- Event-specific payload
  step                  INT,                     -- which email in the sequence (1, 2, 3)
  link_url              TEXT,                    -- populated for email_clicked
  reply_snippet         TEXT,                    -- populated for email_replied

  -- Full payload for anything we didn't break out, plus audit
  raw_payload           JSONB,
  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_lead
  ON instantly_engagement(instantly_lead_id);

CREATE INDEX IF NOT EXISTS idx_engagement_visitor
  ON instantly_engagement(visitor_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_campaign
  ON instantly_engagement(campaign_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_engagement_type_time
  ON instantly_engagement(event_type, event_at DESC);


-- ═══════════════════════════════════════
-- PART 2: Denormalized summary on visitors
-- ═══════════════════════════════════════

ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS first_engaged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_engaged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count      INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count      INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounced          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS unsubscribed     BOOLEAN NOT NULL DEFAULT FALSE,
  -- 'None' | 'Passive' (opened) | 'Engaged' (clicked) | 'Hot' (replied / interested / booked)
  ADD COLUMN IF NOT EXISTS engagement_tier  TEXT    NOT NULL DEFAULT 'None';

-- Partial index used by the admin dashboard's "Engaged Leads" view
CREATE INDEX IF NOT EXISTS idx_visitors_engaged
  ON visitors (client_key, last_engaged_at DESC)
  WHERE first_engaged_at IS NOT NULL;


-- ═══════════════════════════════════════════════════
-- PART 3: Denormalized summary on email_enrollments
-- ═══════════════════════════════════════════════════
-- Lets the cleanup cron filter "sequence complete AND no engagement"
-- without a JOIN against the event log.

ALTER TABLE email_enrollments
  ADD COLUMN IF NOT EXISTS first_engaged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_engaged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_event_type  TEXT,
  -- Sequence-step tracking so we know when the 3-email sequence is complete
  ADD COLUMN IF NOT EXISTS last_step_sent   INT,
  ADD COLUMN IF NOT EXISTS last_sent_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_enrollments_cleanup
  ON email_enrollments (campaign_id, last_sent_at)
  WHERE first_engaged_at IS NULL;
