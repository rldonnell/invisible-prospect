import { getDb } from '../../../../lib/db';

/**
 * POST /api/webhook/pixel
 *
 * Receives pixel visitor data via webhook and upserts into Neon Postgres.
 * Deduplicates on HEM_SHA256 (identity hash) — NOT email address.
 * This ensures visitors with multiple emails are consolidated into one record.
 *
 * Supports two formats:
 *
 * 1. Single visitor event (real-time webhook from pixel platform):
 *    { "client_key": "sa-spine", "visitor": { ...fields } }
 *
 * 2. Batch upload (array of visitors from CSV export or Audience Lab webhook):
 *    { "client_key": "sa-spine", "visitors": [ { ...fields }, ... ] }
 *
 * Accepts BOTH Audience Lab native column names (UPPER_CASE) and
 * normalized lowercase names for flexibility.
 */
export async function POST(request) {
  // Auth guard — accepts either:
  //   Authorization: Bearer <secret>   (standard)
  //   x-webhook-secret: <secret>       (Audience Lab compat)
  const authHeader = request.headers.get('authorization');
  const xSecret = request.headers.get('x-webhook-secret');
  const secret = process.env.WEBHOOK_SECRET;
  const authorized =
    authHeader === `Bearer ${secret}` ||
    xSecret === secret;
  if (!authorized) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const sql = getDb();
    const body = await request.json();
    const { client_key, visitor, visitors } = body;

    if (!client_key) {
      return Response.json({ error: 'client_key is required' }, { status: 400 });
    }

    // Normalize to array
    const visitorList = visitors || (visitor ? [visitor] : []);

    if (visitorList.length === 0) {
      return Response.json({ error: 'No visitor data provided' }, { status: 400 });
    }

    let newCount = 0;
    let updatedCount = 0;
    let skipped = 0;

    for (const v of visitorList) {
      // ── HEM SHA256 (primary dedup key) ──
      const hemSha256 = (v.HEM_SHA256 || v.hem_sha256 || '').trim();

      // ── Email (stored for contact, but NOT used for dedup) ──
      const rawEmail = v.PERSONAL_VERIFIED_EMAILS || v.personal_verified_emails || v.email || '';
      const email = rawEmail.includes(',')
        ? rawEmail.split(',')[0].trim().toLowerCase()
        : rawEmail.trim().toLowerCase();

      // Must have either HEM hash or email — HEM preferred
      if (!hemSha256 && (!email || !email.includes('@'))) {
        skipped++;
        continue;
      }

      // If no HEM hash provided, generate a simple one from email
      // This ensures backwards compatibility with non-Audience-Lab sources
      const dedupKey = hemSha256 || `email:${email}`;

      // ── Core fields ──
      const fullUrl    = v.FULL_URL || v.full_url || '';
      const referrer   = v.REFERRER_URL || v.referrer_url || '';
      const timestamp  = v.EVENT_TIMESTAMP || v.event_timestamp || v.timestamp || new Date().toISOString();

      const phone      = v.ALL_MOBILES || v.all_mobiles || v.ALL_LANDLINES || v.all_landlines || v.phone || '';
      const primaryPhone = phone.includes(',') ? phone.split(',')[0].trim() : phone.trim();

      const firstName  = (v.FIRST_NAME || v.first_name || '').trim();
      const lastName   = (v.LAST_NAME || v.last_name || '').trim();
      const city       = (v.PERSONAL_CITY || v.personal_city || v.city || '').trim();
      const state      = (v.PERSONAL_STATE || v.personal_state || v.state || '').trim();
      const ageRange   = v.AGE_RANGE || v.age_range || '';
      const gender     = v.GENDER || v.gender || '';
      const income     = v.INCOME_RANGE || v.income_range || v.income || '';
      const netWorth   = v.NET_WORTH || v.net_worth || '';
      const linkedin   = v.INDIVIDUAL_LINKEDIN_URL || v.individual_linkedin_url || v.linkedin || '';

      // ── Enrichment: Address & Demographics ──
      const address    = (v.PERSONAL_ADDRESS || v.personal_address || v.address || '').trim();
      const zip        = (v.PERSONAL_ZIP || v.personal_zip || v.zip || '').trim();
      const homeowner  = (v.HOMEOWNER || v.homeowner || '').trim();
      const married    = (v.MARRIED || v.married || '').trim();
      const children   = (v.CHILDREN || v.children || '').trim();

      // ── Enrichment: Employer / B2B ──
      const companyName     = (v.COMPANY_NAME || v.company_name || '').trim();
      const jobTitle        = (v.JOB_TITLE || v.job_title || '').trim();
      const companyIndustry = (v.COMPANY_INDUSTRY || v.company_industry || '').trim();
      const companySize     = (v.COMPANY_EMPLOYEE_COUNT || v.company_employee_count || v.company_size || '').trim();
      const companyRevenue  = (v.COMPANY_REVENUE || v.company_revenue || '').trim();
      const department      = (v.DEPARTMENT || v.department || '').trim();
      const seniorityLevel  = (v.SENIORITY_LEVEL || v.seniority_level || '').trim();

      // ── Enrichment: Identity & Emails ──
      const allEmails    = (v.PERSONAL_EMAILS || v.personal_emails || v.all_emails || '').trim();
      const businessEmail = (v.BUSINESS_EMAIL || v.BUSINESS_VERIFIED_EMAILS || v.business_email || '').trim();
      const pixelId      = (v.PIXEL_ID || v.pixel_id || '').trim();
      const edid         = (v.EDID || v.edid || '').trim();

      // ── Enrichment: Social & Skills ──
      const facebookUrl  = (v.INDIVIDUAL_FACEBOOK_URL || v.individual_facebook_url || v.facebook_url || '').trim();
      const twitterUrl   = (v.INDIVIDUAL_TWITTER_URL || v.individual_twitter_url || v.twitter_url || '').trim();
      const skills       = (v.SKILLS || v.skills || '').trim();
      const alInterests  = (v.INTERESTS || v.interests_raw || v.al_interests || '').trim();

      // UPSERT: dedup on HEM SHA256, NOT email
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
          ${client_key}, ${dedupKey}, ${email}, ${firstName}, ${lastName}, ${primaryPhone},
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
          -- Update email if we get a better one (non-empty replacing empty)
          email = CASE WHEN visitors.email = '' AND ${email} != '' THEN ${email} ELSE visitors.email END,
          -- Update enrichment fields only if they were empty before
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
          facebook_url = CASE WHEN visitors.facebook_url = '' AND ${facebookUrl} != '' THEN ${facebookUrl} ELSE visitors.facebook_url END,
          twitter_url = CASE WHEN visitors.twitter_url = '' AND ${twitterUrl} != '' THEN ${twitterUrl} ELSE visitors.twitter_url END,
          skills = CASE WHEN visitors.skills = '' AND ${skills} != '' THEN ${skills} ELSE visitors.skills END,
          al_interests = CASE WHEN visitors.al_interests = '' AND ${alInterests} != '' THEN ${alInterests} ELSE visitors.al_interests END,
          processed = FALSE
        RETURNING (xmax = 0) AS is_new
      `;

      if (result[0]?.is_new) {
        newCount++;
      } else {
        updatedCount++;
      }
    }

    // Update daily ingestion stats
    await sql`
      INSERT INTO ingestion_stats (client_key, stat_date, total_received, new_visitors, updated_visitors, skipped)
      VALUES (${client_key}, CURRENT_DATE, ${visitorList.length}, ${newCount}, ${updatedCount}, ${skipped})
      ON CONFLICT (client_key, stat_date) DO UPDATE SET
        total_received = ingestion_stats.total_received + ${visitorList.length},
        new_visitors = ingestion_stats.new_visitors + ${newCount},
        updated_visitors = ingestion_stats.updated_visitors + ${updatedCount},
        skipped = ingestion_stats.skipped + ${skipped}
    `;

    console.log(`[${client_key}] Webhook: ${newCount} new, ${updatedCount} updated, ${skipped} skipped`);

    return Response.json({
      success: true,
      client_key,
      new: newCount,
      updated: updatedCount,
      skipped,
      total: visitorList.length
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
