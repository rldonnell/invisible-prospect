"""
P5 Marketing — Pixel Intelligence Processor
Processes raw VisitorID pixel CSV exports into segmented, scored visitor intelligence.

Usage:
    python pixel_processor.py <csv_path> <client_key> "<Client Name>"

    client_key: matches a key in references/client_registry.json, or "auto" for auto-discovery
"""

import csv, json, os, re, sys
from collections import Counter, defaultdict
from urllib.parse import urlparse
from datetime import datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
REFERENCES_DIR = SCRIPT_DIR.parent / "references"

# Categories that indicate researching specific services/procedures/products
RESEARCH_CATEGORIES = {
    "Surgical Procedures", "Conditions", "Services",
    "Facial Procedures", "Body Procedures", "Breast Procedures", "Non-Surgical",
    "Product Features", "Industries",
    "Lead Magnet",
}


def load_taxonomy(client_key):
    """Load taxonomy rules from the references directory."""
    if client_key == "auto":
        return None

    registry_path = REFERENCES_DIR / "client_registry.json"
    if not registry_path.exists():
        print(f"Warning: Client registry not found at {registry_path}")
        return None

    with open(registry_path) as f:
        registry = json.load(f)

    client = registry["clients"].get(client_key)
    if not client:
        available = ", ".join(registry["clients"].keys())
        print(f"Error: Client key '{client_key}' not found. Available: {available}")
        sys.exit(1)

    taxonomy_path = REFERENCES_DIR / client["taxonomy_file"]
    if not taxonomy_path.exists():
        print(f"Warning: Taxonomy file not found at {taxonomy_path}. Using auto-discovery.")
        return None

    with open(taxonomy_path) as f:
        taxonomy_data = json.load(f)

    return [(r["pattern"], r["category"], r["subcategory"]) for r in taxonomy_data["rules"]]


def auto_discover_taxonomy(rows):
    """Build a draft taxonomy from URL patterns found in the data."""
    paths = Counter()
    for r in rows:
        path = urlparse(r.get("FULL_URL", "")).path.lower().rstrip("/")
        if path and path != "/":
            paths[path] += 1

    rules = []
    for path, count in paths.most_common():
        slug = path.split("/")[-1]

        # Auto-classify based on common patterns
        if any(kw in path for kw in ["/contact", "/get-in-touch"]):
            rules.append((path, "Intent Signals", "Contact Page"))
        elif any(kw in path for kw in ["/pricing", "/cost", "/financing", "/plans"]):
            rules.append((path, "Intent Signals", "Pricing / Financing"))
        elif any(kw in path for kw in ["/before-after", "/gallery", "/results", "/before-and-after"]):
            rules.append((path, "Intent Signals", "Before & After Gallery"))
        elif any(kw in path for kw in ["/book", "/schedule", "/consultation", "/appointment"]):
            rules.append((path, "Intent Signals", "Book Appointment"))
        elif any(kw in path for kw in ["/demo", "/trial", "/request"]):
            rules.append((path, "Intent Signals", "Demo / Trial Request"))
        elif any(kw in path for kw in ["/about", "/our-story", "/mission"]):
            rules.append((path, "General", "About"))
        elif any(kw in path for kw in ["/blog", "/news", "/article"]):
            rules.append((path, "General", "Blog / News"))
        elif any(kw in path for kw in ["/review", "/testimonial", "/case-stud"]):
            rules.append((path, "Social Proof", "Reviews / Testimonials"))
        elif any(kw in path for kw in ["/faq", "/question"]):
            rules.append((path, "General", "FAQ"))
        elif count >= 3:
            # High-traffic pages are likely service/product pages
            label = slug.replace("-", " ").replace("_", " ").title()
            rules.append((path, "Services / Products", label))
        else:
            label = slug.replace("-", " ").replace("_", " ").title()
            rules.append((path, "Other Pages", label))

    return rules


def classify_url(url, taxonomy):
    """Classify a URL against a taxonomy. Returns (category, subcategory)."""
    path = urlparse(url).path.lower().rstrip("/")
    if not path or path == "/":
        return ("Homepage", "Homepage")
    if taxonomy:
        for pattern, category, subcategory in taxonomy:
            if pattern in path:
                return (category, subcategory)
    return ("Other", path.split("/")[-1].replace("-", " ").title())


