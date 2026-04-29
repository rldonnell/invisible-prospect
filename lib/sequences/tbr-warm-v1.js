/**
 * The Brilliance Revolution - WARM (Pixel) Outreach Email Sequence (v1)
 *
 * Warm counterpart to lib/sequences/tbr-cold-v1.js. Triggered by visitor
 * pixel hits on TBR's site, ICP-validated through normal pixel scoring,
 * routed through push-instantly's bucketMap with kind='warm'.
 *
 * Design notes:
 *   - Mirrors the cold voice (Stephie, founder-to-founder, "your
 *     expertise must outlive your experts") so the brand feels coherent
 *     to anyone who happens to receive both.
 *   - Adds an acknowledgement opener: this isn't pure cold outreach,
 *     these prospects already touched thebrilliancerevolution.com.
 *     Leading with that grounds the email and signals it isn't generic.
 *   - Same single CTA across all 3 emails: "Talk to Stephie."
 *   - Same HTML conventions as cold (560px wrapper, BRAND-color buttons,
 *     tel: link, secondary {{resource_link}} CTA, CAN-SPAM footer).
 *   - Voice rule: NO em-dashes. Use " - " (hyphen with spaces).
 *
 * Bucket coverage: this file defines a SINGLE sequence (general_interest)
 * because there is only one TBR warm Instantly campaign. The campaigns
 * table seeds three rows (general_interest, return_visitor,
 * ready_to_book) all pointing at the same Instantly campaign UUID with
 * different min_tier gates. push-instantly's bucketMap keys on
 * (bucket, kind) and routes any of the three buckets into this same
 * Instantly campaign. If you ever want different copy per bucket, split
 * into separate Instantly campaigns and add a second key here.
 *
 * Used by: app/api/admin/push-tbr-warm-sequences/route.js to PATCH
 * the TBR WARM campaign in Instantly via /api/v2/campaigns/{id}.
 */

// ── Shared HTML snippets (mirrors cold pattern, same TBR brand color) ──

const BRAND = '#2d1f4e';

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
  - Stephie<br>
  <span style="color:#777;">Dr. Stephie Althouse, Founder, The Brilliance Revolution</span>
</p>
${complianceFooter}
`.trim();

const wrap = (inner) => `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;">
${inner.trim()}
${footer}
</div>
`.trim();

// ── Bucket: General Interest (warm, single shared sequence) ────────────

const generalInterest = {
  name: 'TBR WARM - General Interest',
  bucket: 'general_interest',
  steps: [
    {
      day: 0,
      subject: 'Saw you stopped by, {{first_name}}',
      preview: 'Quick note from one founder to another.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>I'm Dr. Stephie Althouse. I noticed someone from {{company_name}} spent some time on our site, and I wanted to send a personal note rather than letting it sit in an analytics dashboard.</p>
<p>Most of what I do is work with founder-led engineering and manufacturing companies on the same question: how do you get the brilliance that lives in the founder's head into the company itself? It's the difference between a business that needs you and a business that runs because of what you've built. Aerospace, defense, mechanical, industrial, medical equipment - I've seen the same pattern in all of them.</p>
<p>If any of that is what brought you over, I'd love a 30-minute conversation about what you're working on at {{company_name}}.</p>
${btn('{{booking_link}}', 'Talk to Stephie')}
<p>Or call ${phoneLink} directly. ${resourceLink('Here is a deeper read')} if you want to see the framework first.</p>
`),
    },
    {
      day: 4,
      subject: 'Your expertise needs to outlive you, {{first_name}}',
      preview: 'The line a founder told me she had been waiting to hear.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>One thing I want to share, in case it's useful.</p>
<p>The founders I talk to are usually carrying three things at once. The deepest technical judgment in the company. The most loyal customer relationships. And the unwritten rules about how decisions actually get made. The business runs because of them, not around them. That's a beautiful position to be in, and a fragile one.</p>
<p>My work is rebuilding that picture so the brilliance you've earned over decades transfers into your team, your protocols, and the value of the company itself. Whether you're thinking about scale, sale, succession, or just not working a 70-hour week anymore, the path is the same. Your expertise has to outlive your experts.</p>
<p>If that resonates, even a little, I'd be glad to talk it through.</p>
${btn('{{booking_link}}', 'Talk to Stephie')}
<p>Or reach me at ${phoneLink}. ${resourceLink('Here is the framework')} if you'd rather look first.</p>
`),
    },
    {
      day: 10,
      subject: 'Last note, {{first_name}}',
      preview: "Then I'll stop.",
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>This will be my last email. I don't want to be in your inbox if it isn't useful.</p>
<p>If at any point - this year, next year, three years from now - you find yourself thinking "I'm tired of being the only one who can do this," reach out. The founders I work with usually wait one or two years longer than they should. There's no rush, but there is a window.</p>
${btn('{{booking_link}}', 'Talk to Stephie')}
<p>You can also reach me at ${phoneLink}, or pull ${resourceLink('the framework')} on your own time. Either is fine.</p>
<p>Wishing {{company_name}} the best.</p>
`),
    },
  ],
};

// ── Export ─────────────────────────────────────────────────────────────

export const TBR_WARM_SEQUENCES = {
  general_interest: generalInterest,
};

/**
 * Convert a bucket's steps into the Instantly v2 sequences array shape.
 * Same logic as cold module.
 */
export function toInstantlySequence(bucketKey) {
  const bucket = TBR_WARM_SEQUENCES[bucketKey];
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
 * this returns true (dry-run is always allowed for inspection). v1
 * ships clean; this stays in place for future v2/v3 drafts.
 */
export function hasUnreplacedPlaceholders() {
  for (const bucket of Object.values(TBR_WARM_SEQUENCES)) {
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
