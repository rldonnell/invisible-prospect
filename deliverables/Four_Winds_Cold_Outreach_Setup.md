# Four Winds Cold Outreach - Setup & Hand-off

**Date:** 2026-04-24
**Status:** Code scaffold complete. Cold pipeline NOT yet live - sequence copy is placeholder, campaign row inactive, cold AL segment ID not yet wired.

---

## What this is

A second outreach pipeline for Four Winds CMMS, running alongside the existing warm pixel-driven follow-up. The cold pipeline targets older founders / CEOs / owner-operators sourced from a separate Audience Lab segment, with the pitch centered on transitioning operating brilliance so the business can run without constant founder management.

The two pipelines share infrastructure (Instantly webhook, blocklist, cleanup cron, admin dashboard) but are fully separated where it matters: separate AL segments, separate Instantly campaigns, separate sending accounts, ICP-validated ingest, and cross-pipeline dedup so the same prospect can never receive both.

---

## Architecture

| | Warm | Cold |
|---|---|---|
| Source | Audience Lab pixel segment | Audience Lab cold segment |
| `acquisition_source` | `pixel` | `al_cold` |
| Campaign `kind` | `warm` | `cold` |
| ICP gate | none (pixel implies interest) | hard gate at ingest |
| Scoring | full processor (process-visitors cron) | bypass; inserted at intent_tier='High', processed=true |
| Instantly campaign | warm campaign, warm sending accounts | separate cold campaign, separate sending accounts |
| Sequence file | `lib/sequences/four-winds-v1.js` (live) | `lib/sequences/four-winds-cold-v1.js` (placeholder) |

---

## Files added or modified

### New

- `lib/migration-015-cold-outreach.sql` - schema: adds `acquisition_source` to visitors, `kind` to campaigns, widens unique constraint to (client_key, bucket, kind)
- `lib/migration-016-four-winds-cold-campaign.sql` - seeds the Four Winds cold campaign row (active=false until copy is finalized)
- `lib/al-segments.js` - parser for AL_SEGMENTS env var, supports both legacy flat and new nested-per-client formats
- `lib/icp/four-winds-cold.js` - validates AL records against the founder/CEO + company-size ICP, returns `{pass, reasons, emailEligible}`
- `lib/sequences/four-winds-cold-v1.js` - cold email sequence module (3 emails, days 0/4/10) with `[REPLACE: ...]` placeholders for every subject line and body
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

3. **Update AL_SEGMENTS env var to the nested format** (only when you're ready to add the cold segment). Both formats are supported, so this can be deferred.

   Old:
   ```
   AL_SEGMENTS={"four-winds":"<warm-segment-id>"}
   ```

   New:
   ```
   AL_SEGMENTS={"four-winds":{"pixel":"<warm-segment-id>","al_cold":"<cold-segment-id>"}}
   ```

   Set in Vercel for production AND in any local `.env` you use.

4. **Build the AL cold segment.** In Audience Lab, create a new segment that filters for older founders/CEOs at small-to-mid companies (5-1000 employees). Age filter goes HERE, upstream - the email copy never references age. Grab the segment UUID and use it in step 3.

5. **Create the cold Instantly campaign.** Separate from the warm one. Use different sending accounts (a deliverability hit on a cold campaign should never bleed into warm). Suggested name: "Four Winds COLD - General Interest - v1". Enable Link Tracking AND the campaign-level unsubscribe footer (CAN-SPAM). Grab the campaign UUID.

6. **Run migration-016 in Neon** with the real cold campaign UUID substituted in:

   ```
   lib/migration-016-four-winds-cold-campaign.sql
   ```

   Verify the `sender_address` field has Four Winds' real postal HQ (CAN-SPAM requires a physical address in every commercial email).

7. **Replace every `[REPLACE: ...]` marker** in `lib/sequences/four-winds-cold-v1.js`. Three emails, three subjects, three preview lines, three bodies. Tom-voice, founder-direct, transition-pitch. Per Robert: do NOT reference age in copy.

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

Hard gates - row is dropped from cold ingest if any fail:

- **Job title** must match `/founder|co-founder|ceo|owner|owner-operator|president|principal|managing partner|managing director|proprietor/i` AND must NOT match disqualifiers (`/intern|student|assistant|coordinator|manager of|of marketing|head of/i`)
- **Company size** must be in [5, 1000] employees (parsed from AL's `COMPANY_EMPLOYEE_COUNT` which can be `"11-50"`, `"1000+"`, or a single number). Missing size is allowed but flagged.
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
