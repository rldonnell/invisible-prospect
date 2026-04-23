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
 * Tiers (page-view signals can reach High but NOT HOT):
 *   High:   25+   → Strong interest from site behavior (research + recency + depth)
 *   Medium: 5-24  → Standard follow-up (repeat visitor, no specific research)
 *   Low:    <5    → Awareness/newsletter (single visit, no classified pages)
 *
 * HOT is reserved for leads that have opened or clicked an Instantly outreach
 * email. That engagement both validates the email address and confirms real
 * interest, so it is the only path to HOT. Promotion happens in the Instantly
 * webhook handler (app/api/webhook/instantly/route.js), which stamps the
 * `email-re-engaged` tag when it flips a visitor's intent_tier to HOT.
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

  // Compute unique page depth (by pathname) — used by multiple checks below.
  // A visitor who hits the same pathname N times with different query strings
  // (common for paid-ad landing pages) counts as 1 unique page.
  const pages = visitor.pages_visited || [];
  const uniquePaths = new Set(pages.map(p => {
    try { return new URL(p).pathname; } catch { return p; }
  }));
  const singlePage = uniquePaths.size <= 1;

  // ── Visit Frequency ──
  // If the visitor has only viewed one unique page, halve the frequency bonus.
  // Real intent shows as browsing depth; ad-noise/retargeting shows as repeated
  // hits on a single landing page.
  const visits = visitor.visit_count || 1;
  let freqBonus = 0;
  if (visits >= 7) freqBonus = 30;
  else if (visits >= 4) freqBonus = 15;
  else if (visits >= 2) freqBonus = 5;
  if (singlePage) freqBonus = Math.floor(freqBonus / 2);
  score += freqBonus;

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
  // Page-view signals top out at High. HOT is reserved for email-engaged leads
  // and is set by the Instantly webhook handler, not by scoring.
  let tier;
  if (score >= 25) tier = "High";
  else if (score >= 5) tier = "Medium";
  else tier = "Low";

  return { score, tier };
}

/**
 * Detect return-visitor pattern: visited on 2+ distinct calendar dates AND
 * viewed 2+ unique pathnames. The multi-page requirement filters out
 * ad-retargeting loops where the same landing page is hit repeatedly across
 * days without any real browsing.
 *
 * Dates are compared in UTC (YYYY-MM-DD from ISO timestamp). A visitor whose
 * first_visit and last_visit fall on the same UTC date is NOT a return visitor
 * even if visit_count is high — they just had a busy session.
 *
 * Used by process-visitors to promote qualified return visitors to the HOT
 * tier and apply a 'return-visitor' tag that flows to GHL.
 *
 * @param {Object} visitor - Visitor row with first_visit, last_visit, visit_count, pages_visited
 * @returns {boolean}
 */
export function detectReturnVisitor(visitor) {
  const visits = visitor.visit_count || 1;
  if (visits < 2) return false;
  if (!visitor.first_visit || !visitor.last_visit) return false;

  const firstDate = new Date(visitor.first_visit).toISOString().slice(0, 10);
  const lastDate = new Date(visitor.last_visit).toISOString().slice(0, 10);
  if (firstDate === lastDate) return false;

  const pages = visitor.pages_visited || [];
  const uniquePaths = new Set(pages.map(p => {
    try { return new URL(p).pathname; } catch { return p; }
  }));
  if (uniquePaths.size < 2) return false;

  return true;
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
 *   -40  Extreme visit count (500+, almost certainly bot/pixel noise)
 *   -35  555 phone number (always fictional)
 *   -30  Suspicious email pattern (test@, jane.doe@, etc.)
 *   -25  High visit count (100-500, suspicious)
 *   -25  Bot-like visit-to-page ratio (15:1+, e.g. 60 visits / 3 pages)
 *   -20  Name doesn't match ANY email address
 *   -20  High velocity (10+ visits/day sustained)
 *   -15  Elevated visit count (40-100)
 *   -15  High visit count but only 1 unique page (ad clicker pattern)
 *   -10  Repetitive pattern (8:1+ visit-to-page ratio)
 *   -10  Elevated velocity (5-10 visits/day sustained)
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
    score -= 40;
    flags.push('extreme-visit-count');
  } else if (visits > 100) {
    score -= 25;
    flags.push('high-visit-count');
  } else if (visits > 40) {
    score -= 15;
    flags.push('elevated-visit-count');
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

  // Bot-like ratio: many visits relative to unique pages viewed
  // Real users explore; bots/noise hammer the same few pages
  if (visits >= 20 && uniquePages.size > 0) {
    const ratio = visits / uniquePages.size;
    if (ratio >= 15) {
      // e.g. 60 visits / 3 pages = 20:1 ratio — very suspicious
      score -= 25;
      flags.push('bot-like-ratio');
    } else if (ratio >= 8) {
      // e.g. 40 visits / 4 pages = 10:1 ratio — moderately suspicious
      score -= 10;
      flags.push('repetitive-pattern');
    }
  }

  // Velocity check: many visits crammed into a very short window
  if (visitor.first_visit && visitor.last_visit && visits >= 15) {
    const first = new Date(visitor.first_visit);
    const last = new Date(visitor.last_visit);
    const daySpan = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
    const visitsPerDay = visits / daySpan;
    if (visitsPerDay >= 10) {
      // 10+ visits per day sustained — almost certainly not a real patient
      score -= 20;
      flags.push('high-velocity');
    } else if (visitsPerDay >= 5) {
      score -= 10;
      flags.push('elevated-velocity');
    }
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

// ═══════════════════════════════════════════════════════════════
// PRIMARY INTEREST & CAMPAIGN BUCKET ASSIGNMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Campaign bucket priority (highest number wins)
 */
const BUCKET_PRIORITY = {
  general_interest: 1,
  return_visitor: 2,
  condition_research: 3,
  procedure_treatment: 4,
  provider_research: 5,
  ready_to_book: 6,
};

/**
 * Map taxonomy categories → campaign buckets
 */
const CATEGORY_TO_BUCKET = {
  'High Intent':          'ready_to_book',
  'Provider Research':    'provider_research',
  'Surgical Procedures':  'procedure_treatment',
  'Non-Surgical':         'procedure_treatment',
  'Services':             'procedure_treatment',
  'Facial Procedures':    'procedure_treatment',
  'Body Procedures':      'procedure_treatment',
  'Breast Procedures':    'procedure_treatment',
  'Product Features':     'procedure_treatment',
  'Industries':           'procedure_treatment',
  'Event Types':          'condition_research',
  'Venue Features':       'procedure_treatment',
  'Conditions':           'condition_research',
  'Lead Magnet':          'general_interest',
  'Content':              'general_interest',
};

/**
 * Determine the primary interest for a visitor.
 *
 * Algorithm:
 *   1. Count page views per classified subcategory
 *   2. Rank by count descending
 *   3. Break ties by last occurrence index (most recent wins)
 *   4. Return the top subcategory, or null if no classified pages
 *
 * @param {Array} classifications - Array of { category, subcategory } from all page views (in visit order)
 * @returns {string|null} The primary interest subcategory, or null
 */
export function determinePrimaryInterest(classifications) {
  if (!classifications || classifications.length === 0) return null;

  // Only count research-relevant categories (skip High Intent and Provider Research
  // for interest naming — those affect bucket, not the interest label)
  const INTEREST_CATEGORIES = new Set([
    'Surgical Procedures', 'Conditions', 'Services',
    'Facial Procedures', 'Body Procedures', 'Breast Procedures',
    'Non-Surgical', 'Product Features', 'Industries',
    'Event Types', 'Venue Features', 'Lead Magnet', 'Content',
  ]);

  const counts = {};      // subcategory → count
  const lastSeen = {};    // subcategory → last index in classifications array

  for (let i = 0; i < classifications.length; i++) {
    const { category, subcategory } = classifications[i];
    if (!INTEREST_CATEGORIES.has(category)) continue;
    counts[subcategory] = (counts[subcategory] || 0) + 1;
    lastSeen[subcategory] = i;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  // Sort by count descending, then by recency (lastSeen index) descending
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];           // higher count first
    return (lastSeen[b[0]] || 0) - (lastSeen[a[0]] || 0);  // more recent first
  });

  return entries[0][0]; // subcategory name
}

