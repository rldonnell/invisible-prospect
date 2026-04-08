-- Migration 005: Client credentials with hashed passwords + reset tokens
-- Run once against Neon to set up DB-backed auth with password reset.

-- ══════════════════════════════════════════════════════════
-- CLIENT_CREDENTIALS: One row per client — hashed password,
-- contact email, and time-limited reset tokens.
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS client_credentials (
  id              SERIAL PRIMARY KEY,
  client_key      TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,            -- bcrypt hash
  contact_email   TEXT NOT NULL DEFAULT '', -- for password reset emails
  display_name    TEXT NOT NULL DEFAULT '', -- friendly name shown in UI
  reset_token     TEXT,                     -- random token for reset link
  reset_expires   TIMESTAMPTZ,             -- token expiration
  last_login      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_creds_reset_token
  ON client_credentials(reset_token)
  WHERE reset_token IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_client_creds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_credentials_updated_at ON client_credentials;
CREATE TRIGGER client_credentials_updated_at
  BEFORE UPDATE ON client_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_client_creds_updated_at();

-- If you already have a client_passwords table with plaintext passwords,
-- you can migrate them by running the /api/admin/migrate-passwords route
-- (one-time operation) which will bcrypt-hash them into client_credentials.
