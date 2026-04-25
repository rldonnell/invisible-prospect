import { cookies } from 'next/headers';
import { getDb } from '../../../lib/db';
import { verifySessionToken, isAuthorized, COOKIE_NAME } from '../../../lib/auth';
import { visitorWhere } from '../../../lib/dashboard-where';
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
 *
 * Filters supported via query params:
 *   ?days=7|30|90|all       - date window (default 30)
 *   ?state=TX or ?state=!TX - in-state / out-of-state
 *   ?source=warm|cold|all   - acquisition source (default all). Toggle is
 *                             auto-hidden in DashboardClient when the client
 *                             has no kind='cold' campaign in the campaigns table.
 */
export async function generateMetadata({ params }) {
  const { client } = params;
  const name = client.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `${name} - VisitorID™`,
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

// Map URL `source` values to DB acquisition_source values. The DB uses
// 'pixel' for warm and 'al_cold' for cold; the URL uses friendlier names.
function urlSourceToDb(s) {
  if (s === 'warm' || s === 'pixel') return 'pixel';
  if (s === 'cold' || s === 'al_cold') return 'al_cold';
  return 'all';
}

export default async function DashboardPage({ params, searchParams }) {
  const { client } = params;
  const clientName = getClientName(client);

  // --- Authentication ---
  const dashSecret = process.env.DASH_SECRET;
  let isAuthenticated = false;
  let authRole = null;

  if (dashSecret) {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(COOKIE_NAME);
    const session = verifySessionToken(sessionCookie?.value);

    if (!isAuthorized(session, client)) {
      return <LoginForm clientKey={client} clientName={clientName} />;
    }

    isAuthenticated = true;
    authRole = session.role;
  } else {
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

    // ── Filter parsing ──
    const daysParam = searchParams?.days;
    const showAll = daysParam === 'all';
    const days = showAll ? null : parseInt(daysParam) || 30;
    const cutoff = days
      ? new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
      : '2000-01-01';

    const stateParam = searchParams?.state || '';
    const stateNegate = stateParam.startsWith('!');
    const stateFilter = (stateNegate ? stateParam.slice(1) : stateParam).toUpperCase();
    const filterByState = stateFilter.length === 2 ? stateFilter : null;

    // Source filter: 'warm' / 'cold' / 'all' (default). DB column is acquisition_source.
    const rawSource = searchParams?.source || 'all';
    const dbSource = urlSourceToDb(rawSource);

    // Common WHERE-builder. last_visit cutoff is the default; trend queries
    // override dateColumn to first_visit.
    const whereOpts = { client, cutoff, stateFilter: filterByState, stateNegate, source: dbSource };

    // ── Cold-enabled detection ──
    // Toggle UI in DashboardClient is hidden when this is false. Auto-detected
    // from the campaigns table so any new cold client lights up automatically.
    const [coldRow] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM campaigns
        WHERE client_key = ${client} AND kind = 'cold'
      )::bool AS cold_enabled
    `;
    const coldEnabled = !!coldRow?.cold_enabled;

    // ── Source counts (always computed; ignores the source filter so toggle -
    //     can show contextual counts for both warm and cold). State + date
    //     filters DO apply so the counts match what's currently in view. ──
    const sourceCountsWhere = visitorWhere({
      client, cutoff, stateFilter: filterByState, stateNegate, source: 'all',
    });
    const sourceCountRows = await sql(
      `SELECT acquisition_source, COUNT(*)::int AS count
       FROM visitors WHERE ${sourceCountsWhere.where}
       GROUP BY acquisition_source`,
      sourceCountsWhere.params
    );
    const sourceCounts = { warm: 0, cold: 0 };
    for (const r of sourceCountRows) {
      if (r.acquisition_source === 'al_cold') sourceCounts.cold = r.count;
      else sourceCounts.warm = r.count;
    }

    // ── Tier counts (source-filtered) ──
    const tierW = visitorWhere(whereOpts);
    const tierRows = await sql(
      `SELECT intent_tier, COUNT(*)::int as count
       FROM visitors WHERE ${tierW.where}
       GROUP BY intent_tier`,
      tierW.params
    );
    const tiers = { HOT: 0, High: 0, Medium: 0, Low: 0 };
    for (const r of tierRows) tiers[r.intent_tier] = r.count;
    const totalVisitors = Object.values(tiers).reduce((a, b) => a + b, 0);

    // All-time totals for context (no source filter; that's intentional for
    // the small "X visitors all-time" tooltip).
    const [allTimeRow] = await sql`
      SELECT COUNT(*)::int as total FROM visitors WHERE client_key = ${client}
    `;
    const allTimeTotal = allTimeRow?.total || totalVisitors;

    // ── Interest counts (source-filtered) ──
    const intW = visitorWhere(whereOpts);
    const interestRows = await sql(
      `SELECT interest, COUNT(*)::int as count FROM (
         SELECT jsonb_array_elements_text(interests) as interest
         FROM visitors WHERE ${intW.where}
           AND interests IS NOT NULL AND interests != '[]'::jsonb
       ) sub GROUP BY interest ORDER BY count DESC`,
      intW.params
    );

    // ── Traffic sources (source-filtered) ──
    const srcW = visitorWhere(whereOpts);
    const sourceRows = await sql(
      `SELECT COALESCE(referrer_source, 'Direct') as source, COUNT(*)::int as count
       FROM visitors WHERE ${srcW.where}
       GROUP BY referrer_source ORDER BY count DESC`,
      srcW.params
    );

    // ── Top visitors (source-filtered). acquisition_source pulled into the
    //     row so DashboardClient can render a per-row Warm/Cold badge. ──
    const tvW = visitorWhere(whereOpts);
    const topVisitors = await sql(
      `SELECT id, COALESCE(first_name, '') as first_name,
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
        COALESCE(tags, '[]'::jsonb) as tags,
        COALESCE(acquisition_source, 'pixel') as acquisition_source
       FROM visitors WHERE ${tvW.where}
       ORDER BY intent_score DESC, last_visit DESC`,
      tvW.params
    );

    // ── Return visitors KPI (source-filtered) ──
    const rvW = visitorWhere(whereOpts);
    const returnVisitorRows = await sql(
      `SELECT COUNT(*)::int as count FROM visitors
       WHERE ${rvW.where}
         AND tags @> '["return-visitor"]'::jsonb`,
      rvW.params
    );
    const returnVisitors = returnVisitorRows[0]?.count || 0;

    // ── Daily trend: new vs returning per day (source-filtered) ──
    const newW = visitorWhere({ ...whereOpts, dateColumn: 'first_visit' });
    const newPerDay = await sql(
      `SELECT DATE(first_visit) as day, COUNT(*)::int as count
       FROM visitors WHERE ${newW.where}
       GROUP BY DATE(first_visit) ORDER BY day`,
      newW.params
    );

    const retW = visitorWhere(whereOpts);
    const returningPerDay = await sql(
      `SELECT DATE(last_visit) as day, COUNT(*)::int as count
       FROM visitors WHERE ${retW.where}
         AND DATE(last_visit) > DATE(first_visit)
       GROUP BY DATE(last_visit) ORDER BY day`,
      retW.params
    );

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

    // ── Date range within filtered window ──
    const drW = visitorWhere(whereOpts);
    const [dateRange] = await sql(
      `SELECT MIN(first_visit)::text as earliest, MAX(last_visit)::text as latest
       FROM visitors WHERE ${drW.where}`,
      drW.params
    );

    // Last processed — show when data actually changed, not just when cron ran
    const [lastRun] = await sql`
      SELECT completed_at::text as last_processed, processed as records_processed
      FROM processing_runs WHERE client_key = ${client}
      ORDER BY completed_at DESC LIMIT 1
    `;

    // Most recent visitor activity (true data freshness, no source filter)
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
      activeState: filterByState,
      activeStateNegate: filterByState ? stateNegate : false,
      // Source-filter fields (new). activeSource is the URL value (warm/cold/all);
      // coldEnabled controls whether the toggle UI renders at all; sourceCounts
      // gives contextual badge numbers next to the toggle.
      activeSource: rawSource === 'warm' || rawSource === 'cold' ? rawSource : 'all',
      coldEnabled,
      sourceCounts,
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
