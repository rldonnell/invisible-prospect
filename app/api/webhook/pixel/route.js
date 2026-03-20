import { getDb } from '../../../../lib/db';

/**
 * POST /api/webhook/pixel
 *
 * Receives pixel visitor data via webhook and upserts into Neon Postgres.
 * Supports two formats:
 *
 * 1. Single visitor event (real-time webhook from pixel platform):
 *    { "client_key": "sa-spine", "visitor": { ...fields } }
 *
 * 2. Batch upload (array of visitors from CSV export):
 *    { "client_key": "sa-spine", "visitors": [ { ...fields }, ... ] }
 *
 * Visitor fields expected (matching pixel CSV export columns):
 *   FIRST_NAME, LAST_NAME, PERSONAL_VERIFIED_EMAILS, ALL_MOBILES,
 *   PERSONAL_CITY, PERSONAL_STATE, AGE_RANGE, GENDER, INCOME_RANGE,
 *   NET_WORTH, FULL_URL, REFERRER_URL, EVENT_TIMESTAMP
 */
export async function POST(request) {
  // Auth guard
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
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
      // Extract email as primary key
      const rawEmail = v.PERSONAL_VERIFIED_EMAILS || v.email || '';
      const email = rawEmail.includes(',')
        ? rawEmail.split(',')[0].trim().toLowerCase()
        : rawEmail.trim().toLowerCase();

      if (!email || !email.includes('@')) {
        skipped++;
        continue;
      }

      const fullUrl = v.FULL_URL || v.full_url || '';
      const referrer = v.REFERRER_URL || v.referrer_url || '';
      const timestamp = v.EVENT_TIMESTAMP || v.timestamp || new Date().toISOString();

      const phone = v.ALL_MOBILES || v.ALL_LANDLINES || v.phone || '';
      const primaryPhone = phone.includes(',') ? phone.split(',')[0].trim() : phone.trim();

      const firstName = (v.FIRST_NAME || v.first_name || '').trim();
      const lastName = (v.LAST_NAME || v.last_name || '').trim();
      const city = (v.PERSONAL_CITY || v.city || '').trim();
      const state = (v.PERSONAL_STATE || v.state || '').trim();
      const ageRange = v.AGE_RANGE || v.age_range || '';
      const gender = v.GENDER || v.gender || '';
      const income = v.INCOME_RANGE || v.income || '';
      const netWorth = v.NET_WORTH || v.net_worth || '';
      const linkedin = v.INDIVIDUAL_LINKEDIN_URL || v.linkedin || '';

      // UPSERT: insert new visitor or update existing with accumulated data
      const result = await sql`
        INSERT INTO visitors (
          client_key, email, first_name, last_name, phone,
          city, state, age_range, gender, income, net_worth, linkedin,
          visit_count, first_visit, last_visit,
          pages_visited, referrers, processed
        ) VALUES (
          ${client_key}, ${email}, ${firstName}, ${lastName}, ${primaryPhone},
          ${city}, ${state}, ${ageRange}, ${gender}, ${income}, ${netWorth}, ${linkedin},
          1, ${timestamp}::timestamptz, ${timestamp}::timestamptz,
          ${fullUrl ? JSON.stringify([fullUrl]) : '[]'}::jsonb,
          ${referrer ? JSON.stringify([referrer]) : '[]'}::jsonb,
          FALSE
        )
        ON CONFLICT (client_key, email) DO UPDATE SET
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
