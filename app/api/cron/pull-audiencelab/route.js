import { getDb } from '../../../../lib/db';
import { parseAlSegments } from '../../../../lib/al-segments';
import { validateProspect as validateFourWindsCold } from '../../../../lib/icp/four-winds-cold';

/**
 * GET /api/cron/pull-audiencelab
 *
 * Pulls recent visitor data from Audience Lab's segment API for each client.
 * Runs daily at 5AM UTC (before the 6AM processing cron).
 *
 * For each configured client+kind ingest job:
 *   1. Fetches all pages from the AL segment API
 *   2. Filters to records with EVENT_TIMESTAMP in the last 25 hours
 *      (25h instead of 24h to avoid gaps between cron runs)
 *   3. Routes by kind:
 *        - 'pixel'   -> existing warm pipeline (upserts visitor as
 *                       acquisition_source='pixel', processed=false so
 *                       the daily processor scores it)
 *        - 'al_cold' -> cold pipeline (ICP-validates first, cross-checks
 *                       against warm by email/HEM/name, inserts with
 *                       acquisition_source='al_cold', processed=true,
 *                       email_eligible per ICP)
 *
 * Env vars required:
 *   AUDIENCELAB_API_KEY  — your AL API key (X-API-KEY header)
 *   AL_SEGMENTS          — JSON, two formats supported (see lib/al-segments.js):
 *     Flat (warm only):
 *       {"sa-spine":"abc-123","four-winds":"def-456"}
 *     Nested per-client kinds (warm + cold):
 *       {"four-winds":{"pixel":"def-456","al_cold":"ghi-789"}}
 */

// Per-client cold ICP validators. Add new clients here as their cold
// pipelines come online.
const COLD_ICP_VALIDATORS = {
  'four-winds': validateFourWindsCold,
};

const AL_BASE = 'https://api.audiencelab.io';
const PAGE_SIZE = 200;
const DEFAULT_LOOKBACK_HOURS = 169; // 7 days + 1 hour overlap
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 5000; // 5 seconds, doubles each retry
const DELAY_BETWEEN_CLIENTS_MS = 2000; // 2 seconds between clients

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with retry + exponential backoff for 429 rate limits.
 */
