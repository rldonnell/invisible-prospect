import { getDb } from '../../../lib/db';
import DashboardClient from './DashboardClient';

// Force fresh data on every request — no Vercel caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /dashboard/[client]
 *
 * Server component that fetches data and passes to client component.
 * Optional: ?key=DASHBOARD_KEY for access control
 */
export async function generateMetadata({ params }) {
  const { client } = params;
  const name = client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `${name} - Invisible Patient Intelligence`,
  };
}

export default async function DashboardPage({ params, searchParams }) {
  const { client } = params;
  const key = searchParams?.key;

  // Access control
  if (process.env.DASHBOARD_KEY && key !== process.env.DASHBOARD_KEY) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: '24px', color: '#666' }}>Access Required</h1>
        <p style={{ color: '#999' }}>Add ?key=YOUR_KEY to the URL to access this dashboard.</p>
      </div>
    );
  }

  try {
    const sql = getDb();

    // Default 30-day window; override with ?days=90 or ?days=all
    const daysParam = searchParams?.days;
    const showAll = daysParam === 'all';
    const days = showAll ? null : parseInt(daysParam) || 30;
    // Use a far-past date when "all" so every query keeps the same shape
    const cutoff = days
      ? new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
      : '2000-01-01';

    // Tier counts
    const tierRows = await sql`
      SELECT intent_tier, COUNT(*)::int as count
      FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
      GROUP BY intent_tier
    `;
    const tiers = { HOT: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of tierRows) tiers[r.intent_tier] = r.count;
    const totalVisitors = Object.values(tiers).reduce((a, b) => a + b, 0);

    // All-time totals for context
    const [allTimeRow] = await sql`
      SELECT COUNT(*)::int as total FROM visitors WHERE client_key = ${client}
    `;
    const allTimeTotal = allTimeRow?.total || totalVisitors;

    // Interests
    const interestRows = await sql`
      SELECT interest, COUNT(*)::int as count FROM (
        SELECT jsonb_array_elements_text(interests) as interest
        FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
          AND interests IS NOT NULL AND interests != '[]'::jsonb
      ) sub GROUP BY interest ORDER BY count DESC
    `;

    // Sources
    const sourceRows = await sql`
      SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
      FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
      GROUP BY referrer_source ORDER BY count DESC
    `;

    // Top visitors — all tiers so geo filter works across full dataset
    const topVisitors = await sql`
      SELECT id, COALESCE(first_name, '') as first_name,
        COALESCE(LEFT(last_name, 1), '') as last_initial,
        COALESCE(city, '') as city, COALESCE(state, '') as state,
        intent_score, intent_tier, interests, referrer_source,
        visit_count, last_visit::text as last_visit,
        COALESCE(age_range, '') as age_range,
        COALESCE(company_name, '') as company,
        COALESCE(confidence, '') as confidence,
        COALESCE(confidence_score, 0) as confidence_score
      FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
      ORDER BY intent_score DESC, last_visit DESC
    `;

    // Date range (within the filtered window)
    const [dateRange] = await sql`
      SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
      FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
    `;

    // Last processed
    const [lastRun] = await sql`
      SELECT completed_at::text as last_processed
      FROM processing_runs WHERE client_key = ${client}
      ORDER BY completed_at DESC LIMIT 1
    `;

    const clientName = CLIENT_NAMES[client] || client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Client geo config — if set, enables the "State Only" quick filter
    const CLIENT_GEO = {
      'sa-spine': { code: 'TX', label: 'Texas' },
      'az-breasts': { code: 'AZ', label: 'Arizona' },
      'demo': { code: 'TX', label: 'Texas' },
    };

    // Friendly display names
    const CLIENT_NAMES = {
      'demo': 'Demo Practice (Anonymized)',
    };
    const clientGeo = CLIENT_GEO[client] || null;

    const data = {
      clientName,
      clientKey: client,
      totalVisitors,
      allTimeTotal,
      tiers,
      interests: interestRows,
      sources: sourceRows,
      topVisitors,
      dateRange: dateRange || {},
      lastProcessed: lastRun?.last_processed || null,
      clientGeo,
      dateWindow: showAll ? 'all' : days,
    };

    return <DashboardClient data={data} />;

  } catch (error) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: '24px', color: '#c00' }}>Error loading dashboard</h1>
        <p style={{ color: '#999' }}>{error.message}</p>
      </div>
    );
  }
}
