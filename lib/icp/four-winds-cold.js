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
 * Audience: facilities / maintenance / operations professionals at small-mid
 * companies sourced from the AL "CMMS to P5 Software" segment
 * (91f6aa7b-ec8e-4863-8f4c-eb12b560fef7). The segment itself does the
 * heavy targeting work — every record arrives pre-filtered to a relevant
 * title. This validator is a light backstop: it catches obvious mismatches
 * if the segment ever drifts (e.g. a junior coordinator slipping in, or an
 * enterprise behemoth where Tom's "human-first" pitch wouldn't land).
 *
 * NOTE: This module replaced an earlier founder/CEO-targeted ICP that was
 * built for the TBR (Brilliance Revolution) audience. If/when TBR cold gets
 * its own pipeline, repurpose the prior version (see commit f34dad3 in git
 * history) at lib/icp/tbr-cold.js.
 */

// ── ICP rules (Four Winds cold) ──

// Match facilities/maintenance/operations roles at any seniority. Catches
// every title in the AL sample plus reasonable adjacencies (engineering,
// plant, building, property, asset, fleet, technical operations).
const TITLE_PATTERN =
  /\b(facilit|maintenance|maintenence|operations|engineer|plant|building|property|asset|fleet|technical operations)\b/i;

// Disqualify junior / non-decision-maker titles even if the title regex hits
// (e.g. "Maintenance Intern" or "Facilities Coordinator").
const TITLE_DISQUALIFIERS =
  /\b(intern|student|assistant|coordinator|analyst|associate)\b/i;

// Company size sanity range. Too small (sub-11) = no real facilities team
// to coordinate. Too large (2000+) = enterprise, likely already on
// IBM Maximo / SAP PM / similar — Tom's "human-first" pitch is a poor fit.
const MIN_EMPLOYEES = 11;
const MAX_EMPLOYEES = 2000;

// Parses AL's company-size strings ("11 to 50", "51 to 100", "1000+", "23")
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

  // "11 to 50" / "11-50" / "11 - 50" / "11–50" style
  const rangeMatch = s.match(/^(\d+)\s*(?:to|-|–)\s*(\d+)$/i);
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
 *   COMPANY_EMPLOYEE_COUNT, BUSINESS_VERIFIED_EMAILS, etc.)
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
    reasons.push(`title_not_facilities:${jobTitle}`);
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
