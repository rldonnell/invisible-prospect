/**
 * SA Spine - Intent-Based Email Sequences (v2, click-optimized)
 *
 * v2 changes vs. v1:
 *   - HTML-styled button CTAs (not raw {{booking_link}} tokens)
 *   - tel: links on every phone mention
 *   - 2-3 click paths per email (primary button + tel link + optional
 *     resource link)
 *   - One "learn more" / resource link per email where sensible, to give
 *     non-bookers a softer click target
 *
 * Variables used in body (Instantly custom_variables):
 *   {{first_name}}    - visitor first name
 *   {{interest}}      - primary interest (e.g. "sciatica", "spinal fusion")
 *   {{practice_name}} - "SA Spine"
 *   {{practice_focus}}- "spine care"
 *   {{doctor_name}}   - "Dr. Steven Cyr"
 *   {{booking_link}}  - scheduling URL
 *   {{phone}}         - practice phone (used for display AND tel: href)
 *   {{testimonial}}   - rotated per interest
 *   {{resource_link}} - bucket-appropriate secondary link (see setup notes
 *                       in deliverables/SA_Spine_Email_Sequences_v2.md)
 *
 * Used by: app/api/admin/push-sa-spine-sequences/route.js to PATCH the
 * six SA Spine campaigns in Instantly v2 via /api/v2/campaigns/{id}.
 */

// ── Shared HTML snippets ─────────────────────────────────────────────

// Branded CTA button. Uses SA Spine navy. Renders in every major client.
const btn = (href, label) => `
<p style="margin:28px 0;">
  <a href="${href}" style="display:inline-block;padding:14px 32px;background-color:#1a5490;color:#ffffff;text-decoration:none;border-radius:4px;font-family:Arial,Helvetica,sans-serif;font-weight:600;font-size:16px;">${label}</a>
</p>`.trim();

// Inline tel: link for the phone number.
const phoneLink = `<a href="tel:{{phone}}" style="color:#1a5490;font-weight:600;text-decoration:none;">{{phone}}</a>`;

// Inline softer resource link (secondary click path for readers not ready
// to book).
const resourceLink = (label) =>
  `<a href="{{resource_link}}" style="color:#1a5490;font-weight:600;">${label}</a>`;

// Common footer block (signature + opt-out friendly line).
const footer = `
<p style="margin-top:32px;color:#666;font-size:14px;">
  Warmly,<br>
  The {{practice_name}} Team
</p>
`.trim();

// Wrap body in a conservative, email-safe container.
const wrap = (inner) => `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:560px;">
${inner.trim()}
${footer}
</div>
`.trim();

// ── Bucket 1: Ready to Book ──────────────────────────────────────────

