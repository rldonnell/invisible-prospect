import { getDb } from './db';

/**
 * Global blocklist checker.
 *
 * Checks a visitor's attributes against the blocklist table.
 * Matches are case-insensitive. Supports:
 *   - email:        exact match or prefix match (boardtruck@%)
 *   - email_domain: matches the domain part of any email (@spambot.com)
 *   - name:         matches full name (first + last, case-insensitive)
 *   - phone:        exact match on phone number
 *   - ip:           exact match on IP address
 *
 * Returns { blocked: true/false, reason: string, matchType: string }
 */
export async function checkBlocklist({ email, firstName, lastName, phone, ip }) {
  const sql = getDb();

  // Load all blocklist rules (table is small, fine to load in full)
  const rules = await sql`SELECT match_type, match_value, reason FROM blocklist`;

  if (!rules || rules.length === 0) {
    return { blocked: false };
  }

  const emailLower = (email || '').toLowerCase();
  const nameLower = `${(firstName || '')} ${(lastName || '')}`.trim().toLowerCase();
  const phoneTrimmed = (phone || '').trim();
  const ipTrimmed = (ip || '').trim();
  const emailDomain = emailLower.includes('@') ? emailLower.split('@')[1] : '';

  for (const rule of rules) {
    const type = rule.match_type;
    const value = rule.match_value.toLowerCase();

    switch (type) {
      case 'email':
        if (emailLower && matchPattern(emailLower, value)) {
          return { blocked: true, reason: rule.reason, matchType: 'email', matchValue: rule.match_value };
        }
        break;

      case 'email_domain':
        if (emailDomain && matchPattern(emailDomain, value)) {
          return { blocked: true, reason: rule.reason, matchType: 'email_domain', matchValue: rule.match_value };
        }
        break;

      case 'name':
        if (nameLower && matchPattern(nameLower, value)) {
          return { blocked: true, reason: rule.reason, matchType: 'name', matchValue: rule.match_value };
        }
        break;

      case 'phone':
        if (phoneTrimmed && matchPattern(phoneTrimmed, value)) {
          return { blocked: true, reason: rule.reason, matchType: 'phone', matchValue: rule.match_value };
        }
        break;

      case 'ip':
        if (ipTrimmed && matchPattern(ipTrimmed, value)) {
          return { blocked: true, reason: rule.reason, matchType: 'ip', matchValue: rule.match_value };
        }
        break;
    }
  }

  return { blocked: false };
}

/**
 * Simple pattern matching:
 *   - "boardtruck@%" matches any string starting with "boardtruck@"
 *   - "%@spambot.com" matches any string ending with "@spambot.com"
 *   - "exact value" matches exactly
 *   - "%partial%" matches if the value contains "partial"
 */
function matchPattern(input, pattern) {
  const startsWild = pattern.startsWith('%');
  const endsWild = pattern.endsWith('%');

  if (startsWild && endsWild) {
    // %contains%
    return input.includes(pattern.slice(1, -1));
  } else if (startsWild) {
    // %endsWith
    return input.endsWith(pattern.slice(1));
  } else if (endsWild) {
    // startsWith%
    return input.startsWith(pattern.slice(0, -1));
  } else {
    // exact match
    return input === pattern;
  }
}
