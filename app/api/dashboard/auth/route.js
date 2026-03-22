import { NextResponse } from 'next/server';
import { validatePassword, createSessionToken, COOKIE_NAME, MAX_AGE } from '../../../../lib/auth';

/**
 * POST /api/dashboard/auth
 * Body: { client, password }
 *
 * Sets an httpOnly cookie on success, returns JSON with status.
 */
export async function POST(request) {
  try {
    const { client, password } = await request.json();

    if (!client || !password) {
      return NextResponse.json(
        { error: 'Client and password are required' },
        { status: 400 }
      );
    }

    const { valid, role } = await validatePassword(client, password);

    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Create signed token
    const token = createSessionToken(client, role);

    // Set httpOnly cookie
    const response = NextResponse.json({ ok: true, role });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/dashboard',
      maxAge: MAX_AGE,
    });

    return response;

  } catch (err) {
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/auth
 * Clears the session cookie (logout).
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/dashboard',
    maxAge: 0,
  });
  return response;
}
