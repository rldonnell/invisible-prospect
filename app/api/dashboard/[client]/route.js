import { getDb } from '../../../../lib/db';

/**
 * GET /api/dashboard/[client]
 *
 * Returns aggregated dashboard data for a client.
 * Optional query param: ?key=DASHBOARD_KEY for access control
 */
export async function GET(request, { params }) {
  const { client } = params;

  // Optional: simple key-based access control
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (process.env.DASHBOARD_KEY && key !== process.env.DASHBOARD_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const sql = getDb();

    // ── Tier counts ──
    const tierRows = await sql`
      SELECT intent_tier, COUNT(*)::int as count
      FROM visitors
      WHERE client_key = ${client}
      GROUP BY intent_tier
    `;
    const tiers = { HOT: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of tierRows) {
      tiers[r.intent_tier] = r.count;
    }
    const totalVisitors = Object.values(tiers).reduce((a, b) => a + b, 0);

    // ── Subcategory / interest counts ──
    const interestRows = await sql`
      SELECT interest, COUNT(*)::int as count
      FROM (
        SELECT jsonb_array_elements_text(interests) as interest
        FROM visitors
        WHERE client_key = ${client}
          AND interests IS NOT NULL
          AND interests != '[]'::jsonb
      ) sub
      GROUP BY interest
      ORDER BY count DESC
    `;

    // ── Traffic sources ──
    const sourceRows = await sql`
      SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
      FROM visitors
      WHERE client_key = ${client}
      GROUP BY referrer_source
      ORDER BY count DESC
    `;

    // ── Score distribution ──
    const scoreRows = await sql`
      SELECT
        CASE
          WHEN intent_score >= 70 THEN '70+'
          WHEN intent_score >= 50 THEN '50-69'
          WHEN intent_score >= 25 THEN '25-49'
          WHEN intent_score >= 5  THEN '5-24'
          ELSE '0-4'
        END as bucket,
        COUNT(*)::int as count
      FROM visitors
      WHERE client_key = ${client}
      GROUP BY bucket
      ORDER BY bucket DESC
    `;

    // ── Date range ──
    const [dateRange] = await sql`
      SELECT
        MIN(first_visit)::text as earliest,
        MAX(last_visit)::text as latest
      FROM visitors
      WHERE client_key = ${client}
    `;

    // ── Top HOT/High visitors (no PII in unauthenticated view) ──
    const topVisitors = await sql`
      SELECT
        id,
        COALESCE(first_name, '') as first_name,
        COALESCE(LEFT(last_name, 1), '') as last_initial,
        COALESCE(city, '') as city,
        COALESCE(state, '') as state,
        intent_score,
        intent_tier,
        interests,
        referrer_source,
        visit_count,
        last_visit::text as last_visit,
        COALESCE(age_range, '') as age_range,
        COALESCE(company_name, '') as company
      FROM visitors
      WHERE client_key = ${client}
        AND intent_tier IN ('HOT', 'High')
      ORDER BY intent_score DESC, last_visit DESC
      LIMIT 50
    `;

    // ── Last processed timestamp ──
    const [lastRun] = await sql`
      SELECT completed_at::text as last_processed
      FROM processing_runs
      WHERE client_key = ${client}
      ORDER BY completed_at DESC
      LIMIT 1
    `;

    return Response.json({
      client_key: client,
      total_visitors: totalVisitors,
      tiers,
      interests: interestRows,
      sources: sourceRows,
      score_distribution: scoreRows,
      date_range: dateRange || {},
      top_visitors: topVisitors,
      last_processed: lastRun?.last_processed || null,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
