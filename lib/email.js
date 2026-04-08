/**
 * Email sending via Postmark API.
 *
 * Env vars:
 *   POSTMARK_API_TOKEN — Server API token from Postmark
 *   EMAIL_FROM         — sender address (e.g. "VisitorID <noreply@visitorid.p5marketing.com>")
 *   APP_URL            — base URL for links in emails (e.g. https://visitorid.p5marketing.com)
 */

const POSTMARK_API = 'https://api.postmarkapp.com/email';

/**
 * Send an email via Postmark.
 * Returns { success: boolean, messageId?: string, error?: string }
 */
export async function sendEmail({ to, subject, html }) {
  const apiToken = process.env.POSTMARK_API_TOKEN;
  if (!apiToken) {
    console.error('[email] POSTMARK_API_TOKEN not set');
    return { success: false, error: 'Email service not configured' };
  }

  const from = process.env.EMAIL_FROM || 'VisitorID <noreply@p5marketing.com>';

  try {
    const res = await fetch(POSTMARK_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiToken,
      },
      body: JSON.stringify({
        From: from,
        To: to,
        Subject: subject,
        HtmlBody: html,
        MessageStream: 'outbound',
      }),
    });

    const data = await res.json();

    if (!res.ok || data.ErrorCode) {
      console.error('[email] Postmark error:', data);
      return { success: false, error: data.Message || 'Send failed' };
    }

    return { success: true, messageId: data.MessageID };
  } catch (err) {
    console.error('[email] Send error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send a password reset email for a client dashboard.
 */
export async function sendPasswordResetEmail({ to, clientKey, displayName, resetToken }) {
  const appUrl = process.env.APP_URL || 'https://visitorid.p5marketing.com';
  const resetLink = `${appUrl}/dashboard/${clientKey}/reset?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px; margin:40px auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <div style="text-align:center; margin-bottom:24px;">
      <div style="display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:12px; background-color:#eef2ff;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
    </div>

    <h1 style="font-size:20px; font-weight:700; color:#1e293b; text-align:center; margin:0 0 8px;">
      Password Reset
    </h1>
    <p style="font-size:14px; color:#64748b; text-align:center; margin:0 0 28px;">
      ${displayName || clientKey} Dashboard
    </p>

    <p style="font-size:14px; color:#334155; line-height:1.6; margin:0 0 24px;">
      We received a request to reset your VisitorID dashboard password. Click the button below to choose a new password.
    </p>

    <div style="text-align:center; margin:0 0 24px;">
      <a href="${resetLink}" style="display:inline-block; padding:12px 32px; font-size:15px; font-weight:600; color:#fff; background-color:#6366f1; border-radius:10px; text-decoration:none;">
        Reset Password
      </a>
    </div>

    <p style="font-size:12px; color:#94a3b8; line-height:1.5; margin:0 0 8px;">
      This link expires in 2 hours. If you didn't request this reset, you can ignore this email — your password won't be changed.
    </p>

    <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />

    <p style="font-size:11px; color:#cbd5e1; text-align:center; margin:0;">
      VisitorID&trade; by P5 Marketing
    </p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to, subject: 'Reset your VisitorID dashboard password', html });
}
