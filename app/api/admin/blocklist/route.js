import { getDb } from '../../../../lib/db';

/**
 * Admin API for managing the global blocklist.
 *
 * Auth: Bearer token via DASH_PW_ADMIN env var.
 *
 * GET  /api/admin/blocklist              — list all entries
 * POST /api/admin/blocklist              — add an entry
 *   Body: { match_type, match_value, reason? }
 *   match_type: 'email' | 'email_domain' | 'name' | 'phone' | 'ip'
 *   match_value: pattern string (use % for wildcards, e.g. "boardtruck@%")
 *
 * DELETE /api/admin/blocklist            — remove an entry
 *   Body: { id } or { match_type, match_value }
 */

const VALID_TYPES = ['email', 'email_domain', 'name', 'phone', 'ip'];

function authorize(request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.DASH_PW_ADMIN;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return false;
  }
  return true;
}

// ── GET: List all blocklist entries ──
export async function GET(request) {
  if (!authorize(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sql = getDb();
  const rows = await sql`
    SELECT id, match_type, match_value, reason, added_by, created_at
    FROM blocklist
    ORDER BY match_type, match_value
  `;

  return Response.json({ count: rows.length, entries: rows });
}

// ── POST: Add a blocklist entry ──
export async function POST(request) {
  if (!authorize(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { match_type, match_value, reason } = body;

    if (!match_type || !match_value) {
      return Response.json({ error: 'match_type and match_value are required' }, { status: 400 });
    }

    if (!VALID_TYPES.includes(match_type)) {
      return Response.json({ error: `match_type must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400 });
    }

    const sql = getDb();
    const result = await sql`
      INSERT INTO blocklist (match_type, match_value, reason, added_by)
      VALUES (${match_type}, ${match_value.trim()}, ${reason || ''}, 'admin')
      ON CONFLICT (match_type, match_value) DO NOTHING
      RETURNING id, match_type, match_value, reason
    `;

    if (result.length === 0) {
      return Response.json({ message: 'Entry already exists', match_type, match_value });
    }

    return Response.json({ success: true, entry: result[0] });
  } catch (error) {
    console.error('[blocklist] Add error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ── DELETE: Remove a blocklist entry ──
export async function DELETE(request) {
  if (!authorize(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, match_type, match_value } = body;

    const sql = getDb();
    let result;

    if (id) {
      result = await sql`DELETE FROM blocklist WHERE id = ${id} RETURNING id`;
    } else if (match_type && match_value) {
      result = await sql`
        DELETE FROM blocklist
        WHERE match_type = ${match_type} AND match_value = ${match_value}
        RETURNING id
      `;
    } else {
      return Response.json({ error: 'Provide id or match_type + match_value' }, { status: 400 });
    }

    if (result.length === 0) {
      return Response.json({ error: 'Entry not found' }, { status: 404 });
    }

    return Response.json({ success: true, deleted: result[0].id });
  } catch (error) {
    console.error('[blocklist] Delete error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
