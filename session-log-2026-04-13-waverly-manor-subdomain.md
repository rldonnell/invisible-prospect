# Session Log: Waverly Manor Subdomain Setup
**Date:** 2026-04-13
**Duration:** ~25 minutes

## What We Worked On
Set up a new VisitorID client subdomain for Waverly Manor (waverlymanor.com), a wedding venue in Texas. Followed the same pattern established for SA Spine and the demo account — registry entry, dashboard config, and subdomain routing.

## Key Decisions
- Client key: `waverly-manor` (hyphenated, matching existing conventions)
- Subdomain: `waverly.visitorid.p5marketing.com` (DNS-friendly short name mapped to `waverly-manor` in middleware, same pattern as `saspine` → `sa-spine`)
- Vertical: `wedding-venue`
- Geo filter: Texas (TX)
- Contact email: rdonnell@p5marketing.com (temporary — Robert's own email)
- Client login password: `Tegu$1953-VisitorID` (case-sensitive — capital V, I, D)
- Admin password (DASH_PW_ADMIN): `Tegu$1953-vistorid` (note: "vistorid" not "visitorid" — this is intentional, it's the existing env var value)

## Deliverables Created
- **Code changes committed and pushed** (commit `b1871c5`): 
  - `middleware.js` — Added `waverly` → `waverly-manor` subdomain mapping
  - `app/dashboard/[client]/page.js` — Added CLIENT_NAMES ("Waverly Manor") and CLIENT_GEO (TX, Texas)
  - `deliverables/pixel-intelligence-skill/references/client_registry.json` — Added waverly-manor entry with domain, vertical, taxonomy file reference

## Important Details
- The git push succeeded: `918d05f..b1871c5 main -> main`
- The `visitorid.p5marketing.com` base domain does NOT resolve via DNS — curl gets "Could not resolve host." The working Vercel URL is `invisible-prospect.vercel.app`. Subdomain-based URLs like `demo.visitorid.p5marketing.com` do work (they have individual CNAME records in Cloudflare), but the bare `visitorid.p5marketing.com` apparently doesn't have a record.
- The repo lives at `~/Documents/Invisible-prospect` on Phil's Mac Mini (found by trial — `find` didn't locate it at first because the folder name is capitalized)
- The repo is NOT on Robert's usual machine path — `find ~ -name "invisible-prospect" -type d -maxdepth 4` returned nothing. It's on Phil's Mac.
- Robert expressed interest in creating a **skill** for this client onboarding workflow so it's repeatable without manual steps.

## Open Items / Next Steps
1. **Create client credentials in the database** — The curl to POST `/api/admin/client-credentials` has NOT been successfully run yet. First attempt failed (DNS). Needs to be re-run against `https://invisible-prospect.vercel.app/api/admin/client-credentials` with:
   - clientKey: `waverly-manor`
   - password: `Tegu$1953-VisitorID`
   - contactEmail: `rdonnell@p5marketing.com`
   - displayName: `Waverly Manor`
   - Authorization Bearer: `Tegu$1953-vistorid`

2. **Add Vercel domain** — `waverly.visitorid.p5marketing.com` needs to be added in Vercel project Settings → Domains

3. **Add Cloudflare DNS records** — CNAME (`waverly.visitorid` → `cname.vercel-dns.com`, DNS only) and TXT (`_vercel.waverly.visitorid` → verification value from Vercel)

4. **Test login** — Once credentials are created and DNS propagates, verify login works at `waverly.visitorid.p5marketing.com` with password `Tegu$1953-VisitorID` (case-sensitive)

5. **Build client onboarding skill** — Robert wants a reusable skill that handles the full new-client setup: registry, dashboard config, middleware mapping, credentials curl, and DNS instructions. This should be the next session's priority.

6. **Waverly Manor taxonomy** — A taxonomy file (`taxonomy_waverly_manor.json`) is referenced in the registry but may or may not exist yet. The explore agent found that waverly-manor taxonomy rules already exist in `lib/taxonomies.js` (59 rules), but the JSON reference file should be verified.

## Context for Future Sessions
- Memory entries: `project_visitorid_auth_system.md` has the full auth system architecture
- The invisible-prospect repo (GitHub: rldonnell/invisible-prospect) deploys to Vercel automatically on push
- Wildcard subdomains don't work with Cloudflare — each client needs individual CNAME + TXT records
- The admin endpoint is `POST /api/admin/client-credentials` with Bearer token auth (DASH_PW_ADMIN env var)
- Phil's Mac Mini has the repo at `~/Documents/Invisible-prospect`
