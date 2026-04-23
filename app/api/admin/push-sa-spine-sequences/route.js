import { getDb } from '../../../../lib/db';
import { SA_SPINE_SEQUENCES, toInstantlySequence } from '../../../../lib/sequences/sa-spine-v2';

/**
 * POST /api/admin/push-sa-spine-sequences
 *
 * Pushes the v2 SA Spine sequences (lib/sequences/sa-spine-v2.js) to
 * Instantly via /api/v2/campaigns/{id}. Overwrites each campaign's
 * `sequences` array with the new HTML-styled, click-optimized copy.
 *
 * Query params:
 *   ?bucket=ready_to_book    Push a single bucket. Omit to push all 6.
 *   ?dry=true                Do everything except the PATCH. Returns
 *                            the exact payload that would be sent.
 *
 * Auth:
 *   Bearer $ADMIN_TOKEN  (falls back to CRON_SECRET)
 *
 * Safety:
 *   - PATCH only touches the `sequences` field. Campaign settings,
 *     sending accounts, schedules, lead lists are untouched.
 *   - Always run with ?dry=true first and eyeball the payload.
 *   - Instantly keeps the previous state - you can re-run against an
 *     older version of lib/sequences/sa-spine-v2.js to roll back.
 *
 * Usage:
 *   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
 *     "https://visitorid.p5marketing.com/api/admin/push-sa-spine-sequences?bucket=ready_to_book&dry=true"
 */

const INSTANTLY_CAMPAIGN_API = 'https://api.instantly.ai/api/v2/campaigns';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  // ── Auth ──
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const adminToken = process.env.ADMIN_TOKEN || process.env.CRON_SECRET;
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiKey = process.env.INSTANTLY_API_KEY;
  const { searchParams } = new URL(request.url);
  const singleBucket = searchParams.get('bucket');
  const isDryRun = searchParams.get('dry') === 'true';

  if (!apiKey && !isDryRun) {
    return Response.json(
      { error: 'INSTANTLY_API_KEY is not configured. Use ?dry=true for a dry run.' },
      { status: 400 }
    );
  }

  const bucketsToPush = singleBucket
    ? [singleBucket]
    : Object.keys(SA_SPINE_SEQUENCES);

  // Validate requested buckets exist in the module
  for (const b of bucketsToPush) {
    if (!SA_SPINE_SEQUENCES[b]) {
      return Response.json(
        { error: `Unknown bucket "${b}". Valid: ${Object.keys(SA_SPINE_SEQUENCES).join(', ')}` },
        { status: 400 }
      );
    }
  }

  try {
    const sql = getDb();

    // Look up each bucket's Instantly campaign ID from the campaigns table
    const campaignRows = await sql`
      SELECT bucket, instantly_campaign_id, name
      FROM campaigns
      WHERE client_key = 'sa-spine'
        AND active = true
        AND bucket = ANY(${bucketsToPush})
    `;

    const campaignByBucket = {};
    for (const row of campaignRows) {
      campaignByBucket[row.bucket] = row;
    }

    const results = [];

    for (const bucketKey of bucketsToPush) {
      const campaign = campaignByBucket[bucketKey];
      const bucketDef = SA_SPINE_SEQUENCES[bucketKey];

      if (!campaign) {
        results.push({
          bucket: bucketKey,
          ok: false,
          error: `No active SA Spine campaign found with bucket="${bucketKey}"`,
        });
        continue;
      }

      if (!campaign.instantly_campaign_id) {
        results.push({
          bucket: bucketKey,
          ok: false,
          error: `Campaign "${campaign.name}" has no instantly_campaign_id`,
        });
        continue;
      }

      const sequences = toInstantlySequence(bucketKey);
      const payload = { sequences };

      if (isDryRun) {
        results.push({
          bucket: bucketKey,
          campaign_name: campaign.name,
          instantly_campaign_id: campaign.instantly_campaign_id,
          dry_run: true,
          step_count: sequences[0].steps.length,
          subjects: sequences[0].steps.map((s) => s.variants[0].subject),
          payload_preview: JSON.stringify(payload).slice(0, 500),
        });
        continue;
      }

      // ── Live PATCH to Instantly ──
      try {
        const res = await fetch(
          `${INSTANTLY_CAMPAIGN_API}/${campaign.instantly_campaign_id}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        );

        const bodyText = await res.text();
        let bodyJson = null;
        try { bodyJson = JSON.parse(bodyText); } catch { /* not JSON */ }

        if (!res.ok) {
          results.push({
            bucket: bucketKey,
            campaign_name: campaign.name,
            instantly_campaign_id: campaign.instantly_campaign_id,
            ok: false,
            status: res.status,
            error_body: bodyText.slice(0, 400),
          });
          continue;
        }

        results.push({
          bucket: bucketKey,
          campaign_name: campaign.name,
          instantly_campaign_id: campaign.instantly_campaign_id,
          ok: true,
          status: res.status,
          step_count: sequences[0].steps.length,
          subjects: sequences[0].steps.map((s) => s.variants[0].subject),
          instantly_response: bodyJson ? { id: bodyJson.id, name: bodyJson.name } : null,
        });
      } catch (fetchErr) {
        results.push({
          bucket: bucketKey,
          campaign_name: campaign.name,
          instantly_campaign_id: campaign.instantly_campaign_id,
          ok: false,
          error: fetchErr.message,
        });
      }
    }

    const okCount = results.filter((r) => r.ok || r.dry_run).length;

    return Response.json({
      success: true,
      dry_run: isDryRun,
      pushed: okCount,
      total: results.length,
      results,
    });
  } catch (err) {
    console.error('[push-sa-spine-sequences] Error:', err);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/push-sa-spine-sequences
 *
 * Preview the sequences that WOULD be pushed. Read-only.
 * Useful for inspecting the HTML rendering of each step in a browser.
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const adminToken = process.env.ADMIN_TOKEN || process.env.CRON_SECRET;
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const singleBucket = searchParams.get('bucket');

  const buckets = singleBucket
    ? [singleBucket]
    : Object.keys(SA_SPINE_SEQUENCES);

  const preview = buckets.map((b) => {
    const def = SA_SPINE_SEQUENCES[b];
    if (!def) return { bucket: b, error: 'unknown bucket' };
    return {
      bucket: b,
      name: def.name,
      steps: def.steps.map((s) => ({
        day: s.day,
        subject: s.subject,
        preview: s.preview,
        body_length: s.body.length,
      })),
    };
  });

  return Response.json({ buckets: preview });
}
