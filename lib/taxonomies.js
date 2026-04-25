/**
 * Client Taxonomy Registry
 *
 * Maps URL patterns to categories/subcategories for each client.
 * Each rule: { pattern: "regex or path fragment", category: "...", subcategory: "..." }
 *
 * High-intent patterns (contact, pricing, gallery, before-after, schedule) get bonus scoring.
 */

export const CLIENT_TAXONOMIES = {
  "sa-spine": {
    name: "SA Spine",
    rules: [
      // ── Conditions ──
      { pattern: "cervical-lordosis", category: "Conditions", subcategory: "Cervical Lordosis / Neck Curve" },
      { pattern: "neck-curve", category: "Conditions", subcategory: "Cervical Lordosis / Neck Curve" },
      { pattern: "loss-of-cervical-lordosis", category: "Conditions", subcategory: "Cervical Lordosis / Neck Curve" },
      { pattern: "herniated-disc", category: "Conditions", subcategory: "Herniated Disc" },
      { pattern: "degenerative-disc", category: "Conditions", subcategory: "Degenerative Disc Disease" },
      { pattern: "spinal-stenosis", category: "Conditions", subcategory: "Spinal Stenosis" },
      { pattern: "dextroscoliosis", category: "Conditions", subcategory: "Dextroscoliosis" },
      { pattern: "levoscoliosis", category: "Conditions", subcategory: "Levoscoliosis" },
      { pattern: "scoliosis", category: "Conditions", subcategory: "Scoliosis" },
      { pattern: "sciatica", category: "Conditions", subcategory: "Sciatica" },
      { pattern: "spondylolisthesis", category: "Conditions", subcategory: "Spondylolisthesis" },
      { pattern: "compression-fracture", category: "Conditions", subcategory: "Compression Fracture" },
      { pattern: "pinched-nerve", category: "Conditions", subcategory: "Pinched Nerve" },
      { pattern: "l5-and-s1", category: "Conditions", subcategory: "L5-S1 Disc Problems" },
      { pattern: "l5-s1", category: "Conditions", subcategory: "L5-S1 Disc Problems" },
      { pattern: "lower-back-pain", category: "Conditions", subcategory: "Lower Back Pain" },
      { pattern: "neck-pain", category: "Conditions", subcategory: "Neck Pain" },
      { pattern: "back-pain", category: "Conditions", subcategory: "Back Pain" },
      { pattern: "spinal-deformity", category: "Conditions", subcategory: "Spinal Deformity" },

      // ── Surgical Procedures ──
      { pattern: "spinal-fusion", category: "Surgical Procedures", subcategory: "Spinal Fusion" },
      { pattern: "lumbar-fusion", category: "Surgical Procedures", subcategory: "Lumbar Fusion" },
      { pattern: "cervical-fusion", category: "Surgical Procedures", subcategory: "ACDF (Cervical Fusion)" },
      { pattern: "acdf", category: "Surgical Procedures", subcategory: "ACDF (Cervical Fusion)" },
      { pattern: "disc-replacement", category: "Surgical Procedures", subcategory: "Disc Replacement" },
      { pattern: "laminectomy", category: "Surgical Procedures", subcategory: "Laminectomy" },
      { pattern: "microdiscectomy", category: "Surgical Procedures", subcategory: "Microdiscectomy" },
      { pattern: "minimally-invasive", category: "Surgical Procedures", subcategory: "Minimally Invasive Surgery" },
      { pattern: "kyphoplasty", category: "Surgical Procedures", subcategory: "Kyphoplasty" },
      { pattern: "foraminotomy", category: "Surgical Procedures", subcategory: "Foraminotomy" },
      { pattern: "revision-surgery", category: "Surgical Procedures", subcategory: "Revision Surgery" },
      { pattern: "scoliosis-surgery", category: "Surgical Procedures", subcategory: "Scoliosis Surgery" },
      { pattern: "scoliosis-correction", category: "Surgical Procedures", subcategory: "Scoliosis Surgery" },

      // ── Services ──
      { pattern: "physical-therapy", category: "Services", subcategory: "Physical Therapy" },
      { pattern: "neurology", category: "Services", subcategory: "Neurology" },
      { pattern: "interventional-pain", category: "Services", subcategory: "Interventional Pain" },
      { pattern: "pain-management", category: "Services", subcategory: "Interventional Pain" },
      { pattern: "management-services", category: "Services", subcategory: "Management Services" },

      // ── Providers ──
      { pattern: "steven-j-cyr", category: "Provider Research", subcategory: "Dr. Steven Cyr" },
      { pattern: "dr-cyr", category: "Provider Research", subcategory: "Dr. Steven Cyr" },
      { pattern: "steven-cyr", category: "Provider Research", subcategory: "Dr. Steven Cyr" },
      { pattern: "anjali-jain", category: "Provider Research", subcategory: "Dr. Anjali Jain" },
      { pattern: "dr-jain", category: "Provider Research", subcategory: "Dr. Anjali Jain" },
      { pattern: "john-sladky", category: "Provider Research", subcategory: "Dr. John Sladky" },
      { pattern: "dr-sladky", category: "Provider Research", subcategory: "Dr. John Sladky" },
      { pattern: "marcus-trejo", category: "Provider Research", subcategory: "Dr. Marcus Trejo" },
      { pattern: "dr-trejo", category: "Provider Research", subcategory: "Dr. Marcus Trejo" },
      { pattern: "our-team", category: "Provider Research", subcategory: "Team Page" },
      { pattern: "spine-center", category: "Provider Research", subcategory: "Spine Center (General)" },

      // ── High Intent ──
      { pattern: "contact", category: "High Intent", subcategory: "Contact Page" },
      { pattern: "appointment", category: "High Intent", subcategory: "Appointment Request" },
      { pattern: "patient-forms", category: "High Intent", subcategory: "Patient Forms" },
      { pattern: "insurance", category: "High Intent", subcategory: "Insurance Info" },
      { pattern: "before-after", category: "High Intent", subcategory: "Before & After Gallery" },
      { pattern: "before-and-after", category: "High Intent", subcategory: "Before & After Gallery" },
      { pattern: "testimonial", category: "High Intent", subcategory: "Testimonials" },
      { pattern: "review", category: "High Intent", subcategory: "Reviews" },
    ]
  },

  "plastic-surgery-generic": {
    name: "Plastic Surgery (Generic)",
    rules: [
      // Facial
      { pattern: "rhinoplasty", category: "Facial Procedures", subcategory: "Rhinoplasty" },
      { pattern: "facelift", category: "Facial Procedures", subcategory: "Facelift" },
      { pattern: "blepharoplasty", category: "Facial Procedures", subcategory: "Blepharoplasty" },
      { pattern: "brow-lift", category: "Facial Procedures", subcategory: "Brow Lift" },
      { pattern: "chin", category: "Facial Procedures", subcategory: "Chin Augmentation" },
      { pattern: "otoplasty", category: "Facial Procedures", subcategory: "Otoplasty" },
      { pattern: "neck-lift", category: "Facial Procedures", subcategory: "Neck Lift" },
      // Body
      { pattern: "liposuction", category: "Body Procedures", subcategory: "Liposuction" },
      { pattern: "tummy-tuck", category: "Body Procedures", subcategory: "Tummy Tuck" },
      { pattern: "abdominoplasty", category: "Body Procedures", subcategory: "Abdominoplasty" },
      { pattern: "body-lift", category: "Body Procedures", subcategory: "Body Lift" },
      { pattern: "mommy-makeover", category: "Body Procedures", subcategory: "Mommy Makeover" },
      { pattern: "bbl", category: "Body Procedures", subcategory: "Brazilian Butt Lift" },
      { pattern: "arm-lift", category: "Body Procedures", subcategory: "Arm Lift" },
      // Breast
      { pattern: "breast-augmentation", category: "Breast Procedures", subcategory: "Breast Augmentation" },
      { pattern: "breast-lift", category: "Breast Procedures", subcategory: "Breast Lift" },
      { pattern: "breast-reduction", category: "Breast Procedures", subcategory: "Breast Reduction" },
      { pattern: "breast-revision", category: "Breast Procedures", subcategory: "Breast Revision" },
      { pattern: "breast-implant", category: "Breast Procedures", subcategory: "Breast Implants" },
      // Non-Surgical
      { pattern: "botox", category: "Non-Surgical", subcategory: "Botox" },
      { pattern: "filler", category: "Non-Surgical", subcategory: "Dermal Fillers" },
      { pattern: "coolsculpting", category: "Non-Surgical", subcategory: "CoolSculpting" },
      { pattern: "laser", category: "Non-Surgical", subcategory: "Laser Treatments" },
      { pattern: "chemical-peel", category: "Non-Surgical", subcategory: "Chemical Peels" },
      { pattern: "microneedling", category: "Non-Surgical", subcategory: "Microneedling" },
      // High Intent
      { pattern: "before-after", category: "High Intent", subcategory: "Before & After Gallery" },
      { pattern: "gallery", category: "High Intent", subcategory: "Photo Gallery" },
      { pattern: "pricing", category: "High Intent", subcategory: "Pricing Page" },
      { pattern: "financing", category: "High Intent", subcategory: "Financing" },
      { pattern: "consultation", category: "High Intent", subcategory: "Consultation Request" },
      { pattern: "contact", category: "High Intent", subcategory: "Contact Page" },
      { pattern: "schedule", category: "High Intent", subcategory: "Schedule Appointment" },
    ]
  },

  "az-breasts": {
    name: "AZ Breasts",
    rules: [
      { pattern: "breast-augmentation", category: "Breast Procedures", subcategory: "Breast Augmentation" },
      { pattern: "breast-lift", category: "Breast Procedures", subcategory: "Breast Lift" },
      { pattern: "breast-reduction", category: "Breast Procedures", subcategory: "Breast Reduction" },
      { pattern: "breast-revision", category: "Breast Procedures", subcategory: "Breast Revision" },
      { pattern: "breast-implant", category: "Breast Procedures", subcategory: "Breast Implants" },
      { pattern: "implant-removal", category: "Breast Procedures", subcategory: "Implant Removal" },
      { pattern: "gynecomastia", category: "Breast Procedures", subcategory: "Gynecomastia" },
      { pattern: "before-after", category: "High Intent", subcategory: "Before & After Gallery" },
      { pattern: "gallery", category: "High Intent", subcategory: "Photo Gallery" },
      { pattern: "pricing", category: "High Intent", subcategory: "Pricing Page" },
      { pattern: "financing", category: "High Intent", subcategory: "Financing" },
      { pattern: "consultation", category: "High Intent", subcategory: "Consultation Request" },
      { pattern: "contact", category: "High Intent", subcategory: "Contact Page" },
      { pattern: "about", category: "Provider Research", subcategory: "About the Doctor" },
      { pattern: "testimonial", category: "Provider Research", subcategory: "Testimonials" },
      { pattern: "review", category: "Provider Research", subcategory: "Reviews" },
    ]
  },

  "four-winds": {
    name: "Four Winds CMMS",
    rules: [
      { pattern: "work-order", category: "Product Features", subcategory: "Work Order Management" },
      { pattern: "preventive-maintenance", category: "Product Features", subcategory: "Preventive Maintenance" },
      { pattern: "asset-management", category: "Product Features", subcategory: "Asset Management" },
      { pattern: "inventory", category: "Product Features", subcategory: "Inventory Management" },
      { pattern: "reporting", category: "Product Features", subcategory: "Reporting & Analytics" },
      { pattern: "mobile", category: "Product Features", subcategory: "Mobile Access" },
      { pattern: "integration", category: "Product Features", subcategory: "Integrations" },
      { pattern: "healthcare", category: "Industries", subcategory: "Healthcare" },
      { pattern: "manufacturing", category: "Industries", subcategory: "Manufacturing" },
      { pattern: "education", category: "Industries", subcategory: "Education" },
      { pattern: "hospitality", category: "Industries", subcategory: "Hospitality" },
      { pattern: "government", category: "Industries", subcategory: "Government" },
      { pattern: "pricing", category: "High Intent", subcategory: "Pricing" },
      { pattern: "demo", category: "High Intent", subcategory: "Demo Request" },
      { pattern: "free-trial", category: "High Intent", subcategory: "Free Trial" },
      { pattern: "contact", category: "High Intent", subcategory: "Contact Page" },
      { pattern: "case-stud", category: "Lead Magnet", subcategory: "Case Studies" },
      { pattern: "whitepaper", category: "Lead Magnet", subcategory: "Whitepapers" },
      { pattern: "webinar", category: "Lead Magnet", subcategory: "Webinars" },
    ]
  },

  "tbr": {
    name: "The Brilliance Revolution",
    rules: [
      { pattern: "executive-coaching", category: "Services", subcategory: "Executive Coaching" },
      { pattern: "leadership", category: "Services", subcategory: "Leadership Development" },
      { pattern: "team-building", category: "Services", subcategory: "Team Building" },
      { pattern: "strategic-planning", category: "Services", subcategory: "Strategic Planning" },
      { pattern: "keynote", category: "Services", subcategory: "Keynote Speaking" },
      { pattern: "workshop", category: "Services", subcategory: "Workshops" },
      { pattern: "consulting", category: "Services", subcategory: "Consulting" },
      { pattern: "assessment", category: "Services", subcategory: "Assessments" },
      { pattern: "about", category: "Provider Research", subcategory: "About" },
      { pattern: "testimonial", category: "Provider Research", subcategory: "Testimonials" },
      { pattern: "blog", category: "Content", subcategory: "Blog" },
      { pattern: "podcast", category: "Content", subcategory: "Podcast" },
      { pattern: "book", category: "Lead Magnet", subcategory: "Book" },
      { pattern: "download", category: "Lead Magnet", subcategory: "Downloads" },
      { pattern: "contact", category: "High Intent", subcategory: "Contact Page" },
      { pattern: "schedule", category: "High Intent", subcategory: "Schedule a Call" },
      { pattern: "pricing", category: "High Intent", subcategory: "Pricing" },
    ]
  },

  "dough-babies": {
    name: "Dough Babies (Cute C Toys)",
    rules: [
      // ── Product Collections ──
      { pattern: "collections/boys", category: "Product Features", subcategory: "Boys Collection" },
      { pattern: "collections/girls", category: "Product Features", subcategory: "Girls Collection" },
      { pattern: "collections/mythicals", category: "Product Features", subcategory: "Mythicals Collection" },
      { pattern: "collections/animals", category: "Product Features", subcategory: "Animals Collection" },
      { pattern: "collections/holiday", category: "Product Features", subcategory: "Holiday Collection" },
      { pattern: "collections/accessories", category: "Product Features", subcategory: "Accessories" },
      { pattern: "collections/catalog", category: "Product Features", subcategory: "Full Catalog" },
      { pattern: "collections/all", category: "Product Features", subcategory: "All Products" },

      // ── Product Detail Pages (Shopify /products/) ──
      { pattern: "/products/", category: "Product Features", subcategory: "Product Detail" },

      // ── Shopify Browsing Signals ──
      { pattern: "/collections", category: "Product Features", subcategory: "Collection Browse" },
      { pattern: "/search", category: "Product Features", subcategory: "Site Search" },
      { pattern: "variant=", category: "Product Features", subcategory: "Variant Selection" },

      // ── Brand Research ──
      { pattern: "about-dough-babies", category: "Provider Research", subcategory: "About Dough Babies" },
      { pattern: "our-story", category: "Provider Research", subcategory: "Our Story" },
      { pattern: "page-5", category: "Provider Research", subcategory: "Safety & Quality" },
      { pattern: "safety", category: "Provider Research", subcategory: "Safety & Quality" },
      { pattern: "faq", category: "Provider Research", subcategory: "FAQ" },
      { pattern: "blog", category: "Content", subcategory: "Blog" },
      { pattern: "testimonial", category: "Provider Research", subcategory: "Testimonials" },
      { pattern: "review", category: "Provider Research", subcategory: "Reviews" },
      { pattern: "policies", category: "Provider Research", subcategory: "Store Policies" },

      // ── High Intent ──
      { pattern: "/cart", category: "High Intent", subcategory: "Shopping Cart" },
      { pattern: "checkout", category: "High Intent", subcategory: "Checkout" },
      { pattern: "contact", category: "High Intent", subcategory: "Contact Page" },
      { pattern: "twin-delivery", category: "High Intent", subcategory: "Twin Delivery Promo" },
      { pattern: "account", category: "High Intent", subcategory: "Account / Login" },
    ]
  },

  "waverly-manor": {
    name: "Waverly Manor",
    rules: [
      // ── Venue Types / Event Spaces ──
      { pattern: "wedding", category: "Event Types", subcategory: "Weddings" },
      { pattern: "reception", category: "Event Types", subcategory: "Receptions" },
      { pattern: "ceremony", category: "Event Types", subcategory: "Ceremonies" },
      { pattern: "corporate", category: "Event Types", subcategory: "Corporate Events" },
      { pattern: "private-event", category: "Event Types", subcategory: "Private Events" },
      { pattern: "party", category: "Event Types", subcategory: "Private Parties" },
      { pattern: "rehearsal", category: "Event Types", subcategory: "Rehearsal Dinners" },
      { pattern: "bridal-shower", category: "Event Types", subcategory: "Bridal Showers" },
      { pattern: "engagement", category: "Event Types", subcategory: "Engagement Parties" },
      { pattern: "elopement", category: "Event Types", subcategory: "Elopements" },
      { pattern: "birthday", category: "Event Types", subcategory: "Birthday Parties" },
      { pattern: "anniversary", category: "Event Types", subcategory: "Anniversary Celebrations" },
      { pattern: "holiday", category: "Event Types", subcategory: "Holiday Events" },
      { pattern: "fundraiser", category: "Event Types", subcategory: "Fundraisers" },
      { pattern: "gala", category: "Event Types", subcategory: "Galas" },

      // ── Venue Features / Spaces ──
      { pattern: "ballroom", category: "Venue Features", subcategory: "Ballroom" },
      { pattern: "garden", category: "Venue Features", subcategory: "Garden" },
      { pattern: "outdoor", category: "Venue Features", subcategory: "Outdoor Spaces" },
      { pattern: "chapel", category: "Venue Features", subcategory: "Chapel" },
      { pattern: "suite", category: "Venue Features", subcategory: "Bridal Suite" },
      { pattern: "patio", category: "Venue Features", subcategory: "Patio" },
      { pattern: "estate", category: "Venue Features", subcategory: "Estate Grounds" },
      { pattern: "accommodation", category: "Venue Features", subcategory: "Accommodations" },
      { pattern: "lodging", category: "Venue Features", subcategory: "Lodging" },

      // ── Services / Packages ──
      { pattern: "catering", category: "Services", subcategory: "Catering" },
      { pattern: "package", category: "Services", subcategory: "Event Packages" },
      { pattern: "planning", category: "Services", subcategory: "Event Planning" },
      { pattern: "coordinator", category: "Services", subcategory: "Event Coordination" },
      { pattern: "floral", category: "Services", subcategory: "Floral Design" },
      { pattern: "decor", category: "Services", subcategory: "Decor" },
      { pattern: "photography", category: "Services", subcategory: "Photography" },
      { pattern: "vendor", category: "Services", subcategory: "Preferred Vendors" },
      { pattern: "menu", category: "Services", subcategory: "Menu Options" },

      // ── Provider Research ──
      { pattern: "about", category: "Provider Research", subcategory: "About the Venue" },
      { pattern: "history", category: "Provider Research", subcategory: "Venue History" },
      { pattern: "testimonial", category: "Provider Research", subcategory: "Testimonials" },
      { pattern: "review", category: "Provider Research", subcategory: "Reviews" },
      { pattern: "faq", category: "Provider Research", subcategory: "FAQ" },
      { pattern: "blog", category: "Content", subcategory: "Blog" },

      // ── High Intent ──
      { pattern: "gallery", category: "High Intent", subcategory: "Photo Gallery" },
      { pattern: "photo", category: "High Intent", subcategory: "Photo Gallery" },
      { pattern: "tour", category: "High Intent", subcategory: "Schedule a Tour" },
      { pattern: "visit", category: "High Intent", subcategory: "Schedule a Visit" },
      { pattern: "availability", category: "High Intent", subcategory: "Check Availability" },
      { pattern: "pricing", category: "High Intent", subcategory: "Pricing" },
      { pattern: "contact", category: "High Intent", subcategory: "Contact Page" },
      { pattern: "book-now", category: "High Intent", subcategory: "Book Now" },
      { pattern: "schedule", category: "High Intent", subcategory: "Schedule Consultation" },
      { pattern: "inquiry", category: "High Intent", subcategory: "Event Inquiry" },
    ]
  }
};

