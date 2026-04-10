# SA Spine — Intent-Based Email Sequences

## System Context

These sequences are delivered via Instantly.ai using VisitorID custom variables.
Each bucket is a separate Instantly campaign. Variables personalize every send.

**Available Variables:**
- `{{first_name}}` — Visitor's first name
- `{{interest}}` — Primary interest (e.g., "scoliosis treatment", "spinal fusion")
- `{{practice_name}}` — "SA Spine"
- `{{practice_focus}}` — "spine care"
- `{{doctor_name}}` — "Dr. Steven Cyr"
- `{{booking_link}}` — Appointment request URL
- `{{testimonial}}` — Rotated per interest
- `{{city}}` — Visitor's city
- `{{phone}}` — Practice phone number

---

## Bucket 1: Ready to Book

**Audience:** Visitors who viewed contact, appointment, insurance, or patient forms pages.
**Tone:** Direct, friction-removing, helpful. They're already close — just clear the path.
**Confidence Min:** Any | **Tier Min:** Any

### Email 1 — Day 0 (Morning after processing)

**Subject Line Options:**
- Your next step for {{interest}} care
- Quick question about your visit, {{first_name}}

**Preview Text:** We make scheduling simple — here's how.

**Body:**

Hi {{first_name}},

We noticed you were exploring {{interest}} options at {{practice_name}}, and it looked like you were ready to take the next step.

We know that reaching out about spine care can feel like a big decision. We want to make it as easy as possible.

{{doctor_name}} and our team specialize in helping patients just like you find the right path forward — whether that's conservative treatment, minimally invasive options, or surgery.

**Scheduling is simple:**
- Call us directly at {{phone}}
- Or book online: {{booking_link}}

Most new patients are seen within a week.

Warmly,
The {{practice_name}} Team

---

### Email 2 — Day 3

**Subject Line Options:**
- What {{practice_name}} patients wish they knew sooner
- "I should have called months ago"

**Preview Text:** Hear from patients who took the same step you're considering.

**Body:**

Hi {{first_name}},

One thing we hear all the time from patients is: "I wish I'd come in sooner."

Here's what one of them had to say:

> {{testimonial}}

The hardest part is making the call. Everything after that, we handle — insurance verification, scheduling around your life, and making sure you understand every option before any decisions are made.

If you have questions before booking, just reply to this email. We're happy to help.

{{booking_link}}

— The {{practice_name}} Team

---

### Email 3 — Day 7

**Subject Line Options:**
- Still thinking about {{interest}} treatment?
- We're here when you're ready, {{first_name}}

**Preview Text:** No pressure — just a reminder we're here to help.

**Body:**

Hi {{first_name}},

We wanted to check in one last time. We understand that spine care decisions take time, and there's absolutely no pressure.

If you're still considering your options for {{interest}}, here's what a first visit looks like:

1. A thorough evaluation with {{doctor_name}}
2. A clear explanation of what's going on and what your options are
3. A recommendation — but the decision is always yours

Whenever you're ready, we're here: {{booking_link}}

Or call us at {{phone}} — even if it's just to ask a question.

Wishing you well,
{{practice_name}}

---
---

## Bucket 2: Provider Research

**Audience:** Visitors who viewed doctor bios, team pages, credentials, or reviews/testimonials.
**Tone:** Trust-building, credibility-focused. They're vetting — give them reasons to choose you.
**Confidence Min:** 40 (Medium+) | **Tier Min:** High

### Email 1 — Day 0

**Subject Line Options:**
- Meet the team behind {{practice_name}}
- Why patients choose {{doctor_name}}

**Preview Text:** Board-certified specialists with thousands of procedures performed.

**Body:**

Hi {{first_name}},

Choosing a spine specialist is one of the most important healthcare decisions you can make. We're glad you're doing your research.

At {{practice_name}}, our team is led by {{doctor_name}}, a board-certified spine surgeon with extensive experience in both minimally invasive and complex spinal procedures.

A few things that set our practice apart:

