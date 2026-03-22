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

/**
 * Resolve the GHL API key for a given client.
 * Checks for per-client key first (GHL_API_KEY_FOUR_WINDS),
 * then falls back to the shared agency-level GHL_API_KEY.
 */
function resolveApiKey(clientKey) {
  const envKey = `GHL_API_KEY_${clientKey.replace(/-/g, '_').toUpperCase()}`;
  return process.env[envKey] || process.env.GHL_API_KEY || '';
}

async function ghlFetch(path, apiKey, options = {}) {
  if (!apiKey) throw new Error('GHL API key not configured');

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

async function findContact(email, locationId, apiKey) {
  try {
    const data = await ghlFetch(
      `/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}&limit=1`,
      apiKey
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
  if (visitor.confidence) fields.push({ key: 'pixel_confidence', field_value: visitor.confidence });
  if (visitor.confidence_score) fields.push({ key: 'pixel_confidence_score', field_value: String(visitor.confidence_score) });
  return fields;
}

function buildTags(visitor) {
  // Always tag with "Visitor ID" so GHL can filter pixel-identified contacts
  const tags = ['Visitor ID'];

  // Tier tag — this drives GHL workflow triggers
  if (visitor.intent_tier) {
    tags.push(visitor.intent_tier); // "HOT", "High", or "Medium"
  }

  // Confidence tag if available
  if (visitor.confidence) {
    tags.push(`Confidence: ${visitor.confidence}`);
  }

  // Append any system-generated tags (conditions, interests)
  if (Array.isArray(visitor.tags)) {
    for (const t of visitor.tags) {
      if (!tags.includes(t)) tags.push(t);
    }
  }

  return tags;
}

async function createContact(visitor, locationId, apiKey) {
  return ghlFetch('/contacts/', apiKey, {
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
      tags: buildTags(visitor),
      customFields: buildCustomFields(visitor),
      source: 'P5 Pixel Intelligence',
    }),
  });
}

async function updateContact(contactId, visitor, locationId, apiKey) {
  return ghlFetch(`/contacts/${contactId}`, apiKey, {
    method: 'PUT',
    body: JSON.stringify({
      locationId,
      tags: buildTags(visitor),
      customFields: buildCustomFields(visitor),
    }),
  });
}

// Allow up to 60 seconds per invocation (Vercel Pro)
export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const singleClient = searchParams.get('client');
    // Batch size — keep small to stay within Vercel 60s timeout
    // Each contact needs ~2 API calls + DB write + delay ≈ 3s each
    const batchSize = parseInt(searchParams.get('limit')) || 10;

    const activeClients = singleClient
      ? [singleClient]
      : (process.env.ACTIVE_CLIENTS || '').split(',').map(s => s.trim()).filter(Boolean);

    const defaultLocationId = process.env.GHL_LOCATION_ID;

    const results = {};

    for (const clientKey of activeClients) {
      // Resolve per-client API key (falls back to shared GHL_API_KEY)
      const apiKey = resolveApiKey(clientKey);
      if (!apiKey) {
        results[clientKey] = { error: 'No GHL API key configured' };
        continue;
      }

      const envKey = `GHL_LOCATION_${clientKey.replace(/-/g, '_').toUpperCase()}`;
      const locationId = process.env[envKey] || defaultLocationId;

      if (!locationId) {
        results[clientKey] = { error: 'No GHL_LOCATION_ID configured' };
        continue;
      }

      // Count total remaining before we start
      const [remaining] = await sql`
        SELECT COUNT(*)::int as count FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = TRUE AND ghl_pushed = FALSE
          AND intent_tier IN ('HOT', 'High', 'Medium')
      `;

      // Log the push run
      const [run] = await sql`
        INSERT INTO processing_runs (client_key, run_type)
        VALUES (${clientKey}, 'ghl_push')
        RETURNING id
      `;

      // Query a BATCH of processed visitors that haven't been pushed yet
      // Only push Medium+ tier (skip Low to reduce noise)
      const toPush = await sql`
        SELECT id, email, first_name, last_name, phone,
               city, state, address, zip, visit_count, last_visit,
               age_range, gender, income, net_worth, homeowner, married, children,
               company_name, job_title, company_industry, department, seniority_level,
               intent_score, intent_tier, interests,
               referrer_source, tags,
               confidence, confidence_score
        FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = TRUE
          AND ghl_pushed = FALSE
          AND intent_tier IN ('HOT', 'High', 'Medium')
        ORDER BY intent_score DESC
        LIMIT ${batchSize}
      `;

      let created = 0;
      let updated = 0;
      let errors = 0;
      let skipped = 0;
      const errorDetails = [];

      for (const visitor of toPush) {
        try {
          // Skip visitors with no email — GHL requires email to create/find contacts
          if (!visitor.email) {
            await sql`
              UPDATE visitors SET ghl_pushed = TRUE, ghl_pushed_at = NOW()
              WHERE id = ${visitor.id}
            `;
            skipped++;
            continue;
          }

          const existing = await findContact(visitor.email, locationId, apiKey);

          let ghlContactId = null;
          if (existing) {
            await updateContact(existing.id, visitor, locationId, apiKey);
            ghlContactId = existing.id;
            updated++;
          } else {
            const result = await createContact(visitor, locationId, apiKey);
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
          errorDetails.push({
            email: visitor.email || '(no email)',
            id: visitor.id,
            error: pushError.message.slice(0, 300),
          });

          // If we get a rate limit error, stop this batch
          if (pushError.message.includes('429') || pushError.message.includes('rate')) {
            console.warn('Rate limited — stopping batch early');
            break;
          }
        }

        // Rate limit: ~80 requests/min (750ms between contacts)
        await new Promise(resolve => setTimeout(resolve, 750));
      }

      const remainingAfter = remaining.count - (created + updated);

      // Update run log
      await sql`
        UPDATE processing_runs SET
          completed_at = NOW(),
          total_visitors = ${toPush.length},
          processed = ${created + updated},
          errors = ${errors},
          details = ${JSON.stringify({ created, updated, remaining: Math.max(0, remainingAfter) })}::jsonb
        WHERE id = ${run.id}
      `;

      results[clientKey] = {
        batch: toPush.length,
        created,
        updated,
        skipped,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        remaining: Math.max(0, remainingAfter),
        done: remainingAfter <= 0,
      };
    }

    console.log('GHL push batch complete:', JSON.stringify(results));
    return Response.json({ success: true, results });

  } catch (error) {
    console.error('GHL push error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