/**
 * Determine the campaign bucket for a visitor.
 *
 * Uses the highest-priority bucket from all classified page categories.
 * Ready to Book > Provider Research > Procedure/Treatment > Condition Research > General Interest
 *
 * Return Visitor bucket is handled separately by the caller (requires multi-session gap check).
 *
 * @param {Array} classifications - Array of { category, subcategory } from all page views
 * @param {Object} visitor - Visitor object (for return-visitor detection)
 * @returns {string} Campaign bucket key
 */
export function determineCampaignBucket(classifications, visitor) {
  // Check for return visitor pattern:
  // 2+ visits with a gap > 7 days, AND no high-intent pages
  if (visitor && visitor.first_visit && visitor.last_visit && (visitor.visit_count || 1) >= 2) {
    const first = new Date(visitor.first_visit);
    const last = new Date(visitor.last_visit);
    const daySpan = (last - first) / (1000 * 60 * 60 * 24);
    const hasHighIntent = classifications.some(c => c.category === 'High Intent');

    // If they have a 7+ day gap but no high-intent pages, they might be a return visitor
    // But only if no other higher-priority bucket applies
    if (daySpan >= 7 && !hasHighIntent) {
      // Check if they have any classified research pages
      const hasResearch = classifications.some(c =>
        CATEGORY_TO_BUCKET[c.category] && CATEGORY_TO_BUCKET[c.category] !== 'general_interest'
      );
      // If no specific research, they're a return visitor
      if (!hasResearch) {
        return 'return_visitor';
      }
    }
  }

  if (!classifications || classifications.length === 0) {
    return 'general_interest';
  }

  // Find the highest-priority bucket from all page classifications
  let bestBucket = 'general_interest';
  let bestPriority = BUCKET_PRIORITY.general_interest;

  for (const { category } of classifications) {
    const bucket = CATEGORY_TO_BUCKET[category];
    if (bucket && BUCKET_PRIORITY[bucket] > bestPriority) {
      bestBucket = bucket;
      bestPriority = BUCKET_PRIORITY[bucket];
    }
  }

  return bestBucket;
}

/**
 * Determine if a visitor is eligible for email outreach.
 *
 * Requirements:
 *   - Has an email address
 *   - Has a campaign bucket assigned
 *   - Confidence score >= 40 (Medium+)
 *
 * @param {Object} visitor - Visitor object
 * @param {string} campaignBucket - Assigned bucket
 * @param {number} confidenceScore - Confidence score (0-100)
 * @returns {boolean}
 */
export function isEmailEligible(visitor, campaignBucket, confidenceScore) {
  const hasEmail = !!(visitor.email || visitor.all_emails || '').trim();
  const hasBucket = !!campaignBucket;
  const meetsConfidence = confidenceScore >= 40;
  return hasEmail && hasBucket && meetsConfidence;
}
