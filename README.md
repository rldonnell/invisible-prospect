# Invisible Prospect

**An ICP-driven intent intelligence platform that turns anonymous website traffic into qualified pipeline.**

Roughly 95% of website visitors leave without filling out a form. Invisible Prospect identifies those visitors, validates their identity against a multi-signal confidence model, scores their intent against a defined Ideal Customer Profile, and routes the qualified ones into the client's CRM and outbound systems — automatically, every day.

Currently running in production for high-trust service practices (medical, professional services) under the **VisitorID™** brand at [visitorid.p5marketing.com](https://visitorid.p5marketing.com).

---

## What it does

For each website visitor identified by [Audience Lab](https://audiencelab.io), Invisible Prospect:

1. **Enriches** the visitor record with personal and firmographic data (name, address, age range, employment, income range, net worth, homeowner status, phone, multiple email addresses).
2. **Scores identity confidence** against multi-signal validation: name-email match, phone-state match, page-depth pattern, enrichment completeness, bot-likelihood ratio, in-market signal.
3. **Scores intent** against the client's defined ICP, weighted by visit count, page depth, return-visit recency, traffic source, and behavioral signals.
4. **Tiers** the visitor into one of four outreach buckets: HOT (immediate outreach), High (priority nurture), Medium (standard follow-up), or Low (awareness).
5. **Routes** qualified leads to the client's GoHighLevel CRM sub-account and to Instantly for tiered email outreach across six behavioral campaigns: general interest, condition research, return visitor, procedures and treatment, provider research, and ready-to-book.
6. **Generates** a daily client-specific hot-lead digest delivered to the client team for immediate action.

The entire pipeline runs on Vercel cron, processes overnight, and produces a fresh dashboard view each morning.

---

## Live system

A **Demo Practice (Anonymized)** dashboard runs on a synthetic dataset for prospect demonstrations. The production system serves five active client tenants across medical aesthetics, spine surgery, professional services, and hospitality.

Sample 30-day metrics from the demo tenant:

| Metric | Value |
|---|---|
| Total identified visitors | 3,624 |
| All-time identified visitors | 13,388 |
| HOT — immediate outreach | 81 |
| High Intent — priority nurture | 1,910 |
| Medium — standard follow-up | 1,633 |
| Return visitors | 83 |

---

## Architecture

```
                    ┌─────────────────┐
                    │  Audience Lab   │
                    │ (identification │
                    │   data source)  │
                    └────────┬────────┘
                             │
                             ▼  daily pull
                  ┌──────────────────────┐
                  │  Neon Postgres (raw) │
                  └──────────┬───────────┘
                             │
                             ▼  scoring + filtering
            ┌─────────────────────────────────┐
            │  Two-axis scoring engine        │
            │   • Identity Confidence (0–100) │
            │   • Intent Score (0–135+)       │
            │   • ICP-driven, deterministic   │
            └────────────┬────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
    ┌──────────────────┐   ┌──────────────────┐
    │ GoHighLevel CRM  │   │   Instantly      │
    │ (per-client      │   │  (6-bucket email │
    │  sub-account)    │   │   retargeting)   │
    └──────────────────┘   └──────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │ Client Dashboard │
              │  (Next.js 14,    │
              │   multi-tenant,  │
              │   HMAC auth)     │
              └──────────────────┘
```

---

## Scoring methodology

Each visitor is evaluated on two independent axes.

### Identity Confidence (0–100)

A visitor's identity confidence is built from positive and negative signals fired during enrichment and validation:

| Positive signals | Negative signals |
|---|---|
| `+ name matches email` | `- bot-like ratio` |
| `+ phone matches state` | `- out of market` |
| `+ multi-page depth` | `- mismatched email` |
| `+ has enrichment` | |
| `+ in market` | |
| `+ high visit count` | |

The system surfaces the active signals to dashboard users, so client teams can see exactly *why* a record scored the way it did. This transparency is unusual in lead-qualification systems — most competitors present scores as opaque outputs.

### Intent Score (0–135+)

Intent is evaluated against the client's uploaded ICP definition, weighted by:

- Number of pages visited
- Page-depth pattern (which pages, in what order)
- Return-visit recency (re-engagement from retargeting amplifies the score)
- Traffic source quality (organic vs. paid vs. direct)
- Time-on-site signals
- ICP-match score against the client's defined profile

Visitors are then sorted into HOT / High / Medium / Low tiers based on combined Intent × Confidence.

---

## Multi-tenancy

Each client tenant is configured via environment variables and a per-client segment map. Clients can be added without code changes by:

1. Adding a new entry to `AL_SEGMENTS` (Audience Lab segment ID per client)
2. Adding the client key to `ACTIVE_CLIENTS`
3. (Optional) Setting per-client `GHL_API_KEY_{CLIENT}` and `GHL_LOCATION_{CLIENT}` for sub-account routing
4. (Optional) Adding a client-specific digest cron entry in `vercel.json`

The dashboard isolates each tenant. Admin users can switch between tenants; client users see only their own data.

---

## Tech stack

- **Application** — Next.js 14 (App Router), React 18
- **Database** — Neon Postgres (serverless, pooled connections)
- **Identification source** — Audience Lab API
- **CRM** — GoHighLevel (multi-tenant sub-accounts)
- **Email outreach** — Instantly
- **Transactional email** — Postmark
- **Auth** — bcrypt + HMAC-signed dashboard sessions
- **Reporting** — ExcelJS for spreadsheet exports, custom React dashboards for in-app
- **Deployment** — Vercel (serverless functions, cron, static hosting)

---

## Pipeline (daily cron schedule)

Configured in `vercel.json`. Runs daily on a sequenced schedule designed to ensure each step completes before the next begins.

| Time (UTC) | Endpoint | Purpose |
|---|---|---|
| 04:00 | `/api/cron/refresh-demo` | Refresh the demo tenant dataset |
| 05:00 | `/api/cron/pull-audiencelab` | Pull identified visitors from Audience Lab |
| 06:00 | `/api/cron/process-visitors` | Score, validate, and tier visitors |
| 07:00 | `/api/cron/push-ghl` | Push qualified leads to GoHighLevel CRM |
| 08:00 | `/api/cron/cleanup-instantly` | Maintenance on cold-email lists |
| 12:00 | `/api/cron/push-instantly` | Push tiered cohorts to Instantly retargeting |
| 13:00 | `/api/cron/sa-spine-hot-digest` | Generate client-specific daily hot-lead digest |

---

## Engineering with Claude

This system was designed and built in close collaboration with Anthropic's Claude. The scoring rules, multi-signal validation logic, and pipeline architecture were developed iteratively in conversation — Claude served as engineering partner for the technical design, while domain expertise on lead qualification, marketing operations, and ICP construction came from twenty-five years of running a marketing agency.

The runtime is fully deterministic JavaScript — no LLM calls in the hot path. Claude's contribution lives in the design of the system, the codification of marketing judgment into rules, and the implementation of those rules as fast, predictable, production-grade code.

The result is a system that combines marketing operator-level judgment with engineering speed — a combination that is unusually rare in the lead-qualification space, where the engineering-led tools lack marketing nuance and the marketing-led tools lack technical sophistication.

---

## About

Built and operated by [P5 Marketing](https://p5marketing.com), an independent agency that has been delivering demand generation and direct-response marketing for clinical practices and high-ticket service businesses since 1996.

Founder: Robert Donnell — Pepperdine MBA & MSA, 25+ years in SEO and lead generation, agency founder, AI workflow specialist.

For inquiries about deploying Invisible Prospect for your practice or business, visit [p5marketing.com](https://p5marketing.com) or [visitorid.p5marketing.com](https://visitorid.p5marketing.com).

---

*Invisible Prospect and VisitorID™ are products of P5 Marketing.* All rights reserved
