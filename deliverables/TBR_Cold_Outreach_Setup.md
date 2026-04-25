# The Brilliance Revolution Cold Outreach - Setup & Hand-off

**Date:** 2026-04-25
**Status:** Code complete and v1 copy drafted in Stephie's voice. Cold pipeline NOT yet live - migration-017 still needs to run in Neon (with the real Instantly campaign UUID swapped in for the placeholder), AL_SEGMENTS env update needs to be deployed, sequence still needs to be pushed to Instantly, and the campaign is intentionally inactive until everything is verified.

---

## What this is

A cold outreach pipeline for The Brilliance Revolution (Dr. Stephie Althouse), running alongside the existing warm pixel-driven Field Manual nurture. The cold pipeline targets founders, CEOs, and owners of innovation-driven engineering companies in aerospace, defense, mechanical, industrial, and medical equipment manufacturing - revenue band $10-150M. Source is the Audience Lab cold segment `e60ee0f7-3b53-4663-aff6-090915315e57 (AL cold) / 344a40f3-42d7-4454-bbe9-b13971e82857 (Instantly cold)`, pre-filtered upstream on industry plus seniority. The pitch is Stephie's Q1 2026 positioning: "Your expertise must outlive your experts." Single CTA across all three emails: "Talk to Stephie."

This is the second cold pipeline on the platform after Four Winds CMMS. The schema split, parser, and ingest branching all came online in migrations 015 and 016 - this client only needs migration-017 (campaign row) plus an env update and a validator registration.

---

## Architecture

| | Warm | Cold |
|---|---|---|
| Source | AL pixel segment `34e00e2c-6d9c-4d9f-aad1-63ad5b81e7f5` | AL cold segment `e60ee0f7-3b53-4663-aff6-090915315e57 (AL cold) / 344a40f3-42d7-4454-bbe9-b13971e82857 (Instantly cold)` |
| `acquisition_source` | `pixel` | `al_cold` |
| Campaign `kind` | `warm` | `cold` |
| ICP gate | none (pixel implies interest) | hard gate at ingest (founder title + $10-150M revenue + email) |
| Scoring | full processor | bypass; inserted at intent_tier='High', processed=true |
| Sending stack | GHL Field Manual sequence (existing) | Instantly cold campaign (separate sending accounts) |
| Sequence file | n/a in this repo (lives in GHL) | `lib/sequences/tbr-cold-v1.js` |

---

## Files added or modified

### New

- `lib/icp/tbr-cold.js` - validates AL records against the founder/CEO + $10-150M revenue ICP. Returns `{pass, reasons, emailEligible}`. 10 unit cases pass locally.
- `lib/sequences/tbr-cold-v1.js` - cold email sequence module (3 emails, days 0/4/10). Stephie's voice. No em-dashes, no `[REPLACE: ...]` markers. `hasUnreplacedPlaceholders()` returns false.
- `app/api/admin/push-tbr-cold-sequences/route.js` - admin endpoint to PATCH the cold sequence into the cold Instantly campaign. Mirrors the FW cold push endpoint, including the placeholder guard.
- `lib/migration-017-tbr-cold-campaign.sql` - seeds the TBR cold campaign row (active=false). Postal address baked in. **Instantly campaign UUID is currently a placeholder - replace before running.**

### Modified

- `app/api/cron/pull-audiencelab/route.js` - added `validateTbrCold` import and registered `'tbr': validateTbrCold` in `COLD_ICP_VALIDATORS`. Cold ingest now applies the TBR ICP filter.
- `.env.example` - AL_SEGMENTS updated to canonical full nested form including TBR cold + all existing clients.

---

## Hand-off checklist (in order)

1. **Get the Instantly cold campaign UUID for TBR.** Confirm in Instantly that the cold campaign exists with separate sending accounts from any warm/nurture sends. Suggested name: "TBR COLD - General Interest - v1". Confirm Link Tracking is ON and the campaign-level unsubscribe footer is enabled (CAN-SPAM).

