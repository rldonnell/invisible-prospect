import { getDb } from '../../../../lib/db';
import {
  TBR_COLD_SEQUENCES,
  toInstantlySequence,
  hasUnreplacedPlaceholders,
} from '../../../../lib/sequences/tbr-cold-v1';

/**
 * POST /api/admin/push-tbr-cold-sequences
 *
 * Pushes the TBR (The Brilliance Revolution) COLD sequence
 * (lib/sequences/tbr-cold-v1.js) to Instantly via
 * /api/v2/campaigns/{id}. Targets the cold campaign row (kind='cold')
 * seeded by lib/migration-017-tbr-cold-campaign.sql.
 *
 * Mirrors the FW cold push endpoint structurally - same placeholder
 * guard pattern (refuses live PATCH while [REPLACE: ...] markers exist),
 * same dry-run support.
 *
 * Query params:
 *   ?bucket=general_interest  Push a single bucket (currently the only one)
 *   ?dry=true                 Skip the PATCH; return what would be sent
 *
 * Auth: Bearer $ADMIN_TOKEN (falls back to CRON_SECRET)
 *
 * Prerequisites before calling live:
 *   1. Sequence copy in tbr-cold-v1.js has no [REPLACE: ...] markers
 *      (v1 ships clean; this is a guard for future drafts).
 *   2. Cold Instantly campaign exists with separate sending accounts
 *      from any TBR warm/nurture campaign so cold deliverability
 *      problems can't blow up the warm pipeline.
 *   3. Campaigns row exists with client_key='tbr',
 *      bucket='general_interest', kind='cold', instantly_campaign_id=
 *      <id>, active=true. See migration-017.
 *   4. Link Tracking + unsubscribe footer enabled in the Instantly UI
 *      (cold sequences need CAN-SPAM compliance + click events for
 *      engagement-based HOT promotion to work).
 *
 * Usage:
 *   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
 *     "https://visitorid.p5marketing.com/api/admin/push-tbr-cold-sequences?dry=true"
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
  if (!isDryRun && hasUnreplacedPlaceholders()) {
    return Response.json(
      {
        error:
          'Sequence still contains [REPLACE: ...] placeholders. Replace all markers in lib/sequences/tbr-cold-v1.js before pushing live, or pass ?dry=true to inspect the scaffold.',
      },
      { status: 400 }
    );
  }

  const bucketsToPush = singleBucket
    ? [singleBucket]
    : Object.keys(TBR_COLD_SEQUENCES);

  for (const b of bucketsToPush) {
    if (!TBR_COLD_SEQUENCES[b]) {
      return Response.json(
        {
          error: `Unknown bucket "${b}". Valid: ${Object.keys(TBR_COLD_SEQUENCES).join(', ')}`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const sql = getDb();

    // Look up each bucket's COLD Instantly campaign ID. The kind='cold'
    // filter is what distinguishes the cold campaign row from any TBR
    // warm row in (client_key, bucket).
    const campaignRows = await sql`
      SELECT bucket, instantly_campaign_id
      FROM campaigns
      WHERE client_key = 'tbr'
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
      const bucketDef = TBR_COLD_SEQUENCES[bucketKey];

      if (!campaign) {
        results.push({
          bucket: bucketKey,
          ok: false,
          error: `No active TBR COLD campaign found with bucket="${bucketKey}". Did you run migration-017 and set active=true?`,
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
    console.error('[push-tbr-cold-sequences] Error:', err);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/push-tbr-cold-sequences
 *
 * Read-only preview of the cold sequences that WOULD be pushed.
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
    : Object.keys(TBR_COLD_SEQUENCES);

  const preview = buckets.map((b) => {
    const def = TBR_COLD_SEQUENCES[b];
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
