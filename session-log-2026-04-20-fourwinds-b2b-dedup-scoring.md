# Session Log: Four Winds B2B Ingest + Scoring Overhaul + Dedup

**Date:** 2026-04-20
**Duration:** ~3 hours

## What We Worked On

Troubleshot Four Winds (fourwindscmms.com) reporting issue that turned out to span four separate problems, each fixed in one continuous session: (1) a B2B-shaped Audience Lab segment the ingest couldn't parse, (2) scoring logic that rewarded ad-clicker visits the same as real intent, (3) a new `return-visitor` flag/tag feature requested across all clients, (4) duplicate rows in Four Winds caused by the same person appearing twice in the DB with different dedup keys. Also set up the `four.visitorid.p5marketing.com` subdomain for the client dashboard.

## Key Decisions

- **B2B email fallback:** `pull-audiencelab/route.js` now tries `PERSONAL_VERIFIED_EMAILS → PERSONAL_EMAILS → BUSINESS_VERIFIED_EMAILS → BUSINESS_EMAIL` as identity. Consumer shape preserved; B2B records now ingest instead of being silently skipped.
- **Scoring change #1 — halve freq bonus for single-page visitors.** When `uniquePaths ≤ 1`, visit-frequency bonus is halved (2-3 visits → +2, 4-6 → +7, 7+ → +15). Real intent shows as browsing depth, not repeated hits on one landing page.
- **Scoring change #2 — return-visitor HOT promotion.** Visitor with 2+ distinct UTC dates AND 2+ unique pathnames AND confidence_score ≥ 40 → force-promoted to HOT tier AND tagged `return-visitor`. Tag flows through to GHL via existing `buildTags()`. Multi-page gate on the return-visitor check prevents ad-retargeting loops from qualifying.
- **Rejected: explicit ad-clicker tier cap.** Showed Robert the dry-run impact (would have demoted 17,695 HOT/High records across all clients, e.g. SA Spine 10,240 High → ~3,000). Too disruptive. The frequency-bonus halving alone already demotes most of these naturally. Can add the explicit cap later if needed.
- **Dedup strategy: pre-insert lookup by secondary identity.** Before each INSERT, look for existing row matching by (a) primary email, (b) first business email (handles AL comma-separated lists), or (c) exact case-insensitive first+last+company. If found, UPDATE that row; else INSERT. Applies to ALL clients. Handles the case where the same person appears once with a HEM-based key and once with an email-based key.
- **Merge winner rule:** For one-time dedup cleanup, winner = row with highest visit_count (tie-break: lowest id = oldest). Old rows typically have real visit history; newer duplicates from today's backfill had placeholder NOW timestamps.
- **Name+company match = exact only** (case-insensitive). Safer than fuzzy matching; accepted the small risk of under-merging for two-people-same-name-same-company edge cases.
- **Delivery split:** Backend changes now, dashboard UI refresh (badge, stat tile, filter, trend chart, HOT reason labels) deferred to a follow-up session.
- **Four Winds subdomain** = `four` (not `fourwinds` or `four-winds`). Explicit mapping `four: 'four-winds'` added to middleware.js SUBDOMAIN_TO_CLIENT.

## Deliverables Created

**Code changes (pixel-automation repo):**

