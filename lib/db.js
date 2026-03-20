import { neon } from '@neondatabase/serverless';

/**
 * Get a SQL query function connected to Neon.
 *
 * IMPORTANT: Initialize INSIDE request handlers, not at module level.
 * Module-level init runs at build time when env vars aren't available.
 *
 * Usage:
 *   const sql = getDb();
 *   const rows = await sql`SELECT * FROM visitors WHERE client_key = ${clientKey}`;
 */
export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(databaseUrl);
}
