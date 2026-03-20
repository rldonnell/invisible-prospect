import { getDb } from '../../../lib/db';

/**
 * GET /api/reports?client=sa-spine
 *
 * Returns processed visitor data for a client in the same JSON format
 * that the Invisible Prospect Report dashboard expects.
 *
 * Optional params:
 *   ?client=sa-spine       (required) Client key
 *   ?tier=HOT,High         (optional) Filter by intent tiers
 *   ?min_score=45          (optional) Minimum intent score
 *   ?limit=100             (optional) Max visitors returned (default 500)
 *   ?format=dashboard      (optional) 'dashboard' wraps in summary+visitors
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientKey = searchParams.get('client');
  const tierFilter = searchParams.get('tier');
  const minScore = parseInt(searchParams.get('min_score') || '0');
  const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 2000);

  if (!clientKey) {
    return Response.json({ error: 'client query param required' }, { status: 400 });
  }

  try {
    const sql = getDb();

    // ── Summary stats (all done in SQL) ──
    const [totals] = await sql`
      SELECT
        COUNT(*) AS total_visitors,
        COUNT(*) FILTER (WHERE intent_tier = 'HOT') AS hot_count,
        COUNT(*) FILTER (WHERE intent_tier = 'High') AS high_count,
        COUNT(*) FILTER (WHERE intent_tier = 'Medium') AS medium_count,
        COUNT(*) FILTER (WHERE intent_tier = 'Low') AS low_count,
        ROUND(AVG(intent_score)::numeric, 1) AS avg_score,
        MAX(last_visit) AS most_recent_visit,
        MIN(first_visit) AS earliest_visit
      FROM visitors
      WHERE client_key = ${clientKey} AND processed = TRUE
    `;

    // Top interests breakdown
    const interestRows = await sql`
      SELECT interest, COUNT(*) AS visitor_count
      FROM visitors,
           jsonb_array_elements_text(interests) AS interest
      WHERE client_key = ${clientKey} AND processed = TRUE
      GROUP BY interest
      ORDER BY visitor_count DESC
      LIMIT 20
    `;

    // Traffic source breakdown
    const sourceRows = await sql`
      SELECT referrer_source, COUNT(*) AS visitor_count
      FROM visitors
      WHERE client_key = ${clientKey} AND processed = TRUE
      GROUP BY referrer_source
      ORDER BY visitor_count DESC
    `;

    // Daily visitor trend (last 30 days)
    const trendRows = await sql`
      SELECT
        DATE(last_visit) AS visit_date,
        COUNT(*) AS visitor_count
      FROM visitors
      WHERE client_key = ${clientKey}
        AND last_visit >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(last_visit)
      ORDER BY visit_date
    `;

    // ── Visitor list (with optional filters) ──
    let visitors;
    if (tierFilter) {
      const tiers = tierFilter.split(',').map(t => t.trim());
      visitors = await sql`
        SELECT
          first_name, last_name, email, phone,
          city, state, age_range, gender, income, net_worth,
          visit_count, first_visit, last_visit,
          intent_score, intent_tier, interests,
          referrer_source, tags, pages_visited
        FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = TRUE
          AND intent_tier = ANY(${tiers})
          AND intent_score >= ${minScore}
        ORDER BY intent_score DESC
        LIMIT ${limit}
      `;
    } else {
      visitors = await sql`
        SELECT
          first_name, last_name, email, phone,
          city, state, age_range, gender, income, net_worth,
          visit_count, first_visit, last_visit,
          intent_score, intent_tier, interests,
          referrer_source, tags, pages_visited
        FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = TRUE
          AND intent_score >= ${minScore}
        ORDER BY intent_score DESC
        LIMIT ${limit}
      `;
    }

    // Last processing run
    const [lastRun] = await sql`
      SELECT completed_at, processed, tier_counts
      FROM processing_runs
      WHERE client_key = ${clientKey} AND run_type = 'process'
      ORDER BY started_at DESC
      LIMIT 1
    `;

    // Build response
    const summary = {
      total_visitors: parseInt(totals.total_visitors),
      tier_counts: {
        HOT: parseInt(totals.hot_count),
        High: parseInt(totals.high_count),
        Medium: parseInt(totals.medium_count),
        Low: parseInt(totals.low_count),
      },
      avg_score: parseFloat(totals.avg_score || 0),
      date_range: {
        first: totals.earliest_visit,
        last: totals.most_recent_visit,
      },
      subcategory_counts: Object.fromEntries(
        interestRows.map(r => [r.interest, parseInt(r.visitor_count)])
      ),
      referrer_counts: Object.fromEntries(
        sourceRows.map(r => [r.referrer_source, parseInt(r.visitor_count)])
      ),
      daily_trend: trendRows.map(r => ({
        date: r.visit_date,
        count: parseInt(r.visitor_count),
      })),
      last_processed: lastRun?.completed_at || null,
    };

    return Response.json({
      client_key: clientKey,
      summary,
      visitors,
    });

  } catch (error) {
    console.error('Reports error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
