---
name: client-brief
description: >
  Generate a comprehensive client intelligence brief for any P5 Marketing client.
  Pulls together client context references, Gmail communications, recent meetings (Fireflies),
  Google Calendar, Google Drive strategy docs, Slack threads, and SEO health (Ahrefs/DataForSEO)
  into a single actionable readout with a composite health score.
  Use this skill whenever the user asks for a client brief, client status, client health,
  client review, account review, or says things like "brief me on [client]",
  "where are we with [client]", "what's happening with [client]", "client health for [client]",
  "how is [client] doing", or "pull up [client]". Also use when the user asks about
  client health scores, the client dashboard, or wants to prepare for a client meeting.
  This skill should trigger even if the user just names a client and asks a broad question
  about status or progress.
---

# Client Intelligence Brief

You are generating a comprehensive client intelligence brief for a P5 Marketing client. This brief is the single source of truth for understanding where things stand with a client — what services they're on, what was discussed recently, what communications are active, and whether the account is healthy.

## Step 1: Identify the Client

Extract the client name from the user's request. Look up the client in `references/client-context.md` — this is the authoritative source for client identification. It contains:
- Client name and domain
- Relationship type
- Active services
- Key contacts
- Notes and context that data alone wouldn't reveal

If the match is ambiguous (e.g., "CYR" could match CYR MD or LeCyr), ask the user to clarify.

### Relationship Types

Every client falls into one of these categories. The relationship type fundamentally changes how you interpret the data and score the account:

- **Full Service** — Active retainer with multiple programs running. This is the default assumption for clients with services listed and regular activity. Health scoring uses all dimensions at full weight.
- **Advisory/Monitoring** — Small engagement, periodic check-ins, consulting as needed. Lower communication frequency is *expected* and healthy. Score should be calibrated: monthly contact is fine. Focus health scoring on responsiveness (do they reply when contacted?) and whether the advisory scope is being delivered.
- **Project-Based** — Defined scope with an end date. Health scoring should weight deliverable momentum heavily and flag scope creep or timeline slippage.
- **Prospective** — Not yet a client, in sales process. No health score — instead show pipeline stage, last touchpoint, and next action.
- **Loss/Former** — Left P5 but may still have a small paid connection or occasionally reach out. A burst of activity doesn't mean they're a full client again. Score should reflect the actual engagement scope, not the volume of recent communications.
- **Internal** — P5 Marketing itself. Different scoring — focus on internal project momentum.

If the relationship type isn't documented in `references/client-context.md`, infer it from the data and flag your assumption in the brief so Robert can confirm or correct it.

## Step 2: Gather Data (in parallel where possible)

Pull from all available sources. Launch these data-gathering calls in parallel to save time:

**a) Gmail**
- `gmail_search_messages` for the client domain or key contact emails, last 14 days
- For important threads, use `gmail_read_thread` to get full context

**b) Fireflies Transcripts**
- `fireflies_get_transcripts` filtered by participant email (key contact) or keyword (client name), last 30 days
- For the most recent 1-2 transcripts, pull the full summary and action items

**c) Google Calendar**
- `gcal_list_events` with a search query for the client name, next 14 days — find upcoming meetings
- Also search the last 14 days for recent meetings

**d) Google Drive**
- `google_drive_search` for ICP documents, strategy docs, or reports mentioning the client name

**e) Slack**
- `slack_search_public_and_private` for recent mentions of the client name or domain — catch internal team discussions about the client

**f) Ahrefs / DataForSEO** (for SEO clients only)
- If the client has SEO services, pull domain overview metrics (DR, organic traffic, referring domains)
- Use DataForSEO for keyword rankings, backlink summary, and domain analytics as needed

Not all sources will return data for every client — that's fine. Use what's available.

## Step 3: Identify Services & Programs

Read the `references/p5-services.md` file for the full P5 service catalog. Cross-reference what `references/client-context.md` shows with what you see in recent communications, meeting transcripts, and Slack discussions to build an accurate picture of which services are active.

For each active service, note its current status:
- **Active & Healthy** — work is happening, communications confirm activity
- **Active but Stalled** — service is supposed to be running but no recent activity visible
- **Setup/Onboarding** — being configured, not yet producing results
- **Paused** — explicitly on hold
- **Not Subscribed** — client doesn't have this service

## Step 4: Calculate Health Score

The health score is a composite 0-100 that tells you at a glance whether this client relationship is thriving or needs attention. **The relationship type adjusts expectations** — an Advisory client scoring 60 with monthly contact is perfectly healthy, while a Full Service client at 60 needs attention.

