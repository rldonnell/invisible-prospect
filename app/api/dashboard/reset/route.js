import { NextResponse } from 'next/server';
import { createResetToken, completePasswordReset } from '../../../../lib/auth';
import { sendPasswordResetEmail } from '../../../../lib/email';

/**
 * POST /api/dashboard/reset
 * Request a password reset. Body: { client }
 *
 * Always returns 200 to avoid leaking whether a client exists.
 * If the client has a contact_email, sends a reset link.
 */
export async function POST(request) {
  try {
    const { client } = await request.json();

    if (!client) {
      return NextResponse.json(
        { error: 'Client key is required' },
        { status: 400 }
      );
    }

    // Attempt to create a reset token — returns null if client not found
    const result = await createResetToken(client);

    if (result) {
      // Send the reset email
      const { token, email } = result;

      // Look up display name for the email
      const { getDb } = await import('../../../../lib/db');
      const sql = getDb();
      const [row] = await sql`
        SELECT display_name FROM client_credentials
        WHERE client_key = ${client}
        LIMIT 1
      `;

      await sendPasswordResetEmail({
        to: email,
        clientKey: client,
        displayName: row?.display_name || client,
        resetToken: token,
      });
    }

    // Always return success to avoid enumeration
    return NextResponse.json({
      ok: true,
      message: 'If an account exists with that client key, a reset email has been sent.',
    });
  } catch (err) {
    console.error('[reset] Request error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dashboard/reset
 * Complete a password reset. Body: { token, password }
 */
export async function PUT(request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and new password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const result = await completePasswordReset(token, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      clientKey: result.clientKey,
      message: 'Password has been reset successfully.',
    });
  } catch (err) {
    console.error('[reset] Complete error:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
