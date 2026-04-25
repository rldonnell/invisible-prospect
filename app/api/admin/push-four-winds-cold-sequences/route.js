import { getDb } from '../../../../lib/db';
import {
  FOUR_WINDS_COLD_SEQUENCES,
  toInstantlySequence,
  hasUnreplacedPlaceholders,
} from '../../../../lib/sequences/four-winds-cold-v1';

/**
 * POST /api/admin/push-four-winds-cold-sequences
 *
 * Pushes the Four Winds COLD sequence (lib/sequences/four-winds-cold-v1.js)
 * to Instantly via /api/v2/campaigns/{id}. Targets the cold campaign row
 * (kind='cold') seeded by lib/migration-016-four-winds-cold-campaign.sql.
 *
 * Mirrors the warm push endpoint but adds a placeholder guard: the live
 * PATCH is refused while the sequence still contains [REPLACE: ...]
 * markers. Dry runs are always allowed.
 *
 * Query params:
 *   ?bucket=general_interest  Push a single bucket (currently the only one)
 *   ?dry=true                 Skip the PATCH; return what would be sent
 *
 * Auth: Bearer $ADMIN_TOKEN (falls back to CRON_SECRET)
 *
 * Prerequisites before calling live:
 *   1. Sequence copy in four-winds-cold-v1.js has all [REPLACE: ...]
 *      markers replaced.
 *   2. Cold Instantly campaign exists (separate sending accounts from
 *      warm to protect deliverability).
 *   3. Campaigns row exists with client_key='four-winds',
 *      bucket='general_interest', kind='cold', instantly_campaign_id=<id>,
 *      active=true. See migration-016.
 *   4. Link Tracking + unsubscribe footer enabled in the Instantly UI
 *      (cold sequences need CAN-SPAM compliance + click events for
 *      engagement-based HOT promotion to work).
 *
 * Usage:
 *   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
 *     "https://visitorid.p5marketing.com/api/admin/push-four-winds-cold-sequences?dry=true"
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

  // ── Placeholder guard ──
  // Refuse to PATCH live while the sequence still has [REPLACE: ...]
  // markers. Dry runs are allowed so the user can inspect the scaffold.
  if (!isDryRun && hasUnreplacedPlaceholders()) {
    return Response.json(
      {
        error:
          'Sequence still contains [REPLACE: ...] placeholders. Replace all markers in lib/sequences/four-winds-cold-v1.js before pushing live, or pass ?dry=true to inspect the scaffold.',
      },
      { status: 400 }
    );
  }

  const bucketsToPush = singleBucket
    ? [singleBucket]
    : Object.keys(FOUR_WINDS_COLD_SEQUENCES);

  for (const b of bucketsToPush) {
    if (!FOUR_WINDS_COLD_SEQUENCES[b]) {
      return Response.json(
        {
          error: `Unknown bucket "${b}". Valid: ${Object.keys(FOUR_WINDS_COLD_SEQUENCES).join(', ')}`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const sql = getDb();

    // Look up each bucket's COLD Instantly campaign ID. Note the
    // kind='cold' filter - this is the only thing that distinguishes
    // the cold campaign row from the warm one in (client_key, bucket).
    const campaignRows = await sql`
      SELECT bucket, instantly_campaign_id
      FROM campaigns
      WHERE client_key = 'four-winds'
        AND kind = 'cold'
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
      const bucketDef = FOUR_WINDS_COLD_SEQUENCES[bucketKey];

      if (!campaign) {
        results.push({
          bucket: bucketKey,
          ok: false,
          error: `No active Four Winds COLD campaign found with bucket="${bucketKey}". Did you run migration-016 and set the real instantly_campaign_id?`,
        });
        continue;
      }

      if (!campaign.instantly_campaign_id) {
        results.push({
          bucket: bucketKey,
          ok: false,
          error: `Bucket "${bucketKey}" (cold) has no instantly_campaign_id`,
        });
        continue;
      }

      const sequences = toInstantlySequence(bucketKey);
      const payload = { sequences };

      if (isDryRun) {
        results.push({
          bucket: bucketKey,
          display_name: bucketDef.name,
          instantly_campaign_id: campaign.instantly_campaign_id,
          dry_run: true,
          step_count: sequences[0].steps.length,
          subjects: sequences[0].steps.map((s) => s.variants[0].subject),
          has_unreplaced_placeholders: hasUnreplacedPlaceholders(),
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
            display_name: bucketDef.name,
            instantly_campaign_id: campaign.instantly_campaign_id,
            ok: false,
            status: res.status,
            error_body: bodyText.slice(0, 400),
          });
          continue;
        }

        results.push({
          bucket: bucketKey,
          display_name: bucketDef.name,
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
          display_name: bucketDef.name,
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
      placeholder_guard_active: hasUnreplacedPlaceholders(),
      results,
    });
  } catch (err) {
    console.error('[push-four-winds-cold-sequences] Error:', err);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/push-four-winds-cold-sequences
 *
 * Read-only preview of the cold sequences that WOULD be pushed.
 * Surfaces the placeholder count so it's obvious what still needs
 * copy work before this can go live.
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
    : Object.keys(FOUR_WINDS_COLD_SEQUENCES);

  const preview = buckets.map((b) => {
    const def = FOUR_WINDS_COLD_SEQUENCES[b];
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

  return Response.json({
    buckets: preview,
    has_unreplaced_placeholders: hasUnreplacedPlaceholders(),
  });
}
