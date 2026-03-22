# New Client Setup — Four Winds, TBR, Waverly Manor

## 1. Vercel Environment Variables

Add these to the Vercel project settings → Environment Variables:

```
# Update ACTIVE_CLIENTS (add the three new keys)
ACTIVE_CLIENTS=sa-spine,az-breasts,four-winds,tbr,waverly-manor

# Four Winds CMMS
GHL_API_KEY_FOUR_WINDS=pit-1118ff9f-8f1b-4d18-bfd1-60d8f212485f
GHL_LOCATION_FOUR_WINDS=EIYFFGv4vzTXjtrUmaaE

# The Brilliance Revolution
GHL_API_KEY_TBR=pit-4cb89659-676c-4f47-b208-5cd1fcda631e
GHL_LOCATION_TBR=lxwqV5EPvU3ERLdQE7uK

# Waverly Manor
GHL_API_KEY_WAVERLY_MANOR=pit-9129e968-c815-46cb-979f-c9738c180eae
GHL_LOCATION_WAVERLY_MANOR=flOyjYOyCCrxhNJxt8M6
```

---

## 2. Audience Lab Webhook Payloads

All three clients use the same webhook endpoint. Only the `client_key` changes.

**Webhook URL:**
```
https://<YOUR-VERCEL-APP>.vercel.app/api/webhook/pixel
```

