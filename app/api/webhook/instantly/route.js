import crypto from 'crypto';
import { getDb } from '../../../../lib/db';

/**
 * POST /api/webhook/instantly
 *
 * Receives engagement events from Instantly.ai v2 webhooks.
 *
 * Supported events:
 *   email_sent, email_opened, email_clicked, email_replied,
 *   email_bounced, lead_unsubscribed, lead_interested,
 *   lead_meeting_booked, lead_not_interested, lead_completed
 *
 * Writes a row to instantly_engagement for every event and updates
 * denormalized counters + tier on visitors and email_enrollments.
 *
 * Auth (any ONE of these passes):
 *   - Authorization: Bearer {INSTANTLY_WEBHOOK_SECRET}
 *   - x-instantly-signature: sha256={hex HMAC of raw body using the secret}
 *   - x-webhook-signature: {hex HMAC}
 *
 * If INSTANTLY_WEBHOOK_SECRET is not set, requests are accepted
 * without auth (lockdown mode: set the secret).
 *
 * Instantly can batch events or send them singly. This handler accepts
 * both: a top-level event object, or { events: [...] }, or a raw array.
 */

// Engagement tier hierarchy (higher wins on upgrade, never downgrades)
const TIER_ORDER = { None: 0, Passive: 1, Engaged: 2, Hot: 3 };

function tierForEvent(eventType) {
  switch (eventType) {
    case 'email_opened':        return 'Passive';
    case 'email_clicked':       return 'Engaged';
    case 'email_replied':       return 'Hot';
    case 'lead_interested':     return 'Hot';
    case 'lead_meeting_booked': return 'Hot';
    default:                    return 'None';
  }
}

/**
 * Normalize the many shapes Instantly webhook payloads can take
 * into a single internal event object.
 */
function normalizeEvent(raw) {
  const e = raw || {};
  // Event type: v2 uses `event_type`, some older payloads use `event`
  const event_type = e.event_type || e.event || e.type || 'unknown';

  const lead = e.lead || e.data?.lead || {};
  const campaign = e.campaign || e.data?.campaign || {};

  const event_at = e.timestamp || e.event_at || e.created_at || new Date().toISOString();

  return {
    event_type,
    event_at,
    instantly_campaign_id: e.campaign_id || campaign.id || e.data?.campaign_id || null,
    instantly_lead_id:     e.lead_id     || lead.id     || e.data?.lead_id     || null,
    lead_email:            (e.lead_email || lead.email  || e.email             || '').toLowerCase() || null,
    step:                  e.step ?? e.step_number ?? e.data?.step ?? null,
    link_url:              e.url || e.link_url || e.data?.url || e.data?.link_url || null,
    reply_snippet:         (e.reply_snippet || e.reply || e.data?.reply_snippet || '').slice(0, 500) || null,
    raw: raw,
  };
}