/**
 * Categories that count as "researching specific services"
 * (used for interest tagging)
 */
export const RESEARCH_CATEGORIES = new Set([
  "Surgical Procedures", "Conditions", "Services",
  "Facial Procedures", "Body Procedures", "Breast Procedures",
  "Non-Surgical", "Product Features", "Industries", "Lead Magnet",
  "Event Types", "Venue Features", "Content"
]);

/**
 * Classify a URL against a client's taxonomy
 * Returns array of { category, subcategory } matches
 */
export function classifyUrl(url, clientKey) {
  const taxonomy = CLIENT_TAXONOMIES[clientKey];
  if (!taxonomy) return [];

  const path = url.toLowerCase();
  const matches = [];

  for (const rule of taxonomy.rules) {
    if (path.includes(rule.pattern)) {
      matches.push({ category: rule.category, subcategory: rule.subcategory });
    }
  }

  return matches;
}

/**
 * Classify referrer URL into a source category.
 *
 * IMPORTANT - rule order matters. Email-tracking and webmail patterns are
 * checked FIRST, because mail.google.com would otherwise fall through to the
 * generic "google" rule and get mislabeled as "Google Search". Same for
 * mail.yahoo.com → "Yahoo". The Instantly pattern catches cold-email
 * clickthroughs (Instantly redirects clicks through its tracking domain so
 * the destination page sees `clk.instantly.ai` as the referrer).
 */
