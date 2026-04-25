import { getDb } from '../../../../lib/db';

/**
 * GET /api/admin/engagement-stats
 *
 * Returns Instantly engagement metrics for the admin dashboard "Engagement" tab.
 *
 * Response shape:
 *   {
 *     totals: { sent, opens, clicks, replies, open_rate, click_rate, reply_rate },
 *     per_client: [ { client_key, enrolled, engaged, opens, clicks, replies, ... } ],
 *     per_campaign: [ { client_key, bucket, instantly_campaign_id, enrolled, opens, ... } ],
 *     recent_engaged: [ { visitor_id, client_key, email, intent_tier, engagement_tier,
 *                        tags, last_engaged_at, last_event_type } ],
 *     reclaimed_last_7d, reclaim_eligible_now
 *   }
 *
 * Auth: Bearer $ADMIN_TOKEN (falls back to CRON_SECRET like /api/admin/instantly-status).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const adminToken = process.env.ADMIN_TOKEN || process.env.CRON_SECRET;
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sql = getDb();

  // ── Per-client aggregates from email_enrollments + instantly_engagement ──
  const perClient = await sql`
    SELECT
      c.client_key,
      COUNT(DISTINCT e.id)::int AS enrolled,
      COUNT(DISTINCT e.id) FILTER (WHERE e.first_engaged_at IS NOT NULL)::int AS engaged,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_sent')::int    AS sends,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_opened')::int  AS opens,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_clicked')::int AS clicks,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_replied')::int AS replies,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_bounced')::int AS bounces,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'lead_unsubscribed')::int AS unsubs,
      COUNT(DISTINCT e.id) FILTER (WHERE e.cleaned_up_at > NOW() - INTERVAL '7 days')::int AS reclaimed_7d,
      COUNT(DISTINCT e.id) FILTER (
        WHERE e.instantly_lead_id IS NOT NULL
          AND e.first_engaged_at IS NULL
          AND COALESCE(e.status, 'sent') = 'sent'
          AND COALESCE(e.last_step_sent, 0) >= 3
          AND e.last_sent_at < NOW() - INTERVAL '7 days'
      )::int AS reclaim_eligible
    FROM campaigns c
    LEFT JOIN email_enrollments e   ON e.campaign_id = c.id
    LEFT JOIN instantly_engagement ev ON ev.enrollment_id = e.id
    GROUP BY c.client_key
    ORDER BY COUNT(DISTINCT e.id) DESC
  `;

  // ── Per-campaign (bucket × client × kind) breakdown ──
  // c.kind ('warm' | 'cold') is included so cold campaigns surface as
  // distinct rows in the admin Engagement tab. Sort puts warm above cold
  // within each (client, bucket) pair so eyes scan top-to-bottom by recency.
  const perCampaign = await sql`
    SELECT
      c.id AS campaign_id,
      c.client_key,
      c.bucket,
      c.kind,
      c.instantly_campaign_id,
      c.active,
      COUNT(DISTINCT e.id)::int AS enrolled,
      COUNT(DISTINCT e.id) FILTER (WHERE e.first_engaged_at IS NOT NULL)::int AS engaged,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_opened')::int  AS opens,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_clicked')::int AS clicks,
      COUNT(ev.id) FILTER (WHERE ev.event_type = 'email_replied')::int AS replies
    FROM campaigns c
    LEFT JOIN email_enrollments e   ON e.campaign_id = c.id
    LEFT JOIN instantly_engagement ev ON ev.enrollment_id = e.id
    GROUP BY c.id, c.client_key, c.bucket, c.kind, c.instantly_campaign_id, c.active
    ORDER BY c.client_key, c.bucket, c.kind
  `;

  // ── Recently engaged visitors (top 50) ──
  const recent = await sql`
    SELECT
      v.id AS visitor_id,
      v.client_key,
      v.email,
      v.first_name,
      v.last_name,
      v.intent_tier,
      v.engagement_tier,
      v.tags,
      v.open_count,
      v.click_count,
      v.reply_count,
      v.last_engaged_at,
      (
        SELECT ev.event_type
        FROM instantly_engagement ev
        WHERE ev.visitor_id = v.id
        ORDER BY ev.event_at DESC
        LIMIT 1
      ) AS last_event_type
    FROM visitors v
    WHERE v.first_engaged_at IS NOT NULL
    ORDER BY v.last_engaged_at DESC
    LIMIT 50
  `;

  // ── Totals ──
  const totals = perClient.reduce(
    (a, r) => ({
      enrolled: a.enrolled + (r.enrolled || 0),
      engaged:  a.engaged  + (r.engaged  || 0),
      sends:    a.sends    + (r.sends    || 0),
      opens:    a.opens    + (r.opens    || 0),
      clicks:   a.clicks   + (r.clicks   || 0),
      replies:  a.replies  + (r.replies  || 0),
      bounces:  a.bounces  + (r.bounces  || 0),
      unsubs:   a.unsubs   + (r.unsubs   || 0),
      reclaimed_7d:    a.reclaimed_7d    + (r.reclaimed_7d    || 0),
      reclaim_eligible: a.reclaim_eligible + (r.reclaim_eligible || 0),
    }),
    { enrolled: 0, engaged: 0, sends: 0, opens: 0, clicks: 0, replies: 0, bounces: 0, unsubs: 0, reclaimed_7d: 0, reclaim_eligible: 0 }
  );

  // Derived rates. We divide by `sends` when we have it (post-webhook data),
  // and fall back to `enrolled` as the denominator before email_sent events
  // start flowing. Guard against div-by-zero.
  function rate(num, denom) {
    if (!denom) return null;
    return Math.round((num / denom) * 1000) / 10; // one decimal
  }
  const denom = totals.sends || totals.enrolled;
  totals.open_rate  = rate(totals.opens,   denom);
  totals.click_rate = rate(totals.clicks,  denom);
  totals.reply_rate = rate(totals.replies, denom);

  return Response.json({
    success: true,
    fetched_at: new Date().toISOString(),
    totals,
    per_client: perClient,
    per_campaign: perCampaign,
    recent_engaged: recent,
  });
}
