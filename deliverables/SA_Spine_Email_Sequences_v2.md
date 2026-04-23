# SA Spine - Intent-Based Email Sequences (v2, click-optimized)

**Status:** Ready to push via `POST /api/admin/push-sa-spine-sequences?dry=true`
**Source of truth:** `lib/sequences/sa-spine-v2.js`
**Deploy mechanism:** `app/api/admin/push-sa-spine-sequences/route.js`

---

## What changed vs. v1

The v1 sequences (`deliverables/SA_Spine_Email_Sequences.md`) had good voice but weak click paths. Across all 18 emails:

1. **`{{booking_link}}` was a raw token, not a button.** Readers saw a naked URL. Branded anchor text gets far more clicks.
2. **`{{phone}}` was plain text, not a `tel:` link.** On mobile (the majority of medical lead opens), a tappable number is one of the highest-converting CTAs.
3. **Single CTA per email.** Readers not ready to book had nowhere to click.
4. **No resource link.** No softer "learn more" option for readers in research mode.

**v2 fixes all four.** Every email now has:

- A **styled button** (SA Spine navy, padding, rounded) as the primary CTA - renders in every major client.
- A **`tel:` link** wrapped around the phone number.
- A **`{{resource_link}}` secondary CTA** for readers not ready to book.
- A **testimonial block** styled as a left-bar quote so it stands out visually.

Voice and length are preserved from v1. Only the clickable elements changed.

---

## One new variable: `{{resource_link}}`

v2 introduces a bucket-level `resource_link` custom variable so each bucket can point to the most relevant SA Spine page. Suggested mapping (to confirm with Robert):

| Bucket | Suggested resource URL |
|---|---|
| Ready to Book | `/new-patients/what-to-expect` |
| Provider Research | `/about/dr-steven-cyr` |
| Procedure Treatment | `/procedures/minimally-invasive-spine-surgery` |
| Condition Research | `/what-we-treat/{{interest-slug}}` or `/conditions` |
| Return Visitor | `/patient-stories` |
| General Interest | `/what-we-treat` |

To wire these in, add `resource_link` to each SA Spine campaign row's `variables` JSONB in Neon:

```sql
UPDATE campaigns
SET variables = variables || jsonb_build_object('resource_link', 'https://saspine.com/new-patients/what-to-expect')
WHERE client_key = 'sa-spine' AND bucket = 'ready_to_book';
-- repeat for the other 5 buckets with the right URL
```

Then push-instantly will pick it up on the next run and pass it through as a custom variable.

---

## Also check in Instantly before pushing

**Link Tracking must be ON for every SA Spine campaign.** If it is off, Instantly sends the raw URL without its click-tracking wrapper, and we get zero `email_clicked` webhooks regardless of how good the copy is.

`Campaign -> Options -> Link Tracking` - confirm for all 6.

---

## Sequence overview

| Bucket | Instantly Campaign ID | Emails | Cadence | Tier Min | Confidence Min |
|---|---|---|---|---|---|
| Ready to Book | `c4470569-9f19-48b9-a8a9-f44a7c169619` | 3 | Days 0, 3, 7 | Medium | 35 |
| Provider Research | `aedb66b1-7d14-4912-99e4-35496c0d52fa` | 3 | Days 0, 4, 8 | Medium | 40 |
| Procedure Treatment | `5f4cd879-9b19-4289-8813-a88d772c05fd` | 3 | Days 0, 4, 8 | Medium | 40 |
| Condition Research | `27c43105-2393-45e8-a5fa-0f61bc65f3e8` | 3 | Days 0, 4, 8 | Low | 40 |
| Return Visitor | `ad54b22c-c1de-41aa-b743-809dc7bdbffb` | 3 | Days 0, 5, 10 | Low | 35 |
| General Interest | `8de6da51-a0f1-4cf2-9358-32bdd1efe7f8` | 3 | Days 0, 5, 10 | Low | 45 |

Thresholds above reflect the current `campaigns` table state as of 2026-04-23 (tuned from v1 defaults). They live in the `campaigns` table, not in the sequence copy, so the sequence push does not change them.

---

## Full copy (rendered)

Variables shown as `{{token}}`. HTML bodies are in `lib/sequences/sa-spine-v2.js` - do not edit this markdown directly; treat it as a rendered view.

### Bucket 1: Ready to Book

**Email 1 (Day 0)**
- Subject: `Your next step for {{interest}} care`
- Preview: `We make scheduling simple. Here is how.`
- Primary CTA: `Request a consultation` button
- Secondary: `tel:` link on phone, resource link to "what to expect at your first visit"

**Email 2 (Day 3)**
- Subject: `What {{practice_name}} patients wish they knew sooner`
- Preview: `A quick story from someone who took the same step.`
- Primary CTA: `Request a consultation` button
- Secondary: `tel:` link on phone
- Includes: styled testimonial block

**Email 3 (Day 7)**
- Subject: `Still thinking about {{interest}} treatment?`
- Preview: `No pressure. Just a reminder we are here.`
- Primary CTA: `Book your consultation` button
- Secondary: `tel:` link, resource link to "patient stories"

