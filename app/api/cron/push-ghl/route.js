import { getDb } from '../../../../lib/db';

/**
 * GET /api/cron/push-ghl
 *
 * Scheduled daily at 7 AM UTC (1 hour after processing).
 * Queries all processed visitors not yet pushed to GHL (Medium+ tier),
 * creates or updates contacts in GoHighLevel with tags and custom fields.
 *
 * Optional query param: ?client=sa-spine (push single client)
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';

async function ghlFetch(path, options = {}) {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error('GHL_API_KEY not configured');

  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL API ${res.status}: ${body}`);
  }

  return res.json();
}

async function findContact(email, locationId) {
  try {
    const data = await ghlFetch(
      `/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}&limit=1`
    );
    return data.contacts?.[0] || null;
  } catch (e) {
    console.error(`GHL lookup failed for ${email}:`, e.message);
    return null;
  }
}

function buildCustomFields(visitor) {
  const fields = [
    { key: 'pixel_score', field_value: String(visitor.intent_score || 0) },
    { key: 'pixel_tier', field_value: visitor.intent_tier || 'Low' },
    { key: 'pixel_source', field_value: visitor.referrer_source || 'Direct' },
    { key: 'pixel_visits', field_value: String(visitor.visit_count || 1) },
    { key: 'pixel_last_seen', field_value: visitor.last_visit || '' },
    { key: 'pixel_interests', field_value: (visitor.interests || []).join(', ') },
  ];
  // Enrichment fields — only send if populated
  if (visitor.age_range) fields.push({ key: 'pixel_age_range', field_value: visitor.age_range });
  if (visitor.gender) fields.push({ key: 'pixel_gender', field_value: visitor.gender });
  if (visitor.income) fields.push({ key: 'pixel_income', field_value: visitor.income });
  if (visitor.net_worth) fields.push({ key: 'pixel_net_worth', field_value: visitor.net_worth });
  if (visitor.homeowner) fields.push({ key: 'pixel_homeowner', field_value: visitor.homeowner });
  if (visitor.married) fields.push({ key: 'pixel_married', field_value: visitor.married });
  if (visitor.children) fields.push({ key: 'pixel_children', field_value: visitor.children });
  if (visitor.company_name) fields.push({ key: 'pixel_company', field_value: visitor.company_name });
  if (visitor.job_title) fields.push({ key: 'pixel_job_title', field_value: visitor.job_title });
  if (visitor.company_industry) fields.push({ key: 'pixel_industry', field_value: visitor.company_industry });
  return fields;
}

async function createContact(visitor, locationId) {
  return ghlFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify({
      locationId,
      firstName: visitor.first_name,
      lastName: visitor.last_name,
      email: visitor.email,
      phone: visitor.phone,
      address1: visitor.address || '',
      city: visitor.city,
      state: visitor.state,
      postalCode: visitor.zip || '',
      tags: visitor.tags || [],
      customFields: buildCustomFields(visitor),
      source: 'P5 Pixel Intelligence',
    }),
  });
}

async function updateContact(contactId, visitor, locationId) {
  return ghlFetch(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify({
      locationId,
      tags: visitor.tags || [],
      customFields: buildCustomFields(visitor),
    }),
  });
}

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

    const defaultLocationId = process.env.GHL_LOCATION_ID;

    if (!process.env.GHL_API_KEY) {
      return Response.json({ error: 'GHL_API_KEY not configured' }, { status: 400 });
    }

    const results = {};

    for (const clientKey of activeClients) {
      const envKey = `GHL_LOCATION_${clientKey.replace(/-/g, '_').toUpperCase()}`;
      const locationId = process.env[envKey] || defaultLocationId;

      if (!locationId) {
        results[clientKey] = { error: 'No GHL_LOCATION_ID configured' };
        continue;
      }

      // Log the push run
      const [run] = await sql`
        INSERT INTO processing_runs (client_key, run_type)
        VALUES (${clientKey}, 'ghl_push')
        RETURNING id
      `;

      // Query processed visitors that haven't been pushed yet
      // Only push Medium+ tier (skip Low to reduce noise)
      const toPush = await sql`
        SELECT id, email, first_name, last_name, phone,
               city, state, address, zip, visit_count, last_visit,
               age_range, gender, income, net_worth, homeowner, married, children,
               company_name, job_title, company_industry, department, seniority_level,
               intent_score, intent_tier, interests,
               referrer_source, tags
        FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = TRUE
          AND ghl_pushed = FALSE
          AND intent_tier IN ('HOT', 'High', 'Medium')
        ORDER BY intent_score DESC
      `;

      let created = 0;
      let updated = 0;
      let errors = 0;

      for (const visitor of toPush) {
        try {
          const existing = await findContact(visitor.email, locationId);

          let ghlContactId = null;
          if (existing) {
            await updateContact(existing.id, visitor, locationId);
            ghlContactId = existing.id;
            updated++;
          } else {
            const result = await createContact(visitor, locationId);
            ghlContactId = result.contact?.id || null;
            created++;
          }

          // Mark as pushed
          await sql`
            UPDATE visitors SET
              ghl_pushed = TRUE,
              ghl_pushed_at = NOW(),
              ghl_contact_id = ${ghlContactId}
            WHERE id = ${visitor.id}
          `;

        } catch (pushError) {
          console.error(`GHL push failed for ${visitor.email}:`, pushError.message);
          errors++;
        }

        // Rate limit: pace at ~50 requests/min
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      // Update run log
      await sql`
        UPDATE processing_runs SET
          completed_at = NOW(),
          total_visitors = ${toPush.length},
          processed = ${created + updated},
          errors = ${errors},
          details = ${JSON.stringify({ created, updated })}::jsonb
        WHERE id = ${run.id}
      `;

      results[clientKey] = { queued: toPush.length, created, updated, errors };
    }

    console.log('GHL push complete:', JSON.stringify(results));
    return Response.json({ success: true, results });

  } catch (error) {
    console.error('GHL push error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
