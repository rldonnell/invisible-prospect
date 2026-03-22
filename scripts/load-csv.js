#!/usr/bin/env node
/**
 * Bulk CSV Loader — reads an Audience Lab CSV export and POSTs
 * visitors to the pixel webhook in batches of 100.
 *
 * Usage:
 *   node scripts/load-csv.js <csv-path> <client-key> <webhook-secret>
 *
 * Example:
 *   node scripts/load-csv.js ./data/sa-spine-export.csv sa-spine my_secret_here
 *
 * Optionally set WEBHOOK_URL env var (defaults to https://invisible-prospect.vercel.app)
 */

const fs = require('fs');
const path = require('path');

const BATCH_SIZE = 100;
const DELAY_MS = 500; // pause between batches to avoid hammering

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return rows;
}

async function sendBatch(visitors, clientKey, webhookUrl, webhookSecret) {
  const res = await fetch(`${webhookUrl}/api/webhook/pixel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${webhookSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_key: clientKey,
      visitors,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json();
}

async function main() {
  const [,, csvPath, clientKey, webhookSecret] = process.argv;

  if (!csvPath || !clientKey || !webhookSecret) {
    console.error('Usage: node scripts/load-csv.js <csv-path> <client-key> <webhook-secret>');
    process.exit(1);
  }

  const webhookUrl = process.env.WEBHOOK_URL || 'https://invisible-prospect.vercel.app';

  console.log(`Loading CSV: ${csvPath}`);
  const visitors = parseCSV(path.resolve(csvPath));
  console.log(`Parsed ${visitors.length} visitors for client "${clientKey}"`);
  console.log(`Sending to: ${webhookUrl}/api/webhook/pixel`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let batchNum = 0;

  for (let i = 0; i < visitors.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = visitors.slice(i, i + BATCH_SIZE);

    try {
      const result = await sendBatch(batch, clientKey, webhookUrl, webhookSecret);
      totalNew += result.new || 0;
      totalUpdated += result.updated || 0;
      totalSkipped += result.skipped || 0;
      console.log(`  Batch ${batchNum}: ${batch.length} sent -> ${result.new} new, ${result.updated} updated, ${result.skipped} skipped`);
    } catch (err) {
      console.error(`  Batch ${batchNum}: FAILED - ${err.message}`);
    }

    // Pause between batches
    if (i + BATCH_SIZE < visitors.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n========== COMPLETE ==========`);
  console.log(`Total visitors: ${visitors.length}`);
  console.log(`New:     ${totalNew}`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Skipped: ${totalSkipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