### Bucket 2: Provider Research

**Email 1 (Day 0)**
- Subject: `Meet the team behind {{practice_name}}`
- Preview: `Board-certified specialists. Thousands of procedures performed.`
- Primary CTA: `Book a consultation` button
- Secondary: resource link to "Dr. Cyr's background"

**Email 2 (Day 4)**
- Subject: `What our patients say about {{practice_name}}`
- Preview: `Credentials matter. So do results.`
- Primary CTA: `Schedule a consultation` button
- Secondary: `tel:` link, resource link to more patient stories
- Includes: styled testimonial block

**Email 3 (Day 8)**
- Subject: `What to expect at your first visit`
- Preview: `No commitment. Just a conversation about your options.`
- Primary CTA: `Request your consultation` button
- Secondary: `tel:` link, resource link to "about the first visit"

### Bucket 3: Procedure / Treatment Research

**Email 1 (Day 0)**
- Subject: `Understanding your options for {{interest}}`
- Primary CTA: `Talk to a specialist` button
- Secondary: resource link to "how the procedure works", `tel:` link

**Email 2 (Day 4)**
- Subject: `How {{practice_name}} patients recover from {{interest}}`
- Primary CTA: `Schedule a consultation` button
- Secondary: resource link to recovery stories
- Includes: styled testimonial block

**Email 3 (Day 8)**
- Subject: `Ready to explore {{interest}} with a specialist?`
- Primary CTA: `Book a consultation` button
- Secondary: `tel:` link

### Bucket 4: Condition Research

**Email 1 (Day 0)**
- Subject: `Living with {{interest}} - you have options`
- Primary CTA: `Talk to a specialist` button
- Secondary: resource link to condition page, `tel:` link

**Email 2 (Day 4)**
- Subject: `You are not alone - others with {{interest}} found relief`
- Primary CTA: `Take the first step` button
- Secondary: resource link to success stories
- Includes: styled testimonial block

**Email 3 (Day 8)**
- Subject: `Take the first step for your {{interest}}, {{first_name}}`
- Primary CTA: `Schedule a consultation` button
- Secondary: `tel:` link

### Bucket 5: Return Visitor

**Email 1 (Day 0)**
- Subject: `Still thinking about spine care, {{first_name}}?`
- Primary CTA: `Request a consultation` button
- Secondary: `tel:` link, resource link to patient resources

**Email 2 (Day 5)**
- Subject: `A quick update from {{practice_name}}`
- Primary CTA: `Schedule a visit` button
- Secondary: `tel:` link
- Includes: styled testimonial block

**Email 3 (Day 10)**
- Subject: `The door is always open, {{first_name}}`
- Primary CTA: `Reach out anytime` button
- Secondary: `tel:` link, resource link to resource library

### Bucket 6: General Interest

**Email 1 (Day 0)**
- Subject: `Exploring {{practice_focus}} options?`
- Primary CTA: `Book a consultation` button
- Secondary: resource link to "conditions we treat", `tel:` link

**Email 2 (Day 5)**
- Subject: `Not sure where to start? We can help`
- Primary CTA: `Request a consultation` button
- Secondary: resource link to patient resources
- Includes: styled testimonial block

**Email 3 (Day 10)**
- Subject: `We are here if you need us, {{first_name}}`
- Primary CTA: `Book a consultation` button
- Secondary: `tel:` link

---

## How to push

```bash
# 1. Dry run - see exactly what will be sent for one bucket
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://visitorid.p5marketing.com/api/admin/push-sa-spine-sequences?bucket=ready_to_book&dry=true"

# 2. Live push - one bucket first
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://visitorid.p5marketing.com/api/admin/push-sa-spine-sequences?bucket=ready_to_book"

# 3. Eyeball that campaign in Instantly. If it looks right, push the rest:
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "https://visitorid.p5marketing.com/api/admin/push-sa-spine-sequences"
```

Each call returns a per-bucket `ok`/`error` breakdown.

---

## Expected benchmarks (lead nurture, healthcare)

| Metric | v1 baseline | v2 target | Rationale |
|---|---|---|---|
| Open rate | 20-30% | 20-30% | Subject lines minimally changed |
| Click-through rate | <1% (estimate) | 3-7% | Buttons + tel links + resource links |
| Reply rate | 1-2% | 1-2% | Copy tone unchanged |
| Conversion (booking) | Unknown | 2-5% of clickers | Clearer primary path |

CTR is the headline metric because it is what feeds HOT promotion under the new engagement-only classifier.

---

## A/B test ideas (for a later pass)

1. **Button label:** `Request a consultation` vs. `See available times` - the latter implies less friction.
2. **Subject line on Email 3:** add a deadline framing (`Your consultation slot, {{first_name}}`) vs. the current soft reminder.
3. **Add a P.S. line** under the signature with a secondary soft ask. P.S. lines often get more reads than main body copy.

---

## Rollback

Instantly retains each PATCH's prior state. To roll back to v1 wording, either restore the v1 markdown as a new `lib/sequences/sa-spine-v1.js` module and push that, or manually revert in the Instantly UI (each campaign's edit history is preserved).
