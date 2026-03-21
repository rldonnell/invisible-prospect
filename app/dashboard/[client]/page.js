import { cookies } from 'next/headers';
import { getDb } from '../../../lib/db';
import { verifySessionToken, isAuthorized, COOKIE_NAME } from '../../../lib/auth';
import DashboardClient from './DashboardClient';
import LoginForm from './LoginForm';

// Force fresh data on every request — no Vercel caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * /dashboard/[client]
 *
 * Server component that fetches data and passes to client component.
 * Requires cookie-based auth (per-client password or admin password).
 * Falls back to legacy ?key= param if DASH_SECRET is not set yet.
 */
export async function generateMetadata({ params }) {
  const { client } = params;
  const name = client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `${name} - Invisible Patient Intelligence`,
  };
}

// Friendly display names (used in both login and dashboard)
const CLIENT_NAMES = {
  'demo': 'Demo Practice (Anonymized)',
};

function getClientName(client) {
  return CLIENT_NAMES[client] || client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default async function DashboardPage({ params, searchParams }) {
  const { client } = params;
  const clientName = getClientName(client);

  // --- Authentication ---
  const dashSecret = process.env.DASH_SECRET;
  let isAuthenticated = false;
  let authRole = null;

  if (dashSecret) {
    // Cookie-based auth is active
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    const session = verifySessionToken(sessionCookie?.value);

    if (!isAuthorized(session, client)) {
      // Not logged in or wrong client — show login form
      return <LoginForm clientKey={client} clientName={clientName} />;
    }

    // Session is valid — show full names
    isAuthenticated = true;
    authRole = session.role;
  } else {
    // Legacy fallback: ?key= param (for backward compat until DASH_SECRET is set)
    const key = searchParams?.key;
    if (process.env.DASHBOARD_KEY && key !== process.env.DASHBOARD_KEY) {
      return (
        <div style={{ padding: '60px', textAlign: 'center', fontFamily: 'system-ui' }}>
          <h1 style={{ fontSize: '24px', color: '#666' }}>Access Required</h1>
          <p style={{ color: '#999' }}>Add ?key=YOUR_KEY to the URL to access this dashboard.</p>
        </div>
      );
    }
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

    // State filter — ?state=TX filters everything to Texas-only
    const stateParam = searchParams?.state || '';
    const stateFilter = stateParam.toUpperCase();
    const filterByState = stateFilter.length === 2;

    // Tier counts
    const tierRows = filterByState
      ? await sql`
          SELECT intent_tier, COUNT(*)::int as count
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
            AND UPPER(state) = ${stateFilter}
          GROUP BY intent_tier
        `
      : await sql`
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
    const interestRows = filterByState
      ? await sql`
          SELECT interest, COUNT(*)::int as count FROM (
            SELECT jsonb_array_elements_text(interests) as interest
            FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
              AND UPPER(state) = ${stateFilter}
              AND interests IS NOT NULL AND interests != '[]'::jsonb
          ) sub GROUP BY interest ORDER BY count DESC
        `
      : await sql`
          SELECT interest, COUNT(*)::int as count FROM (
            SELECT jsonb_array_elements_text(interests) as interest
            FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
              AND interests IS NOT NULL AND interests != '[]'::jsonb
          ) sub GROUP BY interest ORDER BY count DESC
        `;

    // Sources
    const sourceRows = filterByState
      ? await sql`
          SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
            AND UPPER(state) = ${stateFilter}
          GROUP BY referrer_source ORDER BY count DESC
        `
      : await sql`
          SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
          GROUP BY referrer_source ORDER BY count DESC
        `;

    // Top visitors — all tiers so filters work across full dataset
    const topVisitors = filterByState
      ? await sql`
          SELECT id, COALESCE(first_name, '') as first_name,
            COALESCE(last_name, '') as last_name,
            COALESCE(LEFT(last_name, 1), '') as last_initial,
            COALESCE(email, '') as email,
            COALESCE(city, '') as city, COALESCE(state, '') as state,
            intent_score, intent_tier, interests, referrer_source,
            visit_count, last_visit::text as last_visit,
            COALESCE(age_range, '') as age_range,
            COALESCE(company_name, '') as company,
            COALESCE(confidence, '') as confidence,
            COALESCE(confidence_score, 0) as confidence_score
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
            AND UPPER(state) = ${stateFilter}
          ORDER BY intent_score DESC, last_visit DESC
        `
      : await sql`
          SELECT id, COALESCE(first_name, '') as first_name,
            COALESCE(last_name, '') as last_name,
            COALESCE(LEFT(last_name, 1), '') as last_initial,
            COALESCE(email, '') as email,
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
    const [dateRange] = filterByState
      ? await sql`
          SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
            AND UPPER(state) = ${stateFilter}
        `
      : await sql`
          SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
        `;

    // Last processed
    const [lastRun] = await sql`
      SELECT completed_at::text as last_processed
      FROM processing_runs WHERE client_key = ${client}
      ORDER BY completed_at DESC LIMIT 1
    `;

    // Client geo config
    const CLIENT_GEO = {
      'sa-spine': { code: 'TX', label: 'Texas' },
      'az-breasts': { code: 'AZ', label: 'Arizona' },
      'demo': { code: 'TX', label: 'Texas' },
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
      activeState: filterByState ? stateFilter : null,
      isAuthenticated,
      authRole,
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
