/**
 * lib/icp/four-winds-cold.js
 *
 * ICP (Ideal Customer Profile) validator for the Four Winds CMMS COLD
 * outreach pipeline. Used by the Audience Lab cold-segment ingest in
 * app/api/cron/pull-audiencelab/route.js when an AL record arrives with
 * acquisition_source='al_cold'.
 *
 * Cold outreach is fundamentally different from warm pixel-driven follow-up:
 *   - The prospect has no relationship with us and didn't visit the site
 *   - We get one shot at relevance — the wrong title or wrong company size
 *     looks like spam and torches the sending domain
 *   - So every prospect is gated through this validator BEFORE they're
 *     allowed into the cold campaign
 *
 * Four Winds is a CMMS (Computerized Maintenance Management System)
 * targeting older founders / CEOs / owner-operators of operationally-
 * intensive small-to-mid businesses where the founder is still running
 * the day-to-day and wants to "transition their brilliance" so the
 * business can run without constant management.
 *
 * IMPORTANT: Per Robert's directive, age is NOT referenced in the
 * outreach copy and is NOT used here as a hard filter. Age is filtered
 * UPSTREAM in the Audience Lab segment definition itself — by the time
 * a row hits this validator we trust the segment's age cut already
 * applied. We only sanity-check role + company shape + contactability.
 */

// ── ICP rules (Four Winds cold) ──

// Decision-maker titles. Cold outreach about leadership transition only
// makes sense to people who are themselves the principal of the business.
const TITLE_PATTERN =
  /\b(founder|co[-\s]?founder|ceo|chief executive|owner|co[-\s]?owner|owner[-\s]?operator|president|principal|managing partner|managing director|proprietor)\b/i;

// Disqualify obvious mismatches even if the title regex hits (e.g.
// "Founder of Marketing" - not a business owner).
const TITLE_DISQUALIFIERS =
  /\b(intern|student|assistant|coordinator|analyst|associate|manager of|of marketing|of sales|of hr|of people|head of)\b/i;

// Company size sanity range. Too small (1-2) = solopreneur, no team to
// transition. Too large (5000+) = enterprise, wrong buyer for a CMMS
// pitch about founder transition.
const MIN_EMPLOYEES = 5;
const MAX_EMPLOYEES = 1000;

// Parses AL's company-size strings ("11-50", "51-200", "1000+", "23")
// into an inclusive [low, high] range. Returns null if unparseable.
function parseEmployeeCount(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // "1000+" style
  const plusMatch = s.match(/^(\d+)\s*\+/);
  if (plusMatch) {
    const low = parseInt(plusMatch[1], 10);
    return { low, high: Infinity };
  }

  // "11-50" / "11 - 50" style
  const rangeMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (rangeMatch) {
    return { low: parseInt(rangeMatch[1], 10), high: parseInt(rangeMatch[2], 10) };
  }

  // Single number
  const num = parseInt(s.replace(/[^\d]/g, ''), 10);
  if (Number.isFinite(num)) {
    return { low: num, high: num };
  }

  return null;
}

/**
 * Validate a raw Audience Lab record against the Four Winds cold ICP.
 *
 * @param {object} v - Raw AL record (uppercase keys: JOB_TITLE,
 *   COMPANY_EMPLOYEE_COUNT, BUSINESS_EMAIL, etc.)
 * @returns {{pass: boolean, reasons: string[], emailEligible: boolean}}
 *   - pass: meets ALL hard ICP gates
 *   - reasons: human-readable list of why it failed (empty if pass)
 *   - emailEligible: whether to mark email_eligible=true (only if pass
 *     AND has a usable business email)
 */
export function validateProspect(v) {
  const reasons = [];

  // ── 1. Title gate ──
  const jobTitle = (v.JOB_TITLE || '').trim();
  if (!jobTitle) {
    reasons.push('no_job_title');
  } else if (TITLE_DISQUALIFIERS.test(jobTitle)) {
    reasons.push(`title_disqualified:${jobTitle}`);
  } else if (!TITLE_PATTERN.test(jobTitle)) {
    reasons.push(`title_not_decision_maker:${jobTitle}`);
  }

  // ── 2. Company size gate ──
  const sizeRaw = (v.COMPANY_EMPLOYEE_COUNT || '').trim();
  const sizeRange = parseEmployeeCount(sizeRaw);
  if (!sizeRange) {
    // Missing company size is allowed (AL doesn't always have it) but
    // gets flagged for monitoring. We don't auto-fail.
    reasons.push('size_unknown');
  } else if (sizeRange.high < MIN_EMPLOYEES) {
    reasons.push(`size_too_small:${sizeRaw}`);
  } else if (sizeRange.low > MAX_EMPLOYEES) {
    reasons.push(`size_too_large:${sizeRaw}`);
  }

  // ── 3. Contactability gate ──
  const businessEmail = (v.BUSINESS_VERIFIED_EMAILS || v.BUSINESS_EMAIL || '').trim();
  const personalEmail = (v.PERSONAL_VERIFIED_EMAILS || v.PERSONAL_EMAILS || '').trim();
  const hasUsableEmail = !!(businessEmail || personalEmail);
  if (!hasUsableEmail) {
    reasons.push('no_email');
  }

  // Cold outreach STRONGLY prefers a business email - sending cold to a
  // personal Gmail is worse for deliverability and creepier for the
  // recipient. A row with only a personal email passes ICP but is NOT
  // marked email_eligible.
  const emailEligible =
    hasUsableEmail &&
    !!businessEmail &&
    reasons.filter(r => r !== 'size_unknown').length === 0;

  // Hard pass requires no failure reasons OTHER than the soft
  // 'size_unknown' flag.
  const hardFailures = reasons.filter(r => r !== 'size_unknown');
  const pass = hardFailures.length === 0;

  return { pass, reasons, emailEligible };
}

/**
 * Light wrapper for batch logging — returns the same shape but includes
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
