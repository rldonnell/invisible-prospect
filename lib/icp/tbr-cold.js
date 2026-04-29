/**
 * lib/icp/tbr-cold.js
 *
 * ICP (Ideal Customer Profile) validator for The Brilliance Revolution
 * COLD outreach pipeline. Used by the Audience Lab cold-segment ingest in
 * app/api/cron/pull-audiencelab/route.js when an AL record arrives with
 * acquisition_source='al_cold' for client_key='tbr'.
 *
 * Source of truth for the ICP: TBR Q1 2026 Marketing Plan (Stephie
 * Althouse, Feb 21 2026). Founder-led, innovation-driven engineering
 * companies in aerospace, defense, mechanical, industrial, and medical
 * equipment manufacturing. Revenue band $10-30M (mid-tier subcontractors)
 * and $30-150M (scaling organizations).
 *
 * Core message we're qualifying for: "Your expertise must outlive your
 * experts." The pitch lands on founders who feel the weight of being the
 * single point of failure for technical judgment, customer relationships,
 * and institutional memory.
 *
 * As with FW cold, the AL segment does the heavy targeting work upstream
 * (industry + revenue + founder seniority filters live in AL). This
 * validator is a backstop: it catches obvious mismatches if the segment
 * ever drifts (e.g. a marketing director slipping in, or a Fortune-100
 * VP whose bandwidth doesn't include 1:1 founder coaching).
 */

// ── ICP rules (TBR cold) ──

// Match founder-shaped titles. Owner / Managing Partner / Managing
// Director are included because in mid-market engineering shops the
// founder often carries one of these instead of "CEO" formally.
const TITLE_PATTERN =
  /\b(founder|co-?founder|ceo|chief executive|president|owner|managing partner|managing director|principal|chairman)\b/i;

// Disqualify non-founder seniority even if a founder-shaped word slips
// in (e.g. "VP of Founder Relations", "Director of President's Office").
// Also catches obvious junior roles that the segment shouldn't be
// returning in the first place.
const TITLE_DISQUALIFIERS =
  /\b(vp|vice president|director|manager|coordinator|analyst|associate|assistant|intern|student|specialist|administrator)\b/i;

// Revenue band per the Q1 plan. Mid-tier subcontractors start around
// $10M; scaling organizations top out near $150M. Below $10M usually
// means the founder can't yet justify the investment in 1:1 coaching;
// above $150M usually means there's already a COO or chief of staff
// and Stephie's offering doesn't fit the gap.
const MIN_REVENUE_USD = 10_000_000;
const MAX_REVENUE_USD = 150_000_000;

