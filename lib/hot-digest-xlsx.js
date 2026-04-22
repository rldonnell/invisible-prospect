/**
 * Build an xlsx Buffer of HOT leads for the morning digest email.
 *
 * Uses exceljs (pure JS, works in Vercel's Node runtime).
 */

import ExcelJS from 'exceljs';

const HEADERS = [
  { key: 'first_name',      label: 'First Name',       width: 12 },
  { key: 'last_name',       label: 'Last Name',        width: 14 },
  { key: 'email',           label: 'Email',            width: 32 },
  { key: 'phone',           label: 'Phone',            width: 16 },
  { key: 'city',            label: 'City',             width: 16 },
  { key: 'state',           label: 'State',            width: 7 },
  { key: 'age_range',       label: 'Age Range',        width: 10 },
  { key: 'intent_score',    label: 'Intent Score',     width: 12 },
  { key: 'visit_count',     label: 'Visits',           width: 8 },
  { key: 'last_visit',      label: 'Last Visit',       width: 12 },
  { key: 'interests',       label: 'Primary Interests', width: 40 },
  { key: 'referrer_source', label: 'Referrer Source',  width: 16 },
  { key: 'engagement',      label: 'Engagement',       width: 22 },
];

// Surface-worthy tags that explain WHY a visitor is HOT this morning.
// Order matters: first match wins so the most meaningful signal shows.
const ENGAGEMENT_TAG_PRIORITY = [
  'email-meeting-booked',
  'email-interested',
  'email-replied',
  'email-clicked',
  'return-visitor',
  'email-opened',
];

function formatEngagement(v) {
  const parts = [];
  let tags = v.tags;
  if (typeof tags === 'string') {
    try { tags = JSON.parse(tags); } catch { tags = []; }
  }
  if (Array.isArray(tags)) {
    for (const label of ENGAGEMENT_TAG_PRIORITY) {
      if (tags.includes(label)) { parts.push(label); break; }
    }
  }
  if (v.engagement_tier && v.engagement_tier !== 'None' && parts.length === 0) {
    parts.push(v.engagement_tier);
  }
  return parts.join(' · ');
}

const HEADER_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const HEADER_FONT  = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const BODY_FONT    = { name: 'Arial', size: 10 };
const BORDER       = {
  top:    { style: 'thin', color: { argb: 'FFCCCCCC' } },
  left:   { style: 'thin', color: { argb: 'FFCCCCCC' } },
  right:  { style: 'thin', color: { argb: 'FFCCCCCC' } },
  bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
};

function firstOf(csv) {
  return (csv || '').split(',')[0].trim();
}

function formatInterests(raw) {
  if (!raw) return '';
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { arr = [raw]; }
  }
  if (!Array.isArray(arr)) return '';
  return arr.slice(0, 5).join(', ');
}

function formatDate(d) {
  if (!d) return '';
  const s = typeof d === 'string' ? d : new Date(d).toISOString();
  return s.split('T')[0];
}

export async function buildHotDigestXlsx({ sheetName, visitors }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VisitorID by P5 Marketing';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName || 'HOT Leads', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = HEADERS.map(h => ({ header: h.label, key: h.key, width: h.width }));

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER;
  });

  // Sort by score desc
  const sorted = [...visitors].sort(
    (a, b) => (b.intent_score || 0) - (a.intent_score || 0)
  );

  for (const v of sorted) {
    ws.addRow({
      first_name:      v.first_name || '',
      last_name:       v.last_name || '',
      email:           firstOf(v.email),
      phone:           firstOf(v.phone),
      city:            v.city || '',
      state:           v.state || '',
      age_range:       v.age_range || '',
      intent_score:    v.intent_score || 0,
      visit_count:     v.visit_count || 0,
      last_visit:      formatDate(v.last_visit),
      interests:       formatInterests(v.interests),
      referrer_source: v.referrer_source || '',
      engagement:      formatEngagement(v),
    });
  }

  // Style body
  for (let r = 2; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell(cell => {
      cell.font = BODY_FONT;
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle' };
    });
  }

  // AutoFilter over all columns
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: HEADERS.length },
  };

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