2. **Edit migration-017 to swap the placeholder Instantly UUID for the real one.** The placeholder is `[REPLACE-WITH-TBR-INSTANTLY-COLD-CAMPAIGN-UUID]`. Do not confuse this with the AL cold segment ID `e60ee0f7-3b53-4663-aff6-090915315e57 (AL cold) / 344a40f3-42d7-4454-bbe9-b13971e82857 (Instantly cold)`, which lives in the AL_SEGMENTS env, not in migration-017.

3. **Update AL_SEGMENTS env var** to the canonical nested form. Both flat and nested are still supported by the parser, but production needs nested for TBR cold to fire:

   ```
   AL_SEGMENTS={"sa-spine":"0d8c23ca-10b9-4ec7-9a08-d37abaf80d02","four-winds":{"pixel":"e1ec1ea9-a4bf-4287-bc60-50fede1efa42","al_cold":"91f6aa7b-ec8e-4863-8f4c-eb12b560fef7"},"tbr":{"pixel":"34e00e2c-6d9c-4d9f-aad1-63ad5b81e7f5","al_cold":"e60ee0f7-3b53-4663-aff6-090915315e57 (AL cold) / 344a40f3-42d7-4454-bbe9-b13971e82857 (Instantly cold)"},"waverly-manor":"80c2a238-3596-453e-979d-fb0094efd70a","dough-babies":"df25a6ad-b040-45ff-bf88-edbab4f92afa","az-breasts":"87c40f83-af78-453b-8a7c-877e6f027277","p5":"d2b2fab3-e255-4edb-a5cf-65dd4fbb5dd5"}
   ```

   Set in Vercel for production AND in any local `.env` you use.

4. **Run migration-017 in Neon.** Postal address (6610 Raintree Pl, Flower Mound TX 75022) is already baked into `sender_address`. Booking link defaults to `https://thebrilliancerevolution.com/talk-to-stephie/` and resource link defaults to the Field Manual download page - update in `variables` if either path changes.

   ```
   lib/migration-017-tbr-cold-campaign.sql
   ```

5. **Push the sequence to Instantly** (dry run first, then live):

   ```bash
   # Dry run - inspect the payload
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://visitorid.p5marketing.com/api/admin/push-tbr-cold-sequences?dry=true"

   # Live push - refused if [REPLACE] markers present (none in v1, but the guard stays in place for v2/v3)
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://visitorid.p5marketing.com/api/admin/push-tbr-cold-sequences"
   ```

6. **Flip the campaign active.** Once everything above is verified:

   ```sql
   UPDATE campaigns
   SET active = true
   WHERE client_key = 'tbr' AND bucket = 'general_interest' AND kind = 'cold';
   ```

   The next pull-audiencelab cron run picks up the cold segment, ICP-validates, and inserts cold rows. The next push-instantly cron run picks them up and pushes to the cold Instantly campaign.

7. **Watch the first cron tick** after env update. Confirm the cold ingest is pulling rows from `344a40f3-...` and that the validator reasons (in `confidence_flags`) match the AL segment's actual title and revenue distribution. If the validator is rejecting a high percentage of rows, either the AL segment is wider than expected or the ICP regex needs a tweak.

---

## Sequence summary (v1, in Stephie's voice)

All three emails sign off "- Stephie / Dr. Stephie Althouse, Founder, The Brilliance Revolution" with the CAN-SPAM footer underneath. CTA across all three is "Talk to Stephie" linking to the booking page.

