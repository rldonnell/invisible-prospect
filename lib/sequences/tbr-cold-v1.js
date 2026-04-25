/**
 * The Brilliance Revolution - COLD Outreach Email Sequence (v1)
 *
 * Cold pipeline counterpart to TBR's warm pixel-driven Field Manual
 * sequence. Same HTML/click-path conventions as the FW cold sequence:
 *   - HTML-styled button CTAs (not raw {{booking_link}} tokens)
 *   - tel: link on the phone number
 *   - Secondary {{resource_link}} CTA for non-bookers
 *   - Conservative 560px-max email-safe HTML
 *   - CAN-SPAM footer with {{sender_address}} + {{unsubscribe_link}}
 *
 * Single-bucket rollout: "general_interest" - matches the campaigns
 * table CHECK constraint and lets every cold-segment prospect flow
 * through the same founder-to-founder narrative arc.
 *
 * Audience: Founder / CEO / Owner of innovation-driven engineering
 * companies in aerospace, defense, mechanical, industrial, or medical
 * equipment manufacturing. Revenue band $10M-$150M. Sourced from a
 * dedicated AL "TBR cold" segment that pre-filters on industry + size +
 * seniority. The lib/icp/tbr-cold.js validator is a backstop only.
 *
 * Pitch backbone: Stephie Althouse, Ph.D., founder of The Brilliance
 * Revolution / The Brilliance Mine, writes founder-to-founder. The
 * core line is "Your expertise must outlive your experts." She frames
 * the founder's irreplaceability as both an asset and a liability -
 * great that you've earned that depth, dangerous that the company
 * can't grow / sell / be inherited without you.
 *
 * Single CTA across all 3 emails: "Talk to Stephie."
 *
 * COMPLIANCE NOTE (CAN-SPAM):
 *   Cold commercial email MUST include:
 *     1. Physical postal address of sender (TBR HQ - per migration-017)
 *     2. Functional unsubscribe mechanism (Instantly handles this if
 *        link tracking + unsubscribe footer is enabled at the campaign
 *        level - verify in Instantly UI before going live)
 *
 * Voice rule: NO em-dashes anywhere. Use " - " (hyphen with spaces).
 * The existing Field Manual sequence uses em-dashes; that predates
 * Robert's rule. Cold sequence follows the rule.
 *
 * Used by: app/api/admin/push-tbr-cold-sequences/route.js to PATCH
 * the TBR COLD campaign in Instantly via /api/v2/campaigns/{id}.
 */

// ── Shared HTML snippets (mirrors FW cold pattern, TBR brand color) ──

// TBR brand: deep navy/violet from the warm sequence header gradient.
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

// ── Bucket: General Interest (cold, single-bucket rollout) ───────────

const generalInterest = {
  name: 'TBR COLD - General Interest',
  bucket: 'general_interest',
  steps: [
    {
      day: 0,
      subject: 'Your expertise needs to outlive you, {{first_name}}',
      preview: 'A note from one founder to another.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>I'm Dr. Stephie Althouse. I work with founder-led engineering companies in aerospace, defense, mechanical, industrial, and medical equipment - the kind of place where the deepest expertise often lives in one or two people's heads. Yours.</p>
<p>I'm reaching out because of a pattern I've watched at companies like {{company_name}} for years. The founder is the bottleneck for the most important decisions, the most loyal customers, and the technical judgment calls that don't fit a written process. The business runs because of you, not around you. That's a beautiful position to be in, and a fragile one.</p>
<p>My work is helping founders rebuild that picture, so the brilliance you've spent decades earning gets transferred into your team, your protocols, and the value of the company itself. Whether the goal is scale, sale, succession, or simply not working a 70-hour week anymore, the path is the same. Your expertise has to outlive your experts.</p>
${btn('{{booking_link}}', 'Talk to Stephie')}
<p>Or call ${phoneLink}, or take a look at ${resourceLink('how I work')} on your own time.</p>
`),
    },
    {
      day: 4,
      subject: 'A short story, {{first_name}}',
      preview: 'A 40-person engineering CEO who stopped firefighting.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Quick story.</p>
<p>A CEO of a 40-person engineering firm came to me working 70-hour weeks. The business was growing. The team was capable. He still felt like he was pushing a boulder uphill every single day, because he was the unwritten knowledge base for everything that mattered.</p>
<p>Ninety days later, the boulder was gone. We didn't hire a COO. We extracted what was in his head and put it into a system the team could actually run. He went from firefighting to thinking. The company's enterprise value moved at the same time, because the buyer he eventually talked to didn't see "key person risk" anymore. He saw a business.</p>
<p>That's the work. If any of it sounds familiar at {{company_name}}, I'd love a 30-minute call.</p>
${btn('{{booking_link}}', 'Talk to Stephie')}
<p>Or reach me direct at ${phoneLink}. ${resourceLink('Here is the framework')} if you'd rather see it on paper first.</p>
`),
    },
    {
      day: 10,
      subject: 'Last note, {{first_name}}',
      preview: "Then I'll stop.",
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>This will be my last email. I don't want to be in your inbox if it's not useful.</p>
<p>If at any point - this year, next year, three years from now - you find yourself thinking "I'm tired of being the only one who can do this," reach out. The founders I work with usually wait one or two years longer than they should. There's no rush, but there is a window.</p>
${btn('{{booking_link}}', 'Talk to Stephie')}
<p>You can also reach me at ${phoneLink}, or pull ${resourceLink('the framework')} on your own time. Either is fine.</p>
<p>Wishing {{company_name}} the best.</p>
`),
    },
  ],
};

// ── Export ───────────────────────────────────────────────────────────

export const TBR_COLD_SEQUENCES = {
  general_interest: generalInterest,
};

/**
 * Convert a bucket's steps into the Instantly v2 sequences array shape.
 * Same logic as the FW cold module.
 */
export function toInstantlySequence(bucketKey) {
  const bucket = TBR_COLD_SEQUENCES[bucketKey];
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
 * ships with no markers; this stays in place so future v2/v3 drafts
 * can use the same guard.
 */
export function hasUnreplacedPlaceholders() {
  for (const bucket of Object.values(TBR_COLD_SEQUENCES)) {
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
