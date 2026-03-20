import { getDb } from '../../../../lib/db';
import { classifyUrl, classifyReferrer } from '../../../../lib/taxonomies';
import { scoreIntent, extractInterests, generateTags } from '../../../../lib/scoring';

/**
 * GET /api/cron/process-visitors
 *
 * Scheduled daily at 6 AM UTC.
 * Fetches all unprocessed visitors from Postgres, applies taxonomy,
 * scores intent, and writes results back in batch.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/process-visitors
 *
 * Optional query param: ?client=sa-spine (process single client)
 */
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const singleClient = searchParams.get('client');

    const activeClients = singleClient
      ? [singleClient]
      : (process.env.ACTIVE_CLIENTS || '').split(',').map(s => s.trim()).filter(Boolean);

    if (activeClients.length === 0) {
      return Response.json({ error: 'No ACTIVE_CLIENTS configured' }, { status: 400 });
    }

    const results = {};

    for (const clientKey of activeClients) {
      // Log the processing run
      const [run] = await sql`
        INSERT INTO processing_runs (client_key, run_type)
        VALUES (${clientKey}, 'process')
        RETURNING id
      `;

      // Fetch unprocessed visitors for this client
      const unprocessed = await sql`
        SELECT id, email, visit_count, first_visit, last_visit,
               pages_visited, referrers
        FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = FALSE
      `;

      let processed = 0;
      let errors = 0;
      const tierCounts = { HOT: 0, High: 0, Medium: 0, Low: 0 };

      for (const visitor of unprocessed) {
        try {
          // Classify all page views
          const pages = visitor.pages_visited || [];
          const allClassifications = [];
          for (const url of pages) {
            const matches = classifyUrl(url, clientKey);
            allClassifications.push(...matches);
          }

          // Classify referrer sources
          const referrerList = visitor.referrers || [];
          const referrerSources = referrerList.map(classifyReferrer);
          const primarySource = referrerSources[0] || 'Direct';

          // Score intent
          const { score, tier } = scoreIntent(visitor, allClassifications);

          // Extract interests and generate tags
          const interests = extractInterests(allClassifications);
          const tags = generateTags(tier, interests, primarySource);

          // Write results back
          await sql`
            UPDATE visitors SET
              intent_score = ${score},
              intent_tier = ${tier},
              interests = ${JSON.stringify(interests)}::jsonb,
              referrer_source = ${primarySource},
              tags = ${JSON.stringify(tags)}::jsonb,
              processed = TRUE,
              processed_at = NOW()
            WHERE id = ${visitor.id}
          `;

          tierCounts[tier]++;
          processed++;

        } catch (visitorError) {
          console.error(`Error processing visitor ${visitor.id}:`, visitorError.message);
          errors++;
        }
      }

      // Get total visitor count for this client
      const [countResult] = await sql`
        SELECT COUNT(*) as total FROM visitors WHERE client_key = ${clientKey}
      `;

      // Update processing run log
      await sql`
        UPDATE processing_runs SET
          completed_at = NOW(),
          total_visitors = ${parseInt(countResult.total)},
          processed = ${processed},
          skipped = ${parseInt(countResult.total) - unprocessed.length},
          errors = ${errors},
          tier_counts = ${JSON.stringify(tierCounts)}::jsonb
        WHERE id = ${run.id}
      `;

      results[clientKey] = {
        total_visitors: parseInt(countResult.total),
        unprocessed_found: unprocessed.length,
        processed,
        errors,
        tier_counts: tierCounts,
      };
    }

    console.log('Processing complete:', JSON.stringify(results));
    return Response.json({ success: true, results });

  } catch (error) {
    console.error('Process visitors error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
