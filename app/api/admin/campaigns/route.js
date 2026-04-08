import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';

/**
 * Admin route to manage email outreach campaigns.
 * Protected by DASH_PW_ADMIN — pass as Authorization: Bearer <admin-password>
 *
 * GET  /api/admin/campaigns?client=sa-spine  (optional filter)
 * POST /api/admin/campaigns  (upsert by client_key + bucket)
 */

const VALID_BUCKETS = new Set([
  'ready_to_book', 'provider_research', 'procedure_treatment',
  'condition_research', 'return_visitor', 'general_interest',
]);

const VALID_TIERS = new Set(['HOT', 'High', 'Medium', 'Low']);

function isAdmin(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token && token === process.env.DASH_PW_ADMIN;
}

/**
 * GET /api/admin/campaigns
 * List all campaigns, optionally filtered by client_key
 */
export async function GET(request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const clientFilter = searchParams.get('client');

    const campaigns = clientFilter
      ? await sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM email_enrollments e WHERE e.campaign_id = c.id) as enrolled_count,
            (SELECT COUNT(*)::int FROM email_enrollments e WHERE e.campaign_id = c.id AND e.status = 'sent') as sent_count
          FROM campaigns c
          WHERE c.client_key = ${clientFilter}
          ORDER BY c.bucket
        `
      : await sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM email_enrollments e WHERE e.campaign_id = c.id) as enrolled_count,
            (SELECT COUNT(*)::int FROM email_enrollments e WHERE e.campaign_id = c.id AND e.status = 'sent') as sent_count
          FROM campaigns c
          ORDER BY c.client_key, c.bucket
        `;

    return NextResponse.json({ campaigns });
  } catch (err) {
    console.error('[admin] List campaigns error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/campaigns
 * Create or update a campaign (upsert by client_key + bucket)
 *
 * Body: {
 *   clientKey: "sa-spine",
 *   bucket: "condition_research",
 *   instantlyCampaignId: "uuid-from-instantly",  (optional — can add later)
 *   confidenceMin: 40,                           (optional, default 40)
 *   minTier: "High",                             (optional, default "High")
 *   active: false,                               (optional, default false)
 *   variables: { practice_name: "SA Spine", ... } (optional)
 * }
 */
export async function POST(request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      clientKey,
      bucket,
      instantlyCampaignId,
      confidenceMin = 40,
      minTier = 'High',
      active = false,
      variables = {},
    } = body;

    // Validate required fields
    if (!clientKey || !bucket) {
      return NextResponse.json(
        { error: 'clientKey and bucket are required' },
        { status: 400 }
      );
    }

    if (!VALID_BUCKETS.has(bucket)) {
      return NextResponse.json(
        { error: `Invalid bucket. Must be one of: ${[...VALID_BUCKETS].join(', ')}` },
        { status: 400 }
      );
    }

    if (!VALID_TIERS.has(minTier)) {
      return NextResponse.json(
        { error: `Invalid minTier. Must be one of: ${[...VALID_TIERS].join(', ')}` },
        { status: 400 }
      );
    }

    const sql = getDb();

    // Upsert: insert or update on conflict (client_key + bucket)
    const [result] = await sql`
      INSERT INTO campaigns (client_key, bucket, instantly_campaign_id, confidence_min, min_tier, active, variables)
      VALUES (${clientKey}, ${bucket}, ${instantlyCampaignId || null}, ${confidenceMin}, ${minTier}, ${active}, ${JSON.stringify(variables)}::jsonb)
      ON CONFLICT (client_key, bucket)
      DO UPDATE SET
        instantly_campaign_id = COALESCE(EXCLUDED.instantly_campaign_id, campaigns.instantly_campaign_id),
        confidence_min = EXCLUDED.confidence_min,
        min_tier = EXCLUDED.min_tier,
        active = EXCLUDED.active,
        variables = EXCLUDED.variables,
        updated_at = NOW()
      RETURNING id, client_key, bucket, active
    `;

    return NextResponse.json({
      ok: true,
      message: `Campaign ${result.bucket} for ${result.client_key} ${result.active ? 'activated' : 'configured (inactive)'}`,
      campaign: result,
    });
  } catch (err) {
    console.error('[admin] Upsert campaign error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
