import { getDb } from '../../../lib/db';
import DashboardClient from './DashboardClient';

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

    // Tier counts
    const tierRows = await sql`
      SELECT intent_tier, COUNT(*)::int as count
      FROM visitors WHERE client_key = ${client}
      GROUP BY intent_tier
    `;
    const tiers = { HOT: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of tierRows) tiers[r.intent_tier] = r.count;
    const totalVisitors = Object.values(tiers).reduce((a, b) => a + b, 0);

    // Interests
    const interestRows = await sql`
      SELECT interest, COUNT(*)::int as count FROM (
        SELECT jsonb_array_elements_text(interests) as interest
        FROM visitors WHERE client_key = ${client}
          AND interests IS NOT NULL AND interests != '[]'::jsonb
      ) sub GROUP BY interest ORDER BY count DESC
    `;

    // Sources
    const sourceRows = await sql`
      SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
      FROM visitors WHERE client_key = ${client}
      GROUP BY referrer_source ORDER BY count DESC
    `;

    // Top visitors
    const topVisitors = await sql`
      SELECT id, COALESCE(first_name, '') as first_name,
        COALESCE(LEFT(last_name, 1), '') as last_initial,
        COALESCE(city, '') as city, COALESCE(state, '') as state,
        intent_score, intent_tier, interests, referrer_source,
        visit_count, last_visit::text as last_visit,
        COALESCE(age_range, '') as age_range,
        COALESCE(company_name, '') as company
      FROM visitors WHERE client_key = ${client}
        AND intent_tier IN ('HOT', 'High')
      ORDER BY intent_score DESC, last_visit DESC LIMIT 100
    `;

    // Date range
    const [dateRange] = await sql`
      SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
      FROM visitors WHERE client_key = ${client}
    `;

    // Last processed
    const [lastRun] = await sql`
      SELECT completed_at::text as last_processed
      FROM processing_runs WHERE client_key = ${client}
      ORDER BY completed_at DESC LIMIT 1
    `;

    const clientName = client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const data = {
      clientName,
      clientKey: client,
      totalVisitors,
      tiers,
      interests: interestRows,
      sources: sourceRows,
      topVisitors,
      dateRange: dateRange || {},
      lastProcessed: lastRun?.last_processed || null,
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
