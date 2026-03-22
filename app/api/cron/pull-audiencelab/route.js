import { getDb } from '../../../../lib/db';

/**
 * GET /api/cron/pull-audiencelab
 *
 * Pulls recent visitor data from Audience Lab's segment API for each client.
 * Runs daily at 5AM UTC (before the 6AM processing cron).
 *
 * For each configured client segment:
 *   1. Fetches all pages from the AL segment API
 *   2. Filters to records with EVENT_TIMESTAMP in the last 25 hours
 *      (25h instead of 24h to avoid gaps between cron runs)
 *   3. Upserts into the visitors table using the same logic as the webhook
 *
 * Env vars required:
 *   AUDIENCELAB_API_KEY  — your AL API key (X-API-KEY header)
 *   AL_SEGMENTS          — JSON mapping client_key → segment_id, e.g.:
 *                          {"waverly-manor":"80c2a238-...","sa-spine":"abc123-..."}
 */

const AL_BASE = 'https://api.audiencelab.io';
const PAGE_SIZE = 200;
const LOOKBACK_HOURS = 25; // slight overlap to avoid gaps

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

  let segmentMap;
  try {
    segmentMap = JSON.parse(process.env.AL_SEGMENTS || '{}');
  } catch {
    return Response.json({ error: 'AL_SEGMENTS is not valid JSON' }, { status: 400 });
  }

  if (Object.keys(segmentMap).length === 0) {
    return Response.json({ error: 'AL_SEGMENTS is empty' }, { status: 400 });
  }

  const sql = getDb();
  const cutoff = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const results = {};

  for (const [clientKey, segmentId] of Object.entries(segmentMap)) {
    console.log(`[${clientKey}] Pulling segment ${segmentId}...`);

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
        const res = await fetch(url, {
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
          const rawEmail = v.PERSONAL_VERIFIED_EMAILS || v.PERSONAL_EMAILS || '';
          const email = rawEmail.includes(',')
            ? rawEmail.split(',')[0].trim().toLowerCase()
            : rawEmail.trim().toLowerCase();

          // Must have either HEM hash or email
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

          // UPSERT: dedup on client_key + HEM SHA256
          try {
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

            if (result.count > 0) {
              // Check if it was an insert or update by looking at visit_count
              // If visit_count = 1 after upsert, it was a new insert
              const check = await sql`
                SELECT visit_count FROM visitors
                WHERE client_key = ${clientKey} AND hem_sha256 = ${dedupKey}
              `;
              if (check[0]?.visit_count === 1) {
                inserted++;
              } else {
                updated++;
              }
            }
          } catch (dbErr) {
            console.error(`[${clientKey}] DB error for ${dedupKey}:`, dbErr.message);
            skipped++;
          }
        }

        hasMore = json.has_more && records.length > 0;
        page++;

        // Safety: if we've gone through many pages of old data, stop early
        if (filtered > fetched * 0.8 && fetched > PAGE_SIZE * 3) {
          console.log(`[${clientKey}] Stopping early — most records older than cutoff`);
          break;
        }
      }

      results[clientKey] = { fetched, inserted, updated, skipped, filtered };
      console.log(`[${clientKey}] Done: ${fetched} fetched, ${inserted} new, ${updated} updated, ${skipped} skipped, ${filtered} outside window`);

    } catch (err) {
      console.error(`[${clientKey}] Pull failed:`, err.message);
      results[clientKey] = { error: err.message };
    }
  }

  return Response.json({
    message: 'Audience Lab pull complete',
    cutoff: cutoff.toISOString(),
    results,
  });
}