const readyToBook = {
  name: 'Ready to Book',
  bucket: 'ready_to_book',
  steps: [
    {
      day: 0,
      subject: 'Your next step for {{interest}} care',
      preview: 'We make scheduling simple. Here is how.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>We noticed you were exploring {{interest}} options at {{practice_name}}. It looked like you were ready to take the next step, so we wanted to make that step as easy as possible.</p>
<p>{{doctor_name}} and our team specialize in helping patients find the right path forward - whether that is conservative treatment, a minimally invasive option, or surgery.</p>
${btn('{{booking_link}}', 'Request a consultation')}
<p>Prefer to talk first? Call us at ${phoneLink}. Most new patients are seen within a week.</p>
<p>If it is helpful, here is ${resourceLink('what to expect at your first visit')}.</p>
`),
    },
    {
      day: 3,
      subject: "What {{practice_name}} patients wish they knew sooner",
      preview: 'A quick story from someone who took the same step.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>One thing we hear all the time from patients: "I wish I had come in sooner."</p>
<p style="border-left:3px solid #1a5490;padding:4px 0 4px 16px;color:#555;font-style:italic;">{{testimonial}}</p>
<p>The hardest part is making the call. Everything after that, we handle - insurance verification, scheduling around your life, and making sure you understand every option before any decisions are made.</p>
${btn('{{booking_link}}', 'Request a consultation')}
<p>Or call us at ${phoneLink} and we can answer questions over the phone first.</p>
`),
    },
    {
      day: 7,
      subject: 'Still thinking about {{interest}} treatment?',
      preview: 'No pressure. Just a reminder we are here.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>We wanted to check in one last time. Spine care decisions take time and there is absolutely no pressure.</p>
<p>If you are still weighing your options for {{interest}}, here is what a first visit looks like:</p>
<ol>
  <li>A thorough evaluation with {{doctor_name}}</li>
  <li>A clear explanation of what is going on and what your options are</li>
  <li>A recommendation - but the decision is always yours</li>
</ol>
${btn('{{booking_link}}', 'Book your consultation')}
<p>Or call ${phoneLink}, even if it is just to ask a question. You can also ${resourceLink('read patient stories')} to see what others experienced.</p>
`),
    },
  ],
};

// ── Bucket 2: Provider Research ──────────────────────────────────────

const providerResearch = {
  name: 'Provider Research',
  bucket: 'provider_research',
  steps: [
    {
      day: 0,
      subject: 'Meet the team behind {{practice_name}}',
      preview: 'Board-certified specialists. Thousands of procedures performed.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Choosing a spine specialist is one of the most important healthcare decisions you can make. We are glad you are doing your research.</p>
<p>At {{practice_name}}, our team is led by {{doctor_name}}, a board-certified spine surgeon with extensive experience in both minimally invasive and complex spinal procedures.</p>
<p>A few things that set our practice apart:</p>
<ul>
  <li>Fellowship-trained specialists focused exclusively on spine care</li>
  <li>A full range of options from conservative therapy to advanced surgery</li>
  <li>A team that takes the time to explain everything - no rushed appointments</li>
</ul>
${btn('{{booking_link}}', 'Book a consultation')}
<p>Or ${resourceLink("read more about Dr. Cyr's background")} before deciding.</p>
`),
    },
    {
      day: 4,
      subject: 'What our patients say about {{practice_name}}',
      preview: 'Credentials matter. So do results.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Credentials matter - but so do results. Here is what a recent patient shared:</p>
<p style="border-left:3px solid #1a5490;padding:4px 0 4px 16px;color:#555;font-style:italic;">{{testimonial}}</p>
<p>Stories like these are why our team comes to work every day. Every patient is different, and every treatment plan is customized.</p>
${btn('{{booking_link}}', 'Schedule a consultation')}
<p>Questions first? Call ${phoneLink} or ${resourceLink('see more patient stories')}.</p>
`),
    },
    {
      day: 8,
      subject: 'What to expect at your first visit',
      preview: 'No commitment. Just a conversation about your options.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>If you have been researching spine specialists, you probably have a lot of questions. That is exactly what a first consultation is for.</p>
<p>Here is what to expect:</p>
<ul>
  <li>A one-on-one conversation with {{doctor_name}} - not a rushed 5-minute appointment</li>
  <li>A review of your history, imaging, and symptoms</li>
  <li>An honest assessment of your options, including non-surgical ones</li>
  <li>No pressure to commit to anything</li>
</ul>
${btn('{{booking_link}}', 'Request your consultation')}
<p>Prefer the phone? Call ${phoneLink}. Or ${resourceLink('read about the first visit')} first.</p>
`),
    },
  ],
};

// ── Bucket 3: Procedure / Treatment Research ─────────────────────────