export function classifyReferrer(referrer) {
  if (!referrer) return "Direct";
  const r = referrer.toLowerCase();

  // ── Email click sources (must come BEFORE generic search/social patterns
  //    because mail.google.com would otherwise match "google", etc.) ──
  if (r.includes("instantly.ai") || r.includes("clk.instantly")) return "Email Click";
  if (r.includes("mail.google.com")) return "Email Click";
  if (r.includes("outlook.live.com") || r.includes("outlook.office.com") || r.includes("outlook.office365.com")) return "Email Click";
  if (r.includes("mail.yahoo.com")) return "Email Click";
  if (r.includes("list-manage.com")) return "Email Click";          // Mailchimp tracking
  if (r.includes("hubspotemail") || r.includes("hubspotlinks") || r.includes("hs-sites.com")) return "Email Click"; // HubSpot
  if (r.includes("klclick") || r.includes("trk.klclick")) return "Email Click"; // Klaviyo
  if (r.includes("sendgrid.net") || r.includes("links.sendgrid")) return "Email Click";
  if (r.includes("constantcontact")) return "Email Click";
  if (r.includes("activehosted.com")) return "Email Click";          // ActiveCampaign
  if (r.includes("ghl.cx") || r.includes("gohighlevel")) return "Email Click"; // GoHighLevel email
  if (r.includes("postmarkapp.com") || r.includes("pmtools.click")) return "Email Click"; // Postmark

  // ── Search / social / directory ──
  if (r.includes("google")) return "Google Search";
  if (r.includes("facebook") || r.includes("fb.com")) return "Facebook";
  if (r.includes("instagram")) return "Instagram";
  if (r.includes("bing")) return "Bing";
  if (r.includes("yahoo")) return "Yahoo";
  if (r.includes("youtube")) return "YouTube";
  if (r.includes("tiktok")) return "TikTok";
  if (r.includes("linkedin")) return "LinkedIn";
  if (r.includes("twitter") || r.includes("x.com")) return "Twitter/X";
  if (r.includes("yelp")) return "Yelp";
  if (r.includes("healthgrades")) return "Healthgrades";
  if (r.includes("realself")) return "RealSelf";
  return "Other";
}
