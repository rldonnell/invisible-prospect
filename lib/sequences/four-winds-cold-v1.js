/**
 * Four Winds CMMS - COLD Outreach Email Sequence (v1)
 *
 * Founder-direct outreach to facilities / maintenance / operations leads
 * sourced from the Audience Lab "CMMS to P5 Software" cold segment
 * (91f6aa7b-ec8e-4863-8f4c-eb12b560fef7). Single-bucket rollout
 * ("general_interest") to keep the campaigns table CHECK constraint happy
 * and route every cold-segment prospect through one sequence.
 *
 * Pitch backbone: "40 years in, you still talk to the founders."
 * Tom Hamm and his partner Jon started Four Winds over 40 years ago and
 * Tom still takes the demo calls himself. The contrast is with the rest
 * of the CMMS market, where the founders are long gone and you're stuck
 * with a chatbot. The single CTA is "Talk to Tom" - the founder-singular
 * framing is the takeaway, even though the opener mentions both founders.
 *
 * This is the COLD pipeline counterpart to lib/sequences/four-winds-v1.js
 * (the warm pixel-driven follow-up). Same HTML/click-path conventions:
 *   - HTML-styled button CTAs (not raw {{booking_link}} tokens)
 *   - tel: link on the phone number
 *   - Secondary {{resource_link}} CTA for non-bookers
 *   - Conservative 560px-max email-safe HTML
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
      subject: '40 years in, the founder still takes your call',
      preview: "That's why I'm writing you myself.",
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>I'm Tom Hamm. My partner Jon and I started Four Winds CMMS over 40 years ago, and I still take the calls myself.</p>
<p>That's not a marketing line. Most CMMS companies, by year five they've handed support off to a chatbot and the founders are long gone. We went the other way. After four decades, Jon and I are still the people you talk to when you have a real question about how to run maintenance at a place like {{company_name}}.</p>
<p>If you're sizing up a CMMS - or rethinking the one you have - I'd rather talk than pitch. 20 minutes, no slides, just a conversation about what's actually breaking and whether we're a fit.</p>
${btn('{{booking_link}}', 'Talk to Tom')}
<p>Or call me directly at ${phoneLink}, or pull up ${resourceLink('a quick demo')} on your own time.</p>
`),
    },
    {
      day: 4,
      subject: 'Still here, {{first_name}}',
      preview: '40 years and the same phone number.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Following up on my note from earlier this week.</p>
<p>The thing I hear most often from new Four Winds customers, after the first call, is some version of: "I can't believe the founder picked up." It still surprises people, and it shouldn't. 40 years in, I'm still the guy you'll talk to.</p>
<p>If maintenance at {{company_name}} is something you're trying to get a better handle on, that's a conversation I'd actually enjoy. No deck, no junior rep, no "let me loop in my manager."</p>
${btn('{{booking_link}}', 'Talk to Tom')}
<p>Phone: ${phoneLink}. Or take ${resourceLink('the demo')} on your own time and tell me what you think.</p>
`),
    },
    {
      day: 10,
      subject: 'Last note, {{first_name}}',
      preview: "Then I'll stop.",
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Last note from me, then I'll stop.</p>
<p>40 years of doing this, and I'm still the founder you'd talk to if you ever picked up the phone. If now isn't the right moment, I get it - just hit reply with "not now" and I'll close the loop. If it is, I'd love a 20 minute call.</p>
${btn('{{booking_link}}', 'Talk to Tom')}
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
