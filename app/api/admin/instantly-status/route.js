import { getDb } from '../../../../lib/db';

/**
 * GET /api/admin/instantly-status
 *
 * Snapshot of Instantly lead-cap utilization. Combines:
 *   - Our DB's view of enrollments per client, per status, per engagement
 *   - Instantly's own /leads/list endpoint for the authoritative count
 *
 * Auth: Bearer $ADMIN_TOKEN (same as other /api/admin/* routes). Falls
 * back to CRON_SECRET if ADMIN_TOKEN isn't set, so this is usable from
 * the admin dashboard without a second secret.
 *
 * Use this to decide whether cleanup-instantly needs to run with a
 * larger ?limit, and to eyeball engagement rates across clients.
 */

const INSTANTLY_LEADS_LIST = 'https://api.instantly.ai/api/v2/leads/list';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const adminToken = process.env.ADMIN_TOKEN || process.env.CRON_SECRET;
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiKey = process.env.INSTANTLY_API_KEY;
  const sql = getDb();

  // ── DB side: enrollment breakdown by client × status × engagement ──
  const dbBreakdown = await sql`
    SELECT
      c.client_key,
      COUNT(*)::int                                            AS total_enrollments,
      COUNT(*) FILTER (WHERE e.status = 'sent')::int           AS status_sent,
      COUNT(*) FILTER (WHERE e.status = 'cleaned_up')::int     AS status_cleaned_up,
      COUNT(*) FILTER (WHERE e.status = 'failed')::int         AS status_failed,
      COUNT(*) FILTER (WHERE e.first_engaged_at IS NOT NULL)::int AS engaged,
      -- Matches the filter in /api/cron/cleanup-instantly (including the
      -- enrolled_at fallback for enrollments where Instantly never fired an
      -- email_sent webhook, so last_sent_at stays NULL).
      COUNT(*) FILTER (
        WHERE e.instantly_lead_id IS NOT NULL
          AND e.first_engaged_at IS NULL
          AND COALESCE(e.status, 'sent') = 'sent'
          AND (
            (
              e.last_sent_at IS NOT NULL
              AND e.last_sent_at < NOW() - INTERVAL '7 days'
              AND (
                COALESCE(e.last_step_sent, 0) >= 3
                OR e.last_sent_at < NOW() - INTERVAL '21 days'
              )
            )
            OR (
              e.last_sent_at IS NULL
              AND e.enrolled_at IS NOT NULL
              AND e.enrolled_at < NOW() - INTERVAL '9 days'
            )
          )
      )::int AS cleanup_eligible,
      COUNT(*) FILTER (
        WHERE e.cleaned_up_at IS NOT NULL
          AND e.cleaned_up_at > NOW() - INTERVAL '7 days'
      )::int AS cleaned_up_last_7d
    FROM email_enrollments e
    JOIN campaigns c ON c.id = e.campaign_id
    GROUP BY c.client_key
    ORDER BY c.client_key
  `;

  // ── Instantly side: authoritative lead count ──
  // The /leads/list v2 endpoint returns a paginated list. We just want
  // the total so we ask for page 1 with limit=1 and read the `total`
  // field if Instantly returns it (they do as of 2025-Q2). If the API
  // shape differs we fall back to a stub so the endpoint still works.
  let instantly = { available: false };
  if (apiKey) {
    try {
      const res = await fetch(INSTANTLY_LEADS_LIST, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 1 }),
      });
      const text = await res.text();
      let body = null;
      try { body = JSON.parse(text); } catch { body = null; }

      instantly = {
        available: res.ok,
        status: res.status,
        total: body?.total ?? body?.count ?? body?.pagination?.total ?? null,
        raw_shape: body ? Object.keys(body).slice(0, 10) : null,
        error: res.ok ? null : text.slice(0, 300),
      };
    } catch (err) {
      instantly = { available: false, error: err.message };
    }
  }

  // ── Totals across DB ──
  const totals = dbBreakdown.reduce(
    (acc, r) => ({
      total_enrollments: acc.total_enrollments + r.total_enrollments,
      engaged:           acc.engaged           + r.engaged,
      cleanup_eligible:  acc.cleanup_eligible  + r.cleanup_eligible,
      cleaned_up_last_7d: acc.cleaned_up_last_7d + r.cleaned_up_last_7d,
    }),
    { total_enrollments: 0, engaged: 0, cleanup_eligible: 0, cleaned_up_last_7d: 0 }
  );

  return Response.json({
    success: true,
    fetched_at: new Date().toISOString(),
    instantly,
    totals,
    per_client: dbBreakdown,
  });
}