def classify_referrer(ref):
    if not ref or ref == "$direct":
        return "Direct"
    ref_lower = ref.lower()
    mapping = [
        ("google", "Google Search"), ("bing", "Bing Search"),
        ("yahoo", "Yahoo Search"), ("duckduckgo", "DuckDuckGo"),
        ("facebook", "Facebook"), ("fb.com", "Facebook"),
        ("instagram", "Instagram"), ("tiktok", "TikTok"),
        ("youtube", "YouTube"), ("linkedin", "LinkedIn"),
        ("twitter", "X/Twitter"), ("x.com", "X/Twitter"),
    ]
    for keyword, label in mapping:
        if keyword in ref_lower:
            return label
    return "Other Referral"


def score_intent(visitor_events, taxonomy):
    """Score a visitor's intent based on behavior signals."""
    score = 0
    reasons = []

    n_visits = len(visitor_events)
    if n_visits >= 4:
        score += 30
        reasons.append(f"{n_visits} visits (high frequency)")
    elif n_visits >= 2:
        score += 15
        reasons.append(f"{n_visits} visits (repeat)")
    else:
        score += 5

    categories = set()
    subcategories = set()
    for ev in visitor_events:
        cat, sub = classify_url(ev["FULL_URL"], taxonomy)
        categories.add(cat)
        subcategories.add(sub)

    visited_research = categories & RESEARCH_CATEGORIES
    if visited_research:
        score += 25
        reasons.append(f"Researched: {', '.join(visited_research)}")

    if "Intent Signals" in categories:
        intent_subs = [s for c, s in [classify_url(e["FULL_URL"], taxonomy) for e in visitor_events] if c == "Intent Signals"]
        score += 30
        reasons.append(f"High-intent pages: {', '.join(set(intent_subs))}")

    if "Provider Research" in categories:
        score += 15
        reasons.append("Researched specific providers")

    if "Social Proof" in categories:
        score += 10
        reasons.append("Viewed reviews/testimonials")

    timestamps = sorted([ev["EVENT_TIMESTAMP"] for ev in visitor_events])
    try:
        latest_dt = datetime.fromisoformat(timestamps[-1].replace("Z", "+00:00"))
        now = datetime.now(latest_dt.tzinfo)
        days_ago = (now - latest_dt).days
        if days_ago <= 3:
            score += 15
            reasons.append(f"Active {days_ago}d ago")
        elif days_ago <= 7:
            score += 10
            reasons.append(f"Active {days_ago}d ago")
        elif days_ago <= 14:
            score += 5
    except:
        pass

    if score >= 70:
        tier = "HOT"
    elif score >= 45:
        tier = "High"
    elif score >= 25:
        tier = "Medium"
    else:
        tier = "Low"

    return score, tier, reasons, list(subcategories - {"Homepage"})


