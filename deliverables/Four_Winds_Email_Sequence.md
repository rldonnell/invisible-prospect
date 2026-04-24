# Four Winds CMMS - Intent-Based Email Sequence (v1)

**Status:** Ready to push once the Instantly campaign exists and migration-014 is run with the real campaign ID.
**Source of truth:** `lib/sequences/four-winds-v1.js`
**Deploy mechanism:** `app/api/admin/push-four-winds-sequences/route.js`
**Migration:** `lib/migration-014-four-winds-campaign.sql`

---

## Scope

Single-bucket rollout. Every Four Winds lead flows through one 3-email sequence under the `general_interest` bucket. We can split into stage-specific buckets later (e.g. demo-ready vs. research) once we see real engagement data.

**Why single bucket:**

1. Four Winds volume is still ramping - not enough leads yet to justify per-stage segmentation.
2. The "Talk to Tom" pitch is identical regardless of where the visitor is in their research.
3. The existing `campaigns` table CHECK constraint only allows healthcare-flavored bucket names, and `general_interest` is the cleanest semantic fit for a catch-all.

---

## What the sequence does differently vs. SA Spine

The SA Spine v2 pattern carries over wholesale for click optimization:

- HTML-styled button CTA (navy `#1e3a5f`, distinct from SA Spine's `#1a5490`)
- `tel:` link on the phone number
- `{{resource_link}}` secondary CTA (demo page) for non-callers
- Left-bar pullquote for Tom's quote
- Conservative 560px-max email-safe HTML

Four Winds-specific differences:

- **Founder-direct voice.** Every email is signed `- Tom` (Tom Hamm). The central pitch is "skip the sales team, talk to the founder."
- **Tom's quote is hardcoded**, not a `{{testimonial}}` variable. Single bucket means no rotation needed.
- **No `{{interest}}` or `{{doctor_name}}` variables.** Four Winds doesn't have per-page intent slugs wired up, and the voice is founder-centric rather than doctor-centric.
- **Primary CTA is `Talk to Tom`**, not `Book a consultation` - a form submission that Tom calls back on, not a calendar link.

---

## Variables used

Seeded in `campaigns.variables` JSONB via `migration-014-four-winds-campaign.sql`:

| Variable | Value |
|---|---|
| `{{booking_link}}` | `https://fourwindscmms.com/talktotom/` |
| `{{phone}}` | `+16199215845` (used for both display AND tel: href - Instantly substitutes the same value in both places) |
| `{{resource_link}}` | `https://fourwindscmms.com/cmms-demo/` |

Passed through automatically by `push-instantly` cron (see `app/api/cron/push-instantly/route.js` - already handles all three from SA Spine rollout). No code change needed.

Per-lead variable:
- `{{first_name}}` - populated from visitor record

---

## Cadence

3 emails across 10 days:
- Day 0 - Founder intro, Talk to Tom CTA
- Day 4 - "What most CMMS implementations get wrong" + Tom's quote + social proof
- Day 10 - Soft close, "I'll be around when you are"

This is slower than SA Spine ready-to-book (days 0/3/7) because B2B CMMS buyers research longer. Enterprise buyers can loop in committee and budget cycles - giving them breathing room reduces unsubscribes and keeps the founder-voice from feeling pushy.

---

## Full copy (rendered as plain text - see `lib/sequences/four-winds-v1.js` for HTML)

### Email 1 (Day 0)

**Subject:** `{{first_name}}, a quick note from Tom at Four Winds`
**Preview:** `Skip the sales team. Talk to the founder.`

Hi {{first_name}},

I'm Tom Hamm, founder of Four Winds CMMS. I saw you were looking at our site, so I wanted to reach out directly - not through a sales team, not through a form.

I've spent four decades in maintenance. I know what works, what fails, and exactly what most teams need to succeed with a CMMS.

If you're evaluating options - whether you're replacing a tired old system or implementing your first CMMS - the fastest way to find out if we're a fit is just to have a real conversation. No demo script. No pressure.

**[Button: Talk to Tom]**

Prefer to call? Reach us at {{phone}}. Or if you'd rather see the product first, you can [book a quick demo].

- Tom
Tom Hamm, Founder, Four Winds CMMS

---

### Email 2 (Day 4)

**Subject:** `What most CMMS implementations get wrong`
**Preview:** `It's not the software. It's what happens after.`

Hi {{first_name}},

Most CMMS implementations don't fail because of the software. They fail because of poor onboarding and nonexistent post-sale support.

We've spent 40+ years fixing that. Every Four Winds client gets:

- Guided data migration - not "here's a CSV template, good luck"
- Real humans on the phone (Tom, Jon, Chris) - not outsourced support or chatbots
- Role-specific dashboards tailored to how your team actually works

Our clients include Ford, Kraft Foods, San Diego Zoo, Rhode Island Airport Corp, Koch Industries, and municipalities across the country. Most of them have been with us for decades.

> "I've spent four decades in maintenance. I know what works, what fails, and exactly what your team needs to succeed. Skip the sales pitch. Let's just talk about your operation."
> - Tom Hamm, Founder, Four Winds CMMS

**[Button: Talk to Tom]**

Or call {{phone}}. If you want the product tour before the conversation, [see a demo here].

- Tom
Tom Hamm, Founder, Four Winds CMMS

---

### Email 3 (Day 10)

**Subject:** `Still on your plate, {{first_name}}?`
**Preview:** `No pressure. Just want you to know we're here.`

Hi {{first_name}},

Last note for now. I know evaluating a CMMS isn't a snap decision, especially if you're juggling other priorities.

If you want to talk through your operation whenever you're ready - what's working, what's not, what a better system might look like - my line is open. No sales pitch. Just a real conversation with someone who's seen a few hundred of these.

**[Button: Talk to Tom]**

Or call {{phone}}. If research mode suits you better right now, you can [watch a demo] on your own time.

I'll be around when you are.

- Tom
Tom Hamm, Founder, Four Winds CMMS

---

## Rollout steps

### 1. Create the Instantly campaign (manual, in Instantly UI)

- Go to https://app.instantly.ai -> Campaigns -> New Campaign
- Name: `Four Winds - General Interest - v1`
- Attach sending accounts (same pool as SA Spine is fine, or dedicate new ones if you want deliverability isolation)
- Set the schedule (recommend Mon-Fri business hours, 9am-4pm local time)
- **Turn ON Link Tracking** under Campaign -> Options -> Link Tracking. This is non-negotiable - without it, clicks don't fire webhooks and we get zero HOT promotions under the engagement-only classifier.
- Copy the campaign UUID from the URL (the piece after `/campaign/`)

### 2. Run migration-014 in Neon

Open `lib/migration-014-four-winds-campaign.sql`, replace `REPLACE_WITH_REAL_INSTANTLY_CAMPAIGN_UUID` with the UUID from step 1, paste into the Neon console, and run.

The verify query at the bottom should return exactly one row for Four Winds with `booking_link`, `phone`, and `resource_link` all populated.

### 3. Commit and push the code

```bash
cd /Users/phil/Documents/pixel-automation && \
  git add lib/sequences/four-winds-v1.js \
          app/api/admin/push-four-winds-sequences/route.js \
          lib/migration-014-four-winds-campaign.sql \
          deliverables/Four_Winds_Email_Sequence.md && \
  git commit -m "Four Winds v1 email sequence + push endpoint + migration-014" && \
  git push origin main
```

Wait ~30 seconds for Vercel to redeploy.

### 4. Dry run

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://visitorid.p5marketing.com/api/admin/push-four-winds-sequences?dry=true"
```

You should see `dry_run: true`, 3 subjects, and a `payload_preview`. Eyeball the subjects and confirm the campaign ID matches what you set in migration-014.

### 5. Live push

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://visitorid.p5marketing.com/api/admin/push-four-winds-sequences"
```

Expect `ok: true, status: 200`. Open the campaign in Instantly UI and eyeball the sequence - buttons, tel links, and the quote should all render correctly in the preview.

### 6. Wait for push-instantly cron

Next cron run (`app/api/cron/push-instantly/route.js`) will pick up any email-eligible Four Winds visitors and drop them into the new sequence. Check `/admin` dashboard a few hours later to confirm enrollments.

---

## Rollback

Instantly retains the previous state on each PATCH. To roll back, either:
- Check out an older version of `lib/sequences/four-winds-v1.js`, redeploy, and re-run the push endpoint
- Or revert manually in the Instantly UI (each campaign's edit history is preserved)

To pause entirely, set `active = false` in the campaigns row:
```sql
UPDATE campaigns SET active = false WHERE client_key = 'four-winds';
```

---

## Expected benchmarks (B2B SaaS lead nurture)

| Metric | Target | Rationale |
|---|---|---|
| Open rate | 35-50% | Personal founder-direct subject lines should over-index vs. templated B2B drips |
| Click-through rate | 3-6% | Button + tel + resource = three click paths per email |
| Reply rate | 2-4% | Founder-voice and "just a conversation" tone invite replies |
| Talk-to-Tom form fills | 1-3% of clickers | Single primary CTA, low-friction form |

CTR is the headline metric because it is the only path to HOT under the engagement-only classifier.

---

## Future work (not part of this rollout)

- **Per-stage buckets.** Split `general_interest` into `demo_ready` (visited `/cmms-demo`, `/pricing`), `feature_research` (visited `/work-order`, `/asset-management`, etc.), and `general_interest` (everyone else). Requires expanding the campaigns CHECK constraint and mapping intent signals to buckets in the push-instantly cron.
- **Industry-specific voice.** Email 2 could swap the social proof block based on the lead's industry (manufacturing → Ford/Kraft/Lindt, government → City of El Centro/WSDOT, healthcare → Community Mental Health).
- **A/B test subject lines.** Test a non-personal subject ("Quick thought on your CMMS search") vs. the current personal one to see which earns more opens.