const procedureTreatment = {
  name: 'Procedure / Treatment Research',
  bucket: 'procedure_treatment',
  steps: [
    {
      day: 0,
      subject: 'Understanding your options for {{interest}}',
      preview: 'Clear, honest information from specialists.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>We noticed you were researching {{interest}}, so we wanted to share some helpful context.</p>
<p>At {{practice_name}}, we believe that understanding your options is the first step toward feeling better. {{interest}} is a procedure our team performs regularly, and outcomes depend heavily on an accurate diagnosis and the right approach for your specific situation.</p>
<p>A few things worth knowing:</p>
<ul>
  <li>Not everyone who researches {{interest}} needs surgery. Conservative options work for many patients.</li>
  <li>When surgery is the right choice, minimally invasive techniques mean faster recovery.</li>
  <li>The most important factor is an experienced surgeon who specializes in spine care.</li>
</ul>
${btn('{{booking_link}}', 'Talk to a specialist')}
<p>Want to learn more first? ${resourceLink('See how the procedure works')}, or call ${phoneLink} with any questions.</p>
`),
    },
    {
      day: 4,
      subject: 'How {{practice_name}} patients recover from {{interest}}',
      preview: 'Real recovery stories from patients like you.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>If you are considering {{interest}}, you are probably wondering: what does recovery actually look like?</p>
<p>Every patient is different, but here is what one of ours had to say:</p>
<p style="border-left:3px solid #1a5490;padding:4px 0 4px 16px;color:#555;font-style:italic;">{{testimonial}}</p>
<p>At {{practice_name}}, we use the latest techniques to minimize recovery time and get you back to your life. {{doctor_name}} will walk you through exactly what to expect - before, during, and after - so there are no surprises.</p>
${btn('{{booking_link}}', 'Schedule a consultation')}
<p>Or ${resourceLink('read more recovery stories')} before you decide.</p>
`),
    },
    {
      day: 8,
      subject: 'Ready to explore {{interest}} with a specialist?',
      preview: 'A consultation is just a conversation.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Researching {{interest}} can feel overwhelming. There is a lot of information out there, and not all of it applies to your specific situation.</p>
<p>That is why a consultation with a specialist can be so valuable, even if you are not sure you need treatment. {{doctor_name}} can review your case, explain what is going on, and lay out your options clearly.</p>
<p>No pressure. No commitment. Just answers.</p>
${btn('{{booking_link}}', 'Book a consultation')}
<p>Or call us at ${phoneLink}. We are here when you are ready.</p>
`),
    },
  ],
};

// ── Bucket 4: Condition Research ─────────────────────────────────────

const conditionResearch = {
  name: 'Condition Research',
  bucket: 'condition_research',
  steps: [
    {
      day: 0,
      subject: 'Living with {{interest}} - you have options',
      preview: 'Clear information from spine specialists.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>If you have been researching {{interest}}, you are probably looking for answers. Living with spine-related pain or uncertainty can be exhausting.</p>
<p>At {{practice_name}}, we see patients dealing with {{interest}} every day. A few things we want you to know:</p>
<ul>
  <li>{{interest}} affects people differently - your experience is unique</li>
  <li>There are more treatment options than you might think, from physical therapy to advanced surgical techniques</li>
  <li>Getting a proper diagnosis is the most important first step</li>
</ul>
${btn('{{booking_link}}', 'Talk to a specialist')}
<p>Want to read more first? ${resourceLink('Learn about {{interest}}')} or call ${phoneLink}.</p>
`),
    },
    {
      day: 4,
      subject: 'You are not alone - others with {{interest}} found relief',
      preview: 'From pain to pain-free.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>When you are dealing with {{interest}}, it can feel isolating. You might wonder if things will ever improve.</p>
<p>We wanted to share something from one of our patients:</p>
<p style="border-left:3px solid #1a5490;padding:4px 0 4px 16px;color:#555;font-style:italic;">{{testimonial}}</p>
<p>Every journey is different, but most patients tell us the same thing: they wish they had gotten help sooner. Whether your path involves conservative care, a targeted procedure, or something in between, the first step is understanding your options.</p>
${btn('{{booking_link}}', 'Take the first step')}
<p>Or ${resourceLink('read more success stories')} to see what is possible.</p>
`),
    },
    {
      day: 8,
      subject: 'Take the first step for your {{interest}}, {{first_name}}',
      preview: 'No obligation. Just a conversation.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>We wanted to reach out one more time. If {{interest}} is still on your mind, we want you to know that help is available - and it starts with a simple conversation.</p>
<p>A consultation at {{practice_name}} means:</p>
<ul>
  <li>An honest evaluation of your condition</li>
  <li>A clear explanation of all your options</li>
  <li>A treatment plan built around your goals and your life</li>
</ul>
${btn('{{booking_link}}', 'Schedule a consultation')}
<p>Or call ${phoneLink}. We are here whenever you are ready.</p>
`),
    },
  ],
};

// ── Bucket 5: Return Visitor ─────────────────────────────────────────