// Parses AL's revenue strings into an inclusive [low, high] USD range.
// AL surfaces revenue in several shapes:
//   - "$10M to $50M" / "$25M" / "$1B+"          (compact suffix style)
//   - "10 million to 25 million"                (word-suffix style, common for TBR)
//   - "1 billion+" / "500 thousand"             (single value with word suffix)
//   - "10000000"                                (bare integer)
// Returns null if unparseable.
function parseRevenue(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Multiplier helper: accepts compact suffixes (M, B, K) AND word
  // suffixes (million, billion, thousand), case-insensitive. Anything
  // unrecognized falls through to 1x.
  const mult = (suffix) => {
    if (!suffix) return 1;
    const c = suffix[0].toLowerCase();
    if (c === 'b') return 1_000_000_000;
    if (c === 'm') return 1_000_000;
    if (c === 't' || c === 'k') return 1_000; // "thousand" or "K"
    return 1;
  };

  // Normalize: lowercase, strip $ and commas, collapse internal spaces.
  // We keep a single space between tokens so the word-suffix regexes
  // can anchor on word boundaries.
  const normalized = s
    .toLowerCase()
    .replace(/[$,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Suffix token group: either compact (m|mm|b|k) or word (million|billion|thousand).
  // The leading optional space lets us match both "10m" and "10 million".
  const SUFFIX = '(?:\\s*(million|billion|thousand|mm|m|b|k))?';

  // "10m+" / "1 billion+" / "$1B+" style
  const plusRe = new RegExp(`^(\\d+(?:\\.\\d+)?)${SUFFIX}\\+$`);
  const plusMatch = normalized.match(plusRe);
  if (plusMatch) {
    const low = parseFloat(plusMatch[1]) * mult(plusMatch[2]);
    return { low, high: Infinity };
  }

  // Range styles: "10m to 50m", "10 million to 25 million", "10-50m", "$10M-$50M"
  const rangeRe = new RegExp(
    `^(\\d+(?:\\.\\d+)?)${SUFFIX}\\s*(?:to|-|–)\\s*(\\d+(?:\\.\\d+)?)${SUFFIX}$`
  );
  const rangeMatch = normalized.match(rangeRe);
  if (rangeMatch) {
    const lowSuffix = rangeMatch[2] || rangeMatch[4];
    const highSuffix = rangeMatch[4];
    return {
      low: parseFloat(rangeMatch[1]) * mult(lowSuffix),
      high: parseFloat(rangeMatch[3]) * mult(highSuffix),
    };
  }

  // Single value with suffix: "25m", "10.5 million", "$1B"
  const singleRe = new RegExp(`^(\\d+(?:\\.\\d+)?)${SUFFIX}$`);
  const singleMatch = normalized.match(singleRe);
  if (singleMatch && singleMatch[2]) {
    const v = parseFloat(singleMatch[1]) * mult(singleMatch[2]);
    return { low: v, high: v };
  }

  // Bare number: "10000000"
  const bareNum = parseFloat(normalized);
  if (Number.isFinite(bareNum) && /^\d+(?:\.\d+)?$/.test(normalized)) {
    return { low: bareNum, high: bareNum };
  }

  return null;
}

/**
 * Validate a raw Audience Lab record against the TBR cold ICP.
 *
 * @param {object} v - Raw AL record (uppercase keys: JOB_TITLE,
 *   COMPANY_REVENUE, BUSINESS_VERIFIED_EMAILS, etc.)
 * @returns {{pass: boolean, reasons: string[], emailEligible: boolean}}
 *   - pass: meets ALL hard ICP gates
 *   - reasons: human-readable list of why it failed (empty if pass)
 *   - emailEligible: whether to mark email_eligible=true (only if pass
 *     AND has a usable business email)
 */
export function validateProspect(v) {
  const reasons = [];

  // ── 1. Title gate ──
  // The disqualifier check runs FIRST so that "VP of Operations" doesn't
  // sneak in just because TITLE_PATTERN later matches "operations". Any
  // hit on the disqualifier set kills the row regardless of other words.
  //
  // Missing JOB_TITLE is treated as a SOFT flag (like 'revenue_unknown'),
  // not a hard fail. Rationale: the TBR Founders Segment in Audience Lab
  // currently doesn't surface JOB_TITLE on every record, but the segment
  // itself is upstream-filtered to founder/CEO seniority. If AL ever
  // adds the field back, the disqualifier + pattern checks below resume
  // doing their job. Until then we trust the segment definition.
  const jobTitle = (v.JOB_TITLE || '').trim();
  if (!jobTitle) {
    reasons.push('title_unknown');
  } else if (TITLE_DISQUALIFIERS.test(jobTitle)) {
    reasons.push(`title_disqualified:${jobTitle}`);
  } else if (!TITLE_PATTERN.test(jobTitle)) {
    reasons.push(`title_not_founder:${jobTitle}`);
  }

  // ── 2. Revenue gate ──
  // Missing revenue is allowed (AL doesn't always have it for smaller
  // private cos) but flagged for monitoring. If AL gives us a number
  // we hold it to the band.
  const revenueRaw = (v.COMPANY_REVENUE || '').toString().trim();
  const revenueRange = parseRevenue(revenueRaw);
  if (!revenueRange) {
    reasons.push('revenue_unknown');
  } else if (revenueRange.high < MIN_REVENUE_USD) {
    reasons.push(`revenue_too_small:${revenueRaw}`);
  } else if (revenueRange.low > MAX_REVENUE_USD) {
    reasons.push(`revenue_too_large:${revenueRaw}`);
  }

  // ── 3. Contactability gate ──
  const businessEmail = (v.BUSINESS_VERIFIED_EMAILS || v.BUSINESS_EMAIL || '').trim();
  const personalEmail = (v.PERSONAL_VERIFIED_EMAILS || v.PERSONAL_EMAILS || '').trim();
  const hasUsableEmail = !!(businessEmail || personalEmail);
  if (!hasUsableEmail) {
    reasons.push('no_email');
  }

  // Soft flags that don't block the hard ICP pass. Missing revenue and
  // missing job title are both surfaced for monitoring but don't fail
  // the row - AL upstream filtering is the load-bearing gate for both.
  const SOFT_FLAGS = new Set(['revenue_unknown', 'title_unknown']);

  // Cold prefers business email - personal Gmail to a founder feels
  // creepy and tanks deliverability. A row with only a personal email
  // passes ICP but is NOT marked email_eligible.
  const emailEligible =
    hasUsableEmail &&
    !!businessEmail &&
    reasons.filter((r) => !SOFT_FLAGS.has(r)).length === 0;

  // Hard pass requires no failure reasons other than the soft flags.
  const hardFailures = reasons.filter((r) => !SOFT_FLAGS.has(r));
  const pass = hardFailures.length === 0;

  return { pass, reasons, emailEligible };
}

/**
 * Light wrapper for batch logging - returns the same shape but includes
 * a short label for log lines.
 */
export function summarizeValidation(v) {
  const result = validateProspect(v);
  const name = [v.FIRST_NAME, v.LAST_NAME].filter(Boolean).join(' ') || '(no name)';
  const company = v.COMPANY_NAME || '(no company)';
  return {
    ...result,
    label: `${name} - ${v.JOB_TITLE || '(no title)'} @ ${company}`,
  };
}
