import { getDb } from '../../../../../lib/db';
import VisitorProfile from './VisitorProfile';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }) {
  const sql = getDb();
  const [v] = await sql`SELECT first_name, last_name FROM visitors WHERE id = ${params.id} LIMIT 1`;
  const name = v ? `${v.first_name} ${v.last_name}`.trim() : 'Visitor';
  return { title: `${name} - Patient Intelligence Brief` };
}

export default async function VisitorDetailPage({ params, searchParams }) {
  const { client, id } = params;
  const key = searchParams?.key;

  if (process.env.DASHBOARD_KEY && key !== process.env.DASHBOARD_KEY) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 24, color: '#666' }}>Access Required</h1>
        <p style={{ color: '#999' }}>Add ?key=YOUR_KEY to access this profile.</p>
      </div>
    );
  }

  try {
    const sql = getDb();

    const [visitor] = await sql`
      SELECT
        id, client_key, email, first_name, last_name, phone,
        city, state, age_range, gender, income, net_worth, linkedin,
        address, zip, homeowner, married, children,
        company_name, job_title, company_industry, company_size, company_revenue,
        department, seniority_level,
        all_emails, business_email, pixel_id, edid,
        facebook_url, twitter_url, skills, al_interests,
        visit_count, first_visit::text as first_visit, last_visit::text as last_visit,
        pages_visited, referrers,
        intent_score, intent_tier, interests, referrer_source, tags,
        confidence, confidence_score, confidence_flags,
        processed_at::text as processed_at,
        ghl_pushed, ghl_pushed_at::text as ghl_pushed_at, ghl_contact_id,
        created_at::text as created_at
      FROM visitors
      WHERE id = ${id} AND client_key = ${client}
    `;

    if (!visitor) {
      return (
        <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui' }}>
          <h1 style={{ fontSize: 24, color: '#666' }}>Visitor not found</h1>
          <p style={{ color: '#999' }}>No visitor with ID {id} for client {client}.</p>
        </div>
      );
    }

    // Resolve GHL location ID for deep-link to contact record
    const ghlLocEnv = `GHL_LOCATION_${client.replace(/-/g, '_').toUpperCase()}`;
    const ghlLocationId = process.env[ghlLocEnv] || process.env.GHL_LOCATION_ID || null;

    return <VisitorProfile visitor={visitor} clientKey={client} ghlLocationId={ghlLocationId} />;

  } catch (error) {
    return (
      <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: 24, color: '#c00' }}>Error</h1>
        <p style={{ color: '#999' }}>{error.message}</p>
      </div>
    );
  }
}
