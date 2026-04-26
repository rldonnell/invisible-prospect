# Session Log - Four Winds cold finalization + VisitorID/IntentID twin-funnel visual

**Date:** 2026-04-25

## What We Worked On

Closed out the Four Winds CMMS cold outreach pipeline (code + copy + env), then built a P5-branded "twin funnel" visual showing how the warm (VisitorID) and cold (IntentID) pipelines interact and produce premium "Diamond Leads." Robert is taking a break and will relaunch for TBR (The Brilliance Revolution) cold pipeline next.

## Key Decisions

- **FW cold audience pivot, locked in.** Original 2026-04-24 scaffold targeted founder/CEO transitions; that pitch is now earmarked for TBR. FW cold is facilities/maintenance/operations leads at small-to-mid companies, sourced from AL segment `91f6aa7b-ec8e-4863-8f4c-eb12b560fef7`.
- **"Jon" not "John"** for Tom's partner. Globally corrected in `lib/sequences/four-winds-cold-v1.js` and memory. The first live PATCH to Instantly went out with "John" - Robert needs to commit, redeploy, and re-PATCH to overwrite.
- **Visual labeling: VisitorID (warm) + IntentID (cold).** One-word IDs, ID capitalized. "Diamond Lead" is the term for a prospect who traverses both pipelines (engaged via cold email -> clicked through -> pixeled on site -> warm follow-up).
- **HQ postal address verified.** "Four Winds Software, Inc., 13398 Sunshine Path, Rancho Penasquitos, CA 92129, United States" - now baked into migration-016 sender_address.

## Deliverables Created

- `lib/sequences/four-winds-cold-v1.js` - all `[REPLACE: ...]` markers gone, "Jon" everywhere, `hasUnreplacedPlaceholders()` returns false.
- `lib/migration-016-four-winds-cold-campaign.sql` - real Instantly UUID `75c09b88-bcd2-4327-9cf0-19c4815a199f` + verified HQ address inline.
- `deliverables/Four_Winds_Cold_Outreach_Setup.md` - rewritten for facilities/maintenance audience, hand-off checklist updated.
- `deliverables/visitorid-intentid-twin-funnel.svg` - P5 wordmark, channel feeders (FB/IG/LI/Google/Organic -> VisitorID; Audience Lab -> IntentID), Diamond Lead loop, HOT vs DIAMOND outcomes.
- `deliverables/visitorid-intentid-twin-funnel.png` - 2400px-wide PNG render of the SVG.

## Important Details

**Canonical AL_SEGMENTS env value:**

```
AL_SEGMENTS={"sa-spine":"0d8c23ca-10b9-4ec7-9a08-d37abaf80d02","four-winds":{"pixel":"e1ec1ea9-a4bf-4287-bc60-50fede1efa42","al_cold":"91f6aa7b-ec8e-4863-8f4c-eb12b560fef7"},"tbr":"34e00e2c-6d9c-4d9f-aad1-63ad5b81e7f5","waverly-manor":"80c2a238-3596-453e-979d-fb0094efd70a","dough-babies":"df25a6ad-b040-45ff-bf88-edbab4f92afa","az-breasts":"87c40f83-af78-453b-8a7c-877e6f027277","p5":"d2b2fab3-e255-4edb-a5cf-65dd4fbb5dd5"}
```

The corruption that triggered the rebuild: FW had `"/75c09b88-bcd2-4327-9cf0-19c4815a199f"` (Instantly cold campaign UUID with leading slash) instead of an AL segment, so pull-audiencelab was 404'ing every FW warm fetch.

**FW cold sequence (approved 2026-04-25, "Talk to Tom" angle):**
- Email 1 (Day 0) - Subject: "40 years in, the founder still takes your call" / Preview: "That's why I'm writing you myself."
- Email 2 (Day 4) - Subject: "Still here, {{first_name}}" / Preview: "40 years and the same phone number."
- Email 3 (Day 10) - Subject: "Last note, {{first_name}}" / Preview: "Then I'll stop."

**Twin-funnel visual structure:**
- Top-left: small P5 Marketing wordmark (navy rounded square + black "MARKETING" letterspaced).
- Feeder band: 5 chips (Facebook, Instagram, LinkedIn, Google Ads, Organic) -> VisitorID; 1 wide chip (Audience Lab · Cold Data Segment) -> IntentID.
- Two 5-stage funnels (navy VisitorID, terracotta IntentID).
- Gold dashed feedback arrow from IntentID Engaged -> VisitorID Website Visit, label along the curve: "EMAIL CLICK DRIVES SITE VISIT."
- Two outcomes at the bottom: HOT Lead (white card, slate border) and DIAMOND Lead (cream card, gold border, diamond icon).

## Open Items / Next Steps

### Four Winds cold - to fully ship (carryover)
1. Update `AL_SEGMENTS` env to the canonical nested-FW value above in Vercel Production and local `.env`.
2. Commit + push the "Jon" spelling fix and redeploy.
3. Re-run live push: `POST /api/admin/push-four-winds-cold-sequences` (no `?dry=true`) so Instantly gets the corrected sequence body.
4. Confirm Instantly campaign `75c09b88-bcd2-4327-9cf0-19c4815a199f` has Link Tracking + unsubscribe footer enabled.
5. Watch first cron tick after env update to verify cold ingest is pulling rows from AL segment `91f6aa7b-...`.

### TBR cold pipeline - the next session's focus
- Repurpose the original founder/CEO "transition your operating brilliance" scaffold (commit `f34dad3`) into the TBR cold pipeline.
- TBR's AL warm segment is already wired as `34e00e2c-6d9c-4d9f-aad1-63ad5b81e7f5` (flat string, pixel-only).
- Adding TBR cold means switching TBR to nested form `{"tbr":{"pixel":"34e00e2c-...","al_cold":"<new-cold-segment>"}}` and registering a TBR cold ICP validator in `COLD_ICP_VALIDATORS` in `pull-audiencelab`.
- Need at session start: the AL cold segment ID for TBR + the Instantly cold campaign UUID for TBR + sender postal address.
