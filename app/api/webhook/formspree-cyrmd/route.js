import { getDb } from '../../../../lib/db';
import { sendEmail } from '../../../../lib/email';

/**
 * POST /api/webhook/formspree-cyrmd
 *
 * Receives form submissions from Formspree (endpoint mjgpddkz)
 * for the CYR-MD (Dr. Cyr Spine) website contact form.
 *
 * Formspree webhook payload format:
 * {
 *   "_replyto": "submitter@email.com",   // or "email"
 *   "name": "...",
 *   "company": "...",
 *   "email": "...",
 *   "message": "...",
 *   "_subject": "...",                    // if configured
 *   ...any other form fields
 * }
 *
 * On each submission:
 *   1. Validates the webhook (Formspree signature or shared secret)
 *   2. Inserts the lead into form_leads table
 *   3. Sends a notification email to the practice via Postmark
 */

const CLIENT_KEY = 'cyr-md';

// Who gets notified when a new lead comes in
const NOTIFY_EMAILS = (process.env.CYRMD_NOTIFY_EMAILS || 'Lcyr@me.com,rdonnell@p5marketing.com,aalvarado@cyrmd.com,Leann@cyrmd.com,ashley@lecyrconsulting.com').split(',').map(e => e.trim());

export async function POST(request) {
  // ── Auth: Formspree can send a custom header or we use a shared secret ──
  // Formspree webhook plugins let you add custom headers.
  // We check for our webhook secret in multiple places for flexibility.
  const authHeader = request.headers.get('authorization');
  const xSecret = request.headers.get('x-webhook-secret');
  const formspreeSecret = request.headers.get('x-formspree-secret');
  const secret = process.env.FORMSPREE_CYRMD_SECRET;

  // If a secret is configured, enforce it. Otherwise accept all
  // (Formspree webhooks come from their servers — you can lock down later).
  if (secret) {
    const authorized =
      authHeader === `Bearer ${secret}` ||
      xSecret === secret ||
      formspreeSecret === secret;
    if (!authorized) {
      console.error('[cyr-md] Webhook auth failed');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const body = await request.json();
    console.log('[cyr-md] Formspree webhook received:', JSON.stringify(body).slice(0, 500));

    // ── Extract form fields ──
    // Formspree webhook payload nests form data inside a "submission" object:
    //   { "form": "mjgpddkz", "keys": [...], "submission": { "email": "...", ... } }
    // We check both top-level and submission-level for resilience.
    const sub = body.submission || body;

    const name     = (sub.name || sub.Name || '').trim();
    const email    = (sub.email || sub.Email || sub._replyto || '').trim().toLowerCase();
    const company  = (sub.company || sub.Company || '').trim();
    const message  = (sub.message || sub.Message || sub['How Can We Help?'] || '').trim();
    const phone    = (sub.phone || sub.Phone || '').trim();
    const location = (sub.location || sub.Location || '').trim();  // San Antonio or Houston

    // Formspree metadata
    const formId      = body.form || body._formId || 'mjgpddkz';
    const submittedAt = (sub._date || sub._submittedAt || new Date().toISOString());

    if (!email) {
      console.warn('[cyr-md] Submission missing email, skipping');
      return Response.json({ success: false, error: 'No email provided' }, { status: 400 });
    }

    // ── 1. Store in database ──
    const sql = getDb();

    await sql`
      CREATE TABLE IF NOT EXISTS form_leads (
        id            SERIAL PRIMARY KEY,
        client_key    TEXT NOT NULL,
        source        TEXT NOT NULL DEFAULT 'formspree',
        form_id       TEXT DEFAULT '',
        name          TEXT DEFAULT '',
        email         TEXT NOT NULL,
        phone         TEXT DEFAULT '',
        company       TEXT DEFAULT '',
        message       TEXT DEFAULT '',
        raw_payload   JSONB DEFAULT '{}'::jsonb,
        notified      BOOLEAN DEFAULT FALSE,
        notified_at   TIMESTAMPTZ,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_form_leads_client
        ON form_leads(client_key, created_at DESC)
    `;

    const inserted = await sql`
      INSERT INTO form_leads (client_key, source, form_id, name, email, phone, company, message, raw_payload)
      VALUES (
        ${CLIENT_KEY},
        'formspree',
        ${formId},
        ${name},
        ${email},
        ${phone},
        ${company},
        ${message},
        ${JSON.stringify(body)}::jsonb
      )
      RETURNING id
    `;

    const leadId = inserted[0]?.id;
    console.log(`[cyr-md] Lead #${leadId} saved: ${name} <${email}>`);

    // ── 2. Send notification email ──
    const notifyHtml = buildNotificationEmail({ leadId, name, email, company, phone, location, message, submittedAt });

    let notifySuccess = true;
    for (const recipient of NOTIFY_EMAILS) {
      const result = await sendEmail({
        to: recipient,
        subject: `🦴 New CYR-MD Lead: ${name || email}`,
        html: notifyHtml,
      });
      if (!result.success) {
        console.error(`[cyr-md] Failed to notify ${recipient}:`, result.error);
        notifySuccess = false;
      }
    }

    // Mark as notified
    if (notifySuccess && leadId) {
      await sql`
        UPDATE form_leads SET notified = TRUE, notified_at = NOW() WHERE id = ${leadId}
      `;
    }

    return Response.json({
      success: true,
      leadId,
      notified: notifySuccess,
    });

  } catch (error) {
    console.error('[cyr-md] Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Also handle GET for webhook verification / health check
export async function GET() {
  return Response.json({
    status: 'ok',
    endpoint: 'formspree-cyrmd',
    client: CLIENT_KEY,
    description: 'CYR-MD Formspree form submission webhook',
  });
}


/**
 * Build an HTML notification email for the practice.
 */
function buildNotificationEmail({ leadId, name, email, company, phone, location, message, submittedAt }) {
  const timestamp = new Date(submittedAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0; padding:0; background-color:#f0f4f8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:540px; margin:32px auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a3a5c 0%, #2d5f8a 100%); padding:28px 32px;">
      <h1 style="margin:0; font-size:20px; font-weight:700; color:#ffffff;">
        New Website Lead
      </h1>
      <p style="margin:6px 0 0; font-size:14px; color:rgba(255,255,255,0.8);">
        CyrMD.com Contact Form
      </p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">

      <!-- Lead details table -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
        <tr>
          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; width:100px;">Name</td>
          <td style="padding:10px 12px; font-size:15px; color:#1e293b; border-bottom:1px solid #e2e8f0; font-weight:600;">${escapeHtml(name) || '<span style="color:#94a3b8;">Not provided</span>'}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0;">Email</td>
          <td style="padding:10px 12px; font-size:15px; color:#1e293b; border-bottom:1px solid #e2e8f0;">
            <a href="mailto:${escapeHtml(email)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(email)}</a>
          </td>
        </tr>
        ${company ? `
        <tr>
          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0;">Company</td>
          <td style="padding:10px 12px; font-size:15px; color:#1e293b; border-bottom:1px solid #e2e8f0;">${escapeHtml(company)}</td>
        </tr>` : ''}
        ${phone ? `
        <tr>
          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0;">Phone</td>
          <td style="padding:10px 12px; font-size:15px; color:#1e293b; border-bottom:1px solid #e2e8f0;">
            <a href="tel:${escapeHtml(phone)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(phone)}</a>
          </td>
        </tr>` : ''}
        ${location ? `
        <tr>
          <td style="padding:10px 12px; font-size:12px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0;">Location</td>
          <td style="padding:10px 12px; font-size:15px; color:#1e293b; border-bottom:1px solid #e2e8f0;">${escapeHtml(location)} Office</td>
        </tr>` : ''}
      </table>

      ${message ? `
      <!-- Message -->
      <div style="background:#f8fafc; border-radius:8px; padding:16px 18px; margin-bottom:20px; border-left:3px solid #2d5f8a;">
        <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Message</div>
        <p style="margin:0; font-size:14px; color:#334155; line-height:1.6; white-space:pre-wrap;">${escapeHtml(message)}</p>
      </div>` : ''}

      <!-- Metadata -->
      <div style="font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:14px;">
        Submitted ${timestamp} &middot; Lead #${leadId || '—'}
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc; padding:16px 32px; border-top:1px solid #e2e8f0;">
      <p style="margin:0; font-size:11px; color:#94a3b8; text-align:center;">
        CYR-MD Lead Notifications &middot; Powered by P5 Marketing
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
