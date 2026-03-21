/**
 * Setup GHL Custom Fields for Pixel Intelligence
 *
 * Creates all custom contact fields in a GoHighLevel sub-account
 * so the push-ghl cron job can write enrichment data.
 *
 * Usage:
 *   GHL_API_KEY=your-key GHL_LOCATION_ID=your-location-id node scripts/setup-ghl-fields.js
 *
 * The script is idempotent — it checks for existing fields first
 * and only creates what's missing.
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';

const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!API_KEY || !LOCATION_ID) {
  console.error('Missing required env vars:');
  if (!API_KEY) console.error('  GHL_API_KEY');
  if (!LOCATION_ID) console.error('  GHL_LOCATION_ID');
  process.exit(1);
}

// ── Field Definitions ────────────────────────────────────────────────
// These match exactly what buildCustomFields() sends in push-ghl/route.js
//
// GHL field types:
//   TEXT, LARGE_TEXT, NUMERICAL, PHONE, EMAIL, DATE,
//   SINGLE_OPTIONS, MULTIPLE_OPTIONS, CHECKBOX, FILE_UPLOAD

const PIXEL_FIELDS = [
  // Core scoring fields
  { name: 'Pixel Score',            key: 'pixel_score',            dataType: 'NUMERICAL',   group: 'Pixel Intelligence' },
  { name: 'Pixel Tier',             key: 'pixel_tier',             dataType: 'SINGLE_OPTIONS', group: 'Pixel Intelligence',
    options: ['HOT', 'High', 'Medium', 'Low'] },
  { name: 'Pixel Source',           key: 'pixel_source',           dataType: 'TEXT',        group: 'Pixel Intelligence' },
  { name: 'Pixel Visits',           key: 'pixel_visits',           dataType: 'NUMERICAL',   group: 'Pixel Intelligence' },
  { name: 'Pixel Last Seen',        key: 'pixel_last_seen',        dataType: 'TEXT',        group: 'Pixel Intelligence' },
  { name: 'Pixel Interests',        key: 'pixel_interests',        dataType: 'LARGE_TEXT',  group: 'Pixel Intelligence' },

  // Confidence
  { name: 'Pixel Confidence',       key: 'pixel_confidence',       dataType: 'SINGLE_OPTIONS', group: 'Pixel Intelligence',
    options: ['High', 'Medium', 'Low'] },
  { name: 'Pixel Confidence Score', key: 'pixel_confidence_score', dataType: 'NUMERICAL',   group: 'Pixel Intelligence' },

  // Demographics
  { name: 'Pixel Age Range',        key: 'pixel_age_range',        dataType: 'TEXT',        group: 'Pixel Demographics' },
  { name: 'Pixel Gender',           key: 'pixel_gender',           dataType: 'SINGLE_OPTIONS', group: 'Pixel Demographics',
    options: ['Male', 'Female'] },
  { name: 'Pixel Income',           key: 'pixel_income',           dataType: 'TEXT',        group: 'Pixel Demographics' },
  { name: 'Pixel Net Worth',        key: 'pixel_net_worth',        dataType: 'TEXT',        group: 'Pixel Demographics' },
  { name: 'Pixel Homeowner',        key: 'pixel_homeowner',        dataType: 'SINGLE_OPTIONS', group: 'Pixel Demographics',
    options: ['Yes', 'No', 'Likely'] },
  { name: 'Pixel Married',          key: 'pixel_married',          dataType: 'SINGLE_OPTIONS', group: 'Pixel Demographics',
    options: ['Yes', 'No', 'Likely'] },
  { name: 'Pixel Children',         key: 'pixel_children',         dataType: 'SINGLE_OPTIONS', group: 'Pixel Demographics',
    options: ['Yes', 'No', 'Likely'] },

  // Employment
  { name: 'Pixel Company',          key: 'pixel_company',          dataType: 'TEXT',        group: 'Pixel Employment' },
  { name: 'Pixel Job Title',        key: 'pixel_job_title',        dataType: 'TEXT',        group: 'Pixel Employment' },
  { name: 'Pixel Industry',         key: 'pixel_industry',         dataType: 'TEXT',        group: 'Pixel Employment' },
];

// ── API Helper ───────────────────────────────────────────────────────

async function ghlFetch(path, options = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
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

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Setting up Pixel custom fields for location: ${LOCATION_ID}\n`);

  // 1. Get existing custom fields
  console.log('Fetching existing custom fields...');
  const existing = await ghlFetch(`/locations/${LOCATION_ID}/customFields`);
  const existingKeys = new Set(
    (existing.customFields || []).map(f => f.fieldKey)
  );

  console.log(`Found ${existingKeys.size} existing custom fields.\n`);

  // 2. Create missing fields
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const field of PIXEL_FIELDS) {
    // Check if already exists (by key)
    if (existingKeys.has(field.key)) {
      console.log(`  ✓ ${field.name} (${field.key}) — already exists`);
      skipped++;
      continue;
    }

    try {
      const body = {
        name: field.name,
        dataType: field.dataType,
        fieldKey: field.key,
        model: 'contact',
        placeholder: '',
      };

      // Add options for dropdown fields
      if (field.options) {
        body.options = field.options;
      }

      await ghlFetch(`/locations/${LOCATION_ID}/customFields`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      console.log(`  + ${field.name} (${field.key}) — CREATED [${field.dataType}]`);
      created++;

      // Rate limit
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      console.error(`  ✗ ${field.name} (${field.key}) — ERROR: ${err.message}`);
      errors++;
    }
  }

  // 3. Summary
  console.log(`\n========== COMPLETE ==========`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped} (already exist)`);
  console.log(`Errors:  ${errors}`);
  console.log(`\nTotal Pixel fields: ${PIXEL_FIELDS.length}`);
  console.log(`Location: ${LOCATION_ID}`);

  if (created > 0) {
    console.log(`\nCustom fields are ready. The push-ghl cron job will now`);
    console.log(`populate these fields when pushing contacts to GHL.`);
  }

  if (errors > 0) {
    console.log(`\n⚠️  Some fields failed. Check the errors above.`);
    console.log(`You may need to create those manually in GHL Settings → Custom Fields.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
