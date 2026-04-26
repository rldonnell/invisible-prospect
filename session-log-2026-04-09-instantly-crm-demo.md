# Session Log: Instantly Campaign Registration, CRM Deep-Link, Demo Dashboard Refresh
**Date:** 2026-04-09
**Duration:** ~90 minutes

## What We Worked On
Continued building the VisitorID intent-based email outreach system for SA Spine. Registered all 6 Instantly campaigns in the database, added a CRM deep-link button to visitor profiles, fixed GHL push credentials for SA Spine, created a nightly auto-refresh for the demo dashboard, connected a demo GHL account, and updated the CRM button URL to the white-labeled p5mk.com domain.

## Key Decisions
- **Campaign thresholds set per bucket:** ready_to_book (conf 35, Medium tier), provider_research (40, Medium), procedure_treatment (40, Medium), condition_research (40, Low), return_visitor (35, Low), general_interest (45, Low). Rationale: higher-intent buckets get lower thresholds to cast a wider net; broadest bucket (general_interest) gets a higher confidence floor to filter noise.
- **Campaigns left active but without Instantly campaign IDs** — safe because the push cron skips campaigns with no instantly_campaign_id on non-dry runs.
- **CRM button labeled "Open in CRM"** instead of "Open in GoHighLevel" — future-proofs for potential CRM changes.
- **CRM button placed at top center of visitor profile header** — most visible position for sales demo flow.
- **CRM button URL uses white-labeled domain** app.p5mk.com instead of app.gohighlevel.com.
- **Demo auto-refresh uses date shifting** — anchors the latest visit to within 1-2 days of today so the demo always looks fresh.

## Deliverables Created
- **`deliverables/SA_Spine_Email_Sequences.docx`** — All 18 emails (6 buckets x 3 emails) in a professionally formatted Word document with variable reference table, campaign DB ID mapping, and Instantly setup checklist.
- **`deliverables/SA_Spine_Campaign_Buckets_OnePager.docx`** — Single-page summary of all 6 buckets with audience, signal, tone, thresholds, eligible counts, and sequence overview.
- **`scripts/register-sa-spine-campaigns.sh`** — Shell script for bulk campaign registration via admin API with all SA Spine variables pre-configured.
- **`app/api/cron/refresh-demo/route.js`** — New cron route that regenerates demo data nightly at 4 AM UTC (11 PM Central).
- **Updated `app/dashboard/[client]/visitor/[id]/VisitorProfile.js`** — Added "Open in CRM" button in header card.
- **Updated `app/dashboard/[client]/visitor/[id]/page.js`** — Resolves GHL location ID per client for CRM deep-link.
- **Updated `vercel.json`** — Added refresh-demo cron at "0 4 * * *".

## Important Details

### Instantly API Key
`MDQ2NDdmMGMtMzI2MS00YWM1LWEzNjctMWU0N2EwNWUyYzcyOmZocUV6c3BubXJKbg==`

### Campaign Database IDs (SA Spine)
| DB ID | Bucket | Confidence Min | Tier Min |
|-------|--------|---------------|----------|
| 1 | ready_to_book | 35 | Medium |
| 2 | provider_research | 40 | Medium |
| 3 | procedure_treatment | 40 | Medium |
| 4 | condition_research | 40 | Low |
| 5 | return_visitor | 35 | Low |
| 6 | general_interest | 45 | Low |

All 6 campaigns are **active** in the DB but have **no instantly_campaign_id yet** — waiting for Robert to create the campaigns in Instantly and PATCH the IDs.

### Campaign Variables (SA Spine)
- practice_name: SA Spine
- doctor_name: Dr. Steven Cyr
- booking_link: https://www.saspine.com/contact-us/
- phone: (210) 487-7463
- practice_focus: spinal care
- Testimonials: 9 interest-specific testimonials configured (Back Pain, Neck Pain, Sciatica, Spinal Stenosis, Herniated Disc, Scoliosis, Spine Surgery, Minimally Invasive Surgery, plus default)

### Dry Run Results
- 8,308 eligible visitors found
- 8,229 would be pushed to Instantly
- 79 skipped due to confidence/tier thresholds
- 0 failures, 0 skipped for missing campaign

### GHL Credentials
**SA Spine:**
- Location ID: jBRQvBlf1eAPev1Yvmf6
- API Key: pit-6f7e741f-0257-411f-b321-05a217e90a54
- Env vars: GHL_API_KEY_SA_SPINE, GHL_LOCATION_SA_SPINE

**Demo:**
- Location ID: sYx3vNnOIiQRBsTT7syD
- API Key: pit-aa72d363-8965-4b13-a962-1686a10dedb1
- Env vars: GHL_API_KEY_DEMO, GHL_LOCATION_DEMO

### Demo Dashboard
- URL: https://demo.visitorid.p5marketing.com (also https://saspine.visitorid.p5marketing.com/dashboard/demo)
- 9,232 anonymized visitors generated from SA Spine data
- ~43 contacts pushed to demo GHL account with CRM deep-links working
- Auto-refreshes nightly at 4 AM UTC / 11 PM Central
- Login: admin password works (Tegu$1953-vistorid — note: no second "i" in vistorid)

### DNS Added
- demo.visitorid.p5marketing.com CNAME → cname.vercel-dns.com (added to Vercel domains, valid configuration confirmed)

### GHL Location ID Env Var Fix
The GHL_LOCATION_SA_SPINE env var in Vercel had junk appended: `jBRQvBlf1eAPev1Yvmf6" node scripts/setup-ghl-fields.js`. This was cleaned up to just the location ID.

## Open Items / Next Steps
1. **Set up Instantly campaigns** — Robert plans to do this tomorrow. Create 6 campaigns in Instantly, paste email copy from the Word doc, map variable placeholders, copy each campaign ID, and PATCH them into the admin API.
2. **Add Vercel env vars for Instantly** — INSTANTLY_API_KEY and INSTANTLY_PUSH_ENABLED=true need to be added.
3. **Run final dry test** after Instantly campaign IDs are registered, then go live.
4. **SA Spine GHL push** — Credentials are now working (7 contacts created in test). The daily cron at 7 AM UTC will continue pushing batches of 10. Could increase batch size for faster initial push.
5. **Demo GHL population** — Only ~43 contacts pushed so far. The daily push-ghl cron will continue adding more automatically.
6. **Onboard additional clients** — The bucket/template structure is designed to work across verticals. TBR and other clients can be set up using the same pattern.

## Context for Future Sessions
- All VisitorID code is in the `pixel-automation` repo (GitHub: rldonnell/invisible-prospect), deployed to Vercel.
- Database is Neon Postgres (serverless).
- The complete Instantly integration architecture is documented in `VisitorID_Intent_Email_Outreach_Spec.docx` (in the repo root).
- The push-instantly cron is at `/api/cron/push-instantly` — uses CRON_SECRET for auth, supports ?dry=true and ?client= filters.
- The admin API for campaigns is at `/api/admin/campaigns` — uses DASH_PW_ADMIN for auth.
- Memory entries exist for: project_visitorid_auth_system.md, project_instantly_outreach.md, project_tbr_pixel_sequence.md, project_tbr_pixel_missing.md.
- CRM button URL hardcoded to app.p5mk.com (white-labeled GHL).