const returnVisitor = {
  name: 'Return Visitor',
  bucket: 'return_visitor',
  steps: [
    {
      day: 0,
      subject: 'Still thinking about spine care, {{first_name}}?',
      preview: 'A few updates that might help with your decision.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>We noticed you have been exploring {{practice_name}} - and we completely understand that spine care decisions take time.</p>
<p>Whether you are still in the research phase or getting closer to making a decision, a few things that might help:</p>
<ul>
  <li>We offer complimentary insurance verification so you know your costs upfront</li>
  <li>{{doctor_name}} sees patients for consultations with no obligation to proceed</li>
  <li>Many patients start with conservative treatment before considering surgery</li>
</ul>
${btn('{{booking_link}}', 'Request a consultation')}
<p>Questions? Call ${phoneLink} or ${resourceLink('browse our patient resources')}.</p>
`),
    },
    {
      day: 5,
      subject: 'A quick update from {{practice_name}}',
      preview: 'New patient resources and a reminder we are here.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>At {{practice_name}}, we are always working to make spine care more accessible:</p>
<ul>
  <li>Same-week appointments available for new patients</li>
  <li>Transparent pricing with no surprise bills</li>
  <li>A patient care team that follows up with you at every step</li>
</ul>
<p>Here is what a recent patient said:</p>
<p style="border-left:3px solid #1a5490;padding:4px 0 4px 16px;color:#555;font-style:italic;">{{testimonial}}</p>
${btn('{{booking_link}}', 'Schedule a visit')}
<p>Or call ${phoneLink} when you are ready.</p>
`),
    },
    {
      day: 10,
      subject: 'The door is always open, {{first_name}}',
      preview: 'No pressure. Just a reminder.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>This is our last note for now. We do not want to crowd your inbox - just want you to know that {{practice_name}} is here whenever you are ready.</p>
<p>If you ever want to:</p>
<ul>
  <li>Ask a quick question about a condition or treatment</li>
  <li>Get a second opinion on something another doctor recommended</li>
  <li>Simply learn more about your options</li>
</ul>
${btn('{{booking_link}}', 'Reach out anytime')}
<p>Or call ${phoneLink}. You can also ${resourceLink('explore our resource library')} on your own time.</p>
`),
    },
  ],
};

// ── Bucket 6: General Interest ───────────────────────────────────────

const generalInterest = {
  name: 'General Interest',
  bucket: 'general_interest',
  steps: [
    {
      day: 0,
      subject: 'Exploring {{practice_focus}} options?',
      preview: 'Specialized spine care, from diagnosis to recovery.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Thanks for visiting {{practice_name}}. Whether you are researching for yourself or someone you care about, we are glad you found us.</p>
<p>{{practice_name}} is a comprehensive spine care practice led by {{doctor_name}} and a team of specialists who focus exclusively on spine-related conditions. From back pain to complex spinal surgery, we offer the full spectrum of care.</p>
<p>A few things that make us different:</p>
<ul>
  <li>We start with conservative options and only recommend surgery when it is truly the best path</li>
  <li>Every patient gets a personalized plan - no cookie-cutter approaches</li>
  <li>Our team handles insurance and scheduling so you can focus on getting better</li>
</ul>
${btn('{{booking_link}}', 'Book a consultation')}
<p>Not quite ready? ${resourceLink('See the conditions we treat')}, or call ${phoneLink} with any questions.</p>
`),
    },
    {
      day: 5,
      subject: 'Not sure where to start? We can help',
      preview: 'You do not need a diagnosis to schedule a consultation.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>Here are the most common reasons people contact us:</p>
<ul>
  <li>Persistent back or neck pain that is not going away</li>
  <li>A diagnosis they want a second opinion on</li>
  <li>Numbness, tingling, or weakness in the arms or legs</li>
  <li>Questions about whether they need surgery</li>
</ul>
<p>You do not need a diagnosis or a referral to see us. A consultation is simply a conversation about what you are experiencing and what your options might be.</p>
<p style="border-left:3px solid #1a5490;padding:4px 0 4px 16px;color:#555;font-style:italic;">{{testimonial}}</p>
${btn('{{booking_link}}', 'Request a consultation')}
<p>Or ${resourceLink('browse our patient resources')} to learn more first.</p>
`),
    },
    {
      day: 10,
      subject: 'We are here if you need us, {{first_name}}',
      preview: 'Whether now or later, our door is open.',
      body: wrap(`
<p>Hi {{first_name}},</p>
<p>{{practice_focus}} decisions happen on your timeline, not ours. So this is a friendly reminder that {{practice_name}} is here whenever you need us.</p>
<p>If you or someone you know is dealing with:</p>
<ul>
  <li>Chronic back or neck pain</li>
  <li>A recent spine diagnosis</li>
  <li>Questions about treatment options</li>
</ul>
${btn('{{booking_link}}', 'Book a consultation')}
<p>Or call ${phoneLink}. No commitment, just answers.</p>
`),
    },
  ],
};

// ── Export ───────────────────────────────────────────────────────────

export const SA_SPINE_SEQUENCES = {
  ready_to_book: readyToBook,
  provider_research: providerResearch,
  procedure_treatment: procedureTreatment,
  condition_research: conditionResearch,
  return_visitor: returnVisitor,
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
  const bucket = SA_SPINE_SEQUENCES[bucketKey];
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