- Fellowship-trained specialists focused exclusively on spine care
- A full range of options from conservative therapy to advanced surgery
- A team that takes the time to explain everything — no rushed appointments

We believe the best patient is an informed patient. That's why we're happy you're looking into your options carefully.

If you'd like to learn more, visit our website or book a consultation: {{booking_link}}

— The {{practice_name}} Team

---

### Email 2 — Day 4

**Subject Line Options:**
- What our patients say about {{practice_name}}
- Real results from real patients

**Preview Text:** See why patients trust us with their spine care.

**Body:**

Hi {{first_name}},

We know that credentials matter — but so do results. Here's what a recent patient shared:

> {{testimonial}}

Stories like these are why our team comes to work every day. Every patient is different, and every treatment plan is customized to the individual.

We'd love the opportunity to show you the same level of care. If you have questions about our team, our approach, or what to expect, just reply to this email.

Or schedule a consultation: {{booking_link}}

— {{practice_name}}

---

### Email 3 — Day 8

**Subject Line Options:**
- Your questions answered, {{first_name}}
- What to expect at your first visit

**Preview Text:** No commitment — just a conversation about your options.

**Body:**

Hi {{first_name}},

If you've been researching spine specialists, you probably have a lot of questions. That's exactly what a first consultation is for.

Here's what to expect:

- A one-on-one conversation with {{doctor_name}} — not a rushed 5-minute appointment
- A review of your history, imaging, and symptoms
- An honest assessment of your options — including non-surgical ones
- No pressure to commit to anything

We believe you deserve a doctor who listens first and recommends second.

Ready to meet us? {{booking_link}}
Or call {{phone}} — we're happy to answer any questions over the phone first.

— The {{practice_name}} Team

---
---

## Bucket 3: Procedure / Treatment Research

**Audience:** Visitors who researched specific surgical or non-surgical procedures (spinal fusion, laminectomy, disc replacement, etc.).
**Tone:** Educational, outcomes-focused. They're weighing options — help them understand.
**Confidence Min:** 40 (Medium+) | **Tier Min:** High

### Email 1 — Day 0

**Subject Line Options:**
- Understanding your options for {{interest}}
- What you should know about {{interest}}

**Preview Text:** Clear, honest information from spine care specialists.

**Body:**

Hi {{first_name}},

We noticed you were researching {{interest}}, and we wanted to share some helpful information.

At {{practice_name}}, we believe that understanding your options is the first step toward feeling better. {{interest}} is one of the procedures our team performs regularly, and outcomes depend heavily on getting an accurate diagnosis and choosing the right approach for your specific situation.

Here are a few things worth knowing:

- Not everyone who researches {{interest}} needs surgery — conservative options work for many patients
- When surgery is the right choice, minimally invasive techniques mean faster recovery
- The most important factor is an experienced surgeon who specializes in spine care

We're happy to answer any questions. Just reply to this email or call us at {{phone}}.

— The {{practice_name}} Team

---

### Email 2 — Day 4

**Subject Line Options:**
- How {{practice_name}} patients recover from {{interest}}
- "I was back to normal faster than I expected"

**Preview Text:** Real recovery stories from patients like you.

**Body:**

Hi {{first_name}},

If you're considering {{interest}}, you're probably wondering: what does recovery actually look like?

Every patient is different, but here's what one of ours had to say:

> {{testimonial}}

At {{practice_name}}, we use the latest techniques to minimize recovery time and get you back to your life. {{doctor_name}} will walk you through exactly what to expect — before, during, and after — so there are no surprises.

Want to learn more about whether {{interest}} is right for you? Schedule a consultation: {{booking_link}}

— {{practice_name}}

---

### Email 3 — Day 8

**Subject Line Options:**
- Ready to explore {{interest}} with a specialist?
- Your next step for {{interest}}

**Preview Text:** A consultation is just a conversation — no commitment required.

**Body:**

Hi {{first_name}},

We know that researching {{interest}} can feel overwhelming. There's a lot of information out there, and not all of it applies to your specific situation.

