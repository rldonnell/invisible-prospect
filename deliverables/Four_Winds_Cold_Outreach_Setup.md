# Four Winds Cold Outreach - Setup & Hand-off

**Date:** 2026-04-25
**Status:** Code complete and copy approved. Cold pipeline NOT yet live - migration-016 still needs to run in Neon, AL_SEGMENTS env still needs the cold segment, sequence still needs to be pushed to Instantly, and the campaign is intentionally inactive until everything is verified.

---

## What this is

A second outreach pipeline for Four Winds CMMS, running alongside the existing warm pixel-driven follow-up. The cold pipeline targets facilities, maintenance, and operations leads at small-to-mid businesses, sourced from the Audience Lab "CMMS to P5 Software" segment (`91f6aa7b-ec8e-4863-8f4c-eb12b560fef7`). The pitch is "40 years in, you still talk to the founders." Tom Hamm and his partner John started Four Winds over 40 years ago and Tom still takes the demo calls himself - the contrast is with the rest of the CMMS market where the founders are long gone and you get a chatbot. Single CTA across all three emails: "Talk to Tom."

The two pipelines share infrastructure (Instantly webhook, blocklist, cleanup cron, admin dashboard) but are fully separated where it matters: separate AL segments, separate Instantly campaigns, separate sending accounts, ICP-validated ingest, and cross-pipeline dedup so the same prospect can never receive both.

---

## Architecture

| | Warm | Cold |
|---|---|---|
| Source | Audience Lab pixel segment | AL "CMMS to P5 Software" segment (`91f6aa7b-ec8e-4863-8f4c-eb12b560fef7`) |
| `acquisition_source` | `pixel` | `al_cold` |
| Campaign `kind` | `warm` | `cold` |
| ICP gate | none (pixel implies interest) | hard gate at ingest |
| Scoring | full processor (process-visitors cron) | bypass; inserted at intent_tier='High', processed=true |
| Instantly campaign | warm campaign, warm sending accounts | cold campaign `75c09b88-bcd2-4327-9cf0-19c4815a199f`, separate sending accounts |
| Sequence file | `lib/sequences/four-winds-v1.js` (live) | `lib/sequences/four-winds-cold-v1.js` (copy approved 2026-04-25) |

---

## Files added or modified

### New

- `lib/migration-015-cold-outreach.sql` - schema: adds `acquisition_source` to visitors, `kind` to campaigns, widens unique constraint to (client_key, bucket, kind)
- `lib/migration-016-four-winds-cold-campaign.sql` - seeds the Four Winds cold campaign row (active=false until copy is finalized)
- `lib/al-segments.js` - parser for AL_SEGMENTS env var, supports both legacy flat and new nested-per-client formats
- `lib/icp/four-winds-cold.js` - validates AL records against the facilities/maintenance + company-size ICP, returns `{pass, reasons, emailEligible}`
- `lib/sequences/four-winds-cold-v1.js` - cold email sequence module (3 emails, days 0/4/10), copy approved: "40 years in, you still talk to the founders" / Talk to Tom CTA
- `app/api/admin/push-four-winds-cold-sequences/route.js` - admin endpoint to PATCH the cold sequence into the cold Instantly campaign; refuses live PATCH while placeholders remain

### Modified

- `app/api/cron/pull-audiencelab/route.js` - kind-aware iteration via the new parser; cold branch ICP-validates, cross-pipeline-dedups, and inserts with `acquisition_source='al_cold'`/`processed=true`
- `app/api/cron/push-instantly/route.js` - bucket map now keyed by `${bucket}|${kind}`; visitors are routed to cold or warm campaigns based on `acquisition_source`

---

## Hand-off checklist (in order)

1. **Run migration-015 in Neon** (run both PARTs in the file, copy-paste verify queries return sensible counts):

   ```
   lib/migration-015-cold-outreach.sql
   ```

   After this completes, `visitors` has `acquisition_source` (defaulted to `pixel` for every existing row) and `campaigns` has `kind` (defaulted to `warm`) plus the widened unique constraint `uq_campaigns_client_bucket_kind`.

2. **Verify the warm pipeline still works.** Existing warm INSERTs do not specify `acquisition_source`, so they pick up the `pixel` default. Existing campaigns rows pick up `kind='warm'`. The push-instantly cron now keys by `${bucket}|${kind}` - so warm leads continue to route to warm campaigns. Run `?dry=true` once and eyeball the result before letting the next scheduled push fire live.

3. **Update AL_SEGMENTS env var to the nested format** with the cold segment wired in. Both formats are still supported, but production needs the nested form to pick up cold:

   Old:
   ```
   AL_SEGMENTS={"four-winds":"<warm-segment-id>"}
   ```

   New (use this):
   ```
   AL_SEGMENTS={"four-winds":{"pixel":"<warm-segment-id>","al_cold":"91f6aa7b-ec8e-4863-8f4c-eb12b560fef7"}}
   ```

   Set in Vercel for production AND in any local `.env` you use.

4. **AL cold segment built (done).** Live segment `91f6aa7b-ec8e-4863-8f4c-eb12b560fef7` ("CMMS to P5 Software") filters for facilities / maintenance / operations titles at small-to-mid companies. The ICP validator in `lib/icp/four-winds-cold.js` is a backstop for the segment - it disqualifies obvious mismatches (junior titles, sub-11 employees, 2000+) without re-doing the segment's targeting work.