**Headers (same for all):**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <YOUR_WEBHOOK_SECRET>"
}
```

---

### Four Winds CMMS

```json
{
  "client_key": "four-winds",
  "visitor": {
    "PIXEL_ID": "{{PIXEL_ID}}",
    "HEM_SHA256": "{{HEM_SHA256}}",
    "EVENT_TIMESTAMP": "{{EVENT_TIMESTAMP}}",
    "REFERRER_URL": "{{REFERRER_URL}}",
    "FULL_URL": "{{FULL_URL}}",
    "EDID": "{{EDID}}",
    "FIRST_NAME": "{{FIRST_NAME}}",
    "LAST_NAME": "{{LAST_NAME}}",
    "PERSONAL_ADDRESS": "{{PERSONAL_ADDRESS}}",
    "PERSONAL_CITY": "{{PERSONAL_CITY}}",
    "PERSONAL_STATE": "{{PERSONAL_STATE}}",
    "PERSONAL_ZIP": "{{PERSONAL_ZIP}}",
    "PERSONAL_ZIP4": "{{PERSONAL_ZIP4}}",
    "AGE_RANGE": "{{AGE_RANGE}}",
    "CHILDREN": "{{CHILDREN}}",
    "GENDER": "{{GENDER}}",
    "HOMEOWNER": "{{HOMEOWNER}}",
    "MARRIED": "{{MARRIED}}",
    "NET_WORTH": "{{NET_WORTH}}",
    "INCOME_RANGE": "{{INCOME_RANGE}}",
    "ALL_LANDLINES": "{{ALL_LANDLINES}}",
    "LANDLINE_DNC": "{{LANDLINE_DNC}}",
    "ALL_MOBILES": "{{ALL_MOBILES}}",
    "MOBILE_DNC": "{{MOBILE_DNC}}",
    "PERSONAL_EMAILS": "{{PERSONAL_EMAILS}}",
    "PERSONAL_VERIFIED_EMAILS": "{{PERSONAL_VERIFIED_EMAILS}}",
    "SHA256_PERSONAL_EMAIL": "{{SHA256_PERSONAL_EMAIL}}",
    "COMPANY_NAME": "{{COMPANY_NAME}}",
    "COMPANY_DESCRIPTION": "{{COMPANY_DESCRIPTION}}",
    "COMPANY_EMPLOYEE_COUNT": "{{COMPANY_EMPLOYEE_COUNT}}",
    "COMPANY_DOMAIN": "{{COMPANY_DOMAIN}}",
    "COMPANY_ADDRESS": "{{COMPANY_ADDRESS}}",
    "COMPANY_CITY": "{{COMPANY_CITY}}",
    "COMPANY_STATE": "{{COMPANY_STATE}}",
    "COMPANY_ZIP": "{{COMPANY_ZIP}}",
    "COMPANY_PHONE": "{{COMPANY_PHONE}}",
    "COMPANY_REVENUE": "{{COMPANY_REVENUE}}",
    "COMPANY_SIC": "{{COMPANY_SIC}}",
    "COMPANY_NAICS": "{{COMPANY_NAICS}}",
    "COMPANY_INDUSTRY": "{{COMPANY_INDUSTRY}}",
    "BUSINESS_EMAIL": "{{BUSINESS_EMAIL}}",
    "BUSINESS_VERIFIED_EMAILS": "{{BUSINESS_VERIFIED_EMAILS}}",
    "SHA256_BUSINESS_EMAIL": "{{SHA256_BUSINESS_EMAIL}}",
    "JOB_TITLE": "{{JOB_TITLE}}",
    "HEADLINE": "{{HEADLINE}}",
    "DEPARTMENT": "{{DEPARTMENT}}",
    "SENIORITY_LEVEL": "{{SENIORITY_LEVEL}}",
    "INFERRED_YEARS_EXPERIENCE": "{{INFERRED_YEARS_EXPERIENCE}}",
    "COMPANY_NAME_HISTORY": "{{COMPANY_NAME_HISTORY}}",
    "JOB_TITLE_HISTORY": "{{JOB_TITLE_HISTORY}}",
    "EDUCATION_HISTORY": "{{EDUCATION_HISTORY}}",
    "COMPANY_LINKEDIN_URL": "{{COMPANY_LINKEDIN_URL}}",
    "INDIVIDUAL_LINKEDIN_URL": "{{INDIVIDUAL_LINKEDIN_URL}}",
    "INDIVIDUAL_TWITTER_URL": "{{INDIVIDUAL_TWITTER_URL}}",
    "INDIVIDUAL_FACEBOOK_URL": "{{INDIVIDUAL_FACEBOOK_URL}}",
    "SKILLS": "{{SKILLS}}",
    "INTERESTS": "{{INTERESTS}}"
  }
}
```

---

### The Brilliance Revolution (TBR)

```json
{
  "client_key": "tbr",
  "visitor": {
    "PIXEL_ID": "{{PIXEL_ID}}",
    "HEM_SHA256": "{{HEM_SHA256}}",
    "EVENT_TIMESTAMP": "{{EVENT_TIMESTAMP}}",
    "REFERRER_URL": "{{REFERRER_URL}}",
    "FULL_URL": "{{FULL_URL}}",
    "EDID": "{{EDID}}",
    "FIRST_NAME": "{{FIRST_NAME}}",
    "LAST_NAME": "{{LAST_NAME}}",
    "PERSONAL_ADDRESS": "{{PERSONAL_ADDRESS}}",
    "PERSONAL_CITY": "{{PERSONAL_CITY}}",
    "PERSONAL_STATE": "{{PERSONAL_STATE}}",
    "PERSONAL_ZIP": "{{PERSONAL_ZIP}}",
    "PERSONAL_ZIP4": "{{PERSONAL_ZIP4}}",
    "AGE_RANGE": "{{AGE_RANGE}}",
    "CHILDREN": "{{CHILDREN}}",
    "GENDER": "{{GENDER}}",
    "HOMEOWNER": "{{HOMEOWNER}}",
    "MARRIED": "{{MARRIED}}",
    "NET_WORTH": "{{NET_WORTH}}",
    "INCOME_RANGE": "{{INCOME_RANGE}}",
    "ALL_LANDLINES": "{{ALL_LANDLINES}}",
    "LANDLINE_DNC": "{{LANDLINE_DNC}}",
    "ALL_MOBILES": "{{ALL_MOBILES}}",
    "MOBILE_DNC": "{{MOBILE_DNC}}",
    "PERSONAL_EMAILS": "{{PERSONAL_EMAILS}}",
    "PERSONAL_VERIFIED_EMAILS": "{{PERSONAL_VERIFIED_EMAILS}}",
    "SHA256_PERSONAL_EMAIL": "{{SHA256_PERSONAL_EMAIL}}",
    "COMPANY_NAME": "{{COMPANY_NAME}}",
    "COMPANY_DESCRIPTION": "{{COMPANY_DESCRIPTION}}",
    "COMPANY_EMPLOYEE_COUNT": "{{COMPANY_EMPLOYEE_COUNT}}",
    "COMPANY_DOMAIN": "{{COMPANY_DOMAIN}}",
    "COMPANY_ADDRESS": "{{COMPANY_ADDRESS}}",
    "COMPANY_CITY": "{{COMPANY_CITY}}",
    "COMPANY_STATE": "{{COMPANY_STATE}}",
    "COMPANY_ZIP": "{{COMPANY_ZIP}}",
    "COMPANY_PHONE": "{{COMPANY_PHONE}}",
    "COMPANY_REVENUE": "{{COMPANY_REVENUE}}",
    "COMPANY_SIC": "{{COMPANY_SIC}}",
    "COMPANY_NAICS": "{{COMPANY_NAICS}}",
    "COMPANY_INDUSTRY": "{{COMPANY_INDUSTRY}}",
    "BUSINESS_EMAIL": "{{BUSINESS_EMAIL}}",
    "BUSINESS_VERIFIED_EMAILS": "{{BUSINESS_VERIFIED_EMAILS}}",
    "SHA256_BUSINESS_EMAIL": "{{SHA256_BUSINESS_EMAIL}}",
    "JOB_TITLE": "{{JOB_TITLE}}",
    "HEADLINE": "{{HEADLINE}}",
    "DEPARTMENT": "{{DEPARTMENT}}",
    "SENIORITY_LEVEL": "{{SENIORITY_LEVEL}}",
    "INFERRED_YEARS_EXPERIENCE": "{{INFERRED_YEARS_EXPERIENCE}}",
    "COMPANY_NAME_HISTORY": "{{COMPANY_NAME_HISTORY}}",
    "JOB_TITLE_HISTORY": "{{JOB_TITLE_HISTORY}}",
    "EDUCATION_HISTORY": "{{EDUCATION_HISTORY}}",
    "COMPANY_LINKEDIN_URL": "{{COMPANY_LINKEDIN_URL}}",
    "INDIVIDUAL_LINKEDIN_URL": "{{INDIVIDUAL_LINKEDIN_URL}}",
    "INDIVIDUAL_TWITTER_URL": "{{INDIVIDUAL_TWITTER_URL}}",
    "INDIVIDUAL_FACEBOOK_URL": "{{INDIVIDUAL_FACEBOOK_URL}}",
    "SKILLS": "{{SKILLS}}",
    "INTERESTS": "{{INTERESTS}}"
  }
}
```

---

### Waverly Manor

```json
{
  "client_key": "waverly-manor",
  "visitor": {
    "PIXEL_ID": "{{PIXEL_ID}}",
    "HEM_SHA256": "{{HEM_SHA256}}",
    "EVENT_TIMESTAMP": "{{EVENT_TIMESTAMP}}",
    "REFERRER_URL": "{{REFERRER_URL}}",
    "FULL_URL": "{{FULL_URL}}",
    "EDID": "{{EDID}}",
    "FIRST_NAME": "{{FIRST_NAME}}",
    "LAST_NAME": "{{LAST_NAME}}",
    "PERSONAL_ADDRESS": "{{PERSONAL_ADDRESS}}",
    "PERSONAL_CITY": "{{PERSONAL_CITY}}",
    "PERSONAL_STATE": "{{PERSONAL_STATE}}",
    "PERSONAL_ZIP": "{{PERSONAL_ZIP}}",
    "PERSONAL_ZIP4": "{{PERSONAL_ZIP4}}",
    "AGE_RANGE": "{{AGE_RANGE}}",
    "CHILDREN": "{{CHILDREN}}",
    "GENDER": "{{GENDER}}",
    "HOMEOWNER": "{{HOMEOWNER}}",
    "MARRIED": "{{MARRIED}}",
    "NET_WORTH": "{{NET_WORTH}}",
    "INCOME_RANGE": "{{INCOME_RANGE}}",
    "ALL_LANDLINES": "{{ALL_LANDLINES}}",
    "LANDLINE_DNC": "{{LANDLINE_DNC}}",
    "ALL_MOBILES": "{{ALL_MOBILES}}",
    "MOBILE_DNC": "{{MOBILE_DNC}}",
    "PERSONAL_EMAILS": "{{PERSONAL_EMAILS}}",
    "PERSONAL_VERIFIED_EMAILS": "{{PERSONAL_VERIFIED_EMAILS}}",
    "SHA256_PERSONAL_EMAIL": "{{SHA256_PERSONAL_EMAIL}}",
    "COMPANY_NAME": "{{COMPANY_NAME}}",
    "COMPANY_DESCRIPTION": "{{COMPANY_DESCRIPTION}}",
    "COMPANY_EMPLOYEE_COUNT": "{{COMPANY_EMPLOYEE_COUNT}}",
    "COMPANY_DOMAIN": "{{COMPANY_DOMAIN}}",
    "COMPANY_ADDRESS": "{{COMPANY_ADDRESS}}",
    "COMPANY_CITY": "{{COMPANY_CITY}}",
    "COMPANY_STATE": "{{COMPANY_STATE}}",
    "COMPANY_ZIP": "{{COMPANY_ZIP}}",
    "COMPANY_PHONE": "{{COMPANY_PHONE}}",
    "COMPANY_REVENUE": "{{COMPANY_REVENUE}}",
    "COMPANY_SIC": "{{COMPANY_SIC}}",
    "COMPANY_NAICS": "{{COMPANY_NAICS}}",
    "COMPANY_INDUSTRY": "{{COMPANY_INDUSTRY}}",
    "BUSINESS_EMAIL": "{{BUSINESS_EMAIL}}",
    "BUSINESS_VERIFIED_EMAILS": "{{BUSINESS_VERIFIED_EMAILS}}",
    "SHA256_BUSINESS_EMAIL": "{{SHA256_BUSINESS_EMAIL}}",
    "JOB_TITLE": "{{JOB_TITLE}}",
    "HEADLINE": "{{HEADLINE}}",
    "DEPARTMENT": "{{DEPARTMENT}}",
    "SENIORITY_LEVEL": "{{SENIORITY_LEVEL}}",
    "INFERRED_YEARS_EXPERIENCE": "{{INFERRED_YEARS_EXPERIENCE}}",
    "COMPANY_NAME_HISTORY": "{{COMPANY_NAME_HISTORY}}",
    "JOB_TITLE_HISTORY": "{{JOB_TITLE_HISTORY}}",
    "EDUCATION_HISTORY": "{{EDUCATION_HISTORY}}",
    "COMPANY_LINKEDIN_URL": "{{COMPANY_LINKEDIN_URL}}",
    "INDIVIDUAL_LINKEDIN_URL": "{{INDIVIDUAL_LINKEDIN_URL}}",
    "INDIVIDUAL_TWITTER_URL": "{{INDIVIDUAL_TWITTER_URL}}",
    "INDIVIDUAL_FACEBOOK_URL": "{{INDIVIDUAL_FACEBOOK_URL}}",
    "SKILLS": "{{SKILLS}}",
    "INTERESTS": "{{INTERESTS}}"
  }
}
```

---

## 3. Audience Lab Pixel Setup Checklist

For each client:

1. Create a new pixel in Audience Lab for the client's domain
2. Install the pixel script on the client's website
3. Configure the webhook:
   - **URL:** `https://<YOUR-VERCEL-APP>.vercel.app/api/webhook/pixel`
   - **Method:** POST
   - **Headers:** `Authorization: Bearer <WEBHOOK_SECRET>` and `Content-Type: application/json`
   - **Payload:** Use the JSON above (only `client_key` differs)
4. Test with a single event before enabling real-time flow

| Client | Domain | client_key | Pixel Domain |
|--------|--------|------------|-------------|
| Four Winds CMMS | fourwindscmms.com | `four-winds` | fourwindscmms.com |
| The Brilliance Revolution | thebrilliancerevolution.com | `tbr` | thebrilliancerevolution.com |
| Waverly Manor | waverlymanor.com | `waverly-manor` | waverlymanor.com |
