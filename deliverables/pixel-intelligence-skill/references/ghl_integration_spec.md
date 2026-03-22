# GoHighLevel Integration Specification

## Overview

Push intent-scored visitors from the Pixel Intelligence Processor into GoHighLevel as tagged contacts, triggering automated workflows based on intent tier and interest tags.

## Architecture

```
Pixel CSV → Processor → pixel_intelligence.json → GHL Pusher → GoHighLevel CRM
                                                        ↓
                                                  Tagged Contacts
                                                        ↓
                                                  GHL Workflows
```

## Phase 2A: Manual Push (Vercel API Route)

### Endpoint: `POST /api/ghl/push-leads`

Accepts processed pixel_intelligence.json and pushes to GHL via API.

### Contact Mapping

| Pixel Field | GHL Field | Notes |
|-------------|-----------|-------|
| first_name | firstName | |
| last_name | lastName | |
| email | email | Primary identifier |
| phone | phone | First mobile, fallback to landline |
| city + state | address.city, address.state | |
| intent_tier | tag: `pixel-{tier}` | e.g., `pixel-hot`, `pixel-high` |
| interests[] | tags: `interest-{slug}` | e.g., `interest-rhinoplasty` |
| intent_score | customField: pixel_score | Numeric 0-100 |
| referrer_source | customField: pixel_source | e.g., "Google Search" |
| visit_count | customField: pixel_visits | |
| last_visit | customField: pixel_last_seen | ISO date |

### Tags Applied

Every contact gets:
- `pixel-identified` (master tag for all pixel contacts)
- `pixel-{tier}` (one of: `pixel-hot`, `pixel-high`, `pixel-medium`, `pixel-low`)
- `interest-{slug}` for each identified interest (e.g., `interest-herniated-disc`, `interest-rhinoplasty`)
- `source-{channel}` for traffic source (e.g., `source-google`, `source-facebook`)

### Deduplication

Before creating a contact, check if email already exists in GHL:
- If exists: update tags and custom fields (don't create duplicate)
- If new: create contact with full data

## Phase 2B: Automated Processing (Vercel Cron)

### Flow

1. Cron job runs daily (or on webhook trigger from pixel platform)
2. Pulls latest pixel export via API (or processes uploaded CSV from Vercel KV)
3. Runs through taxonomy engine
4. Pushes new/updated contacts to GHL
5. Logs processing results to Vercel KV

### GHL Workflow Triggers

Recommend these workflows be set up in GHL:

| Trigger Tag | Workflow | Action |
|-------------|----------|--------|
| `pixel-hot` | Hot Lead Alert | Immediate SMS/email to practice + internal notification |
| `pixel-high` | High Intent Nurture | 3-email sequence: procedure info → before/after → consult CTA |
| `pixel-medium` | Medium Intent Warm | Educational drip: 5 emails over 14 days |
| `pixel-low` | Low Intent Awareness | Add to monthly newsletter list |

### API Requirements

- GHL API v2 with OAuth or API key
- Endpoints needed:
  - `POST /contacts/` — create contact
  - `GET /contacts/lookup?email=` — dedup check
  - `PUT /contacts/{id}` — update existing
  - `POST /contacts/{id}/tags` — add tags

### Environment Variables (Vercel)

```
GHL_API_KEY=xxx
GHL_LOCATION_ID=xxx
PIXEL_API_KEY=xxx (if pulling exports via API)
```

## Phase 2C: Per-Client Configuration

Each client's Vercel project gets its own GHL connection:

```json
{
  "client_key": "sa-spine",
  "ghl_location_id": "loc_xxx",
  "ghl_api_key": "key_xxx",
  "taxonomy": "sa-spine",
  "pixel_id": "15a3e4e9-...",
  "cron_schedule": "0 6 * * *",
  "hot_lead_notify": "+1-210-555-0000"
}
```
