#!/bin/bash
# Register all 6 SA Spine email outreach campaigns
# Usage: ADMIN_PW=your-admin-password ./scripts/register-sa-spine-campaigns.sh
#
# These campaigns are created INACTIVE. Once you create the matching campaigns
# in Instantly and have their campaign IDs, PATCH each one to add the
# instantly_campaign_id and set active=true.

BASE_URL="${APP_URL:-https://visitorid.p5marketing.com}"
AUTH="Authorization: Bearer ${ADMIN_PW:?Set ADMIN_PW environment variable}"

# Shared variables for all SA Spine campaigns
SHARED_VARS='{
  "practice_name": "SA Spine",
  "doctor_name": "Dr. Steven Cyr",
  "booking_link": "https://www.saspine.com/contact-us/",
  "phone": "(210) 487-7463",
  "practice_focus": "spinal care",
  "testimonials": {
    "default": "SA Spine helped me get back to living my life pain-free.",
    "Back Pain": "After years of back pain, Dr. Cyr and the SA Spine team helped me find real relief.",
    "Neck Pain": "I can finally turn my head without wincing. The team at SA Spine changed everything.",
    "Sciatica": "The shooting pain down my leg is gone. I wish I had come to SA Spine sooner.",
    "Spinal Stenosis": "Dr. Cyr explained my spinal stenosis clearly and gave me options that actually worked.",
    "Herniated Disc": "I was terrified of surgery, but Dr. Cyr helped me explore every option first.",
    "Scoliosis": "SA Spine took my scoliosis seriously and built a plan that fit my life.",
    "Spine Surgery": "Dr. Cyr and his team made my spine surgery experience as smooth as possible.",
    "Minimally Invasive Surgery": "I was back on my feet in days, not weeks. Minimally invasive was the right call."
  }
}'

echo "=== Registering 6 SA Spine campaigns at ${BASE_URL} ==="
echo ""

# 1. ready_to_book — highest intent, lowest threshold
echo "1/6  ready_to_book..."
curl -s -X POST "${BASE_URL}/api/admin/campaigns" \
  -H "Content-Type: application/json" \
  -H "${AUTH}" \
  -d "{
    \"clientKey\": \"sa-spine\",
    \"bucket\": \"ready_to_book\",
    \"confidenceMin\": 35,
    \"minTier\": \"Medium\",
    \"active\": false,
    \"variables\": ${SHARED_VARS}
  }" | jq .
echo ""

# 2. provider_research
echo "2/6  provider_research..."
curl -s -X POST "${BASE_URL}/api/admin/campaigns" \
  -H "Content-Type: application/json" \
  -H "${AUTH}" \
  -d "{
    \"clientKey\": \"sa-spine\",
    \"bucket\": \"provider_research\",
    \"confidenceMin\": 40,
    \"minTier\": \"Medium\",
    \"active\": false,
    \"variables\": ${SHARED_VARS}
  }" | jq .
echo ""

# 3. procedure_treatment
echo "3/6  procedure_treatment..."
curl -s -X POST "${BASE_URL}/api/admin/campaigns" \
  -H "Content-Type: application/json" \
  -H "${AUTH}" \
  -d "{
    \"clientKey\": \"sa-spine\",
    \"bucket\": \"procedure_treatment\",
    \"confidenceMin\": 40,
    \"minTier\": \"Medium\",
    \"active\": false,
    \"variables\": ${SHARED_VARS}
  }" | jq .
echo ""

# 4. condition_research
echo "4/6  condition_research..."
curl -s -X POST "${BASE_URL}/api/admin/campaigns" \
  -H "Content-Type: application/json" \
  -H "${AUTH}" \
  -d "{
    \"clientKey\": \"sa-spine\",
    \"bucket\": \"condition_research\",
    \"confidenceMin\": 40,
    \"minTier\": \"Low\",
    \"active\": false,
    \"variables\": ${SHARED_VARS}
  }" | jq .
echo ""

# 5. return_visitor
echo "5/6  return_visitor..."
curl -s -X POST "${BASE_URL}/api/admin/campaigns" \
  -H "Content-Type: application/json" \
  -H "${AUTH}" \
  -d "{
    \"clientKey\": \"sa-spine\",
    \"bucket\": \"return_visitor\",
    \"confidenceMin\": 35,
    \"minTier\": \"Low\",
    \"active\": false,
    \"variables\": ${SHARED_VARS}
  }" | jq .
echo ""

# 6. general_interest
echo "6/6  general_interest..."
curl -s -X POST "${BASE_URL}/api/admin/campaigns" \
  -H "Content-Type: application/json" \
  -H "${AUTH}" \
  -d "{
    \"clientKey\": \"sa-spine\",
    \"bucket\": \"general_interest\",
    \"confidenceMin\": 45,
    \"minTier\": \"Low\",
    \"active\": false,
    \"variables\": ${SHARED_VARS}
  }" | jq .
echo ""

echo "=== Done. All 6 campaigns registered as INACTIVE. ==="
echo ""
echo "Next steps:"
echo "  1. Create 6 campaigns in Instantly.ai with the email sequences"
echo "  2. Copy each Instantly campaign ID"
echo "  3. PATCH each campaign here to add the instantly_campaign_id and set active=true:"
echo ""
echo "     curl -X PATCH \${BASE_URL}/api/admin/campaigns/<DB_ID> \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -H 'Authorization: Bearer \${ADMIN_PW}' \\"
echo "       -d '{\"instantlyCampaignId\": \"INSTANTLY_UUID\", \"active\": true}'"
