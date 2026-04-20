import { getDb } from '../../../../lib/db';
import { classifyUrl, classifyReferrer } from '../../../../lib/taxonomies';
import { scoreIntent, extractInterests, generateTags, scoreConfidence, determinePrimaryInterest, determineCampaignBucket, isEmailEligible, detectReturnVisitor } from '../../../../lib/scoring';
import { checkBlocklist } from '../../../../lib/blocklist';

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
      // Fetch unprocessed visitors for this client
      const unprocessed = await sql`
        SELECT id, email, first_name, last_name, phone, city, state,
               company_name, job_title, all_emails,
               visit_count, first_visit, last_visit,
               pages_visited, referrers
        FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = FALSE
      `;

      // Only create a processing_runs record if there's actual work to do
      let run = null;
      if (unprocessed.length > 0) {
        const [r] = await sql`
          INSERT INTO processing_runs (client_key, run_type)
          VALUES (${clientKey}, 'process')
          RETURNING id
        `;
        run = r;
      }

      let processed = 0;
      let errors = 0;
      let emailEligibleCount = 0;
      let skippedCount = 0;
      const tierCounts = { HOT: 0, High: 0, Medium: 0, Low: 0 };
      const bucketCounts = {
        ready_to_book: 0, provider_research: 0, procedure_treatment: 0,
        condition_research: 0, return_visitor: 0, general_interest: 0,
      };

      for (const visitor of unprocessed) {
        try {
          // ── Blocklist check: silently skip bots ──
          const blockCheck = await checkBlocklist({
            email: visitor.email,
            firstName: visitor.first_name,
            lastName: visitor.last_name,
            phone: visitor.phone,
          });
          if (blockCheck.blocked) {
            // Delete the blocked visitor entirely
            await sql`DELETE FROM visitors WHERE id = ${visitor.id}`;
            console.log(`[${clientKey}] Purged blocked visitor #${visitor.id}: ${visitor.email || visitor.first_name} (${blockCheck.reason})`);
            skippedCount++;
            continue;
          }

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
          const { score, tier: baseTier } = scoreIntent(visitor, allClassifications);

          // Score confidence (needed before tier overrides below)
          const { confidence, confidenceScore, confidenceFlags } = scoreConfidence(
            visitor, allClassifications, clientKey
          );

          // ── Tier promotion: return visitor ──
          // A visitor with 2+ distinct calendar dates, 2+ unique pathnames,
          // and confidence >= 40 is our highest-conviction lead and is
          // force-promoted to HOT. Low-tier visitors are excluded to avoid
          // promoting very weak signals.
          // Ad-clicker pattern is no longer explicitly capped here — the
          // halved frequency bonus inside scoreIntent already pushes most
          // single-page repeat visitors down to Medium naturally.
          let tier = baseTier;
          const isReturnVisitor = detectReturnVisitor(visitor);
          if (isReturnVisitor && confidenceScore >= 40 && tier !== 'Low') {
            tier = 'HOT';
          }

          // Extract interests and generate tags (tier now reflects overrides)
          const interests = extractInterests(allClassifications);
          const tags = generateTags(tier, interests, primarySource);
          if (isReturnVisitor && confidenceScore >= 40) {
            tags.push('return-visitor');
          }

          // Determine primary interest and campaign bucket
          const primaryInterest = determinePrimaryInterest(allClassifications);
          const campaignBucket = determineCampaignBucket(allClassifications, visitor);
          const emailEligible = isEmailEligible(visitor, campaignBucket, confidenceScore);

          // Write results back
          await sql`
            UPDATE visitors SET
              intent_score = ${score},
              intent_tier = ${tier},
              interests = ${JSON.stringify(interests)}::jsonb,
              referrer_source = ${primarySource},
              tags = ${JSON.stringify(tags)}::jsonb,
              confidence = ${confidence},
              confidence_score = ${confidenceScore},
              confidence_flags = ${JSON.stringify(confidenceFlags)}::jsonb,
              primary_interest = ${primaryInterest},
              campaign_bucket = ${campaignBucket},
              email_eligible = ${emailEligible},
              processed = TRUE,
              processed_at = NOW()
            WHERE id = ${visitor.id}
          `;

          tierCounts[tier]++;
          if (campaignBucket) bucketCounts[campaignBucket]++;
          if (emailEligible) emailEligibleCount++;
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

      // Update processing run log (only if we created one)
      if (run) {
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
      }

      results[clientKey] = {
        total_visitors: parseInt(countResult.total),
        unprocessed_found: unprocessed.length,
        processed,
        errors,
        tier_counts: tierCounts,
        bucket_counts: bucketCounts,
        email_eligible: emailEligibleCount,
      };
    }

    console.log('Processing complete:', JSON.stringify(results));
    return Response.json({ success: true, results });

  } catch (error) {
    console.error('Process visitors error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
