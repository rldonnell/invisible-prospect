import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';

/**
 * GET /api/admin/campaigns/stats?client=sa-spine  (optional filter)
 *
 * Dashboard-level stats:
 *   - Total email-eligible visitors by client
 *   - Bucket distribution (how many visitors per bucket)
 *   - Enrollment counts (pushed to Instantly vs. pending)
 *   - Campaign status (active/paused per bucket)
 */

function isAdmin(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token && token === process.env.DASH_PW_ADMIN;
}

export async function GET(request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const clientFilter = searchParams.get('client');

    // Visitor bucket distribution
    const bucketDist = clientFilter
      ? await sql`
          SELECT campaign_bucket as bucket, COUNT(*)::int as count,
                 COUNT(*) FILTER (WHERE email_eligible = true)::int as eligible
          FROM visitors
          WHERE client_key = ${clientFilter} AND campaign_bucket IS NOT NULL
          GROUP BY campaign_bucket
          ORDER BY count DESC
        `
      : await sql`
          SELECT client_key, campaign_bucket as bucket, COUNT(*)::int as count,
                 COUNT(*) FILTER (WHERE email_eligible = true)::int as eligible
          FROM visitors
          WHERE campaign_bucket IS NOT NULL
          GROUP BY client_key, campaign_bucket
          ORDER BY client_key, count DESC
        `;

    // Enrollment stats
    const enrollmentStats = clientFilter
      ? await sql`
          SELECT c.bucket, c.active,
                 COUNT(e.id)::int as enrolled,
                 COUNT(e.id) FILTER (WHERE e.status = 'sent')::int as sent,
                 COUNT(e.id) FILTER (WHERE e.status = 'failed')::int as failed
          FROM campaigns c
          LEFT JOIN email_enrollments e ON e.campaign_id = c.id
          WHERE c.client_key = ${clientFilter}
          GROUP BY c.id, c.bucket, c.active
          ORDER BY c.bucket
        `
      : await sql`
          SELECT c.client_key, c.bucket, c.active,
                 COUNT(e.id)::int as enrolled,
                 COUNT(e.id) FILTER (WHERE e.status = 'sent')::int as sent,
                 COUNT(e.id) FILTER (WHERE e.status = 'failed')::int as failed
          FROM campaigns c
          LEFT JOIN email_enrollments e ON e.campaign_id = c.id
          GROUP BY c.id, c.client_key, c.bucket, c.active
          ORDER BY c.client_key, c.bucket
        `;

    // Summary: total eligible, total enrolled, pending (eligible but not yet enrolled)
    const [summary] = clientFilter
      ? await sql`
          SELECT
            COUNT(*)::int as total_eligible,
            COUNT(*) FILTER (WHERE v.id IN (SELECT visitor_id FROM email_enrollments))::int as total_enrolled,
            COUNT(*) FILTER (WHERE v.id NOT IN (SELECT visitor_id FROM email_enrollments))::int as pending
          FROM visitors v
          WHERE v.client_key = ${clientFilter} AND v.email_eligible = true
        `
      : await sql`
          SELECT
            COUNT(*)::int as total_eligible,
            COUNT(*) FILTER (WHERE v.id IN (SELECT visitor_id FROM email_enrollments))::int as total_enrolled,
            COUNT(*) FILTER (WHERE v.id NOT IN (SELECT visitor_id FROM email_enrollments))::int as pending
          FROM visitors v
          WHERE v.email_eligible = true
        `;

    return NextResponse.json({
      summary,
      bucket_distribution: bucketDist,
      campaign_enrollments: enrollmentStats,
    });
  } catch (err) {
    console.error('[admin] Campaign stats error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