For **Advisory/Monitoring** clients: monthly communication scores 25/25, and the overall bar for "Thriving" drops to 65+. For **Project-Based** clients: deliverable momentum gets 35 points (doubled) and communication frequency drops to 15 points.

Calculate from these four dimensions (Full Service weights shown — adjust per relationship type):

### Activity Recency (30 points)
How recently has there been meaningful activity (meeting, email exchange, deliverable update)?
- Within 7 days: 30
- 8-14 days: 24
- 15-21 days: 15
- 22-30 days: 6
- 30+ days: 0

### Communication Frequency (25 points)
How often are we in contact? Meetings and substantive emails count.
- Weekly or more: 25
- Biweekly: 20
- Monthly: 10
- Less than monthly: 4
- No communication in 30+ days: 0

### Deliverable Momentum (25 points)
Based on what's visible in emails, meetings, and Drive — are milestones being hit? Is work product being delivered and discussed?
- Clear evidence of active deliverables and progress: 25
- Some work visible but pace is slow: 18
- Minimal evidence of deliverable activity: 10
- No deliverables tracked or visible: 12 (neutral — some clients are maintenance-only)

### SEO/Digital Trajectory (20 points) — SEO clients only
Is organic traffic/DR trending up, flat, or down? For non-SEO clients, redistribute these points proportionally across the other three dimensions.
- Trending up: 20
- Stable: 13
- Declining: 4

### Score Interpretation
- **80-100**: Thriving. Strong engagement, work moving, relationship healthy.
- **60-79**: Healthy but watch. Minor gaps — maybe communication has slowed or deliverables aren't visible.
- **40-59**: Needs attention. Significant gaps in communication or unclear what's being delivered.
- **0-39**: At risk. Client has gone quiet, or there are serious issues.

## Step 5: Generate the Brief

Format the output as a clean, scannable document. The structure should be:

```
CLIENT INTELLIGENCE BRIEF
[Client Name] — [Domain]
Relationship: [Full Service | Advisory/Monitoring | Project-Based | Prospective | Loss/Former | Internal]
Generated: [Date]

HEALTH SCORE: [Score]/100 — [Interpretation]
[One-sentence explanation of what's driving the score]
[If relationship type was inferred: "⚠ Relationship type inferred — confirm or update via client context."]

---

SERVICES & PROGRAMS
[Service Name] .............. [Status]
[Service Name] .............. [Status]
[Service Name] .............. [Status]

---

RECENT CONVERSATIONS
[Meeting Title] — [Date]
[2-3 sentence summary]
Key action items: [list]

[Meeting Title] — [Date]
[2-3 sentence summary]
Key action items: [list]

---

COMMUNICATIONS PULSE
[Summary of recent email activity — volume, key threads, any unanswered items]
Last contact: [date and context]

[Summary of relevant Slack discussions about this client, if any]

---

UPCOMING
[Upcoming meetings from Google Calendar, next 14 days]
[Any deadlines or milestones mentioned in recent communications]

---

STRATEGIC DIRECTION
[Synthesize from meeting transcripts, Drive docs, and email threads. What are we building toward for this client? What's the current focus?]

---

SEO & DIGITAL HEALTH (if applicable)
Domain Rating: [X]
Organic Traffic: [X] ([trend])
Referring Domains: [X]
Key Changes: [notable ranking shifts, new/lost backlinks]

---

ICP SUMMARY (if available)
[Pull from Drive docs if found. If not, note "ICP not yet documented in Drive."]

---

RECOMMENDATIONS
[Auto-generated based on gaps identified during the analysis]
- If communication has gone quiet: "Schedule a check-in call"
- If deliverables aren't visible: "Confirm current deliverable status with the team"
- If SEO is declining: "Review SEO strategy — organic traffic down X%"
- If no upcoming meetings: "Consider scheduling a touchpoint"
```

## Step 6: Deliver the Brief

Present the brief directly in the conversation. If the user wants it as a document, offer to save as a markdown file or create a formatted HTML version.

When used as part of the morning briefing or client dashboard, provide a condensed version:
- Client name, health score, one-line status, top action item
- This condensed format is used when briefing across ALL clients

## Multi-Client Rollup

If the user asks for a rollup across all clients (or the weekly digest uses this skill), generate a summary table:

```
CLIENT HEALTH DASHBOARD — [Date]

Client                  Score   Status          Top Priority
────────────────────────────────────────────────────────────
[Client A]              85      Thriving        [Top action]
[Client B]              72      Healthy/Watch   [Top action]
[Client C]              45      Needs Attention [Top action]
...
```

Sort by health score ascending so the clients needing the most attention are at the top.

For the multi-client rollup, pull the client list from `references/client-context.md` — this is the authoritative roster.
