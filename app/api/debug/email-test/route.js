import { sendEmail } from '../../../../lib/email';

/**
 * GET /api/debug/email-test
 *
 * Sends a single test email and returns the full Postmark response
 * so we can see exactly why sends are failing.
 *
 * Protected by DASH_PW_ADMIN via query param: ?pw=YOUR_PASSWORD
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const pw = searchParams.get('pw');

  if (pw !== process.env.DASH_PW_ADMIN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Show config (redacted)
  const token = process.env.POSTMARK_API_TOKEN;
  const from = process.env.EMAIL_FROM || 'VisitorID <noreply@p5marketing.com>';

  const config = {
    hasToken: !!token,
    tokenPrefix: token ? token.slice(0, 8) + '...' : null,
    fromAddress: from,
  };

  // Try a raw Postmark call so we get the FULL error back
  let rawResult = null;
  try {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify({
        From: from,
        To: 'rdonnell@p5marketing.com',
        Subject: 'VisitorID Email Test',
        HtmlBody: '<p>This is a test email from the VisitorID debug endpoint.</p>',
        MessageStream: 'outbound',
      }),
    });

    const data = await res.json();
    rawResult = {
      httpStatus: res.status,
      postmarkResponse: data,
    };
  } catch (err) {
    rawResult = { fetchError: err.message };
  }

  return Response.json({ config, rawResult }, { status: 200 });
}