5. **Cold Instantly campaign created (done).** UUID `75c09b88-bcd2-4327-9cf0-19c4815a199f`. Confirm the campaign has Link Tracking ON and the campaign-level unsubscribe footer enabled before going live - both are CAN-SPAM requirements.

6. **Run migration-016 in Neon.** The UUID is already wired in. Before running, edit the `sender_address` line to replace `[VERIFY HQ ADDRESS]` with Four Winds' real postal HQ (CAN-SPAM requires a physical address in every commercial email).

   ```
   lib/migration-016-four-winds-cold-campaign.sql
   ```

7. **Sequence copy approved (done).** `lib/sequences/four-winds-cold-v1.js` is fully wired with v1 copy:
   - Email 1 (Day 0): "40 years in, the founder still takes your call" - opens with Tom + partner John, contrasts with chatbot-era CMMS vendors, single Talk-to-Tom CTA + phone + demo link
   - Email 2 (Day 4): "Still here, {{first_name}}" - the "I can't believe the founder picked up" customer quote, same CTA stack
   - Email 3 (Day 10): "Last note, {{first_name}}" - permission-based out, single Talk-to-Tom button

8. **Push the sequence to Instantly** (dry run first, then live):

   ```bash
   # Dry run - inspect the payload
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://visitorid.p5marketing.com/api/admin/push-four-winds-cold-sequences?dry=true"

   # Live push - refused if [REPLACE] markers still present
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://visitorid.p5marketing.com/api/admin/push-four-winds-cold-sequences"
   ```

9. **Flip the campaign active.** Once everything above is verified:

   ```sql
   UPDATE campaigns
   SET active = true
   WHERE client_key = 'four-winds' AND bucket = 'general_interest' AND kind = 'cold';
   ```

   The next pull-audiencelab cron run picks up the cold segment, ICP-validates, inserts cold rows. The next push-instantly cron run picks them up and pushes to the cold Instantly campaign.

---

## Cross-pipeline dedup behavior

When pull-audiencelab encounters a cold-segment row, before INSERT it checks the visitors table for ANY existing row matching by HEM, primary email, business email substring, or name+company. If found, the cold row is silently skipped (logged as `Cross-pipeline dup`). This prevents the same prospect from receiving both a warm follow-up and a cold founder-transition pitch - which would be embarrassing and obviously machine-generated.

The check is intentionally one-way: a person who arrives via the pixel AFTER they've been ingested as cold will be UPSERTed as cold (and processed=true means they won't be scored). Practical consequence: once a person is in the cold pipeline, an actual website visit from them won't kick off a warm follow-up. That's a deliberate trade-off to avoid the double-outreach failure mode. If we want to reverse it, the fix is in the warm-path `existingRow` query.

---

## ICP rules (Four Winds cold)

The AL segment does the heavy targeting work. The validator in `lib/icp/four-winds-cold.js` is a backstop for obvious mismatches.

Hard gates - row is dropped from cold ingest if any fail:

- **Job title** must match `/facilit|maintenance|maintenence|operations|engineer|plant|building|property|asset|fleet|technical operations/i` AND must NOT match disqualifiers (`/intern|student|assistant|coordinator|analyst|associate/i`)
- **Company size** must be in [11, 2000] employees (parsed from AL's `COMPANY_EMPLOYEE_COUNT` which can be `"11 to 50"`, `"1000+"`, or a single number). Sub-11 = no real facilities team. 2000+ = enterprise, almost certainly already on Maximo / SAP PM where Tom's human-first pitch lands flat. Missing size is allowed but flagged.
- **Email** must exist (personal or business)

Soft signal - row passes ICP but `email_eligible=false`:

- Has only a personal email (no business email). Cold-to-personal-Gmail is a deliverability and creepiness hit.

All ICP failure reasons are stored in `confidence_flags` (prefixed `icp:`) so you can audit dropped prospects with a single SELECT.

---

## CAN-SPAM compliance reminders

Cold commercial email MUST include:

1. A physical postal address of the sender. Lives in `campaigns.variables.sender_address`. Verify with Tom before going live - the placeholder in migration-016 says `[VERIFY HQ ADDRESS]`.
2. A functional unsubscribe mechanism. The sequence template uses `{{unsubscribe_link}}` - this should resolve to Instantly's managed unsubscribe URL. Verify in the Instantly campaign settings that the unsubscribe footer is enabled and the link in our HTML actually goes somewhere live before the first send.

If either of these is broken at send-time, you're shipping non-compliant cold email - which is both illegal and a domain-blacklist risk.

---

## Future-proofing

- Adding a second cold client: add the client to `AL_SEGMENTS`, register a validator in `COLD_ICP_VALIDATORS` in pull-audiencelab, copy the sequence + push endpoint scaffolds, run an analogue of migration-016 with their campaign ID.
- Adding more cold buckets to Four Winds (e.g. industry-specific): the campaigns table allows multiple (bucket, kind='cold') rows per client now. Just add new bucket names to the campaigns CHECK constraint (might require another migration since CHECK is enumerated) and a new entry in `FOUR_WINDS_COLD_SEQUENCES`.
- The warm pipeline is fully unchanged in behavior. If a regression appears, suspect the kind routing in push-instantly first - the bucket map is now keyed by `${bucket}|${kind}` instead of just `${bucket}`.
