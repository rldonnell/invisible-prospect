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
