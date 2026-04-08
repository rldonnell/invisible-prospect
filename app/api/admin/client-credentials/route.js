import { NextResponse } from 'next/server';
import { setClientPassword } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

/**
 * Admin route to manage client credentials.
 * Protected by DASH_PW_ADMIN — pass it as Authorization: Bearer <admin-password>
 *
 * POST /api/admin/client-credentials
 * Body: { clientKey, password, contactEmail, displayName }
 * Creates or updates a client's credentials (bcrypt-hashed).
 *
 * GET /api/admin/client-credentials
 * Lists all client credentials (without password hashes).
 */

function isAdmin(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token && token === process.env.DASH_PW_ADMIN;
}

export async function POST(request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { clientKey, password, contactEmail, displayName } = await request.json();

    if (!clientKey || !password) {
      return NextResponse.json(
        { error: 'clientKey and password are required' },
        { status: 400 }
      );
    }

    await setClientPassword(clientKey, password, contactEmail || '', displayName || '');

    return NextResponse.json({
      ok: true,
      message: `Credentials set for ${clientKey}`,
    });
  } catch (err) {
    console.error('[admin] Set credentials error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT client_key, contact_email, display_name, last_login, created_at
      FROM client_credentials
      ORDER BY client_key
    `;

    return NextResponse.json({ clients: rows });
  } catch (err) {
    console.error('[admin] List credentials error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