1. `app/api/cron/pull-audiencelab/route.js` — TWO changes:
   - Email extraction fallback to BUSINESS_VERIFIED_EMAILS / BUSINESS_EMAIL (committed + deployed)
   - Pre-insert lookup by email / business_email / name+company (**uncommitted, pending Robert's push**)

2. `lib/scoring.js` — Halved freq bonus for single-page visitors + new `detectReturnVisitor(visitor)` exported helper (committed + deployed)

3. `app/api/cron/process-visitors/route.js` — Imports `detectReturnVisitor`, applies HOT promotion gated on confidence_score ≥ 40, appends `return-visitor` to tags (committed + deployed)

4. `middleware.js` — Added `four: 'four-winds'` to SUBDOMAIN_TO_CLIENT (**uncommitted, pending Robert's push**)

**DB operations executed:**

- Reset `processed = FALSE` on all 31,426 visitors, re-scored all clients under new logic
- Four Winds cleanup: merged 140 duplicate groups, deleted losers, kept 142 unique rows
- Purged 4 bogus rows with unreplaced `{{first_name}} {{last_name}}` template placeholders (fwaverly-manor id=13047 with 3,668 visits; tbr id=14076; four-winds id=13964; waverly-manor id=16885)
- Created `client_credentials` row for `four-winds` with bcrypt hash, `rdonnell@p5marketing.com` contact, "Four Winds CMMS" display name

**Memory files created:**

- `memory/project_fourwinds_b2b_email_fallback.md` — documents the business-email fallback
- `memory/project_visitor_dedup_secondary_identity.md` — documents the pre-insert dedup logic

## Important Details

### Four Winds final state (post-cleanup + re-scoring)

```
Tier distribution:
  HOT      10    (all 10 are return-visitors — promoted by new logic)
  High     70
  Medium   61
  Low       1
  Total   142   (was 283 before dedup)

return-visitor tag: 10 rows
```

### All-clients impact of new scoring

Return-visitor tags applied: **493 visitors across 7 clients** — az-breasts 135, sa-spine 135, demo 133, waverly-manor 40, dough-babies 37, four-winds 11, tbr 2.

HOT count changes from re-scoring:
- sa-spine: 114 → 152 (+38)
- az-breasts: 271 → 153 (ad-clicker bonus halving)
- waverly-manor: 18 → 42 (+24)
- dough-babies: 317 → 51 (heavy ad-clicker demotion via halving)
- four-winds: 0 → 11 (first HOTs ever for Four Winds)
- tbr: 1 → 2
- demo: 107 → 133

### AL segment specifics

- Four Winds current segment: `2b1b0d14-14b5-4307-89a7-71f5d4af2f86` (name: "only first", 1,082 total records, 22 pages)
- Old segment required verified business email — returned only 1-2 matchable records/day
- New segment is broader; ~22% of records carry BUSINESS_VERIFIED_EMAILS; ~78% have only first/last/company (un-ingestable without synthetic dedup key — we chose NOT to store these)
- Records from this segment lack `EVENT_TIMESTAMP` and `FULL_URL`, so first_visit/last_visit fell back to NOW at backfill time (dashboard will show the backfill as a single-day spike)

### Duplicate detection findings

Four Winds had 140 dup groups in 283 rows. Dedup key split: 141 HEM-based, 142 `email:...` based. Dup sources:
- 20 business_email pairs (same biz email across two rows)
- 15 name+company-only pairs (different emails, same person at same company)
- 2 primary-email pairs
- Many more caught by connected-components union (name+company overlapping with biz_email from yet another row)

### Four Winds subdomain setup state

- middleware.js edit made (uncommitted)
- client_credentials row created: id=7, contact=rdonnell@p5marketing.com, display="Four Winds CMMS", password=20p526 (6 chars — weak, flagged to Robert)
- DNS is on **Cloudflare** (p5marketing.com NS: max/anna.ns.cloudflare.com); no wildcard record; each subdomain added individually
- Existing subdomains (tbr, waverly, saspine) resolve to 216.150.x.x (Vercel anycast)
- Pending: Vercel → Settings → Domains → add `four.visitorid.p5marketing.com`; Cloudflare → add A/CNAME record per Vercel instructions (DNS only, gray cloud)

## Open Items / Next Steps

1. **Robert needs to git-push the uncommitted changes:**
   ```
   cd ~/Documents/pixel-automation && git add app/api/cron/pull-audiencelab/route.js middleware.js && git commit -m "pull-audiencelab: pre-check email/business_email/name+company before INSERT; middleware: add four→four-winds subdomain" && git push origin main
   ```

2. **Vercel + Cloudflare for Four Winds subdomain:**
   - Vercel: add `four.visitorid.p5marketing.com`
   - Cloudflare: add DNS record per Vercel's instructions, DNS-only gray cloud
   - Test login at https://four.visitorid.p5marketing.com with password `20p526`

3. **Rotate three credentials that were shared in chat:**
   - Neon DB password (Neon → Settings → Reset)
   - Audience Lab API key (AL dashboard → API keys)
   - CRON_SECRET (Vercel env var + redeploy)

4. **NEXT SESSION — Dashboard UI refresh** (already scoped with Robert):
   - "Return Visitors" stat tile on each client dashboard
   - "Return" or "2x" badge next to visitor names carrying the `return-visitor` tag
   - New "Return Visitor" filter option in the tier dropdown
   - New-vs-Return trend chart
   - HOT reason labels (why is this visitor HOT: high-intent pages vs return-visitor vs research pages)
   - Scope: edit `app/dashboard/[client]/page.js` (server component) to add return-visitor count and daily series, and `DashboardClient.js` to render the new UI

5. **Upgrade Four Winds password** when Robert gets a chance (6 chars is weak).

6. **Investigate the template-placeholder bug.** Four rows had literal `{{first_name}}` strings. Likely an AL pixel config that's not substituting Mustache variables. Check HFCM snippet config on fwaverly-manor / waverly-manor / tbr / four-winds sites.

## Context for Future Sessions

- **Memory entries already exist** for the key decisions in this session:
  - `project_fourwinds_b2b_email_fallback.md`
  - `project_visitor_dedup_secondary_identity.md`
- **File paths for dashboard work** next session:
  - `/Users/phil/Documents/pixel-automation/app/dashboard/[client]/page.js` (server component, 293 lines — where to add return-visitor query + daily histogram)
  - `/Users/phil/Documents/pixel-automation/app/dashboard/[client]/DashboardClient.js` (client component, 839 lines — where badges, tiles, filters, charts render)
  - `/Users/phil/Documents/pixel-automation/app/api/dashboard/[client]/route.js` (API endpoint if used — but the page.js uses SQL directly, not this API)
- **Four Winds-specific context:**
  - Client key: `four-winds`
  - Subdomain: `four`
  - Domain: fourwindscmms.com
  - Vertical: B2B SaaS (CMMS software)
  - GHL key: `GHL_API_KEY_FOUR_WINDS` = `pit-1118ff9f-8f1b-4d18-bfd1-60d8f212485f`
  - GHL location: `EIYFFGv4vzTXjtrUmaaE`
- **Related prior session:** 2026-04-07 TBR session where the "stale segment" pattern was first diagnosed (saved in `project_tbr_pixel_missing.md`). That was my initial wrong hypothesis today before the DB query showed the real issue was code, not segment.
- **Preferences reaffirmed this session:**
  - Terminal commands with real values baked in (no `YOUR_SECRET_HERE` placeholders)
  - No em-dashes in copy (use " - " hyphen-with-spaces)
  - Ship backend changes with dashboard UI deferred, when both are in scope