export async function POST(request) {
  // ── Read raw body once for signature verification ──
  const rawBody = await request.text();

  // ── Auth ──
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    const sigHeader =
      request.headers.get('x-instantly-signature') ||
      request.headers.get('x-webhook-signature') ||
      request.headers.get('x-hub-signature-256');

    let authorized = authHeader === `Bearer ${secret}`;

    if (!authorized && sigHeader) {
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      authorized =
        sigHeader === expected ||
        sigHeader === `sha256=${expected}`;
    }

    if (!authorized) {
      console.error('[instantly-webhook] Auth failed');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // ── Parse body ──
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    console.error('[instantly-webhook] Invalid JSON:', err.message);
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle both single-event and batched-event shapes
  const rawEvents = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.events)
    ? payload.events
    : [payload];

  const events = rawEvents.map(normalizeEvent);

  if (events.length === 0) {
    return Response.json({ success: true, processed: 0 });
  }

  try {
    const sql = getDb();
    const processed = [];

    for (const ev of events) {
      // ── Look up enrollment (and via it, the visitor) ──
      let enrollment = null;
      if (ev.instantly_lead_id) {
        const rows = await sql`
          SELECT e.id AS enrollment_id, e.visitor_id, e.campaign_id
          FROM email_enrollments e
          WHERE e.instantly_lead_id = ${ev.instantly_lead_id}
          LIMIT 1
        `;
        enrollment = rows[0] || null;
      }

      // Fallback: if no enrollment match (older leads pushed before we
      // stored instantly_lead_id, manual imports, etc.), try matching
      // by campaign + lead email.
      if (!enrollment && ev.lead_email && ev.instantly_campaign_id) {
        const rows = await sql`
          SELECT e.id AS enrollment_id, e.visitor_id, e.campaign_id
          FROM email_enrollments e
          JOIN campaigns c ON c.id = e.campaign_id
          JOIN visitors v  ON v.id = e.visitor_id
          WHERE LOWER(v.email) = ${ev.lead_email}
            AND c.instantly_campaign_id = ${ev.instantly_campaign_id}
          ORDER BY e.enrolled_at DESC
          LIMIT 1
        `;
        enrollment = rows[0] || null;
      }

      // ── 1. Insert the raw event ──
      await sql`
        INSERT INTO instantly_engagement (
          event_type, event_at,
          instantly_campaign_id, instantly_lead_id, lead_email,
          visitor_id, campaign_id, enrollment_id,
          step, link_url, reply_snippet, raw_payload
        ) VALUES (
          ${ev.event_type}, ${ev.event_at},
          ${ev.instantly_campaign_id}, ${ev.instantly_lead_id}, ${ev.lead_email},
          ${enrollment?.visitor_id ?? null},
          ${enrollment?.campaign_id ?? null},
          ${enrollment?.enrollment_id ?? null},
          ${ev.step}, ${ev.link_url}, ${ev.reply_snippet},
          ${JSON.stringify(ev.raw)}::jsonb
        )
      `;

      // ── 2. Update denormalized summaries ──
      if (enrollment?.visitor_id) {
        await applyEngagementToVisitor(sql, enrollment.visitor_id, ev);
      }
      if (enrollment?.enrollment_id) {
        await applyEngagementToEnrollment(sql, enrollment.enrollment_id, ev);
      }

      processed.push({
        event_type: ev.event_type,
        matched: !!enrollment,
        visitor_id: enrollment?.visitor_id ?? null,
      });
    }

    return Response.json({ success: true, processed: processed.length, events: processed });
  } catch (err) {
    console.error('[instantly-webhook] Error:', err);
    return Response.json(
      { error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhook/instantly - health check / verification endpoint.
 * Instantly's webhook registration flow sometimes performs a GET first.
 */
export async function GET() {
  return Response.json({
    status: 'ok',
    endpoint: 'instantly-webhook',
    description: 'Receives Instantly.ai v2 engagement webhooks',
    supported_events: [
      'email_sent',
      'email_opened',
      'email_clicked',
      'email_replied',
      'email_bounced',
      'lead_unsubscribed',
      'lead_interested',
      'lead_meeting_booked',
      'lead_not_interested',
      'lead_completed',
    ],
  });
}


// ──────────────────────────────────────────────────────────────────────
// Denormalization helpers
// ──────────────────────────────────────────────────────────────────────

async function applyEngagementToVisitor(sql, visitorId, ev) {
  const eventAt = ev.event_at;
  const candidateTier = tierForEvent(ev.event_type);

  const isOpen     = ev.event_type === 'email_opened';
  const isClick    = ev.event_type === 'email_clicked';
  const isReply    = ev.event_type === 'email_replied';
  const isBounce   = ev.event_type === 'email_bounced';
  const isUnsub    = ev.event_type === 'lead_unsubscribed';
  const isEngagingEvent = isOpen || isClick || isReply
    || ev.event_type === 'lead_interested'
    || ev.event_type === 'lead_meeting_booked';

  // Use a single UPDATE with CASE/GREATEST logic so we never downgrade
  // a tier and never overwrite first_engaged_at once set.
  await sql`
    UPDATE visitors
    SET
      first_engaged_at = CASE
        WHEN ${isEngagingEvent} AND first_engaged_at IS NULL THEN ${eventAt}
        ELSE first_engaged_at
      END,
      last_engaged_at = CASE
        WHEN ${isEngagingEvent} THEN GREATEST(COALESCE(last_engaged_at, ${eventAt}::timestamptz), ${eventAt}::timestamptz)
        ELSE last_engaged_at
      END,
      open_count    = open_count    + CASE WHEN ${isOpen}  THEN 1 ELSE 0 END,
      click_count   = click_count   + CASE WHEN ${isClick} THEN 1 ELSE 0 END,
      reply_count   = reply_count   + CASE WHEN ${isReply} THEN 1 ELSE 0 END,
      bounced       = bounced       OR ${isBounce},
      unsubscribed  = unsubscribed  OR ${isUnsub},
      engagement_tier = CASE
        WHEN ${TIER_ORDER[candidateTier] || 0} > COALESCE(
          CASE engagement_tier
            WHEN 'None' THEN 0
            WHEN 'Passive' THEN 1
            WHEN 'Engaged' THEN 2
            WHEN 'Hot' THEN 3
            ELSE 0
          END, 0
        )
        THEN ${candidateTier}
        ELSE engagement_tier
      END
    WHERE id = ${visitorId}
  `;

  // ── Loop-back into intent scoring ──
  // An open or click on an Instantly email validates two things at once:
  // the email address is real, and a human is paying attention. Both
  // signals now promote to HOT. Page-view signals alone can no longer
  // reach HOT (see lib/scoring.js) - this is the only path.
  //
  // Rules (one-way ratchet, never downgrades):
  //   email_opened                      -> HOT + email-re-engaged tag
  //   email_clicked                     -> HOT + email-re-engaged tag
  //   email_replied / interested / booked -> HOT + email-re-engaged tag
  //
  // hot_alerted_at is cleared on every HOT promotion so the next morning's
  // HOT digest re-surfaces the lead with fresh engagement context. This is
  // actionable news even if they were already HOT from a prior event.
  const promoteToHot = isOpen
    || isClick
    || isReply
    || ev.event_type === 'lead_interested'
    || ev.event_type === 'lead_meeting_booked';

  // The event-specific tag label (or null if this event doesn't add one).
  const engagementTag = isReply                       ? 'email-replied'
    : ev.event_type === 'lead_interested'             ? 'email-interested'
    : ev.event_type === 'lead_meeting_booked'         ? 'email-meeting-booked'
    : isClick                                         ? 'email-clicked'
    : isOpen                                          ? 'email-opened'
    : ev.event_type === 'email_bounced'               ? 'email-bounced'
    : ev.event_type === 'lead_unsubscribed'           ? 'email-unsubscribed'
    : null;

  // Umbrella tag stamped on every HOT promotion from an engagement event,
  // so the HOT digest and GHL segmentation can trivially identify
  // engagement-validated leads vs. ones that reached HOT by other means.
  const reEngagedTag = promoteToHot ? 'email-re-engaged' : null;

  await sql`
    UPDATE visitors
    SET
      -- Promote intent_tier (one-way ratchet: never downgrade)
      intent_tier = CASE
        WHEN ${promoteToHot} AND intent_tier <> 'HOT' THEN 'HOT'
        ELSE intent_tier
      END,
      -- Clear alerted stamp on every HOT promotion so tomorrow's digest
      -- re-surfaces the lead with the latest engagement context.
      hot_alerted_at = CASE
        WHEN ${promoteToHot} THEN NULL
        ELSE hot_alerted_at
      END,
      -- Append the event-specific tag if not already present
      tags = CASE
        WHEN ${engagementTag}::text IS NULL THEN tags
        WHEN tags ? ${engagementTag} THEN tags
        ELSE COALESCE(tags, '[]'::jsonb) || to_jsonb(${engagementTag}::text)
      END
    WHERE id = ${visitorId}
  `;

  // Stamp the umbrella 'email-re-engaged' tag on any HOT promotion.
  // Kept as a separate UPDATE so the CASE above stays readable.
  if (reEngagedTag) {
    await sql`
      UPDATE visitors
      SET tags = CASE
        WHEN tags ? ${reEngagedTag} THEN tags
        ELSE COALESCE(tags, '[]'::jsonb) || to_jsonb(${reEngagedTag}::text)
      END
      WHERE id = ${visitorId}
    `;
  }
}

async function applyEngagementToEnrollment(sql, enrollmentId, ev) {
  const eventAt = ev.event_at;

  // Track the last email that was SENT so the cleanup cron knows
  // when the sequence is complete.
  if (ev.event_type === 'email_sent') {
    await sql`
      UPDATE email_enrollments
      SET
        last_step_sent  = COALESCE(${ev.step}, last_step_sent),
        last_sent_at    = GREATEST(COALESCE(last_sent_at, ${eventAt}::timestamptz), ${eventAt}::timestamptz),
        last_event_type = ${ev.event_type}
      WHERE id = ${enrollmentId}
    `;
    return;
  }

  // For engagement events, stamp first/last and latest event type.
  const isEngagingEvent =
    ev.event_type === 'email_opened' ||
    ev.event_type === 'email_clicked' ||
    ev.event_type === 'email_replied' ||
    ev.event_type === 'lead_interested' ||
    ev.event_type === 'lead_meeting_booked';

  await sql`
    UPDATE email_enrollments
    SET
      first_engaged_at = CASE
        WHEN ${isEngagingEvent} AND first_engaged_at IS NULL THEN ${eventAt}
        ELSE first_engaged_at
      END,
      last_engaged_at = CASE
        WHEN ${isEngagingEvent} THEN GREATEST(COALESCE(last_engaged_at, ${eventAt}::timestamptz), ${eventAt}::timestamptz)
        ELSE last_engaged_at
      END,
      last_event_type = ${ev.event_type}
    WHERE id = ${enrollmentId}
  `;
}
