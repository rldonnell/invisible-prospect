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
    title: `${name} - VisitorID\u2122`,
  };
}

// Friendly display names (used in both login and dashboard)
const CLIENT_NAMES = {
  'demo': 'Demo Practice (Anonymized)',
  'waverly-manor': 'Waverly Manor',
  'p5': 'P5 Marketing',
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

    // State filter — ?state=TX filters to Texas-only, ?state=!TX filters out Texas
    const stateParam = searchParams?.state || '';
    const stateNegate = stateParam.startsWith('!');
    const stateFilter = (stateNegate ? stateParam.slice(1) : stateParam).toUpperCase();
    const filterByState = stateFilter.length === 2;

    // Tier counts
    const tierRows = filterByState
      ? (stateNegate
          ? await sql`
              SELECT intent_tier, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(COALESCE(state,'')) != ${stateFilter}
              GROUP BY intent_tier
            `
          : await sql`
              SELECT intent_tier, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(state) = ${stateFilter}
              GROUP BY intent_tier
            `)
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
      ? (stateNegate
          ? await sql`
              SELECT interest, COUNT(*)::int as count FROM (
                SELECT jsonb_array_elements_text(interests) as interest
                FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                  AND UPPER(COALESCE(state,'')) != ${stateFilter}
                  AND interests IS NOT NULL AND interests != '[]'::jsonb
              ) sub GROUP BY interest ORDER BY count DESC
            `
          : await sql`
              SELECT interest, COUNT(*)::int as count FROM (
                SELECT jsonb_array_elements_text(interests) as interest
                FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                  AND UPPER(state) = ${stateFilter}
                  AND interests IS NOT NULL AND interests != '[]'::jsonb
              ) sub GROUP BY interest ORDER BY count DESC
            `)
      : await sql`
          SELECT interest, COUNT(*)::int as count FROM (
            SELECT jsonb_array_elements_text(interests) as interest
            FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
              AND interests IS NOT NULL AND interests != '[]'::jsonb
          ) sub GROUP BY interest ORDER BY count DESC
        `;

    // Sources
    const sourceRows = filterByState
      ? (stateNegate
          ? await sql`
              SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(COALESCE(state,'')) != ${stateFilter}
              GROUP BY referrer_source ORDER BY count DESC
            `
          : await sql`
              SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(state) = ${stateFilter}
              GROUP BY referrer_source ORDER BY count DESC
            `)
      : await sql`
          SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
          GROUP BY referrer_source ORDER BY count DESC
        `;

    // Top visitors — all tiers so filters work across full dataset
    // `tags` jsonb is pulled so we can show the "Return" badge + filter on it.
    const topVisitors = filterByState
      ? (stateNegate
          ? await sql`
              SELECT id, COALESCE(first_name, '') as first_name,
                COALESCE(last_name, '') as last_name,
                COALESCE(LEFT(last_name, 1), '') as last_initial,
                COALESCE(email, '') as email,
                COALESCE(city, '') as city, COALESCE(state, '') as state,
                intent_score, intent_tier, interests, referrer_source,
                visit_count, last_visit::text as last_visit,
                first_visit::text as first_visit,
                COALESCE(age_range, '') as age_range,
                COALESCE(company_name, '') as company,
                COALESCE(confidence, '') as confidence,
                COALESCE(confidence_score, 0) as confidence_score,
                COALESCE(tags, '[]'::jsonb) as tags
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(COALESCE(state,'')) != ${stateFilter}
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
                first_visit::text as first_visit,
                COALESCE(age_range, '') as age_range,
                COALESCE(company_name, '') as company,
                COALESCE(confidence, '') as confidence,
                COALESCE(confidence_score, 0) as confidence_score,
                COALESCE(tags, '[]'::jsonb) as tags
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(state) = ${stateFilter}
              ORDER BY intent_score DESC, last_visit DESC
            `)
      : await sql`
          SELECT id, COALESCE(first_name, '') as first_name,
            COALESCE(last_name, '') as last_name,
            COALESCE(LEFT(last_name, 1), '') as last_initial,
            COALESCE(email, '') as email,
            COALESCE(city, '') as city, COALESCE(state, '') as state,
            intent_score, intent_tier, interests, referrer_source,
            visit_count, last_visit::text as last_visit,
            first_visit::text as first_visit,
            COALESCE(age_range, '') as age_range,
            COALESCE(company_name, '') as company,
            COALESCE(confidence, '') as confidence,
            COALESCE(confidence_score, 0) as confidence_score,
            COALESCE(tags, '[]'::jsonb) as tags
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
          ORDER BY intent_score DESC, last_visit DESC
        `;

    // Return-visitor KPI: count of visitors carrying the 'return-visitor' tag
    // within the current window. The tag is only applied when confidence >= 40
    // and the visitor meets the multi-date + multi-page criteria, so this is
    // a clean dedup-safe count without recomputing dates here.
    const returnVisitorRows = filterByState
      ? (stateNegate
          ? await sql`
              SELECT COUNT(*)::int as count FROM visitors
              WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(COALESCE(state,'')) != ${stateFilter}
                AND tags @> '["return-visitor"]'::jsonb
            `
          : await sql`
              SELECT COUNT(*)::int as count FROM visitors
              WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(state) = ${stateFilter}
                AND tags @> '["return-visitor"]'::jsonb
            `)
      : await sql`
          SELECT COUNT(*)::int as count FROM visitors
          WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
            AND tags @> '["return-visitor"]'::jsonb
        `;
    const returnVisitors = returnVisitorRows[0]?.count || 0;

    // Daily trend: new vs returning visitors per day in the current window.
    //   "New" = visitor's first_visit falls on this day
    //   "Returning" = visitor's last_visit is on this day AND first_visit was earlier
    // State filters are applied in the same pattern as other queries.
    const newPerDay = filterByState
      ? (stateNegate
          ? await sql`
              SELECT DATE(first_visit) as day, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND first_visit >= CAST(${cutoff} AS date)
                AND UPPER(COALESCE(state,'')) != ${stateFilter}
              GROUP BY DATE(first_visit) ORDER BY day
            `
          : await sql`
              SELECT DATE(first_visit) as day, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND first_visit >= CAST(${cutoff} AS date)
                AND UPPER(state) = ${stateFilter}
              GROUP BY DATE(first_visit) ORDER BY day
            `)
      : await sql`
          SELECT DATE(first_visit) as day, COUNT(*)::int as count
          FROM visitors WHERE client_key = ${client} AND first_visit >= CAST(${cutoff} AS date)
          GROUP BY DATE(first_visit) ORDER BY day
        `;

    const returningPerDay = filterByState
      ? (stateNegate
          ? await sql`
              SELECT DATE(last_visit) as day, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(COALESCE(state,'')) != ${stateFilter}
                AND DATE(last_visit) > DATE(first_visit)
              GROUP BY DATE(last_visit) ORDER BY day
            `
          : await sql`
              SELECT DATE(last_visit) as day, COUNT(*)::int as count
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(state) = ${stateFilter}
                AND DATE(last_visit) > DATE(first_visit)
              GROUP BY DATE(last_visit) ORDER BY day
            `)
      : await sql`
          SELECT DATE(last_visit) as day, COUNT(*)::int as count
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
            AND DATE(last_visit) > DATE(first_visit)
          GROUP BY DATE(last_visit) ORDER BY day
        `;

    // Merge new + returning into a single day-indexed series for the chart.
    const trendMap = new Map();
    for (const r of newPerDay) {
      const day = String(r.day).slice(0, 10);
      trendMap.set(day, { day, new: r.count, returning: 0 });
    }
    for (const r of returningPerDay) {
      const day = String(r.day).slice(0, 10);
      const existing = trendMap.get(day) || { day, new: 0, returning: 0 };
      existing.returning = r.count;
      trendMap.set(day, existing);
    }
    const dailyTrend = Array.from(trendMap.values()).sort((a, b) => a.day.localeCompare(b.day));

    // Date range (within the filtered window)
    const [dateRange] = filterByState
      ? (stateNegate
          ? await sql`
              SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(COALESCE(state,'')) != ${stateFilter}
            `
          : await sql`
              SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
              FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
                AND UPPER(state) = ${stateFilter}
            `)
      : await sql`
          SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
          FROM visitors WHERE client_key = ${client} AND last_visit >= CAST(${cutoff} AS date)
        `;

    // Last processed — show when data actually changed, not just when cron ran
    const [lastRun] = await sql`
      SELECT completed_at::text as last_processed, processed as records_processed
      FROM processing_runs WHERE client_key = ${client}
      ORDER BY completed_at DESC LIMIT 1
    `;

    // Most recent visitor activity (true data freshness)
    const [freshness] = await sql`
      SELECT MAX(last_visit)::text as newest_visit,
             MAX(processed_at)::text as newest_processed
      FROM visitors WHERE client_key = ${client}
    `;

    // Client geo config
    const CLIENT_GEO = {
      'sa-spine': { code: 'TX', label: 'Texas' },
      'az-breasts': { code: 'AZ', label: 'Arizona' },
      'demo': { code: 'TX', label: 'Texas' },
      'waverly-manor': { code: 'TX', label: 'Texas' },
    };
    const clientGeo = CLIENT_GEO[client] || null;

    const data = {
      clientName,
      clientKey: client,
      totalVisitors,
      allTimeTotal,
      tiers,
      returnVisitors,
      dailyTrend,
      interests: interestRows,
      sources: sourceRows,
      topVisitors,
      dateRange: dateRange || {},
      lastProcessed: lastRun?.last_processed || null,
      lastProcessedCount: lastRun?.records_processed || 0,
      newestVisit: freshness?.newest_visit || null,
      newestProcessed: freshness?.newest_processed || null,
      clientGeo,
      dateWindow: showAll ? 'all' : days,
      activeState: filterByState ? stateFilter : null,
      activeStateNegate: filterByState ? stateNegate : false,
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
