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
  }
};

/**
 * Categories that count as "researching specific services"
 * (used for interest tagging)
 */
export const RESEARCH_CATEGORIES = new Set([
  "Surgical Procedures", "Conditions", "Services",
  "Facial Procedures", "Body Procedures", "Breast Procedures",
  "Non-Surgical", "Product Features", "Industries", "Lead Magnet"
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
 * Classify referrer URL into a source category
 */
export function classifyReferrer(referrer) {
  if (!referrer) return "Direct";
  const r = referrer.toLowerCase();
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
