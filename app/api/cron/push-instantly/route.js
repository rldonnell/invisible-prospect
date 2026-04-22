import { getDb } from '../../../../lib/db';

/**
 * GET /api/cron/push-instantly
 *
 * Scheduled daily at 12:00 UTC (7 AM CT / 8 AM ET).
 * Qualifies email-eligible visitors against active campaigns
 * and pushes them to Instantly.ai via API.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://your-app.vercel.app/api/cron/push-instantly
 *
 * Optional: ?client=sa-spine (push single client)
 *           ?dry=true (log what would be pushed without calling Instantly)
 *
 * Requires env vars:
 *   INSTANTLY_API_KEY — Instantly.ai V2 API key
 *   INSTANTLY_PUSH_ENABLED — "true" to enable (global kill switch)
 */

const INSTANTLY_API = 'https://api.instantly.ai/api/v2/leads';
const INSTANTLY_CAMPAIGNS_API = 'https://api.instantly.ai/api/v2/campaigns';
const BATCH_SIZE = 500; // Instantly allows up to 1000, we use 500 for safety

// Tier hierarchy for threshold comparison
const TIER_ORDER = { 'Low': 0, 'Medium': 1, 'High': 2, 'HOT': 3 };

function meetsTierThreshold(visitorTier, campaignMinTier) {
  return (TIER_ORDER[visitorTier] || 0) >= (TIER_ORDER[campaignMinTier] || 0);
}

/**
 * Activate an Instantly campaign before pushing leads.
 *
 * Instantly auto-flips campaigns to "Completed" status once every lead
 * has finished the sequence. Completed campaigns will accept new leads
 * via /leads/add but will NOT sequence them - leads land as contacts
 * and just sit there. Calling /activate is a no-op if the campaign is
 * already Active, so it's safe to run on every push.
 *
 * Non-blocking: failures are logged but do not abort the push. Worst
 * case the lead lands without sequencing (current behavior), never worse.
 */
