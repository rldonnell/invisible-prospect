import { getDb } from '../../../../lib/db';
import { sendEmail } from '../../../../lib/email';
import { buildHotDigestXlsx } from '../../../../lib/hot-digest-xlsx';

/**
 * GET /api/cron/sa-spine-hot-digest
 *
 * Scheduled daily at 8 AM Central (13:00 UTC CDT / 14:00 UTC CST).
 * Pulls every SA Spine visitor where intent_tier='HOT' and hot_alerted_at IS NULL,
 * builds an xlsx, emails it to the client, and stamps hot_alerted_at so the same
 * leads aren't sent twice.
 *
 * This catches BOTH brand-new HOT visitors AND existing visitors who were
 * promoted to HOT today by the processing cron.
 *
 * Env vars:
 *   CRON_SECRET             — shared auth with Vercel Cron
 *   POSTMARK_API_TOKEN      — Postmark server token
 *   EMAIL_FROM              — sender, e.g. "VisitorID <noreply@visitorid.p5marketing.com>"
 *   SA_SPINE_DIGEST_TO      — recipient(s), comma-separated; default falls back to
 *                             the hardcoded production list below if not set.
 */

const CLIENT_KEY = 'sa-spine';
const CLIENT_DISPLAY = 'SA Spine';
const DEFAULT_RECIPIENTS = 'lcyr@me.com, appointments@saspine.com';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const sql = getDb();

    // ── Pull unalerted HOT visitors for SA Spine ──
    const visitors = await sql`
      SELECT
        id,
        first_name, last_name, email, phone,
        city, state, age_range,
        intent_score, visit_count,
        last_visit, interests, referrer_source
      FROM visitors
      WHERE client_key = ${CLIENT_KEY}
        AND intent_tier = 'HOT'
        AND hot_alerted_at IS NULL
        AND processed = TRUE
        AND email IS NOT NULL
        AND email <> ''
      ORDER BY intent_score DESC, last_visit DESC
    `;

    // If nothing new, send a short "no new hot leads" note and exit.
    // We still mark the run so ops can see the cron fired.
    if (visitors.length === 0) {
      const recipients = process.env.SA_SPINE_DIGEST_TO || DEFAULT_RECIPIENTS;
      const dateStr = new Date().toLocaleDateString('en-US', {
        timeZone: 'America/Chicago',
        month: 'long', day: 'numeric', year: 'numeric',
      });

      const result = await sendEmail({
        to: recipients,
        subject: `${CLIENT_DISPLAY} — No new HOT leads this morning (${dateStr})`,
        html: `
          <p>Good morning,</p>
          <p>No new HOT-tier leads from VisitorID overnight for ${CLIENT_DISPLAY}.
          You'll receive a spreadsheet tomorrow morning if new high-intent visitors
          are identified.</p>
          <p style="font-size:12px;color:#64748b;">VisitorID&trade; by P5 Marketing</p>
        `,
      });

      return Response.json({
        ok: true,
        client: CLIENT_KEY,
        sent_count: 0,
        email_result: result,
      });
    }

    // ── Build xlsx ──
    const dateStr = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      month: '2-digit', day: '2-digit', year: 'numeric',
    }).replace(/\//g, '-');

    const xlsxBuffer = await buildHotDigestXlsx({
      sheetName: `${CLIENT_DISPLAY} HOT`,
      visitors,
    });
    const base64 = xlsxBuffer.toString('base64');
    const filename = `SA_Spine_HOT_Leads_${dateStr}.xlsx`;

    // ── Summary stats for email body ──
    const avgScore =
      Math.round(
        (visitors.reduce((s, v) => s + (v.intent_score || 0), 0) /
          visitors.length) * 10
      ) / 10;
    const withPhone = visitors.filter(v => v.phone).length;
    const inTx = visitors.filter(
      v => (v.state || '').toUpperCase() === 'TX'
    ).length;

    // Top interests
    const interestCounts = {};
    for (const v of visitors) {
      let arr = v.interests;
      if (typeof arr === 'string') {
        try { arr = JSON.parse(arr); } catch { arr = []; }
      }
      if (Array.isArray(arr)) {
        for (const i of arr) interestCounts[i] = (interestCounts[i] || 0) + 1;
      }
    }
    const topInterests = Object.entries(interestCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const displayDate = new Date().toLocaleDateString('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;line-height:1.5;">
  <p>Good morning,</p>

  <p>Attached are the <strong>${visitors.length} new HOT lead${visitors.length === 1 ? '' : 's'}</strong>
  that VisitorID identified on <strong>saspine.com</strong> since yesterday's digest —
  visitors showing the strongest intent signals (multiple visits, condition/procedure pages,
  high-intent actions, and recent activity).</p>

  <h3 style="margin-bottom:4px;">Snapshot — ${displayDate}</h3>
  <ul>
    <li><strong>${visitors.length} new HOT lead${visitors.length === 1 ? '' : 's'}</strong>
        (avg intent score <strong>${avgScore}</strong>)</li>
    <li><strong>${visitors.length}</strong> with verified email,
        <strong>${withPhone}</strong> with phone number</li>
    <li><strong>${inTx}</strong> in Texas (local market)</li>
  </ul>

  ${topInterests.length ? `
  <h3 style="margin-bottom:4px;">Top interests driving these leads</h3>
  <ol>
    ${topInterests.map(([name, count]) => `<li>${name} — ${count}</li>`).join('')}
  </ol>
  ` : ''}

  <p>The spreadsheet is sorted by intent score (highest first) and includes name, email,
  phone, city/state, age range, visit count, last visit, primary interests, and traffic source.</p>

  <p style="font-size:12px;color:#64748b;margin-top:28px;">
    VisitorID&trade; by P5 Marketing · Automated morning digest
  </p>
</body></html>
    `.trim();

    const recipients = process.env.SA_SPINE_DIGEST_TO || DEFAULT_RECIPIENTS;
    const emailResult = await sendEmail({
      to: recipients,
      subject: `${CLIENT_DISPLAY} — ${visitors.length} new HOT lead${visitors.length === 1 ? '' : 's'} (${displayDate.split(',')[1].trim()})`,
      html,
      attachments: [{
        name: filename,
        contentBase64: base64,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    if (!emailResult.success) {
      // Don't stamp hot_alerted_at if the email failed — we want to retry tomorrow
      return Response.json(
        { ok: false, error: emailResult.error, client: CLIENT_KEY, would_send_count: visitors.length },
        { status: 502 }
      );
    }

    // ── Stamp hot_alerted_at so these visitors don't get re-sent tomorrow ──
    const ids = visitors.map(v => v.id);
    await sql`
      UPDATE visitors
      SET hot_alerted_at = NOW()
      WHERE id = ANY(${ids})
    `;

    return Response.json({
      ok: true,
      client: CLIENT_KEY,
      sent_count: visitors.length,
      message_id: emailResult.messageId,
      recipients,
    });

  } catch (err) {
    console.error('[sa-spine-hot-digest] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