- **Email 1 (Day 0)** - Subject: "Your expertise needs to outlive you, {{first_name}}" / Preview: "A note from one founder to another." Opens with Stephie introducing herself, names the engineering vertical, frames the founder-as-bottleneck pattern, lays the core line "Your expertise has to outlive your experts."
- **Email 2 (Day 4)** - Subject: "A short story, {{first_name}}" / Preview: "A 40-person engineering CEO who stopped firefighting." 90-day before/after for an unnamed engineering CEO. Connects to enterprise-value uplift via reduced key-person risk.
- **Email 3 (Day 10)** - Subject: "Last note, {{first_name}}" / Preview: "Then I'll stop." Permission-based out, soft door-open framing, well-wishes for {{company_name}}.

---

## Cross-pipeline dedup behavior

Same as the FW cold pipeline: when pull-audiencelab encounters a cold-segment row, it pre-checks the visitors table for ANY existing TBR row matching by HEM, primary email, business email substring, or name+company. If found, the cold row is silently skipped and logged as `Cross-pipeline dup`. This prevents the same prospect from receiving both Stephie's warm Field Manual sequence and the cold founder pitch - which would feel obviously machine-generated.

The check is one-way: a person who arrives via the pixel AFTER they've been ingested as cold stays cold (processed=true) and won't trigger warm follow-up. Deliberate trade-off to avoid double-outreach.

---

## ICP rules (TBR cold)

The AL segment does the heavy targeting work. The validator in `lib/icp/tbr-cold.js` is a backstop for obvious mismatches.

Hard gates - row is dropped from cold ingest if any fail:

- **Job title** must match `/founder|co-founder|ceo|chief executive|president|owner|managing partner|managing director|principal|chairman/i` AND must NOT match disqualifiers (`/vp|vice president|director|manager|coordinator|analyst|associate|assistant|intern|student|specialist|administrator/i`). Disqualifier check runs first so "VP of Founder Relations" doesn't sneak in.
- **Company revenue** parsed from `COMPANY_REVENUE` (handles `"25M"`, `"10M to 50M"`, `"1B+"`, bare integers). Must be in [$10M, $150M]. Missing revenue is allowed but flagged.
- **Email** must exist (personal or business).

Soft signal - row passes ICP but `email_eligible=false`:

- Has only a personal email (no business email). Cold-to-personal-Gmail is a deliverability and creepiness hit, especially when reaching out to a founder.

All ICP failure reasons are stored in `confidence_flags` (prefixed `icp:`) so dropped prospects can be audited with a single SELECT.

---

## CAN-SPAM compliance reminders

Cold commercial email MUST include:

1. A physical postal address of the sender. Already baked into `campaigns.variables.sender_address` as "The Brilliance Revolution, 6610 Raintree Pl, Flower Mound, TX 75022, United States".
2. A functional unsubscribe mechanism. The sequence template uses `{{unsubscribe_link}}` - this should resolve to Instantly's managed unsubscribe URL. Verify in the Instantly campaign settings that the unsubscribe footer is enabled and that the link in the rendered HTML actually goes somewhere live before the first send.

If either is broken at send-time, you're shipping non-compliant cold email - which is both illegal and a domain-blacklist risk.

---

## Carryover items

- **Instantly cold campaign UUID** - still needed before migration-017 can run. Placeholder string in the migration is intentional.
- **`tbr_icp_test.mjs`** - a local Node test file in the repo root from validator verification (Bash sandbox couldn't delete it due to mount permissions). Safe to remove with `rm tbr_icp_test.mjs` from the repo root before next commit.

---

## Future-proofing

- Adding a third cold client: add the client to `AL_SEGMENTS`, register a validator in `COLD_ICP_VALIDATORS` in pull-audiencelab, copy the sequence + push endpoint scaffolds, run an analogue of migration-017 with their campaign ID and ICP-specific variables. The schema in migration-015 already supports any number of cold clients.
- Adding more cold buckets to TBR (e.g. industry-specific within engineering): the campaigns table allows multiple `(bucket, kind='cold')` rows per client. Add new bucket names to the campaigns CHECK constraint (a small migration if CHECK is enumerated) and a new entry in `TBR_COLD_SEQUENCES`.
