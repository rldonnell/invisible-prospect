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
 *   HOT:    70+   → Immediate outreach (multi-signal: research + high-intent + recency)
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
  if (score >= 70) tier = "HOT";
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
 * Confidence Scoring — How trustworthy is this visitor's identity & intent?
 *
 * Checks:
 *   +25  Name appears in at least one email address
 *   +20  Has verified email
 *   +15  In-market geography (same state as client practice)
 *   +15  Unique pages > 1 (not just homepage ad clicker)
 *   +10  Has phone number
 *   +10  Has enrichment data (company, job title, etc.)
 *   +5   Consistent phone area code with address state
 *
 * Penalties:
 *   -40  Known fake/placeholder name (Jane Doe, John Smith, etc.)
 *   -35  555 phone number (always fictional)
 *   -30  Suspicious email pattern (test@, jane.doe@, etc.)
 *   -30  Extreme visit count (500+, likely bot/pixel noise)
 *   -20  Name doesn't match ANY email address
 *   -15  High visit count (100-500, suspicious)
 *   -15  High visit count but only 1 unique page (ad clicker pattern)
 *   -10  Out-of-state (far from practice)
 *
 * Tiers:
 *   High:   70+   — Strong identity match, likely real prospect
 *   Medium: 40-69 — Some flags, usable but verify
 *   Low:    <40   — Identity mismatch or bot-like behavior
 */

// US state area code mapping (simplified — major codes per state)
const STATE_AREA_CODES = {
  'tx': ['210','214','254','281','325','346','361','409','430','432','469','512','682','713','726','737','806','817','830','832','903','915','936','940','956','972','979'],
  'ca': ['209','213','279','310','323','341','408','415','424','442','510','530','559','562','619','626','628','650','657','661','669','707','714','747','760','805','818','831','858','909','916','925','949','951'],
  'ny': ['212','315','332','347','516','518','585','607','631','646','680','716','718','838','845','914','917','929','934'],
  'fl': ['239','305','321','352','386','407','561','689','727','754','772','786','813','850','863','904','941','954'],
  'nc': ['252','336','704','743','828','910','919','980','984'],
  'ut': ['385','435','801'],
  'az': ['480','520','602','623','928'],
  'il': ['217','224','309','312','331','618','630','708','773','779','815','847','872'],
  'pa': ['215','223','267','272','412','484','570','610','717','724','814','878'],
  'oh': ['216','220','234','283','326','330','380','419','440','513','567','614','740','937'],
  'mi': ['231','248','269','313','517','586','616','734','810','906','947','989'],
  'ga': ['229','404','470','478','678','706','762','770','912','943'],
  'va': ['276','434','540','571','703','757','804'],
};

// Known fake/placeholder names
const FAKE_NAMES = new Set([
  'jane doe', 'john doe', 'john smith', 'jane smith',
  'test user', 'test test', 'foo bar', 'asdf asdf',
  'sample user', 'demo user', 'example user',
]);

// Known test/disposable email patterns
const FAKE_EMAIL_PATTERNS = [
  /^test@/i, /^test\d*@/i, /^jane\.doe@/i, /^john\.doe@/i,
  /^john\.smith@/i, /^example@/i, /^demo@/i, /^sample@/i,
  /^fake@/i, /^noreply@/i, /^no-reply@/i,
];

export function scoreConfidence(visitor, classifications, clientKey) {
  let score = 50; // Start neutral
  const flags = [];

  const firstName = (visitor.first_name || '').toLowerCase().trim();
  const lastName = (visitor.last_name || '').toLowerCase().trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const allEmails = (visitor.all_emails || visitor.email || '').toLowerCase();
  const primaryEmail = (visitor.email || '').toLowerCase().trim();
  const phone = (visitor.phone || '').trim();
  const state = (visitor.state || '').toLowerCase().trim();
  const pages = visitor.pages_visited || [];
  const visits = visitor.visit_count || 1;

  // ══════════════════════════════════════
  // FAKE / SPAM DETECTION (heavy penalties)
  // ══════════════════════════════════════

  // Known placeholder names (Jane Doe, John Smith, etc.)
  if (fullName && FAKE_NAMES.has(fullName)) {
    score -= 40;
    flags.push('fake-name-detected');
  }

  // 555 phone numbers (always fictional)
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    const localPart = digits.length >= 10 ? digits.substring(3, 6) : digits.substring(0, 3);
    if (localPart === '555') {
      score -= 35;
      flags.push('fake-phone-555');
    }
  }

  // Suspicious email patterns (test@, jane.doe@, etc.)
  if (primaryEmail && FAKE_EMAIL_PATTERNS.some(p => p.test(primaryEmail))) {
    score -= 30;
    flags.push('suspicious-email');
  }

  // Statistical outlier visit count (likely bot or pixel noise)
  if (visits > 500) {
    score -= 30;
    flags.push('extreme-visit-count');
  } else if (visits > 100) {
    score -= 15;
    flags.push('high-visit-count');
  }

  // ── Name vs Email Match ──
  if (firstName && allEmails) {
    const emailStr = allEmails.replace(/[^a-z]/g, '');
    if (emailStr.includes(firstName) || emailStr.includes(lastName)) {
      score += 25;
      flags.push('name-matches-email');
    } else {
      score -= 20;
      flags.push('name-email-mismatch');
    }
  }

  // ── Has verified email ──
  if (allEmails && allEmails.includes('@')) {
    score += 10;
  }

  // ── Unique page depth ──
  const uniquePages = new Set(pages.map(p => {
    try { return new URL(p).pathname; } catch { return p; }
  }));

  if (uniquePages.size > 1) {
    score += 15;
    flags.push('multi-page-depth');
  }

  // Ad clicker: high visits but only 1 unique page
  if (visits >= 5 && uniquePages.size <= 1) {
    score -= 15;
    flags.push('ad-clicker-pattern');
  }

  // ── Has enrichment ──
  if (visitor.company_name || visitor.job_title) {
    score += 10;
    flags.push('has-enrichment');
  }

  // ── Has phone ──
  if (phone) {
    score += 5;
  }

  // ── In-market geography ──
  // Determine client practice state from client key
  // Only map clients with a specific geographic market.
  // National companies (four-winds, tbr, dough-babies) are intentionally omitted —
  // no geography bonus/penalty applies to them.
  const CLIENT_STATES = {
    'sa-spine': 'tx',
    'az-breasts': 'az',
    'waverly-manor': 'tx',
  };
  const practiceState = CLIENT_STATES[clientKey];

  if (practiceState && state) {
    if (state === practiceState) {
      score += 15;
      flags.push('in-market');
    } else {
      score -= 10;
      flags.push('out-of-market');
    }
  }

  // ── Phone area code vs address state ──
  if (phone && state) {
    const areaCode = phone.replace(/\D/g, '').substring(0, 3);
    const stateCodes = STATE_AREA_CODES[state];
    if (stateCodes) {
      if (stateCodes.includes(areaCode)) {
        score += 5;
        flags.push('phone-matches-state');
      }
    }
  }

  // ── Has research interest (classified pages, not just homepage) ──
  if (classifications.length > 0) {
    score += 5;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine confidence tier
  let confidence;
  if (score >= 70) confidence = 'High';
  else if (score >= 40) confidence = 'Medium';
  else confidence = 'Low';

  return { confidence, confidenceScore: score, confidenceFlags: flags };
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
