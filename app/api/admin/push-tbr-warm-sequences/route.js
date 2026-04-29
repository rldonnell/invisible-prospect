import { getDb } from '../../../../lib/db';
import {
  TBR_WARM_SEQUENCES,
  toInstantlySequence,
  hasUnreplacedPlaceholders,
} from '../../../../lib/sequences/tbr-warm-v1';

/**
 * POST /api/admin/push-tbr-warm-sequences
 *
 * Pushes the TBR (The Brilliance Revolution) WARM (pixel-driven)
 * sequence (lib/sequences/tbr-warm-v1.js) to Instantly via
 * /api/v2/campaigns/{id}. Targets the warm campaign rows (kind='warm')
 * seeded by lib/migration-018-tbr-warm-campaign.sql.
 *
 * Mirrors push-tbr-cold-sequences structurally - same placeholder guard,
 * same dry-run support. Difference: warm has multiple campaign rows
 * (general_interest, return_visitor, ready_to_book) that all point at
 * the same Instantly UUID, so this route deduplicates by UUID before
 * patching to avoid pushing the same sequence three times.
 *
 * Query params:
 *   ?bucket=general_interest  Push from a single bucket's perspective
 *   ?dry=true                 Skip the PATCH; return what would be sent
 *
 * Auth: Bearer $ADMIN_TOKEN (falls back to CRON_SECRET)
 *
 * Prerequisites before calling live:
 *   1. Sequence copy in tbr-warm-v1.js has no [REPLACE: ...] markers.
 *   2. Warm Instantly campaign exists with separate sending accounts
 *      from the TBR cold campaign so warm/cold deliverability stays
 *      isolated.
 *   3. Migration-018 has been run with the real UUID substituted into
 *      the [REPLACE-WITH-TBR-INSTANTLY-WARM-CAMPAIGN-UUID] placeholder,
 *      and active=true has been flipped on the warm rows.
 *   4. Link Tracking + unsubscribe footer enabled in the Instantly UI.
 *
 * Usage:
 *   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
 *     "https://visitorid.p5marketing.com/api/admin/push-tbr-warm-sequences?dry=true"
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
          'Sequence still contains [REPLACE: ...] placeholders. Replace all markers in lib/sequences/tbr-warm-v1.js before pushing live, or pass ?dry=true to inspect the scaffold.',
      },
      { status: 400 }
    );
  }

  const bucketsToPush = singleBucket
    ? [singleBucket]
    : Object.keys(TBR_WARM_SEQUENCES);

  for (const b of bucketsToPush) {
    if (!TBR_WARM_SEQUENCES[b]) {
      return Response.json(
        {
          error: `Unknown bucket "${b}". Valid: ${Object.keys(TBR_WARM_SEQUENCES).join(', ')}`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const sql = getDb();

    // Look up TBR warm campaign rows. There can be more rows in the DB
    // (one per bucket) than there are sequence buckets in code; we only
    // need any one row per distinct instantly_campaign_id. Fetch all
    // active warm rows and dedupe on UUID below.
    const campaignRows = await sql`
      SELECT bucket, instantly_campaign_id
      FROM campaigns
      WHERE client_key = 'tbr'
        AND kind = 'warm'
        AND active = true
    `;

    if (campaignRows.length === 0) {
      return Response.json(
        {
          error:
            'No active TBR WARM campaigns found. Did you run migration-018, substitute the Instantly UUID, and flip active=true?',
        },
        { status: 400 }
      );
    }

    // Dedupe by UUID. We only need to PATCH each Instantly campaign
    // once even if it's wired to multiple buckets in the campaigns
    // table. Pick the first bucket alphabetically for each UUID so the
    // log output is stable.
    const uniqueByUuid = new Map();
    for (const row of campaignRows) {
      if (!uniqueByUuid.has(row.instantly_campaign_id)) {
        uniqueByUuid.set(row.instantly_campaign_id, row.bucket);
      }
    }

    // Pick the sequence bucket key to use for each UUID. With v1 we only
    // define general_interest, so every Instantly campaign gets the
    // general_interest sequence. If a bucket is requested explicitly via
    // ?bucket=, only PATCH UUIDs that have a row matching that bucket.
    const sequenceBucketKey = singleBucket || 'general_interest';
    if (!TBR_WARM_SEQUENCES[sequenceBucketKey]) {
      return Response.json(
        {
          error: `No warm sequence defined for bucket "${sequenceBucketKey}".`,
        },
        { status: 400 }
      );
    }

    const bucketDef = TBR_WARM_SEQUENCES[sequenceBucketKey];
    const sequences = toInstantlySequence(sequenceBucketKey);
    const payload = { sequences };

    const results = [];

    for (const [uuid, repBucket] of uniqueByUuid.entries()) {
      // If the caller scoped to a specific bucket, only PATCH UUIDs
      // that actually back that bucket. With one UUID across three
      // buckets this is just a sanity gate.
      if (singleBucket) {
        const matches = campaignRows.some(
          (r) => r.instantly_campaign_id === uuid && r.bucket === singleBucket
        );
        if (!matches) continue;
      }

      if (isDryRun) {
        results.push({
          instantly_campaign_id: uuid,
          representative_bucket: repBucket,
          display_name: bucketDef.name,
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
        const res = await fetch(`${INSTANTLY_CAMPAIGN_API}/${uuid}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const bodyText = await res.text();
        let bodyJson = null;
        try { bodyJson = JSON.parse(bodyText); } catch { /* not JSON */ }

        if (!res.ok) {
          results.push({
            instantly_campaign_id: uuid,
            representative_bucket: repBucket,
            display_name: bucketDef.name,
            ok: false,
            status: res.status,
            error_body: bodyText.slice(0, 400),
          });
          continue;
        }

        results.push({
          instantly_campaign_id: uuid,
          representative_bucket: repBucket,
          display_name: bucketDef.name,
          ok: true,
          status: res.status,
          step_count: sequences[0].steps.length,
          subjects: sequences[0].steps.map((s) => s.variants[0].subject),
          instantly_response: bodyJson ? { id: bodyJson.id, name: bodyJson.name } : null,
        });
      } catch (fetchErr) {
        results.push({
          instantly_campaign_id: uuid,
          representative_bucket: repBucket,
          display_name: bucketDef.name,
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
    console.error('[push-tbr-warm-sequences] Error:', err);
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/push-tbr-warm-sequences
 *
 * Read-only preview of the warm sequence that WOULD be pushed.
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
    : Object.keys(TBR_WARM_SEQUENCES);

  const preview = buckets.map((b) => {
    const def = TBR_WARM_SEQUENCES[b];
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
