/**
 * Intent Scoring Engine
 *
 * Points-based model:
 *   Visit frequency:   7+ visits = +30, 4-6 = +15, 2-3 = +5
 *   Procedure pages:   Each unique procedure/condition page = +25 (cap 3)
 *   High-intent pages: Contact, pricing, gallery, scheduling = +30 each (cap 2)
 *   Provider research: Doctor/team pages = +15
 *   Recency:           Last 3 days = +15, last 7 days = +10
 *
 * Tiers:
 *   HOT:    55+   → Immediate outreach (multi-signal: research + high-intent + recency)
 *   High:   25-54 → Priority nurture (researching specific condition/procedure)
 *   Medium:  5-24 → Standard follow-up (repeat visitor, no specific research)
 *   Low:     <5   → Awareness/newsletter (single visit, no classified pages)
 */

const HIGH_INTENT_CATEGORIES = new Set(["High Intent"]);
const PROVIDER_CATEGORIES = new Set(["Provider Research"]);
const RESEARCH_CATEGORIES = new Set([
  "Surgical Procedures", "Conditions", "Services",
  "Facial Procedures", "Body Procedures", "Breast Procedures",
  "Non-Surgical", "Product Features", "Industries", "Lead Magnet"
]);

/**
 * Score a visitor based on their classified page views
 *
 * @param {Object} visitor - Visitor object from KV
 * @param {Array} classifications - Array of { category, subcategory } from all page views
 * @returns {{ score: number, tier: string }}
 */
export function scoreIntent(visitor, classifications) {
  let score = 0;

  // ── Visit Frequency ──
  const visits = visitor.visit_count || 1;
  if (visits >= 7) score += 30;
  else if (visits >= 4) score += 15;
  else if (visits >= 2) score += 5;

  // ── Procedure/Service Pages ──
  const researchPages = new Set();
  for (const c of classifications) {
    if (RESEARCH_CATEGORIES.has(c.category)) {
      researchPages.add(c.subcategory);
    }
  }
  score += Math.min(researchPages.size, 3) * 25;

  // ── High Intent Pages ──
  const highIntentPages = new Set();
  for (const c of classifications) {
    if (HIGH_INTENT_CATEGORIES.has(c.category)) {
      highIntentPages.add(c.subcategory);
    }
  }
  score += Math.min(highIntentPages.size, 2) * 30;

  // ── Provider Research ──
  const hasProviderResearch = classifications.some(c => PROVIDER_CATEGORIES.has(c.category));
  if (hasProviderResearch) score += 15;

  // ── Recency ──
  if (visitor.last_visit) {
    const lastVisit = new Date(visitor.last_visit);
    const daysSince = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince <= 3) score += 15;
    else if (daysSince <= 7) score += 10;
  }

  // ── Determine Tier ──
  let tier;
  if (score >= 55) tier = "HOT";
  else if (score >= 25) tier = "High";
  else if (score >= 5) tier = "Medium";
  else tier = "Low";

  return { score, tier };
}

/**
 * Extract unique interests from classifications
 * Only includes research categories (procedures, conditions, services, etc.)
 */
export function extractInterests(classifications) {
  const interests = new Set();
  for (const c of classifications) {
    if (RESEARCH_CATEGORIES.has(c.category)) {
      interests.add(c.subcategory);
    }
  }
  return [...interests];
}

/**
 * Generate GHL-compatible tags from a scored visitor
 */
export function generateTags(tier, interests, referrerSource) {
  const tags = [
    "pixel-identified",
    `pixel-${tier.toLowerCase()}`
  ];

  for (const interest of interests) {
    const slug = interest.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    tags.push(`interest-${slug}`);
  }

  if (referrerSource && referrerSource !== "Direct") {
    const sourceSlug = referrerSource.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    tags.push(`source-${sourceSlug}`);
  }

  return tags;
}
