import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';

/**
 * PATCH /api/admin/campaigns/[id]
 * Update specific fields on a campaign (toggle active, change thresholds, update variables, etc.)
 *
 * Body: any subset of { active, confidenceMin, minTier, instantlyCampaignId, variables }
 *
 * GET /api/admin/campaigns/[id]
 * Get a single campaign with enrollment details
 */

function isAdmin(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token && token === process.env.DASH_PW_ADMIN;
}

export async function GET(request, { params }) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { id } = params;

    const [campaign] = await sql`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM email_enrollments e WHERE e.campaign_id = c.id) as enrolled_count,
        (SELECT COUNT(*)::int FROM email_enrollments e WHERE e.campaign_id = c.id AND e.status = 'sent') as sent_count,
        (SELECT COUNT(*)::int FROM email_enrollments e WHERE e.campaign_id = c.id AND e.status = 'failed') as failed_count
      FROM campaigns c
      WHERE c.id = ${id}
    `;

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Get recent enrollments
    const recentEnrollments = await sql`
      SELECT e.id, e.primary_interest, e.bucket, e.enrolled_at, e.status,
             v.first_name, v.last_name, v.email, v.city, v.state,
             v.intent_tier, v.confidence
      FROM email_enrollments e
      JOIN visitors v ON v.id = e.visitor_id
      WHERE e.campaign_id = ${id}
      ORDER BY e.enrolled_at DESC
      LIMIT 25
    `;

    return NextResponse.json({ campaign, recent_enrollments: recentEnrollments });
  } catch (err) {
    console.error('[admin] Get campaign error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { id } = params;
    const body = await request.json();

    // Build dynamic update — only update fields that are provided
    const updates = {};
    if (body.active !== undefined) updates.active = body.active;
    if (body.confidenceMin !== undefined) updates.confidence_min = body.confidenceMin;
    if (body.minTier !== undefined) updates.min_tier = body.minTier;
    if (body.instantlyCampaignId !== undefined) updates.instantly_campaign_id = body.instantlyCampaignId;
    if (body.variables !== undefined) updates.variables = JSON.stringify(body.variables);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Validate tier if provided
    if (updates.min_tier) {
      const validTiers = new Set(['HOT', 'High', 'Medium', 'Low']);
      if (!validTiers.has(updates.min_tier)) {
        return NextResponse.json({ error: 'Invalid minTier' }, { status: 400 });
      }
    }

    // Build SET clause dynamically
    // Using individual conditional updates to stay safe with parameterized queries
    const [result] = await sql`
      UPDATE campaigns SET
        active = COALESCE(${updates.active ?? null}::boolean, active),
        confidence_min = COALESCE(${updates.confidence_min ?? null}::int, confidence_min),
        min_tier = COALESCE(${updates.min_tier ?? null}::text, min_tier),
        instantly_campaign_id = COALESCE(${updates.instantly_campaign_id ?? null}::text, instantly_campaign_id),
        variables = CASE
          WHEN ${updates.variables ?? null}::text IS NOT NULL
          THEN ${updates.variables ?? '{}'}::jsonb
          ELSE variables
        END,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, client_key, bucket, active, confidence_min, min_tier
    `;

    if (!result) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: `Campaign ${result.id} updated`,
      campaign: result,
    });
  } catch (err) {
    console.error('[admin] Patch campaign error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
