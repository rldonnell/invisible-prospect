/**
 * Four Winds CMMS - Intent-Based Email Sequence (v1, click-optimized from day 1)
 *
 * Same HTML/click-path pattern as SA Spine v2, tuned for a B2B CMMS audience:
 *   - HTML-styled button CTAs (not raw {{booking_link}} tokens)
 *   - tel: link on the phone number
 *   - Secondary {{resource_link}} CTA for non-bookers (demo page)
 *   - Conservative 560px-max email-safe HTML
 *
 * Single-bucket rollout: "general_interest" (only allowed bucket name that
 * fits a catch-all under the existing campaigns CHECK constraint). Every
 * Four Winds lead flows through this one sequence for now. We can split
 * into stage-specific buckets later once we see real engagement data.
 *
 * Voice: Founder-direct. The emails are signed by Tom Hamm (40+ years in
 * maintenance) and pitch "skip the sales team, talk to the founder" as the
 * core differentiator. No canned corporate tone.
 *
 * Variables used in body (Instantly custom_variables, seeded per-campaign
 * in campaigns.variables JSONB and forwarded by push-instantly):
 *   {{first_name}}    - visitor first name
 *   {{booking_link}}  - Talk to Tom form URL (https://fourwindscmms.com/talktotom/)
 *   {{phone}}         - Four Winds phone (used for display AND tel: href)
 *   {{resource_link}} - secondary CTA (default: demo page)
 *
 * Used by: app/api/admin/push-four-winds-sequences/route.js to PATCH the
 * Four Winds campaign in Instantly via /api/v2/campaigns/{id}.
 */

// ── Shared HTML snippets ─────────────────────────────────────────────

// Four Winds brand navy. Distinct from SA Spine (#1a5490) so the two
// clients' emails can't be confused in a send-side render check.
const BRAND = '#1e3a5f';

// Branded CTA button. Renders in every major client.
const btn = (href, label) => `
<p style="margin:28px 0;">
  <a href="${href}" style="display:inline-block;padding:14px 32px;background-color:${BRAND};color:#ffffff;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:16px;">${label}</a>
</p>`.trim();

// Inline tel: link for the phone number.
const phoneLink = `<a href="tel:{{phone}}" style="color:${BRAND};font-weight:600;text-decoration:none;">{{phone}}</a>`;

// Inline softer resource link (secondary click path for readers not ready
// to book a call).
const resourceLink = (label) =>
  `<a href="{{resource_link}}" style="color:${BRAND};font-weight:600;">${label}</a>`;

// Tom's on-site quote, styled as a left-bar pullquote. Hardcoded rather
// than variable-driven because single-bucket rollout does not need rotation.
const tomQuote = `
<p style="border-left:3px solid ${BRAND};padding:4px 0 4px 16px;color:#555;font-style:italic;margin:24px 0;">
  "I've spent four decades in maintenance. I know what works, what fails, and exactly what your team needs to succeed. Skip the sales pitch. Let's just talk about your operation."
  <br><span style="font-style:normal;color:#777;">- Tom Hamm, Founder, Four Winds CMMS</span>
</p>`.trim();

// Common footer (founder-direct signature).
const footer = `
<p style="margin-top:32px;color:#555;font-size:14px;">
  - Tom<br>
  <span style="color:#777;">Tom Hamm, Founder, Four Winds CMMS</span>
</p>
`.trim();

// Wrap body in a conservative, email-safe container.
const wrap = (inner) => `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;">
${inner.trim()}
${footer}
</div>
`.trim();

// ── Bucket: General Interest (single-bucket rollout) ─────────────────

const generalInterest = {
  name: 'Four Winds - General Interest',
  bucket: 'general_interest',
  steps: [
    {
      day: 0,
      subject: '{{first_name}}, a quick note from Tom at Four Winds',
      preview: 'Skip the sales team. Talk to the founder.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>I'm Tom Hamm, founder of Four Winds CMMS. I saw you were looking at our site, so I wanted to reach out directly - not through a sales team, not through a form.</p>
<p>I've spent four decades in maintenance. I know what works, what fails, and exactly what most teams need to succeed with a CMMS.</p>
<p>If you're evaluating options - whether you're replacing a tired old system or implementing your first CMMS - the fastest way to find out if we're a fit is just to have a real conversation. No demo script. No pressure.</p>
${btn('{{booking_link}}', 'Talk to Tom')}
<p>Prefer to call? Reach us at ${phoneLink}. Or if you'd rather see the product first, you can ${resourceLink('book a quick demo')}.</p>
`),
    },
    {
      day: 4,
      subject: 'What most CMMS implementations get wrong',
      preview: "It's not the software. It's what happens after.",
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Most CMMS implementations don't fail because of the software. They fail because of poor onboarding and nonexistent post-sale support.</p>
<p>We've spent 40+ years fixing that. Every Four Winds client gets:</p>
<ul>
  <li>Guided data migration - not "here's a CSV template, good luck"</li>
  <li>Real humans on the phone (Tom, Jon, Chris) - not outsourced support or chatbots</li>
  <li>Role-specific dashboards tailored to how your team actually works</li>
</ul>
<p>Our clients include Ford, Kraft Foods, San Diego Zoo, Rhode Island Airport Corp, Koch Industries, and municipalities across the country. Most of them have been with us for decades.</p>
${tomQuote}
${btn('{{booking_link}}', 'Talk to Tom')}
<p>Or call ${phoneLink}. If you want the product tour before the conversation, ${resourceLink('see a demo here')}.</p>
`),
    },
    {
      day: 10,
      subject: 'Still on your plate, {{first_name}}?',
      preview: "No pressure. Just want you to know we're here.",
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Last note for now. I know evaluating a CMMS isn't a snap decision, especially if you're juggling other priorities.</p>
<p>If you want to talk through your operation whenever you're ready - what's working, what's not, what a better system might look like - my line is open. No sales pitch. Just a real conversation with someone who's seen a few hundred of these.</p>
${btn('{{booking_link}}', 'Talk to Tom')}
<p>Or call ${phoneLink}. If research mode suits you better right now, you can ${resourceLink('watch a demo')} on your own time.</p>
<p>I'll be around when you are.</p>
`),
    },
  ],
};

// ── Export ───────────────────────────────────────────────────────────

export const FOUR_WINDS_SEQUENCES = {
  general_interest: generalInterest,
};

/**
 * Convert a bucket's steps into the Instantly v2 sequences array shape.
 *
 * Instantly v2 expects:
 *   sequences: [{
 *     steps: [{
 *       type: 'email',
 *       delay: <days after previous step>,
 *       variants: [{ subject, body }]
 *     }]
 *   }]
 *
 * `delay` is RELATIVE to the previous step (not absolute from trigger).
 * We convert our absolute `day` values to relative deltas here.
 */
export function toInstantlySequence(bucketKey) {
  const bucket = FOUR_WINDS_SEQUENCES[bucketKey];
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