async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, options);

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      console.log(`  Rate limited (429), retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(backoff);
      continue;
    }

    return res;
  }
}

export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiKey = process.env.AUDIENCELAB_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'AUDIENCELAB_API_KEY not configured' }, { status: 400 });
  }

  let jobs;
  try {
    jobs = parseAlSegments(process.env.AL_SEGMENTS);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }

  if (jobs.length === 0) {
    return Response.json({ error: 'AL_SEGMENTS is empty' }, { status: 400 });
  }

  const sql = getDb();
  // Allow override via ?hours=168 query param (e.g., for backfill)
  const url = new URL(request.url);
  const lookbackHours = parseInt(url.searchParams.get('hours')) || DEFAULT_LOOKBACK_HOURS;
  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const results = {};

  for (let ji = 0; ji < jobs.length; ji++) {
    const { client_key: clientKey, kind, segment_id: segmentId } = jobs[ji];
    // Use a kind-suffixed result key so warm + cold for the same client
    // don't collide.
    const resultKey = kind === 'pixel' ? clientKey : `${clientKey}:${kind}`;

    // Delay between jobs to avoid rate limits (skip first)
    if (ji > 0) {
      await sleep(DELAY_BETWEEN_CLIENTS_MS);
    }

    console.log(`[${resultKey}] Pulling segment ${segmentId} (kind=${kind})...`);

    let page = 1;
    let hasMore = true;
    let fetched = 0;
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let filtered = 0;

    try {
      while (hasMore) {
        const url = `${AL_BASE}/segments/${segmentId}?page=${page}&page_size=${PAGE_SIZE}`;
        const res = await fetchWithRetry(url, {
          headers: { 'X-API-KEY': apiKey },
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`AL API error ${res.status}: ${errText}`);
        }

        const json = await res.json();
        const records = json.data || [];
        fetched += records.length;

        for (const v of records) {
          // Filter by timestamp — only process recent records
          const eventTime = v.EVENT_TIMESTAMP ? new Date(v.EVENT_TIMESTAMP) : null;
          if (eventTime && eventTime < cutoff) {
            filtered++;
            continue;
          }

          // ── HEM SHA256 (primary dedup key) ──
          const hemSha256 = (v.HEM_SHA256 || '').trim();

          // ── Email ──
          // Try personal first (consumer pipeline), then fall back to business (B2B pipeline)
          // so segments that return B2B records without personal identifiers still ingest.
          const rawEmail =
            v.PERSONAL_VERIFIED_EMAILS ||
            v.PERSONAL_EMAILS ||
            v.BUSINESS_VERIFIED_EMAILS ||
            v.BUSINESS_EMAIL ||
            '';
          const email = rawEmail.includes(',')
            ? rawEmail.split(',')[0].trim().toLowerCase()
            : rawEmail.trim().toLowerCase();

          // Must have either HEM hash or email (personal or business)
          if (!hemSha256 && (!email || !email.includes('@'))) {
            skipped++;
            continue;
          }

          const dedupKey = hemSha256 || `email:${email}`;

          // ── Core fields ──
          const fullUrl    = v.FULL_URL || '';
          const referrer   = v.REFERRER_URL || '';
          const timestamp  = v.EVENT_TIMESTAMP || new Date().toISOString();

          const phone      = v.ALL_MOBILES || v.ALL_LANDLINES || '';
          const primaryPhone = phone.includes(',') ? phone.split(',')[0].trim() : phone.trim();

          const firstName  = (v.FIRST_NAME || '').trim();
          const lastName   = (v.LAST_NAME || '').trim();
          const city       = (v.PERSONAL_CITY || '').trim();
          const state      = (v.PERSONAL_STATE || '').trim();
          const ageRange   = v.AGE_RANGE || '';
          const gender     = v.GENDER || '';
          const income     = v.INCOME_RANGE || '';
          const netWorth   = v.NET_WORTH || '';
          const linkedin   = v.INDIVIDUAL_LINKEDIN_URL || '';

          // ── Enrichment: Address & Demographics ──
          const address    = (v.PERSONAL_ADDRESS || '').trim();
          const zip        = (v.PERSONAL_ZIP || '').trim();
          const homeowner  = (v.HOMEOWNER || '').trim();
          const married    = (v.MARRIED || '').trim();
          const children   = (v.CHILDREN || '').trim();

          // ── Enrichment: Employer / B2B ──
          const companyName     = (v.COMPANY_NAME || '').trim();
          const jobTitle        = (v.JOB_TITLE || '').trim();
          const companyIndustry = (v.COMPANY_INDUSTRY || '').trim();
          const companySize     = (v.COMPANY_EMPLOYEE_COUNT || '').trim();
          const companyRevenue  = (v.COMPANY_REVENUE || '').trim();
          const department      = (v.DEPARTMENT || '').trim();
          const seniorityLevel  = (v.SENIORITY_LEVEL || '').trim();

          // ── Enrichment: Identity & Emails ──
          const allEmails    = (v.PERSONAL_EMAILS || '').trim();
          const businessEmail = (v.BUSINESS_EMAIL || v.BUSINESS_VERIFIED_EMAILS || '').trim();
          const pixelId      = (v.PIXEL_ID || '').trim();
          const edid         = (v.EDID || '').trim();

          // ── Enrichment: Social & Skills ──
          const facebookUrl  = (v.INDIVIDUAL_FACEBOOK_URL || '').trim();
          const twitterUrl   = (v.INDIVIDUAL_TWITTER_URL || '').trim();
          const skills       = (v.SKILLS || '').trim();
          const alInterests  = (v.INTERESTS || '').trim();

          // ═══════════════════════════════════════════════════════════════
          // COLD PIPELINE FORK
          // ═══════════════════════════════════════════════════════════════
          // For kind='al_cold' jobs: ICP-validate, cross-pipeline dedup
          // against any existing row for this client (warm OR cold), then
          // insert with acquisition_source='al_cold', processed=true,
          // intent_tier='High', and a fixed campaign_bucket. Skip the
          // warm UPSERT path entirely.
          //
          // The push-instantly cron will pick these up via the (client_key,
          // bucket, kind='cold') campaign row added in migration-016.
          if (kind === 'al_cold') {
            const icpValidator = COLD_ICP_VALIDATORS[clientKey];
            if (!icpValidator) {
              console.warn(`[${resultKey}] No cold ICP validator registered for ${clientKey} - skipping`);
              skipped++;
              continue;
            }

            const icpResult = icpValidator(v);
            if (!icpResult.pass) {
              console.log(`[${resultKey}] ICP fail (${icpResult.reasons.join(',')}) - ${firstName} ${lastName} / ${jobTitle} @ ${companyName}`);
              skipped++;
              continue;
            }

            // Cross-pipeline dedup: if this person already exists for this
            // client (regardless of acquisition_source), do NOT create a
            // cold row. Prevents the same prospect from receiving warm
            // follow-up AND cold founder-transition pitch.
            const firstBizEmailCold = businessEmail.includes(',')
              ? businessEmail.split(',')[0].trim().toLowerCase()
              : businessEmail.toLowerCase();

            const crossExisting = await sql`
              SELECT id, acquisition_source FROM visitors
              WHERE client_key = ${clientKey}
                AND (
                  hem_sha256 = ${dedupKey}
                  OR (${email} != '' AND LOWER(email) = ${email})
                  OR (${firstBizEmailCold} != '' AND LOWER(business_email) LIKE ${'%' + firstBizEmailCold + '%'})
                  OR (${firstName} != '' AND ${lastName} != '' AND ${companyName} != ''
                      AND LOWER(first_name) = ${firstName.toLowerCase()}
                      AND LOWER(last_name) = ${lastName.toLowerCase()}
                      AND LOWER(company_name) = ${companyName.toLowerCase()})
                )
              LIMIT 1
            `;

            if (crossExisting.length > 0) {
              console.log(`[${resultKey}] Cross-pipeline dup (${crossExisting[0].acquisition_source}) - skipping ${firstName} ${lastName}`);
              skipped++;
              continue;
            }

            // Cold prospects bypass scoring. Set tier/score/bucket/tags
            // manually and mark processed=true so the daily processor
            // doesn't touch them.
            const coldTags = ['al-cold', 'icp-pass'];
            const coldFlags = ['cold_outreach', ...icpResult.reasons.map(r => `icp:${r}`)];

            try {
              await sql`
                INSERT INTO visitors (
                  client_key, hem_sha256, email, first_name, last_name, phone,
                  city, state, age_range, gender, income, net_worth, linkedin,
                  address, zip, homeowner, married, children,
                  company_name, job_title, company_industry, company_size, company_revenue,
                  department, seniority_level,
                  all_emails, business_email, pixel_id, edid,
                  facebook_url, twitter_url, skills, al_interests,
                  visit_count, first_visit, last_visit,
                  pages_visited, referrers,
                  acquisition_source,
                  processed, processed_at,
                  intent_score, intent_tier, confidence, confidence_score, confidence_flags,
                  primary_interest, campaign_bucket, email_eligible,
                  tags
                ) VALUES (
                  ${clientKey}, ${dedupKey}, ${email}, ${firstName}, ${lastName}, ${primaryPhone},
                  ${city}, ${state}, ${ageRange}, ${gender}, ${income}, ${netWorth}, ${linkedin},
                  ${address}, ${zip}, ${homeowner}, ${married}, ${children},
                  ${companyName}, ${jobTitle}, ${companyIndustry}, ${companySize}, ${companyRevenue},
                  ${department}, ${seniorityLevel},
                  ${allEmails}, ${businessEmail}, ${pixelId}, ${edid},
                  ${facebookUrl}, ${twitterUrl}, ${skills}, ${alInterests},
                  1, ${timestamp}::timestamptz, ${timestamp}::timestamptz,
                  '[]'::jsonb, '[]'::jsonb,
                  'al_cold',
                  TRUE, NOW(),
                  50, 'High', 'medium', 60, ${JSON.stringify(coldFlags)}::jsonb,
                  'cold_outreach', 'general_interest', ${icpResult.emailEligible},
                  ${JSON.stringify(coldTags)}::jsonb
                )
                ON CONFLICT (client_key, hem_sha256) DO NOTHING
              `;
              inserted++;
            } catch (dbErr) {
              console.error(`[${resultKey}] Cold INSERT error for ${dedupKey}:`, dbErr.message);
              skipped++;
            }
            continue;
          }

          // ═══════════════════════════════════════════════════════════════
          // WARM (pixel) pipeline continues below
          // ═══════════════════════════════════════════════════════════════

          // ── Secondary-identity dedup (prevent the duplicate pattern where the
          // same person shows up once with a HEM-based key and once with an
          // email-based key). Before the INSERT, look for an existing row that
          // matches by primary email, normalized-first-business-email, or
          // name+company exactly. If found, UPDATE that row by id instead of
          // creating a new one.
          //
          // The INSERT ON CONFLICT below still handles the (client_key, hem_sha256)
          // unique constraint for race conditions and exact-key matches.
          const firstBizEmail = businessEmail.includes(',')
            ? businessEmail.split(',')[0].trim().toLowerCase()
            : businessEmail.toLowerCase();

          const existingRow = await sql`
            SELECT id FROM visitors
            WHERE client_key = ${clientKey}
              AND (
                hem_sha256 = ${dedupKey}
                OR (${email} != '' AND LOWER(email) = ${email})
                OR (${firstBizEmail} != '' AND LOWER(business_email) LIKE ${'%' + firstBizEmail + '%'})
                OR (${firstName} != '' AND ${lastName} != '' AND ${companyName} != ''
                    AND LOWER(first_name) = ${firstName.toLowerCase()}
                    AND LOWER(last_name) = ${lastName.toLowerCase()}
                    AND LOWER(company_name) = ${companyName.toLowerCase()})
              )
            ORDER BY visit_count DESC NULLS LAST, id ASC
            LIMIT 1
          `;

          try {
            if (existingRow.length > 0) {
              // UPDATE existing row by id — merge new signal into master
              const existingId = existingRow[0].id;
              await sql`
                UPDATE visitors SET
                  visit_count = visit_count + 1,
                  last_visit = GREATEST(last_visit, ${timestamp}::timestamptz),
                  pages_visited = CASE
                    WHEN ${fullUrl} != '' AND NOT pages_visited @> ${JSON.stringify([fullUrl])}::jsonb
                    THEN pages_visited || ${JSON.stringify([fullUrl])}::jsonb
                    ELSE pages_visited
                  END,
                  referrers = CASE
                    WHEN ${referrer} != '' AND NOT referrers @> ${JSON.stringify([referrer])}::jsonb
                    THEN referrers || ${JSON.stringify([referrer])}::jsonb
                    ELSE referrers
                  END,
                  email = CASE WHEN email = '' AND ${email} != '' THEN ${email} ELSE email END,
                  first_name = CASE WHEN first_name = '' AND ${firstName} != '' THEN ${firstName} ELSE first_name END,
                  last_name = CASE WHEN last_name = '' AND ${lastName} != '' THEN ${lastName} ELSE last_name END,
                  phone = CASE WHEN phone = '' AND ${primaryPhone} != '' THEN ${primaryPhone} ELSE phone END,
                  address = CASE WHEN address = '' AND ${address} != '' THEN ${address} ELSE address END,
                  zip = CASE WHEN zip = '' AND ${zip} != '' THEN ${zip} ELSE zip END,
                  homeowner = CASE WHEN homeowner = '' AND ${homeowner} != '' THEN ${homeowner} ELSE homeowner END,
                  married = CASE WHEN married = '' AND ${married} != '' THEN ${married} ELSE married END,
                  children = CASE WHEN children = '' AND ${children} != '' THEN ${children} ELSE children END,
                  company_name = CASE WHEN company_name = '' AND ${companyName} != '' THEN ${companyName} ELSE company_name END,
                  job_title = CASE WHEN job_title = '' AND ${jobTitle} != '' THEN ${jobTitle} ELSE job_title END,
                  company_industry = CASE WHEN company_industry = '' AND ${companyIndustry} != '' THEN ${companyIndustry} ELSE company_industry END,
                  company_size = CASE WHEN company_size = '' AND ${companySize} != '' THEN ${companySize} ELSE company_size END,
                  company_revenue = CASE WHEN company_revenue = '' AND ${companyRevenue} != '' THEN ${companyRevenue} ELSE company_revenue END,
                  department = CASE WHEN department = '' AND ${department} != '' THEN ${department} ELSE department END,
                  seniority_level = CASE WHEN seniority_level = '' AND ${seniorityLevel} != '' THEN ${seniorityLevel} ELSE seniority_level END,
                  all_emails = CASE WHEN all_emails = '' AND ${allEmails} != '' THEN ${allEmails} ELSE all_emails END,
                  business_email = CASE WHEN business_email = '' AND ${businessEmail} != '' THEN ${businessEmail} ELSE business_email END,
                  pixel_id = CASE WHEN pixel_id = '' AND ${pixelId} != '' THEN ${pixelId} ELSE pixel_id END,
                  edid = CASE WHEN edid = '' AND ${edid} != '' THEN ${edid} ELSE edid END,
                  facebook_url = CASE WHEN facebook_url = '' AND ${facebookUrl} != '' THEN ${facebookUrl} ELSE facebook_url END,
                  twitter_url = CASE WHEN twitter_url = '' AND ${twitterUrl} != '' THEN ${twitterUrl} ELSE twitter_url END,
                  skills = CASE WHEN skills = '' AND ${skills} != '' THEN ${skills} ELSE skills END,
                  al_interests = CASE WHEN al_interests = '' AND ${alInterests} != '' THEN ${alInterests} ELSE al_interests END,
                  processed = FALSE
                WHERE id = ${existingId}
              `;
              updated++;
              continue;
            }

            // No existing row matched — insert fresh with original ON CONFLICT
            const result = await sql`
              INSERT INTO visitors (
                client_key, hem_sha256, email, first_name, last_name, phone,
                city, state, age_range, gender, income, net_worth, linkedin,
                address, zip, homeowner, married, children,
                company_name, job_title, company_industry, company_size, company_revenue,
                department, seniority_level,
                all_emails, business_email, pixel_id, edid,
                facebook_url, twitter_url, skills, al_interests,
                visit_count, first_visit, last_visit,
                pages_visited, referrers, processed
              ) VALUES (
                ${clientKey}, ${dedupKey}, ${email}, ${firstName}, ${lastName}, ${primaryPhone},
                ${city}, ${state}, ${ageRange}, ${gender}, ${income}, ${netWorth}, ${linkedin},
                ${address}, ${zip}, ${homeowner}, ${married}, ${children},
                ${companyName}, ${jobTitle}, ${companyIndustry}, ${companySize}, ${companyRevenue},
                ${department}, ${seniorityLevel},
                ${allEmails}, ${businessEmail}, ${pixelId}, ${edid},
                ${facebookUrl}, ${twitterUrl}, ${skills}, ${alInterests},
                1, ${timestamp}::timestamptz, ${timestamp}::timestamptz,
                ${fullUrl ? JSON.stringify([fullUrl]) : '[]'}::jsonb,
                ${referrer ? JSON.stringify([referrer]) : '[]'}::jsonb,
                FALSE
              )
              ON CONFLICT (client_key, hem_sha256) DO UPDATE SET
                visit_count = visitors.visit_count + 1,
                last_visit = GREATEST(visitors.last_visit, ${timestamp}::timestamptz),
                pages_visited = CASE
                  WHEN ${fullUrl} != '' AND NOT visitors.pages_visited @> ${JSON.stringify([fullUrl])}::jsonb
                  THEN visitors.pages_visited || ${JSON.stringify([fullUrl])}::jsonb
                  ELSE visitors.pages_visited
                END,
                referrers = CASE
                  WHEN ${referrer} != '' AND NOT visitors.referrers @> ${JSON.stringify([referrer])}::jsonb
                  THEN visitors.referrers || ${JSON.stringify([referrer])}::jsonb
                  ELSE visitors.referrers
                END,
                email = CASE WHEN visitors.email = '' AND ${email} != '' THEN ${email} ELSE visitors.email END,
                first_name = CASE WHEN visitors.first_name = '' AND ${firstName} != '' THEN ${firstName} ELSE visitors.first_name END,
                last_name = CASE WHEN visitors.last_name = '' AND ${lastName} != '' THEN ${lastName} ELSE visitors.last_name END,
                phone = CASE WHEN visitors.phone = '' AND ${primaryPhone} != '' THEN ${primaryPhone} ELSE visitors.phone END,
                address = CASE WHEN visitors.address = '' AND ${address} != '' THEN ${address} ELSE visitors.address END,
                zip = CASE WHEN visitors.zip = '' AND ${zip} != '' THEN ${zip} ELSE visitors.zip END,
                homeowner = CASE WHEN visitors.homeowner = '' AND ${homeowner} != '' THEN ${homeowner} ELSE visitors.homeowner END,
                married = CASE WHEN visitors.married = '' AND ${married} != '' THEN ${married} ELSE visitors.married END,
                children = CASE WHEN visitors.children = '' AND ${children} != '' THEN ${children} ELSE visitors.children END,
                company_name = CASE WHEN visitors.company_name = '' AND ${companyName} != '' THEN ${companyName} ELSE visitors.company_name END,
                job_title = CASE WHEN visitors.job_title = '' AND ${jobTitle} != '' THEN ${jobTitle} ELSE visitors.job_title END,
                company_industry = CASE WHEN visitors.company_industry = '' AND ${companyIndustry} != '' THEN ${companyIndustry} ELSE visitors.company_industry END,
                company_size = CASE WHEN visitors.company_size = '' AND ${companySize} != '' THEN ${companySize} ELSE visitors.company_size END,
                company_revenue = CASE WHEN visitors.company_revenue = '' AND ${companyRevenue} != '' THEN ${companyRevenue} ELSE visitors.company_revenue END,
                department = CASE WHEN visitors.department = '' AND ${department} != '' THEN ${department} ELSE visitors.department END,
                seniority_level = CASE WHEN visitors.seniority_level = '' AND ${seniorityLevel} != '' THEN ${seniorityLevel} ELSE visitors.seniority_level END,
                all_emails = CASE WHEN visitors.all_emails = '' AND ${allEmails} != '' THEN ${allEmails} ELSE visitors.all_emails END,
                business_email = CASE WHEN visitors.business_email = '' AND ${businessEmail} != '' THEN ${businessEmail} ELSE visitors.business_email END,
                pixel_id = CASE WHEN visitors.pixel_id = '' AND ${pixelId} != '' THEN ${pixelId} ELSE visitors.pixel_id END,
                edid = CASE WHEN visitors.edid = '' AND ${edid} != '' THEN ${edid} ELSE visitors.edid END,
                facebook_url = CASE WHEN visitors.facebook_url = '' AND ${facebookUrl} != '' THEN ${facebookUrl} ELSE visitors.facebook_url END,
                twitter_url = CASE WHEN visitors.twitter_url = '' AND ${twitterUrl} != '' THEN ${twitterUrl} ELSE visitors.twitter_url END,
                skills = CASE WHEN visitors.skills = '' AND ${skills} != '' THEN ${skills} ELSE visitors.skills END,
                al_interests = CASE WHEN visitors.al_interests = '' AND ${alInterests} != '' THEN ${alInterests} ELSE visitors.al_interests END,
                processed = FALSE
            `;

            // Check if it was an insert or update by looking at visit_count
            const check = await sql`
              SELECT visit_count FROM visitors
              WHERE client_key = ${clientKey} AND hem_sha256 = ${dedupKey}
            `;
            if (check[0]?.visit_count === 1) {
              inserted++;
            } else {
              updated++;
            }
          } catch (dbErr) {
            console.error(`[${resultKey}] DB error for ${dedupKey}:`, dbErr.message);
            skipped++;
          }
        }

        hasMore = json.has_more && records.length > 0;
        page++;

        // Safety: stop if 95%+ of records are outside the window after many pages
        if (filtered > fetched * 0.95 && fetched > PAGE_SIZE * 10) {
          console.log(`[${resultKey}] Stopping early - most records older than cutoff (${filtered}/${fetched} filtered)`);
          break;
        }
      }

      results[resultKey] = { kind, fetched, inserted, updated, skipped, filtered };
      console.log(`[${resultKey}] Done: ${fetched} fetched, ${inserted} new, ${updated} updated, ${skipped} skipped, ${filtered} outside window`);

    } catch (err) {
      console.error(`[${resultKey}] Pull failed:`, err.message);
      results[resultKey] = { kind, error: err.message };
    }
  }

  return Response.json({
    message: 'Audience Lab pull complete',
    cutoff: cutoff.toISOString(),
    results,
  });
}
