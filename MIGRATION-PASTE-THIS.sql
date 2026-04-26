CREATE TABLE IF NOT EXISTS client_credentials (
  id SERIAL PRIMARY KEY,
  client_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  reset_token TEXT,
  reset_expires TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_creds_reset_token ON client_credentials(reset_token) WHERE reset_token IS NOT NULL;