def process_pixel_data(csv_path, taxonomy, client_name="Client"):
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        print("Error: CSV file is empty or has no data rows.")
        sys.exit(1)

    # Auto-discover taxonomy if none provided
    if taxonomy is None:
        print("Auto-discovering taxonomy from URL patterns...")
        taxonomy = auto_discover_taxonomy(rows)
        domain = urlparse(rows[0].get("FULL_URL", "")).netloc
        auto_path = REFERENCES_DIR / f"auto_taxonomy_{domain.replace('.', '_')}.json"
        auto_data = {
            "client": client_name,
            "domain": domain,
            "_note": "Auto-generated taxonomy. Review and refine for accuracy.",
            "rules": [{"pattern": p, "category": c, "subcategory": s} for p, c, s in taxonomy]
        }
        with open(auto_path, "w") as f:
            json.dump(auto_data, f, indent=2)
        print(f"Draft taxonomy saved to {auto_path}")

    # Group by visitor
    visitors = defaultdict(list)
    for row in rows:
        edid = row.get("EDID", "")
        if edid:
            visitors[edid].append(row)

    processed = []
    for edid, events in visitors.items():
        first = events[0]
        score, tier, reasons, interests = score_intent(events, taxonomy)

        pages = [urlparse(e["FULL_URL"]).path.rstrip("/") or "/" for e in events]
        all_cats = [classify_url(e["FULL_URL"], taxonomy) for e in events]
        categories = list(set(c for c, s in all_cats if c not in ("Homepage", "Other", "General")))
        subcategories = list(set(s for c, s in all_cats if c not in ("Homepage", "Other", "General")))

        processed.append({
            "edid": edid,
            "first_name": first.get("FIRST_NAME", ""),
            "last_name": first.get("LAST_NAME", ""),
            "email": (first.get("PERSONAL_VERIFIED_EMAILS") or first.get("PERSONAL_EMAILS", "")).split(",")[0],
            "phone": (first.get("ALL_MOBILES") or first.get("ALL_LANDLINES", "")).split(",")[0],
            "city": first.get("PERSONAL_CITY", ""),
            "state": first.get("PERSONAL_STATE", ""),
            "age_range": first.get("AGE_RANGE", ""),
            "gender": first.get("GENDER", ""),
            "income": first.get("INCOME_RANGE", ""),
            "net_worth": first.get("NET_WORTH", ""),
            "visit_count": len(events),
            "first_visit": sorted([e["EVENT_TIMESTAMP"] for e in events])[0],
            "last_visit": sorted([e["EVENT_TIMESTAMP"] for e in events])[-1],
            "pages_visited": pages,
            "referrer_source": classify_referrer(events[0].get("REFERRER_URL", "")),
            "categories": categories,
            "interests": subcategories,
            "intent_score": score,
            "intent_tier": tier,
            "intent_reasons": reasons,
            "linkedin": first.get("INDIVIDUAL_LINKEDIN_URL", ""),
        })

    processed.sort(key=lambda x: x["intent_score"], reverse=True)

    # Build summary
    total = len(processed)
    tier_counts = Counter(v["intent_tier"] for v in processed)
    category_counts = Counter()
    subcategory_counts = Counter()
    referrer_counts = Counter()
    state_counts = Counter()
    age_counts = Counter()
    gender_counts = Counter()
    income_counts = Counter()
    daily_counts = Counter()

    for v in processed:
        for c in v["categories"]:
            category_counts[c] += 1
        for s in v["interests"]:
            subcategory_counts[s] += 1
        referrer_counts[v["referrer_source"]] += 1
        if v["state"]:
            state_counts[v["state"].strip().upper()] += 1
        if v["age_range"]:
            age_counts[v["age_range"]] += 1
        if v["gender"]:
            gender_counts[v["gender"]] += 1
        if v["income"]:
            income_counts[v["income"]] += 1
        try:
            daily_counts[v["first_visit"][:10]] += 1
        except:
            pass

    summary = {
        "client_name": client_name,
        "total_events": len(rows),
        "total_visitors": total,
        "repeat_visitors": sum(1 for v in processed if v["visit_count"] > 1),
        "tier_counts": dict(tier_counts),
        "category_counts": dict(category_counts.most_common(20)),
        "subcategory_counts": dict(subcategory_counts.most_common(30)),
        "referrer_counts": dict(referrer_counts.most_common(15)),
        "state_counts": dict(state_counts.most_common(15)),
        "age_counts": dict(age_counts),
        "gender_counts": dict(gender_counts),
        "income_counts": dict(income_counts.most_common(15)),
        "daily_trend": dict(sorted(daily_counts.items())),
        "date_range": {
            "first": min(r["EVENT_TIMESTAMP"] for r in rows),
            "last": max(r["EVENT_TIMESTAMP"] for r in rows),
        },
    }

    return processed, summary


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python pixel_processor.py <csv_path> [client_key] [client_name]")
        print("  client_key: sa-spine, plastic-surgery-generic, az-breasts, four-winds, tbr, auto")
        sys.exit(1)

    csv_path = sys.argv[1]
    client_key = sys.argv[2] if len(sys.argv) > 2 else "auto"
    client_name = sys.argv[3] if len(sys.argv) > 3 else client_key.replace("-", " ").title()

    taxonomy = load_taxonomy(client_key)
    processed, summary = process_pixel_data(csv_path, taxonomy, client_name)

    # Output to current working directory (avoids read-only source dirs)
    output_path = os.environ.get("PIXEL_OUTPUT_DIR", os.getcwd())
    output_file = os.path.join(output_path, "pixel_intelligence.json")

    output = {"summary": summary, "visitors": processed}
    with open(output_file, "w") as f:
        json.dump(output, f, indent=2, default=str)

    tc = summary["tier_counts"]
    print(f"\nProcessed {summary['total_visitors']} unique visitors from {summary['total_events']} events")
    print(f"Intent tiers: HOT={tc.get('HOT',0)}, High={tc.get('High',0)}, Medium={tc.get('Medium',0)}, Low={tc.get('Low',0)}")
    print(f"Top interests: {', '.join(list(summary['subcategory_counts'].keys())[:8])}")
    print(f"\nJSON saved to {output_file}")
