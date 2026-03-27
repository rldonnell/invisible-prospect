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

// ─── Custom Field Management ───
// Cache: locationId → { fieldName → ghlFieldId }
const customFieldCache = {};

/**
 * Ensure all pixel custom fields exist in GHL for this location.
 * Creates any missing fields and returns a map of name → GHL field ID.
 */
async function ensureCustomFields(locationId, apiKey) {
  // Return cached if available (within same invocation)
  if (customFieldCache[locationId]) return customFieldCache[locationId];

  const fieldMap = {};

  // Fetch existing custom fields
  let existing = [];
  try {
    const data = await ghlFetch(`/locations/${locationId}/customFields`, apiKey);
    existing = data.customFields || [];
  } catch (e) {
    console.error('Failed to fetch custom fields:', e.message);
    // Return empty map — will fall back to key-based fields
    return fieldMap;
  }

  // Fields we need in GHL
  const neededFields = [
    { name: 'Pixel Score', dataType: 'TEXT', key: 'pixel_score' },
    { name: 'Pixel Tier', dataType: 'TEXT', key: 'pixel_tier' },
    { name: 'Pixel Source', dataType: 'TEXT', key: 'pixel_source' },
    { name: 'Pixel Visits', dataType: 'TEXT', key: 'pixel_visits' },
    { name: 'Pixel Last Seen', dataType: 'TEXT', key: 'pixel_last_seen' },
    { name: 'Pixel Interests', dataType: 'TEXT', key: 'pixel_interests' },
    { name: 'Pixel Age Range', dataType: 'TEXT', key: 'pixel_age_range' },
    { name: 'Pixel Gender', dataType: 'TEXT', key: 'pixel_gender' },
    { name: 'Pixel Income', dataType: 'TEXT', key: 'pixel_income' },
    { name: 'Pixel Net Worth', dataType: 'TEXT', key: 'pixel_net_worth' },
    { name: 'Pixel Homeowner', dataType: 'TEXT', key: 'pixel_homeowner' },
    { name: 'Pixel Married', dataType: 'TEXT', key: 'pixel_married' },
    { name: 'Pixel Children', dataType: 'TEXT', key: 'pixel_children' },
    { name: 'Pixel Company', dataType: 'TEXT', key: 'pixel_company' },
    { name: 'Pixel Job Title', dataType: 'TEXT', key: 'pixel_job_title' },
    { name: 'Pixel Industry', dataType: 'TEXT', key: 'pixel_industry' },
    { name: 'Pixel Confidence', dataType: 'TEXT', key: 'pixel_confidence' },
    { name: 'Pixel Confidence Score', dataType: 'TEXT', key: 'pixel_confidence_score' },
  ];

  for (const field of neededFields) {
    // Check if already exists (case-insensitive match on name)
    const found = existing.find(
      (f) => f.name.toLowerCase() === field.name.toLowerCase()
    );
    if (found) {
      fieldMap[field.key] = found.id;
    } else {
      // Create the custom field
      try {
        const result = await ghlFetch(
          `/locations/${locationId}/customFields`,
          apiKey,
          {
            method: 'POST',
            body: JSON.stringify({
              name: field.name,
              dataType: field.dataType,
              placeholder: field.name,
            }),
          }
        );
        if (result.customField) {
          fieldMap[field.key] = result.customField.id;
          console.log(`Created GHL custom field: ${field.name} → ${result.customField.id}`);
        }
      } catch (e) {
        console.warn(`Could not create custom field "${field.name}":`, e.message);
      }
    }
  }

  customFieldCache[locationId] = fieldMap;
  return fieldMap;
}

function buildCustomFields(visitor, fieldMap) {
  const entries = [
    { key: 'pixel_score', field_value: String(visitor.intent_score || 0) },
    { key: 'pixel_tier', field_value: visitor.intent_tier || 'Low' },
    { key: 'pixel_source', field_value: visitor.referrer_source || 'Direct' },
    { key: 'pixel_visits', field_value: String(visitor.visit_count || 1) },
    { key: 'pixel_last_seen', field_value: visitor.last_visit || '' },
    { key: 'pixel_interests', field_value: (visitor.interests || []).join(', ') },
  ];
  // Enrichment fields — only send if populated
  if (visitor.age_range) entries.push({ key: 'pixel_age_range', field_value: visitor.age_range });
  if (visitor.gender) entries.push({ key: 'pixel_gender', field_value: visitor.gender });
  if (visitor.income) entries.push({ key: 'pixel_income', field_value: visitor.income });
  if (visitor.net_worth) entries.push({ key: 'pixel_net_worth', field_value: visitor.net_worth });
  if (visitor.homeowner) entries.push({ key: 'pixel_homeowner', field_value: visitor.homeowner });
  if (visitor.married) entries.push({ key: 'pixel_married', field_value: visitor.married });
  if (visitor.children) entries.push({ key: 'pixel_children', field_value: visitor.children });
  if (visitor.company_name) entries.push({ key: 'pixel_company', field_value: visitor.company_name });
  if (visitor.job_title) entries.push({ key: 'pixel_job_title', field_value: visitor.job_title });
  if (visitor.company_industry) entries.push({ key: 'pixel_industry', field_value: visitor.company_industry });
  if (visitor.confidence) entries.push({ key: 'pixel_confidence', field_value: visitor.confidence });
  if (visitor.confidence_score) entries.push({ key: 'pixel_confidence_score', field_value: String(visitor.confidence_score) });

  // Map key → GHL field ID if we have the mapping, otherwise keep key
  return entries.map(e => {
    if (fieldMap[e.key]) {
      return { id: fieldMap[e.key], field_value: e.field_value };
    }
    // Fallback: use key (works if GHL has the field with this key)
    return e;
  });
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

async function createContact(visitor, locationId, apiKey, fieldMap) {
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
      customFields: buildCustomFields(visitor, fieldMap),
      source: 'P5 Pixel Intelligence',
    }),
  });
}

async function updateContact(contactId, visitor, locationId, apiKey, fieldMap) {
  return ghlFetch(`/contacts/${contactId}`, apiKey, {
    method: 'PUT',
    body: JSON.stringify({
      locationId,
      tags: buildTags(visitor),
      customFields: buildCustomFields(visitor, fieldMap),
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

      // Ensure custom fields exist in GHL (creates missing ones)
      const fieldMap = await ensureCustomFields(locationId, apiKey);

      // Count total remaining before we start
      // FIX: Include visitors with empty/NULL confidence (pre-confidence-scoring visitors)
      // These are still valid — they were processed before confidence scoring was added
      const [remaining] = await sql`
        SELECT COUNT(*)::int as count FROM visitors
        WHERE client_key = ${clientKey}
          AND processed = TRUE AND ghl_pushed = FALSE
          AND intent_tier IN ('HOT', 'High', 'Medium')
          AND (confidence IN ('High', 'Medium') OR confidence IS NULL OR confidence = '')
      `;

      // Log the push run
      const [run] = await sql`
        INSERT INTO processing_runs (client_key, run_type)
        VALUES (${clientKey}, 'ghl_push')
        RETURNING id
      `;

      // Query a BATCH of processed visitors that haven't been pushed yet
      // Only push Medium+ intent tier
      // Accept High/Medium confidence OR empty/NULL confidence (legacy visitors)
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
          AND (confidence IN ('High', 'Medium') OR confidence IS NULL OR confidence = '')
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
            await updateContact(existing.id, visitor, locationId, apiKey, fieldMap);
            ghlContactId = existing.id;
            updated++;
          } else {
            const result = await createContact(visitor, locationId, apiKey, fieldMap);
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
