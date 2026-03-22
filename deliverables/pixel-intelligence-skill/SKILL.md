---
name: pixel-intelligence
description: "Process VisitorID pixel CSV exports into segmented, intent-scored patient/prospect intelligence reports with interactive dashboards and Excel exports. Use this skill whenever the user uploads a pixel export CSV, mentions pixel data, asks for an Invisible Patient Report, wants to analyze website visitor data from the VisitorID pixel, needs to segment visitors by procedure or service interest, wants intent scoring on identified visitors, asks to process pixel data for any P5 client, or mentions GoHighLevel lead tagging from pixel data. Also trigger when the user says things like 'run the pixel report', 'process this pixel data', 'invisible patient report for [client]', 'who visited [client] website', 'segment these visitors', or 'score these leads'. This skill supports multiple clients — each with their own URL-to-interest taxonomy — and can auto-discover taxonomies from new pixel data."
---

# Pixel Intelligence Processor

Transform raw VisitorID pixel CSV exports into actionable, segmented intelligence reports. Each identified visitor gets tagged with what they're researching (procedures, conditions, products, features) and scored for purchase/conversion intent.

## What This Skill Does

1. **Ingests** a raw pixel CSV export (the standard format from the VisitorID pixel)
2. **Maps** each visitor's page views to a client-specific taxonomy (e.g., `/rhinoplasty` → "Facial Procedures > Rhinoplasty")
3. **Scores intent** based on visit frequency, page depth, high-intent signals (contact pages, pricing, galleries), provider research, and recency
4. **Segments** visitors into tiers: HOT, High, Medium, Low
5. **Generates** an interactive HTML dashboard ("Invisible Patient Report") and an Excel export with the full scored visitor list

## How to Use

### Step 1: Identify the Client

Check `references/client_registry.json` to see if this client already has a taxonomy. If not, the processor can auto-discover one from the URL patterns in the data.

### Step 2: Run the Processor

```bash
python3 <skill-path>/scripts/pixel_processor.py <path-to-csv> <client-key> "<Client Display Name>"
```

Client keys available in the registry: `sa-spine`, `plastic-surgery-generic`, `az-breasts`, `four-winds`, `tbr`

The processor outputs:
- `pixel_intelligence.json` — Full processed data (used by dashboard generator)
- Console summary of tier counts and top interests

### Step 3: Generate the Dashboard

```bash
python3 <skill-path>/scripts/generate_dashboard.py <path-to-pixel_intelligence.json> "<output-path>.html"
```

This creates a self-contained HTML file with:
- KPI cards (total visitors, high-intent count, repeat visitors, avg score)
- Interactive filters (intent tier, interest/procedure, traffic source)
- Charts (intent distribution, top interests, traffic sources, daily trend)
- Sortable priority patient table

### Step 4: Generate the Excel Export

```bash
python3 <skill-path>/scripts/generate_excel.py <path-to-pixel_intelligence.json> "<output-path>.xlsx"
```

Three sheets: Priority List (scored visitors), Summary Stats, Interest Breakdown.

### Auto-Discovery Mode (New Clients)

If a client doesn't have a taxonomy yet, pass `auto` as the client key:

```bash
python3 <skill-path>/scripts/pixel_processor.py <path-to-csv> auto "New Client Name"
```

The processor will:
1. Extract all unique URL paths from the data
2. Group them by pattern (common path segments)
3. Apply smart defaults (pages with `/contact`, `/pricing`, `/book` → Intent Signals; pages with doctor names → Provider Research)
4. Output a draft taxonomy to `references/auto_taxonomy_<domain>.json`
5. Process the data using the draft taxonomy

You can then review and refine the auto-generated taxonomy for future runs.

## Outputs Explained

### Intent Scoring Model

| Signal | Points | Why |
|--------|--------|-----|
| 4+ visits | +30 | High engagement, actively researching |
| 2-3 visits | +15 | Repeat interest |
| Visited procedure/condition pages | +25 | Researching specific services |
| Visited high-intent pages (contact, pricing, before/after) | +30 | Ready to take action |
| Researched specific providers | +15 | Comparing/choosing a doctor |
| Active in last 3 days | +15 | Hot timing |
| Active in last 7 days | +10 | Recent interest |

### Intent Tiers

| Tier | Score | Meaning |
|------|-------|---------|
| HOT | 70+ | Multiple strong signals — reach out immediately |
| High | 45-69 | Active researcher, likely in decision phase |
| Medium | 25-44 | Interested but early in journey |
| Low | <25 | Single visit, browsing |

## Phase 2: GoHighLevel Integration

The processor outputs tagged visitor data ready for GHL import. The planned integration (Vercel automation) will:
1. Watch for new pixel exports (webhook or scheduled pull)
2. Process through the taxonomy engine
3. Push contacts to GoHighLevel with tags: `pixel-hot`, `pixel-high`, `pixel-medium`, `pixel-low` plus interest tags like `interest-rhinoplasty`, `interest-herniated-disc`
4. Trigger GHL workflows based on tags (e.g., HOT leads get immediate notification to practice)

See `references/ghl_integration_spec.md` for the detailed specification.
