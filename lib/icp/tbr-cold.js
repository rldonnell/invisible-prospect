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
// AL surfaces revenue in a few shapes: "$10M to $50M", "$1B+", "$25M",
// "10000000". Returns null if unparseable.
function parseRevenue(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Multiplier helper: handles M / MM / B / K suffixes case-insensitively
  const mult = (suffix) => {
    if (!suffix) return 1;
    const c = suffix[0].toUpperCase();
    if (c === 'B') return 1_000_000_000;
    if (c === 'M') return 1_000_000;
    if (c === 'K') return 1_000;
    return 1;
  };

  const stripped = s.replace(/[$,\s]/g, '');

  // "10M+" / "$1B+" style
  const plusMatch = stripped.match(/^(\d+(?:\.\d+)?)([MBK])?\+$/i);
  if (plusMatch) {
    const low = parseFloat(plusMatch[1]) * mult(plusMatch[2]);
    return { low, high: Infinity };
  }

  // "10M-50M" / "10Mto50M" / "10-50M" range styles
  const rangeMatch = stripped.match(
    /^(\d+(?:\.\d+)?)([MBK])?(?:to|-|–)(\d+(?:\.\d+)?)([MBK])?$/i
  );
  if (rangeMatch) {
    const lowSuffix = rangeMatch[2] || rangeMatch[4];
    const highSuffix = rangeMatch[4];
    return {
      low: parseFloat(rangeMatch[1]) * mult(lowSuffix),
      high: parseFloat(rangeMatch[3]) * mult(highSuffix),
    };
  }

  // Single value with suffix: "25M", "$10.5M"
  const singleSuffixMatch = stripped.match(/^(\d+(?:\.\d+)?)([MBK])$/i);
  if (singleSuffixMatch) {
    const v = parseFloat(singleSuffixMatch[1]) * mult(singleSuffixMatch[2]);
    return { low: v, high: v };
  }

  // Bare number: "10000000"
  const bareNum = parseFloat(stripped);
  if (Number.isFinite(bareNum)) {
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
  const jobTitle = (v.JOB_TITLE || '').trim();
  if (!jobTitle) {
    reasons.push('no_job_title');
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

  // Cold prefers business email - personal Gmail to a founder feels
  // creepy and tanks deliverability. A row with only a personal email
  // passes ICP but is NOT marked email_eligible.
  const emailEligible =
    hasUsableEmail &&
    !!businessEmail &&
    reasons.filter((r) => r !== 'revenue_unknown').length === 0;

  // Hard pass requires no failure reasons OTHER than the soft
  // 'revenue_unknown' flag.
  const hardFailures = reasons.filter((r) => r !== 'revenue_unknown');
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
