import { getDb } from '../../../../lib/db';

/**
 * GET /api/cron/refresh-demo
 *
 * Nightly refresh of demo dashboard data.
 * Clones all SA Spine visitors with randomized personal info,
 * preserving behavioral patterns (scores, tiers, visits, buckets).
 *
 * Runs at 4:00 AM UTC (11 PM CT) — before the pipeline crons.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://saspine.visitorid.p5marketing.com/api/cron/refresh-demo
 */

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
const INCOMES = ['$25k-$50k','$50k-$75k','$75k-$100k','$100k-$150k','$150k-$200k','$200k-$250k','$250k+',''];
const NET_WORTHS = ['$50k-$100k','$100k-$250k','$250k-$500k','$500k-$1M','$1M-$2M','$2M+',''];
const HOMEOWNER_VALS = ['Yes','No','Likely',''];
const MARRIED_VALS = ['Yes','No','Likely',''];
const CHILDREN_VALS = ['Yes','No','Likely',''];
const STREETS = ['Main','Oak','Elm','Cedar','Walnut','Pecan','Magnolia','Live Oak','Huebner','Bandera','Fredericksburg','Blanco','Broadway','McCullough','Alamo'];
const STREET_TYPES = ['St','Ave','Rd','Dr','Blvd','Ln'];
const TX_AREA_CODES = ['210','512','713','214','817','830','956','361','806','915','254','325','432','903','936','979'];

// ── Helpers ──────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function randomPhone() {
  if (Math.random() < 0.3) return '';
  const area = pick(TX_AREA_CODES);
  return `${area}-${randInt(200, 999)}-${randInt(1000, 9999)}`;
}

function randomEmail(first, last) {
  if (Math.random() < 0.15) return '';
  const domains = ['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','att.net','sbcglobal.net'];
  const sep = pick(['.','_','']);
  const num = Math.random() < 0.4 ? randInt(1, 99) : '';
  return `${first.toLowerCase()}${sep}${last.toLowerCase()}${num}@${pick(domains)}`;
}

function randomHem() {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)];
  return hash;
}

function shiftDate(dateStr, daysShift) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + daysShift);
  return d.toISOString();
}

// ── Main handler ─────────────────────────────────────────────────────

export async function GET(request) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const sql = getDb();

    // Fetch all SA Spine visitors
    const visitors = await sql`
      SELECT * FROM visitors WHERE client_key = 'sa-spine' ORDER BY id
    `;

    if (visitors.length === 0) {
      return Response.json({ success: false, message: 'No SA Spine visitors found' });
    }

    // Clear existing demo data
    const deleted = await sql`DELETE FROM visitors WHERE client_key = 'demo' RETURNING id`;

    // Also clear demo enrollments if any
    await sql`
      DELETE FROM email_enrollments WHERE visitor_id IN (
        SELECT id FROM visitors WHERE client_key = 'demo'
      )
    `.catch(() => {}); // ignore if no enrollments

    // Shift dates so demo looks fresh — anchor to today
    const now = new Date();
    const latestVisit = visitors.reduce((max, v) => {
      const d = v.last_visit ? new Date(v.last_visit) : new Date(0);
      return d > max ? d : max;
    }, new Date(0));
    const daysDiff = Math.round((now - latestVisit) / (1000 * 60 * 60 * 24));
    // Shift forward so the latest visit lands within the last 1-2 days
    const dateShift = daysDiff - randInt(0, 2);

    let inserted = 0;
    let errors = 0;

    for (const v of visitors) {
      try {
        const isFemale = Math.random() < 0.52;
        const firstName = pick(isFemale ? FIRST_NAMES_F : FIRST_NAMES_M);
        const lastName = pick(LAST_NAMES);
        const gender = isFemale ? 'Female' : 'Male';
        const email = randomEmail(firstName, lastName);
        const phone = randomPhone();
        const hem = randomHem();

        // 75% Texas, 25% out-of-state
        const isTexas = Math.random() < 0.75;
        let city, state, zip, address;
        if (isTexas) {
          const loc = pick(TX_CITIES);
          city = loc.city;
          state = 'TX';
          zip = loc.zip;
          address = `${randInt(100, 9999)} ${pick(STREETS)} ${pick(STREET_TYPES)}`;
        } else {
          const loc = pick(OUT_OF_STATE);
          city = loc.city;
          state = loc.state;
          zip = loc.zip;
          address = '';
        }

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
            primary_interest, campaign_bucket, email_eligible,
            ghl_pushed, created_at, updated_at
          ) VALUES (
            'demo', ${hem}, ${email}, ${firstName}, ${lastName}, ${phone},
            ${city}, ${state}, ${zip}, ${address}, ${pick(AGE_RANGES)}, ${gender},
            ${pick(INCOMES)}, ${pick(NET_WORTHS)},
            ${pick(HOMEOWNER_VALS)}, ${pick(MARRIED_VALS)}, ${pick(CHILDREN_VALS)},
            ${pick(COMPANIES)}, ${pick(JOB_TITLES)}, ${pick(INDUSTRIES)},
            ${v.company_size || ''}, ${v.company_revenue || ''}, ${v.department || ''}, ${v.seniority_level || ''},
            ${email || ''}, '', '', '',
            '', '', '', '', '',
            ${v.visit_count},
            ${shiftDate(v.first_visit, dateShift)},
            ${shiftDate(v.last_visit, dateShift)},
            ${JSON.stringify(v.pages_visited || [])},
            ${JSON.stringify(v.referrers || [])},
            ${v.intent_score}, ${v.intent_tier},
            ${JSON.stringify(v.interests || [])},
            ${v.referrer_source || 'Direct'},
            ${JSON.stringify(v.tags || [])},
            ${v.processed},
            ${shiftDate(v.processed_at, dateShift)},
            ${v.confidence || ''}, ${v.confidence_score || 0},
            ${JSON.stringify(v.confidence_flags || [])},
            ${v.primary_interest || null},
            ${v.campaign_bucket || null},
            ${v.email_eligible || false},
            FALSE,
            ${shiftDate(v.created_at, dateShift)},
            ${shiftDate(v.updated_at, dateShift)}
          )
        `;

        inserted++;
      } catch (err) {
        errors++;
        if (errors <= 5) console.error(`[refresh-demo] Error on visitor ${v.id}:`, err.message);
      }
    }

    // Log the run
    await sql`
      INSERT INTO processing_runs (client_key, run_type, processed, errors, completed_at)
      VALUES ('demo', 'refresh-demo', ${inserted}, ${errors}, NOW())
    `.catch(() => {});

    console.log(`[refresh-demo] Complete: ${inserted} inserted, ${errors} errors, ${deleted.length} cleared`);

    return Response.json({
      success: true,
      source_count: visitors.length,
      inserted,
      errors,
      cleared: deleted.length,
      date_shift_days: dateShift,
      dashboard: 'https://saspine.visitorid.p5marketing.com/dashboard/demo',
    });

  } catch (error) {
    console.error('[refresh-demo] Fatal:', error);
    return Response.json({ error: 'Server error', details: error.message }, { status: 500 });
  }
}
