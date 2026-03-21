/**
 * Dashboard Authentication
 *
 * Cookie-based auth with HMAC-signed tokens.
 * Each client can have its own password (DASH_PW_SA_SPINE, DASH_PW_DEMO, etc.)
 * plus a master admin password (DASH_PW_ADMIN) that accesses all clients.
 *
 * Env vars:
 *   DASH_SECRET   — HMAC signing key (required for auth to work)
 *   DASH_PW_ADMIN — master password (accesses all dashboards)
 *   DASH_PW_<CLIENT_KEY> — per-client password (e.g. DASH_PW_SA_SPINE)
 */

import { createHmac } from 'crypto';

const COOKIE_NAME = 'dash_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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
  // base64url encode the payload + sig
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
    // Check max age (30 days)
    if (Date.now() - data.ts > MAX_AGE * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Validate a password for a given client.
 * Returns { valid: boolean, role: 'admin' | 'client' }
 */
export function validatePassword(client, password) {
  if (!password) return { valid: false, role: null };

  // Check admin password first
  const adminPw = process.env.DASH_PW_ADMIN;
  if (adminPw && password === adminPw) {
    return { valid: true, role: 'admin' };
  }

  // Check client-specific password
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
  // Admin can access anything
  if (session.role === 'admin') return true;
  // Client role can only access their own dashboard
  return session.client === client;
}

export { COOKIE_NAME, MAX_AGE };