That's why a consultation with a specialist can be so valuable — even if you're not sure you need treatment. {{doctor_name}} can review your case, explain what's going on, and lay out all your options clearly.

No pressure. No commitment. Just answers.

Book a consultation: {{booking_link}}
Or call us at {{phone}}.

We're here to help whenever you're ready.

— The {{practice_name}} Team

---
---

## Bucket 4: Condition Research

**Audience:** Visitors who researched specific conditions (scoliosis, herniated disc, spinal stenosis, back pain, etc.).
**Tone:** Empathetic, informative. They're learning about their problem — meet them with understanding.
**Confidence Min:** 40 (Medium+) | **Tier Min:** High

### Email 1 — Day 0

**Subject Line Options:**
- Living with {{interest}} — you have options
- Understanding {{interest}}: what you should know

**Preview Text:** Clear information from spine specialists who treat this every day.

**Body:**

Hi {{first_name}},

If you've been researching {{interest}}, you're probably looking for answers. We understand — living with spine-related pain or uncertainty can be exhausting.

At {{practice_name}}, we see patients dealing with {{interest}} every day. Here's what we want you to know:

- {{interest}} affects people differently — your experience is unique
- There are more treatment options than you might think, from physical therapy to advanced surgical techniques
- Getting a proper diagnosis is the most important first step

{{doctor_name}} and our team specialize in helping patients understand exactly what's going on and what can be done about it — in plain language, with no medical jargon.

If you have questions, we're here. Just reply to this email.

— The {{practice_name}} Team

---

### Email 2 — Day 4

**Subject Line Options:**
- You're not alone — others with {{interest}} found relief
- From {{interest}} pain to pain-free

**Preview Text:** Hear from someone who was in your shoes.

**Body:**

Hi {{first_name}},

When you're dealing with {{interest}}, it can feel isolating. You might wonder if things will ever improve.

We wanted to share something from one of our patients:

> {{testimonial}}

Every journey is different, but most patients tell us the same thing: they wish they'd gotten help sooner. Whether your path involves conservative care, a targeted procedure, or something in between — the first step is understanding your options.

We'd be happy to help you take that step: {{booking_link}}

— The {{practice_name}} Team

---

### Email 3 — Day 8

**Subject Line Options:**
- Take the first step for your {{interest}}, {{first_name}}
- What a consultation could change for you

**Preview Text:** No obligation — just a conversation about what's possible.

**Body:**

Hi {{first_name}},

We wanted to reach out one more time. If {{interest}} is still on your mind, we want you to know that help is available — and it starts with a simple conversation.

A consultation at {{practice_name}} means:

- An honest evaluation of your condition
- A clear explanation of all your options
- A treatment plan built around your goals and your life

No one should live with pain when solutions exist. {{doctor_name}} and our team are here to help you find yours.

Schedule a consultation: {{booking_link}}
Or call us: {{phone}}

Wishing you well,
{{practice_name}}

---
---

## Bucket 5: Return Visitor

**Audience:** Visitors who returned after 7+ days without viewing high-intent pages. They're still thinking about it.
**Tone:** Re-engagement, what's new. Acknowledge the gap without being pushy.
**Confidence Min:** 40 (Medium+) | **Tier Min:** Medium

### Email 1 — Day 0

**Subject Line Options:**
- Still thinking about spine care, {{first_name}}?
- Welcome back — we have some updates for you

**Preview Text:** New information that might help with your decision.

**Body:**

Hi {{first_name}},

We noticed you've been exploring {{practice_name}} — and we completely understand that spine care decisions take time.

Whether you're still in the research phase or getting closer to making a decision, we wanted to share a few things that might help:

- We offer complimentary insurance verification so you know your costs upfront
- {{doctor_name}} sees patients for consultations with no obligation to proceed
- Many of our patients start with conservative treatment before considering surgery

There's no rush. But if you have questions — even small ones — we're happy to help. Just reply to this email.