async function activateInstantlyCampaign(instantlyCampaignId, apiKey) {
  try {
    const res = await fetch(
      `${INSTANTLY_CAMPAIGNS_API}/${instantlyCampaignId}/activate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.warn(
        `[push-instantly] activate failed for ${instantlyCampaignId}: ${res.status} ${body}`
      );
      return { ok: false, status: res.status, body: body.slice(0, 200) };
    }
    return { ok: true };
  } catch (err) {
    console.warn(
      `[push-instantly] activate threw for ${instantlyCampaignId}:`,
      err.message
    );
    return { ok: false, error: err.message };
  }
}

export async function GET(request) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Global kill switch
  const pushEnabled = process.env.INSTANTLY_PUSH_ENABLED === 'true';
  const apiKey = process.env.INSTANTLY_API_KEY;

  const { searchParams } = new URL(request.url);
  const singleClient = searchParams.get('client');
  const isDryRun = searchParams.get('dry') === 'true';

  if (!pushEnabled && !isDryRun) {
    return Response.json({
      success: false,
      message: 'INSTANTLY_PUSH_ENABLED is not set to "true". Use ?dry=true for a dry run.',
    });
  }

  if (!apiKey && !isDryRun) {
    return Response.json({
      success: false,
      message: 'INSTANTLY_API_KEY is not configured. Use ?dry=true for a dry run.',
    });
  }

  try {
    const sql = getDb();
    const results = {};

    // Get all active campaigns (or for a single client)
    const activeCampaigns = singleClient
      ? await sql`
          SELECT * FROM campaigns
          WHERE client_key = ${singleClient} AND active = true
        `
      : await sql`
          SELECT * FROM campaigns WHERE active = true
        `;

    if (activeCampaigns.length === 0) {
      return Response.json({
        success: true,
        message: 'No active campaigns found',
        results: {},
      });
    }

    // Group campaigns by client_key for efficient processing
    const campaignsByClient = {};
    for (const c of activeCampaigns) {
      if (!campaignsByClient[c.client_key]) campaignsByClient[c.client_key] = [];
      campaignsByClient[c.client_key].push(c);
    }

    // Create processing run
    const clientKeys = Object.keys(campaignsByClient);
    const [run] = await sql`
      INSERT INTO processing_runs (client_key, run_type)
      VALUES (${clientKeys.join(',')}, 'push-instantly')
      RETURNING id
    `;

    for (const [clientKey, campaigns] of Object.entries(campaignsByClient)) {
      // Build a map: bucket → campaign config
      const bucketMap = {};
      for (const c of campaigns) {
        bucketMap[c.bucket] = c;
      }

      // Find eligible visitors not yet enrolled in any campaign for this client
      const eligible = await sql`
        SELECT v.id, v.first_name, v.last_name, v.email, v.city, v.state,
               v.intent_tier, v.confidence, v.confidence_score,
               v.primary_interest, v.campaign_bucket, v.visit_count
        FROM visitors v
        WHERE v.client_key = ${clientKey}
          AND v.email_eligible = true
          AND v.campaign_bucket IS NOT NULL
          AND v.id NOT IN (
            SELECT e.visitor_id FROM email_enrollments e
            JOIN campaigns c ON c.id = e.campaign_id
            WHERE c.client_key = ${clientKey}
          )
        ORDER BY v.intent_score DESC
      `;

      let pushed = 0;
      let skippedNoCampaign = 0;
      let skippedThreshold = 0;
      let failed = 0;
      const activations = []; // { campaign_id, ok, status?, error? }

      // Group eligible visitors by their campaign bucket
      const leadsByInstantlyCampaign = {}; // instantly_campaign_id → [lead payloads]
      const enrollmentRecords = [];        // records to insert after successful push

      for (const v of eligible) {
        const campaign = bucketMap[v.campaign_bucket];

        // No active campaign for this bucket
        if (!campaign) {
          skippedNoCampaign++;
          continue;
        }

        // Check confidence threshold
        if ((v.confidence_score || 0) < campaign.confidence_min) {
          skippedThreshold++;
          continue;
        }

        // Check tier threshold
        if (!meetsTierThreshold(v.intent_tier, campaign.min_tier)) {
          skippedThreshold++;
          continue;
        }

        // Must have an Instantly campaign ID to push
        if (!campaign.instantly_campaign_id && !isDryRun) {
          skippedNoCampaign++;
          continue;
        }

        // Build custom variables from campaign config + visitor data
        const campaignVars = campaign.variables || {};

        // Select testimonial: try interest-specific, fall back to default
        const testimonials = campaignVars.testimonials || {};
        const testimonial = testimonials[v.primary_interest]
          || testimonials.default
          || '';

        const customVariables = {
          first_name: v.first_name || '',
          interest: v.primary_interest || campaignVars.practice_focus || '',
          practice_name: campaignVars.practice_name || '',
          practice_focus: campaignVars.practice_focus || '',
          doctor_name: campaignVars.doctor_name || '',
          booking_link: campaignVars.booking_link || '',
          testimonial,
          city: v.city || '',
          state: v.state || '',
          bucket: v.campaign_bucket,
          phone: campaignVars.phone || '',
        };

        const leadPayload = {
          email: v.email,
          first_name: v.first_name || '',
          last_name: v.last_name || '',
          company_name: '',
          custom_variables: customVariables,
        };

        const campaignId = campaign.instantly_campaign_id || 'dry-run';
        if (!leadsByInstantlyCampaign[campaignId]) {
          leadsByInstantlyCampaign[campaignId] = [];
        }
        leadsByInstantlyCampaign[campaignId].push(leadPayload);

        enrollmentRecords.push({
          visitor_id: v.id,
          campaign_id: campaign.id,
          bucket: v.campaign_bucket,
          primary_interest: v.primary_interest,
          variables_sent: customVariables,
        });
      }

      // Push batches to Instantly
      for (const [instantlyCampaignId, leads] of Object.entries(leadsByInstantlyCampaign)) {
        // Ensure campaign is Active before pushing. Instantly auto-flips
        // campaigns to "Completed" once all leads finish the sequence;
        // Completed campaigns accept new leads as contacts but do NOT
        // sequence them. Activating an already-Active campaign is a no-op.
        if (!isDryRun && instantlyCampaignId !== 'dry-run') {
          const activation = await activateInstantlyCampaign(instantlyCampaignId, apiKey);
          activations.push({ campaign_id: instantlyCampaignId, ...activation });
        }

        // Process in batches
        for (let i = 0; i < leads.length; i += BATCH_SIZE) {
          const batch = leads.slice(i, i + BATCH_SIZE);

          if (isDryRun) {
            // Dry run — just count, don't push
            pushed += batch.length;
            continue;
          }

          try {
            const response = await fetch(`${INSTANTLY_API}/add`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                campaign_id: instantlyCampaignId,
                leads: batch,
              }),
            });

            const data = await response.json();

            if (response.ok) {
              pushed += data.leads_uploaded || batch.length;

              // Map Instantly lead IDs back to enrollment records
              const createdLeads = data.created_leads || [];
              for (const cl of createdLeads) {
                const enrollIdx = i + cl.index;
                if (enrollmentRecords[enrollIdx]) {
                  enrollmentRecords[enrollIdx].instantly_lead_id = cl.id;
                }
              }
            } else {
              console.error(`[push-instantly] Instantly API error for ${instantlyCampaignId}:`, data);
              failed += batch.length;
            }
          } catch (fetchErr) {
            console.error(`[push-instantly] Fetch error for ${instantlyCampaignId}:`, fetchErr.message);
            failed += batch.length;
          }
        }
      }

      // Record enrollments in database (skip on dry run)
      if (!isDryRun && enrollmentRecords.length > 0) {
        // Only record enrollments for leads that weren't in the failed batch
        const successRecords = enrollmentRecords.slice(0, pushed);
        for (const rec of successRecords) {
          try {
            await sql`
              INSERT INTO email_enrollments
                (visitor_id, campaign_id, instantly_lead_id, bucket, primary_interest, variables_sent)
              VALUES
                (${rec.visitor_id}, ${rec.campaign_id}, ${rec.instantly_lead_id || null},
                 ${rec.bucket}, ${rec.primary_interest}, ${JSON.stringify(rec.variables_sent)}::jsonb)
              ON CONFLICT (visitor_id, campaign_id) DO NOTHING
            `;
          } catch (insertErr) {
            console.error(`[push-instantly] Enrollment insert error:`, insertErr.message);
          }
        }
      }

      results[clientKey] = {
        eligible_found: eligible.length,
        pushed,
        skipped_no_campaign: skippedNoCampaign,
        skipped_threshold: skippedThreshold,
        failed,
        dry_run: isDryRun,
        activations,
        activations_failed: activations.filter((a) => !a.ok).length,
      };
    }

    // Update processing run
    if (run) {
      const totalPushed = Object.values(results).reduce((s, r) => s + r.pushed, 0);
      const totalSkipped = Object.values(results).reduce((s, r) => s + r.skipped_no_campaign + r.skipped_threshold, 0);
      const totalFailed = Object.values(results).reduce((s, r) => s + r.failed, 0);

      await sql`
        UPDATE processing_runs SET
          completed_at = NOW(),
          processed = ${totalPushed},
          skipped = ${totalSkipped},
          errors = ${totalFailed},
          tier_counts = ${JSON.stringify(results)}::jsonb
        WHERE id = ${run.id}
      `;
    }

    console.log('[push-instantly] Complete:', JSON.stringify(results));
    return Response.json({ success: true, results });

  } catch (error) {
    console.error('[push-instantly] Error:', error);
    return Response.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}
