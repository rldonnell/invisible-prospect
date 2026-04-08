/**
 * Dashboard Authentication
 *
 * Cookie-based auth with HMAC-signed tokens.
 * Password validation order:
 *   1. Master admin password (DASH_PW_ADMIN env var)
 *   2. Per-client DB password — bcrypt hashed (client_credentials table)
 *   3. Per-client env var password (DASH_PW_<KEY>) — legacy fallback
 *
 * Env vars:
 *   DASH_SECRET    — HMAC signing key (required for auth to work)
 *   DASH_PW_ADMIN  — master password (accesses all dashboards)
 *   DASH_PW_<KEY>  — per-client password (legacy, will be phased out)
 *   APP_URL        — base URL for password reset links (e.g. https://visitorid.p5marketing.com)
 */

import { createHmac, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

const COOKIE_NAME = 'dash_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_HOURS = 2;

function getSecret() {
  return process.env.DASH_SECRET || '';
}

/**
 * Sign a payload string with HMAC-SHA256
 */
function sign(payload) {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

/**
 * Create a signed session token.
 * payload = { client, role, ts }
 */
export function createSessionToken(client, role = 'client') {
  const payload = JSON.stringify({ client, role, ts: Date.now() });
  const sig = sign(payload);
  const token = Buffer.from(payload).toString('base64url') + '.' + sig;
  return token;
}

/**
 * Verify and decode a session token.
 * Returns { client, role, ts } or null if invalid.
 */
export function verifySessionToken(token) {
  if (!token || !getSecret()) return null;
  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64, 'base64url').toString();
    const expected = sign(payload);
    if (sig !== expected) return null;
    const data = JSON.parse(payload);
    if (Date.now() - data.ts > MAX_AGE * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Hash a plaintext password with bcrypt.
 */
export async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/**
 * Validate a password for a given client.
 * Returns { valid: boolean, role: 'admin' | 'client' }
 *
 * Checks in order:
 *   1. Admin password (env var — plaintext comparison)
 *   2. Client password from DB (bcrypt hash)
 *   3. Client password from env var (legacy plaintext fallback)
 */
export async function validatePassword(client, password) {
  if (!password) return { valid: false, role: null };

  // 1. Admin password — env var
  const adminPw = process.env.DASH_PW_ADMIN;
  if (adminPw && password === adminPw) {
    return { valid: true, role: 'admin' };
  }

  // 2. Client password from client_credentials (bcrypt)
  try {
    const sql = getDb();
    const [row] = await sql`
      SELECT password_hash FROM client_credentials
      WHERE client_key = ${client}
      LIMIT 1
    `;
    if (row && row.password_hash) {
      const match = await bcrypt.compare(password, row.password_hash);
      if (match) {
        // Update last_login timestamp
        await sql`
          UPDATE client_credentials SET last_login = NOW()
          WHERE client_key = ${client}
        `.catch(() => {});
        return { valid: true, role: 'client' };
      }
    }
  } catch {
    // DB not available or table doesn't exist — fall through to legacy
  }

  // 3. Legacy: env var plaintext password
  const envKey = `DASH_PW_${client.replace(/-/g, '_').toUpperCase()}`;
  const clientPw = process.env[envKey];
  if (clientPw && password === clientPw) {
    return { valid: true, role: 'client' };
  }

  return { valid: false, role: null };
}

/**
 * Check if a session (from cookie) is authorized for a given client.
 */
export function isAuthorized(session, client) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  return session.client === client;
}

// ─── Password Reset ────────────────────────────────────────────

/**
 * Generate a password reset token for a client and store it in DB.
 * Returns { token, email } or null if client not found / no email on file.
 */
export async function createResetToken(clientKey) {
  const sql = getDb();
  const [row] = await sql`
    SELECT contact_email FROM client_credentials
    WHERE client_key = ${clientKey}
    LIMIT 1
  `;

  if (!row || !row.contact_email) return null;

  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await sql`
    UPDATE client_credentials
    SET reset_token = ${token}, reset_expires = ${expires}
    WHERE client_key = ${clientKey}
  `;

  return { token, email: row.contact_email };
}

/**
 * Validate a reset token and return the client_key it belongs to.
 * Returns { clientKey, valid: true } or { valid: false }.
 */
export async function validateResetToken(token) {
  if (!token) return { valid: false };

  const sql = getDb();
  const [row] = await sql`
    SELECT client_key FROM client_credentials
    WHERE reset_token = ${token}
      AND reset_expires > NOW()
    LIMIT 1
  `;

  if (!row) return { valid: false };
  return { valid: true, clientKey: row.client_key };
}

/**
 * Complete a password reset: hash the new password, clear the token.
 */
export async function completePasswordReset(token, newPassword) {
  const { valid, clientKey } = await validateResetToken(token);
  if (!valid) return { success: false, error: 'Invalid or expired reset link' };

  const hash = await hashPassword(newPassword);
  const sql = getDb();

  await sql`
    UPDATE client_credentials
    SET password_hash = ${hash},
        reset_token = NULL,
        reset_expires = NULL
    WHERE client_key = ${clientKey}
  `;

  return { success: true, clientKey };
}

/**
 * Set (or update) a client's password in client_credentials.
 * Creates the row if it doesn't exist.
 */
export async function setClientPassword(clientKey, plaintext, contactEmail = '', displayName = '') {
  const hash = await hashPassword(plaintext);
  const sql = getDb();

  await sql`
    INSERT INTO client_credentials (client_key, password_hash, contact_email, display_name)
    VALUES (${clientKey}, ${hash}, ${contactEmail}, ${displayName})
    ON CONFLICT (client_key)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      contact_email = COALESCE(NULLIF(EXCLUDED.contact_email, ''), client_credentials.contact_email),
      display_name  = COALESCE(NULLIF(EXCLUDED.display_name, ''), client_credentials.display_name)
  `;
}

export { COOKIE_NAME, MAX_AGE };
