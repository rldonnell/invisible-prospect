/**
 * Generate Demo Data
 *
 * Takes all SA Spine visitor records from Neon, randomizes every personal field,
 * and inserts them as client_key = 'demo'. Preserves behavioral patterns
 * (scores, tiers, visit counts, page structures) so the dashboard looks realistic.
 *
 * Usage:
 *   node scripts/generate-demo-data.js
 *
 * Requires DATABASE_URL env var (same Neon connection string used by the app).
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL env var');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

// ── Random data pools ────────────────────────────────────────────────

const FIRST_NAMES_M = [
  'James','Robert','Michael','David','William','Richard','Joseph','Thomas','Christopher','Daniel',
  'Matthew','Anthony','Mark','Steven','Andrew','Joshua','Kevin','Brian','Ryan','Brandon',
  'Jason','Justin','Timothy','Nathan','Samuel','Benjamin','Aaron','Patrick','Henry','Carlos',
  'Eric','Raymond','Gregory','Derek','Sean','Kyle','Victor','Marcus','Tyler','Trevor',
  'Adrian','Jesse','Corey','Brett','Mitchell','Garrett','Cody','Dustin','Spencer','Malik',
];

const FIRST_NAMES_F = [
  'Mary','Patricia','Jennifer','Linda','Barbara','Elizabeth','Susan','Jessica','Sarah','Karen',
  'Lisa','Nancy','Betty','Margaret','Sandra','Ashley','Michelle','Emily','Amanda','Stephanie',
  'Nicole','Melissa','Rebecca','Laura','Kimberly','Rachel','Angela','Heather','Megan','Brittany',
  'Hannah','Samantha','Katherine','Christine','Deborah','Danielle','Alexandra','Vanessa','Natalie','Grace',
  'Crystal','Diana','Monica','Tiffany','Courtney','Brooke','Carmen','Rosa','Priscilla','Veronica',
];

const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
  'Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes','Stewart',
  'Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper','Peterson',
];

const TX_CITIES = [
  { city: 'San Antonio', zip: '78201' }, { city: 'San Antonio', zip: '78205' },
  { city: 'San Antonio', zip: '78209' }, { city: 'San Antonio', zip: '78213' },
  { city: 'San Antonio', zip: '78217' }, { city: 'San Antonio', zip: '78224' },
  { city: 'San Antonio', zip: '78229' }, { city: 'San Antonio', zip: '78240' },
  { city: 'San Antonio', zip: '78245' }, { city: 'San Antonio', zip: '78250' },
  { city: 'Austin', zip: '78701' }, { city: 'Austin', zip: '78702' },
  { city: 'Austin', zip: '78745' }, { city: 'Austin', zip: '78758' },
  { city: 'Houston', zip: '77001' }, { city: 'Houston', zip: '77002' },
  { city: 'Houston', zip: '77054' }, { city: 'Houston', zip: '77098' },
  { city: 'Dallas', zip: '75201' }, { city: 'Dallas', zip: '75204' },
  { city: 'Fort Worth', zip: '76102' }, { city: 'El Paso', zip: '79901' },
  { city: 'New Braunfels', zip: '78130' }, { city: 'Boerne', zip: '78006' },
  { city: 'Schertz', zip: '78154' }, { city: 'Seguin', zip: '78155' },
  { city: 'Laredo', zip: '78040' }, { city: 'McAllen', zip: '78501' },
  { city: 'Corpus Christi', zip: '78401' }, { city: 'Lubbock', zip: '79401' },
];

const OUT_OF_STATE = [
  { city: 'Phoenix', state: 'AZ', zip: '85001' },
  { city: 'Los Angeles', state: 'CA', zip: '90001' },
  { city: 'Denver', state: 'CO', zip: '80201' },
  { city: 'Chicago', state: 'IL', zip: '60601' },
  { city: 'Miami', state: 'FL', zip: '33101' },
  { city: 'Atlanta', state: 'GA', zip: '30301' },
  { city: 'Portland', state: 'OR', zip: '97201' },
  { city: 'Seattle', state: 'WA', zip: '98101' },
  { city: 'Nashville', state: 'TN', zip: '37201' },
  { city: 'Charlotte', state: 'NC', zip: '28201' },
];

const COMPANIES = [
  'Valero Energy','USAA','Rackspace','H-E-B','Frost Bank',
  'iHeartMedia','NuStar Energy','CPS Energy','Southwest Research',
  'Methodist Healthcare','Baptist Health','Christus Health',
  'Keller Williams','RE/MAX Southwest','Wells Fargo','Chase Bank',
  'Amazon','Google','Microsoft','Apple','Dell Technologies',
  'AT&T','Whataburger','Randolph-Brooks FCU','Security Service FCU',
  'University Health','UT Health SA','Texas State University',
  'Self-employed','Retired','',
];

const JOB_TITLES = [
  'Teacher','Nurse','Manager','Engineer','Analyst','Administrative Assistant',
  'Sales Representative','Accountant','Attorney','Physician','Dentist',
  'Real Estate Agent','Project Manager','Software Developer','HR Director',
  'Marketing Coordinator','Operations Manager','Financial Advisor',
  'Retired','Self-employed','Owner','Director','VP of Operations',
  'Office Manager','Consultant','Technician','Electrician','Mechanic',
  'Paramedic','Social Worker','Therapist','Pharmacist','',
];

const INDUSTRIES = [
  'Healthcare','Education','Finance','Technology','Oil & Gas',
  'Retail','Construction','Real Estate','Government','Military',
  'Manufacturing','Hospitality','Legal','Non-Profit','Transportation','',
];

const AGE_RANGES = ['18-24','25-34','35-44','45-54','55-64','65+'];
const GENDERS = ['Male','Female'];
const INCOMES = ['$25k-$50k','$50k-$75k','$75k-$100k','$100k-$150k','$150k-$200k','$200k-$250k','$250k+',''];
const NET_WORTHS = ['$50k-$100k','$100k-$250k','$250k-$500k','$500k-$1M','$1M-$2M','$2M+',''];
const HOMEOWNER_VALS = ['Yes','No','Likely',''];
const MARRIED_VALS = ['Yes','No','Likely',''];
const CHILDREN_VALS = ['Yes','No','Likely',''];

const TX_AREA_CODES = ['210','512','713','214','817','830','956','361','806','915','254','325','432','903','936','979'];

// ── Helpers ──────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function randomPhone() {
  if (Math.random() < 0.3) return ''; // 30% no phone
  const area = pick(TX_AREA_CODES);
  return `${area}-${randInt(200,999)}-${randInt(1000,9999)}`;
}

function randomEmail(first, last) {
  if (Math.random() < 0.15) return ''; // 15% no email
  const domains = ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','att.net','sbcglobal.net'];
  const sep = pick(['.','_','']);
  const num = Math.random() < 0.4 ? randInt(1,99) : '';
  return `${first.toLowerCase()}${sep}${last.toLowerCase()}${num}@${pick(domains)}`;
}

function randomHem() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
  return hash;
}

function anonymizePages(pages) {
  // Keep page structure but don't change URLs — they're practice pages, not personal data
  // The URLs are SA Spine's public website pages, which is fine for a demo
  return pages;
}

function shiftDate(dateStr, daysShift) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysShift);
  return d.toISOString();
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Fetching SA Spine visitors...');

  const visitors = await sql`
    SELECT * FROM visitors WHERE client_key = 'sa-spine'
    ORDER BY id
  `;

  console.log(`Found ${visitors.length} visitors to anonymize.`);

  // Delete existing demo data
  const deleted = await sql`DELETE FROM visitors WHERE client_key = 'demo' RETURNING id`;
  console.log(`Cleared ${deleted.length} existing demo records.`);

  // Shift all dates forward/back by a random amount (same for all, so relative timing is preserved)
  const dateShift = randInt(-30, 30);

  let inserted = 0;
  let errors = 0;

  for (const v of visitors) {
    try {
      const isFemale = Math.random() < 0.52; // slight female skew for spine practice
      const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M);
      const lastName = pick(LAST_NAMES);
      const gender = isFemale ? 'Female' : 'Male';
      const email = randomEmail(firstName, lastName);
      const phone = randomPhone();
      const hem = randomHem();

      // 75% Texas, 25% out-of-state (matches realistic pattern)
      const isTexas = Math.random() < 0.75;
      let city, state, zip;
      if (isTexas) {
        const loc = pick(TX_CITIES);
        city = loc.city;
        state = 'TX';
        zip = loc.zip;
      } else {
        const loc = pick(OUT_OF_STATE);
        city = loc.city;
        state = loc.state;
        zip = loc.zip;
      }

      const company = pick(COMPANIES);
      const jobTitle = pick(JOB_TITLES);
      const industry = pick(INDUSTRIES);
      const ageRange = pick(AGE_RANGES);
      const income = pick(INCOMES);
      const netWorth = pick(NET_WORTHS);
      const homeowner = pick(HOMEOWNER_VALS);
      const married = pick(MARRIED_VALS);
      const children = pick(CHILDREN_VALS);

      // Generate consistent all_emails
      const allEmails = email ? email : '';
      const address = isTexas
        ? `${randInt(100,9999)} ${pick(['Main','Oak','Elm','Cedar','Walnut','Pecan','Magnolia','Live Oak','Huebner','Bandera','Fredericksburg','Blanco','Broadway','McCullough','Alamo'])} ${pick(['St','Ave','Rd','Dr','Blvd','Ln'])}`
        : '';

      await sql`
        INSERT INTO visitors (
          client_key, hem_sha256, email, first_name, last_name, phone,
          city, state, zip, address, age_range, gender, income, net_worth,
          homeowner, married, children, company_name, job_title, company_industry,
          company_size, company_revenue, department, seniority_level,
          all_emails, business_email, pixel_id, edid,
          facebook_url, twitter_url, linkedin, skills, al_interests,
          visit_count, first_visit, last_visit, pages_visited, referrers,
          intent_score, intent_tier, interests, referrer_source, tags,
          processed, processed_at,
          confidence, confidence_score, confidence_flags,
          ghl_pushed, created_at, updated_at
        ) VALUES (
          'demo', ${hem}, ${email}, ${firstName}, ${lastName}, ${phone},
          ${city}, ${state}, ${zip}, ${address}, ${ageRange}, ${gender}, ${income}, ${netWorth},
          ${homeowner}, ${married}, ${children}, ${company}, ${jobTitle}, ${industry},
          ${v.company_size || ''}, ${v.company_revenue || ''}, ${v.department || ''}, ${v.seniority_level || ''},
          ${allEmails}, '', '', '',
          '', '', '', '', '',
          ${v.visit_count}, ${shiftDate(v.first_visit, dateShift)}, ${shiftDate(v.last_visit, dateShift)},
          ${JSON.stringify(anonymizePages(v.pages_visited || []))},
          ${JSON.stringify(v.referrers || [])},
          ${v.intent_score}, ${v.intent_tier}, ${JSON.stringify(v.interests || [])},
          ${v.referrer_source || 'Direct'}, ${JSON.stringify(v.tags || [])},
          ${v.processed}, ${shiftDate(v.processed_at, dateShift)},
          ${v.confidence || ''}, ${v.confidence_score || 0}, ${JSON.stringify(v.confidence_flags || [])},
          FALSE, ${shiftDate(v.created_at, dateShift)}, ${shiftDate(v.updated_at, dateShift)}
        )
      `;

      inserted++;
      if (inserted % 500 === 0) console.log(`  ...${inserted} inserted`);
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`Error on visitor ${v.id}:`, err.message);
    }
  }

  console.log(`\n========== COMPLETE ==========`);
  console.log(`Total source: ${visitors.length}`);
  console.log(`Inserted:     ${inserted}`);
  console.log(`Errors:       ${errors}`);
  console.log(`Client key:   demo`);
  console.log(`Dashboard:    https://invisible-prospect.vercel.app/dashboard/demo`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