— The {{practice_name}} Team

---

### Email 2 — Day 5

**Subject Line Options:**
- What's new at {{practice_name}}
- A quick update from {{practice_name}}

**Preview Text:** New patient resources and a reminder we're here.

**Body:**

Hi {{first_name}},

We wanted to share a quick update. At {{practice_name}}, we're always working to make spine care more accessible:

- Same-week appointments available for new patients
- Transparent pricing with no surprise bills
- A patient care team that follows up with you at every step

Here's what a recent patient said about their experience:

> {{testimonial}}

If spine care is still on your radar, we'd love to help. {{booking_link}}

— {{practice_name}}

---

### Email 3 — Day 10

**Subject Line Options:**
- The door is always open, {{first_name}}
- Whenever you're ready

**Preview Text:** No pressure — just a reminder that we're here for you.

**Body:**

Hi {{first_name}},

This is our last note for now. We don't want to crowd your inbox — just want you to know that {{practice_name}} is here whenever you're ready.

If you ever want to:
- Ask a quick question about a condition or treatment
- Get a second opinion on something another doctor recommended
- Simply learn more about your options

We're just a call or click away.

{{booking_link}} | {{phone}}

Take care,
{{practice_name}}

---
---

## Bucket 6: General Interest

**Audience:** Visitors who browsed broadly without focusing on a specific condition, procedure, or provider. Homepage visitors, general browsers.
**Tone:** Soft introduction, practice overview. They visited but we don't know why — introduce the practice broadly.
**Confidence Min:** 40 (Medium+) | **Tier Min:** Medium

### Email 1 — Day 0

**Subject Line Options:**
- Exploring {{practice_focus}} options?
- Welcome from {{practice_name}}

**Preview Text:** Specialized spine care — from diagnosis to recovery.

**Body:**

Hi {{first_name}},

Thanks for visiting {{practice_name}}. Whether you're researching for yourself or someone you care about, we're glad you found us.

{{practice_name}} is a comprehensive spine care practice led by {{doctor_name}} and a team of specialists who focus exclusively on spine-related conditions. From back pain to complex spinal surgery, we offer the full spectrum of care.

A few things that make us different:

- We start with conservative options and only recommend surgery when it's truly the best path
- Every patient gets a personalized treatment plan — no cookie-cutter approaches
- Our team handles everything from insurance to scheduling so you can focus on getting better

If you have questions about anything spine-related, we're here to help. Just reply to this email.

— The {{practice_name}} Team

---

### Email 2 — Day 5

**Subject Line Options:**
- The most common spine questions we hear
- Not sure where to start? We can help

**Preview Text:** You don't need a diagnosis to schedule a consultation.

**Body:**

Hi {{first_name}},

If you're exploring {{practice_focus}} options, you might not be sure where to start. That's completely normal — and that's exactly what we're here for.

Here are the most common reasons people contact us:

- Persistent back or neck pain that isn't going away
- A diagnosis they want a second opinion on
- Numbness, tingling, or weakness in the arms or legs
- Questions about whether they need surgery

You don't need to have a diagnosis or a referral to see us. A consultation is simply a conversation about what you're experiencing and what your options might be.

Here's what one patient said about their first visit:

> {{testimonial}}

Ready to learn more? {{booking_link}}

— {{practice_name}}

---

### Email 3 — Day 10

**Subject Line Options:**
- A resource from {{practice_name}} for you
- We're here if you need us, {{first_name}}

**Preview Text:** Whether it's now or later — our door is open.

**Body:**

Hi {{first_name}},

We know that {{practice_focus}} decisions happen on your timeline, not ours. So this is just a friendly reminder that {{practice_name}} is here whenever you need us.

If you or someone you know is dealing with:
- Chronic back or neck pain
- A recent spine diagnosis
- Questions about treatment options

We'd be happy to help. A consultation with {{doctor_name}} is the easiest way to get answers — no commitment required.

{{booking_link}} | {{phone}}

Wishing you the best,
{{practice_name}}
