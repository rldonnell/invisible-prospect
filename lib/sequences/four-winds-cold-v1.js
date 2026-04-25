/**
 * Four Winds CMMS - COLD Outreach Email Sequence (v1, SCAFFOLD)
 *
 * ⚠️ ALL COPY IS PLACEHOLDER ⚠️
 * Subject lines and email bodies use [REPLACE: ...] markers. Robert will
 * draft the real founder-transition pitch separately. Do NOT push this
 * to Instantly until every [REPLACE: ...] marker is gone.
 *
 * This is the COLD pipeline counterpart to lib/sequences/four-winds-v1.js
 * (the warm pixel-driven follow-up). Same HTML/click-path conventions:
 *   - HTML-styled button CTAs (not raw {{booking_link}} tokens)
 *   - tel: link on the phone number
 *   - Secondary {{resource_link}} CTA for non-bookers
 *   - Conservative 560px-max email-safe HTML
 *
 * Single-bucket rollout: "general_interest" - matches the campaigns table
 * CHECK constraint and lets every cold-segment prospect flow through one
 * sequence.
 *
 * Audience: Older founders / CEOs / owner-operators of small-to-mid
 * businesses, sourced from an Audience Lab "cold" segment that's already
 * filtered by age UPSTREAM. Per Robert: do NOT reference age in copy.
 * The pitch is "transition your operating brilliance so the team can run
 * without constant management" - not "you're old."
 *
 * COMPLIANCE NOTE (CAN-SPAM):
 *   Cold commercial email MUST include:
 *     1. Physical postal address of sender (Four Winds CMMS HQ)
 *     2. Functional unsubscribe mechanism (Instantly handles this if
 *        link tracking + unsubscribe footer is enabled at the campaign
 *        level - verify in Instantly UI before going live)
 *   The {{unsubscribe_link}} token below is a placeholder for the
 *   Instantly-managed unsubscribe URL. Do not hardcode a static URL.
 *
 * Used by: app/api/admin/push-four-winds-cold-sequences/route.js to
 * PATCH the Four Winds COLD campaign in Instantly via /api/v2/campaigns/{id}.
 */

// ── Shared HTML snippets (mirrors warm sequence) ─────────────────────

const BRAND = '#1e3a5f';

const btn = (href, label) => `
<p style="margin:28px 0;">
  <a href="${href}" style="display:inline-block;padding:14px 32px;background-color:${BRAND};color:#ffffff;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:16px;">${label}</a>
</p>`.trim();

const phoneLink = `<a href="tel:{{phone}}" style="color:${BRAND};font-weight:600;text-decoration:none;">{{phone}}</a>`;

const resourceLink = (label) =>
  `<a href="{{resource_link}}" style="color:${BRAND};font-weight:600;">${label}</a>`;

// CAN-SPAM footer: physical address + unsubscribe. Both pulled from
// campaign variables so they can be updated without touching code.
const complianceFooter = `
<p style="margin-top:32px;color:#888;font-size:12px;line-height:1.5;border-top:1px solid #eee;padding-top:16px;">
  {{sender_address}}<br>
  You're receiving this because we believe it's relevant to your role.
  If it's not, <a href="{{unsubscribe_link}}" style="color:#888;">unsubscribe here</a>.
</p>
`.trim();

const footer = `
<p style="margin-top:32px;color:#555;font-size:14px;">
  - Tom<br>
  <span style="color:#777;">Tom Hamm, Founder, Four Winds CMMS</span>
</p>
${complianceFooter}
`.trim();

const wrap = (inner) => `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;">
${inner.trim()}
${footer}
</div>
`.trim();

// ── Bucket: General Interest (cold, single-bucket rollout) ───────────

const generalInterest = {
  name: 'Four Winds COLD - General Interest',
  bucket: 'general_interest',
  steps: [
    {
      day: 0,
      subject: '[REPLACE: cold email 1 subject - founder-to-founder, no age reference]',
      preview: '[REPLACE: cold email 1 preview text]',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>[REPLACE: cold email 1 opening - introduce Tom, founder-to-founder framing, why you're reaching out unsolicited]</p>
<p>[REPLACE: cold email 1 body paragraph 1 - the operating-brilliance / transition pitch, why a CMMS is part of that picture]</p>
<p>[REPLACE: cold email 1 body paragraph 2 - what makes Four Winds different (40+ years, real humans, guided onboarding)]</p>
${btn('{{booking_link}}', 'Talk to Tom')}
<p>[REPLACE: cold email 1 close - softer alternative, e.g. "Or call ${phoneLink} - or see ${resourceLink('a quick demo')} on your own time."]</p>
`),
    },
    {
      day: 4,
      subject: '[REPLACE: cold email 2 subject - bump, value-add angle]',
      preview: '[REPLACE: cold email 2 preview text]',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>[REPLACE: cold email 2 opening - acknowledge no reply, give a reason to keep reading without guilt-tripping]</p>
<p>[REPLACE: cold email 2 body - concrete proof point or short story about a Four Winds client whose founder transitioned operations successfully]</p>
${btn('{{booking_link}}', 'Talk to Tom')}
<p>[REPLACE: cold email 2 close - phone ${phoneLink} and ${resourceLink('demo link')}]</p>
`),
    },
    {
      day: 10,
      subject: '[REPLACE: cold email 3 subject - final bump, permission-based close]',
      preview: '[REPLACE: cold email 3 preview text]',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>[REPLACE: cold email 3 opening - "last note from me" framing, no pressure]</p>
<p>[REPLACE: cold email 3 body - leave the door open, invite a one-line reply if not now]</p>
${btn('{{booking_link}}', 'Talk to Tom')}
<p>[REPLACE: cold email 3 close - phone ${phoneLink} and ${resourceLink('demo')}]</p>
`),
    },
  ],
};

// ── Export ───────────────────────────────────────────────────────────

export const FOUR_WINDS_COLD_SEQUENCES = {
  general_interest: generalInterest,
};

/**
 * Convert a bucket's steps into the Instantly v2 sequences array shape.
 * Same logic as the warm sequence module - kept duplicated rather than
 * imported so the two modules can evolve independently.
 */
export function toInstantlySequence(bucketKey) {
  const bucket = FOUR_WINDS_COLD_SEQUENCES[bucketKey];
  if (!bucket) throw new Error(`Unknown bucket: ${bucketKey}`);

  let prevDay = 0;
  const steps = bucket.steps.map((step, idx) => {
    const delay = idx === 0 ? 0 : step.day - prevDay;
    prevDay = step.day;
    return {
      type: 'email',
      delay,
      variants: [
        {
          subject: step.subject,
          body: step.body,
        },
      ],
    };
  });

  return [{ steps }];
}

/**
 * Pre-flight check: returns true if the sequence still contains any
 * [REPLACE: ...] markers. The push endpoint refuses to PATCH live if
 * this returns true (dry-run is always allowed for inspection).
 */
export function hasUnreplacedPlaceholders() {
  for (const bucket of Object.values(FOUR_WINDS_COLD_SEQUENCES)) {
    for (const step of bucket.steps) {
      if (
        /\[REPLACE:/i.test(step.subject) ||
        /\[REPLACE:/i.test(step.preview) ||
        /\[REPLACE:/i.test(step.body)
      ) {
        return true;
      }
    }
  }
  return false;
}
