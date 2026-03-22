'use client';

const TIER_COLORS = {
  HOT: '#dc2626',
  High: '#f59e0b',
  Medium: '#3b82f6',
  Low: '#94a3b8',
};

export default function VisitorProfile({ visitor, clientKey }) {
  const v = visitor;
  const fullName = `${v.first_name} ${v.last_name}`.trim() || 'Unknown Visitor';
  const location = [v.address, v.city, v.state, v.zip].filter(Boolean).join(', ') || 'Unknown';
  const tierColor = TIER_COLORS[v.intent_tier] || '#94a3b8';

  const CONFIDENCE_COLORS = { High: '#16a34a', Medium: '#d97706', Low: '#dc2626' };
  const confidenceColor = CONFIDENCE_COLORS[v.confidence] || '#94a3b8';
  const confidenceFlags = v.confidence_flags || [];

  const fmtDate = (d) => {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
      });
    } catch { return d; }
  };

  const pages = v.pages_visited || [];
  const referrers = v.referrers || [];
  const interests = v.interests || [];
  const tags = v.tags || [];

  // Parse all emails into array
  const emailList = (v.all_emails || v.email || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

  // Parse phone numbers
  const phoneList = (v.phone || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  return (
    <div style={styles.page}>
      {/* Back link */}
      <a href={`/dashboard/${clientKey}`} style={styles.backLink}>
        &larr; Back to Dashboard
      </a>

      {/* Header Card */}
      <div style={styles.headerCard}>
        <div style={styles.headerLeft}>
          <div style={styles.avatar}>
            {v.first_name ? v.first_name[0].toUpperCase() : '?'}
          </div>
          <div>
            <h1 style={styles.name}>{fullName}</h1>
            <p style={styles.locationText}>{location}</p>
            {v.job_title && v.company_name && (
              <p style={styles.jobLine}>{v.job_title} at {v.company_name}</p>
            )}
            {v.job_title && !v.company_name && (
              <p style={styles.jobLine}>{v.job_title}</p>
            )}
            {!v.job_title && v.company_name && (
              <p style={styles.jobLine}>{v.company_name}</p>
            )}
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <div style={{ ...styles.scoreBadge, backgroundColor: tierColor }}>
              {v.intent_tier}
            </div>
            {v.confidence && (
              <div style={{ ...styles.scoreBadge, backgroundColor: confidenceColor }}>
                {v.confidence} Confidence
              </div>
            )}
          </div>
          <div style={styles.scoreNumber}>Intent: {v.intent_score} | Confidence: {v.confidence_score || '-'}</div>
          <div style={styles.visits}>{v.visit_count} visit{v.visit_count !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={styles.columns}>

        {/* Left column — Profile Details */}
        <div style={styles.column}>

          {/* Personal Info */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Personal Information</h2>
            <div style={styles.fieldGrid}>
              <Field label="Full Name" value={fullName} />
              <Field label="Age Range" value={v.age_range} />
              <Field label="Gender" value={v.gender === 'M' ? 'Male' : v.gender === 'F' ? 'Female' : v.gender} />
              <Field label="Marital Status" value={v.married === 'Single' ? 'Single' : v.married === 'Married' ? 'Married' : v.married} />
              <Field label="Children" value={v.children === 'Y' ? 'Yes' : v.children === 'N' ? 'No' : v.children} />
              <Field label="Homeowner" value={v.homeowner === 'Homeowner' ? 'Yes' : v.homeowner === 'Renter' ? 'No (Renter)' : v.homeowner} />
            </div>
          </div>

          {/* Address */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Address</h2>
            <div style={styles.fieldGrid}>
              <Field label="Street" value={v.address} wide />
              <Field label="City" value={v.city} />
              <Field label="State" value={v.state} />
              <Field label="ZIP" value={v.zip} />
            </div>
          </div>

          {/* Financial */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Financial Profile</h2>
            <div style={styles.fieldGrid}>
              <Field label="Income Range" value={v.income} />
              <Field label="Net Worth" value={v.net_worth} />
            </div>
          </div>

          {/* Employment */}
          {(v.company_name || v.job_title || v.company_industry) && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Employment</h2>
              <div style={styles.fieldGrid}>
                <Field label="Company" value={v.company_name} />
                <Field label="Job Title" value={v.job_title} />
                <Field label="Industry" value={v.company_industry} />
                <Field label="Department" value={v.department} />
                <Field label="Seniority" value={v.seniority_level} />
                <Field label="Company Size" value={v.company_size} />
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Contact Information</h2>
            {emailList.length > 0 && (
              <div style={styles.contactSection}>
                <div style={styles.contactLabel}>Email Addresses</div>
                {emailList.map((email, i) => (
                  <div key={i} style={styles.contactValue}>
                    <a href={`mailto:${email}`} style={styles.link}>{email}</a>
                    {i === 0 && <span style={styles.primaryBadge}>Primary</span>}
                  </div>
                ))}
              </div>
            )}
            {v.business_email && (
              <div style={styles.contactSection}>
                <div style={styles.contactLabel}>Business Email</div>
                <div style={styles.contactValue}>
                  <a href={`mailto:${v.business_email}`} style={styles.link}>{v.business_email}</a>
                </div>
              </div>
            )}
            {phoneList.length > 0 && (
              <div style={styles.contactSection}>
                <div style={styles.contactLabel}>Phone Numbers</div>
                {phoneList.map((phone, i) => (
                  <div key={i} style={styles.contactValue}>{phone}</div>
                ))}
              </div>
            )}
            {v.linkedin && (
              <div style={styles.contactSection}>
                <div style={styles.contactLabel}>LinkedIn</div>
                <div style={styles.contactValue}>
                  <a href={v.linkedin.startsWith('http') ? v.linkedin : `https://${v.linkedin}`}
                     target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {v.linkedin}
                  </a>
                </div>
              </div>
            )}
            {v.facebook_url && (
              <div style={styles.contactSection}>
                <div style={styles.contactLabel}>Facebook</div>
                <div style={styles.contactValue}>
                  <a href={v.facebook_url.startsWith('http') ? v.facebook_url : `https://${v.facebook_url}`}
                     target="_blank" rel="noopener noreferrer" style={styles.link}>
                    {v.facebook_url}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column — Intent & Activity */}
        <div style={styles.column}>

          {/* Intent Summary */}
          <div style={{ ...styles.card, borderLeft: `4px solid ${tierColor}` }}>
            <h2 style={styles.sectionTitle}>Intent Summary</h2>
            <div style={styles.intentGrid}>
              <div style={styles.intentItem}>
                <div style={styles.intentLabel}>Score</div>
                <div style={{ ...styles.intentValue, color: tierColor, fontSize: 32 }}>{v.intent_score}</div>
              </div>
              <div style={styles.intentItem}>
                <div style={styles.intentLabel}>Tier</div>
                <div style={{ ...styles.intentValue, color: tierColor }}>{v.intent_tier}</div>
              </div>
              <div style={styles.intentItem}>
                <div style={styles.intentLabel}>Total Visits</div>
                <div style={styles.intentValue}>{v.visit_count}</div>
              </div>
              <div style={styles.intentItem}>
                <div style={styles.intentLabel}>Traffic Source</div>
                <div style={styles.intentValue}>{v.referrer_source || 'Direct'}</div>
              </div>
            </div>
          </div>

          {/* Confidence Assessment */}
          {v.confidence && (
            <div style={{ ...styles.card, borderLeft: `4px solid ${confidenceColor}` }}>
              <h2 style={styles.sectionTitle}>Identity Confidence</h2>
              <div style={styles.intentGrid}>
                <div style={styles.intentItem}>
                  <div style={styles.intentLabel}>Score</div>
                  <div style={{ ...styles.intentValue, color: confidenceColor, fontSize: 32 }}>
                    {v.confidence_score}
                  </div>
                </div>
                <div style={styles.intentItem}>
                  <div style={styles.intentLabel}>Level</div>
                  <div style={{ ...styles.intentValue, color: confidenceColor }}>
                    {v.confidence}
                  </div>
                </div>
              </div>
              {confidenceFlags.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                    Signals
                  </div>
                  <div style={styles.tagWrap}>
                    {confidenceFlags.map((flag, i) => {
                      const isPositive = ['name-matches-email', 'multi-page-depth', 'has-enrichment', 'in-market', 'phone-matches-state', 'has-research-interest'].includes(flag);
                      const isSevere = ['fake-name-detected', 'fake-phone-555', 'suspicious-email', 'extreme-visit-count'].includes(flag);
                      return (
                        <span key={i} style={{
                          ...styles.systemTag,
                          backgroundColor: isPositive ? '#dcfce7' : isSevere ? '#fecaca' : '#fef2f2',
                          color: isPositive ? '#166534' : isSevere ? '#7f1d1d' : '#991b1b',
                          fontWeight: isSevere ? 'bold' : 'normal',
                        }}>
                          {isPositive ? '+' : '-'} {flag.replace(/-/g, ' ')}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Research Interests */}
          {interests.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Research Interests</h2>
              <div style={styles.tagWrap}>
                {interests.map((interest, i) => (
                  <span key={i} style={styles.interestTag}>{interest}</span>
                ))}
              </div>
            </div>
          )}

          {/* Visit Timeline */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Visit Timeline</h2>
            <div style={styles.fieldGrid}>
              <Field label="First Visit" value={fmtDate(v.first_visit)} />
              <Field label="Last Visit" value={fmtDate(v.last_visit)} />
            </div>
          </div>

          {/* Pages Visited */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Pages Visited ({pages.length})</h2>
            <div style={styles.pageList}>
              {pages.map((url, i) => {
                // Extract path from full URL
                let display = url;
                try {
                  const u = new URL(url);
                  display = u.pathname + u.search;
                  if (display.length > 80) display = display.substring(0, 77) + '...';
                } catch {}
                return (
                  <div key={i} style={styles.pageItem}>
                    <a href={url} target="_blank" rel="noopener noreferrer" style={styles.pageLink}>
                      {display}
                    </a>
                  </div>
                );
              })}
              {pages.length === 0 && (
                <p style={styles.empty}>No page data recorded.</p>
              )}
            </div>
          </div>

          {/* Referrer Sources */}
          {referrers.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Referrer Sources</h2>
              <div style={styles.pageList}>
                {referrers.map((ref, i) => {
                  let display = ref;
                  try {
                    const u = new URL(ref);
                    display = u.hostname;
                  } catch {}
                  return (
                    <div key={i} style={styles.pageItem}>{display}</div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>System Tags</h2>
              <div style={styles.tagWrap}>
                {tags.map((tag, i) => (
                  <span key={i} style={styles.systemTag}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* GHL Status */}
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>CRM Status</h2>
            <div style={styles.fieldGrid}>
              <Field label="Pushed to GHL" value={v.ghl_pushed ? 'Yes' : 'Not yet'} />
              {v.ghl_pushed_at && <Field label="Pushed At" value={fmtDate(v.ghl_pushed_at)} />}
              {v.ghl_contact_id && <Field label="GHL Contact ID" value={v.ghl_contact_id} />}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>P5 Marketing &bull; Invisible Patient Intelligence &bull; Visitor ID: {v.id}</p>
        <p style={{ fontSize: 11, marginTop: 2 }}>Processed: {fmtDate(v.processed_at)}</p>
      </footer>
    </div>
  );
}

function Field({ label, value, wide }) {
  if (!value) return null;
  return (
    <div style={{ ...fieldStyles.wrap, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
      <div style={fieldStyles.label}>{label}</div>
      <div style={fieldStyles.value}>{value}</div>
    </div>
  );
}

const fieldStyles = {
  wrap: { padding: '6px 0' },
  label: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 },
  value: { fontSize: 14, color: '#1e293b', fontWeight: 500 },
};

const styles = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    padding: 24,
    maxWidth: 1200,
    margin: '0 auto',
    color: '#1e293b',
  },
  backLink: {
    display: 'inline-block',
    color: '#6366f1',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 16,
  },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 28,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 24,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 20 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: 28,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: { fontSize: 24, fontWeight: 700, margin: 0 },
  locationText: { fontSize: 14, color: '#64748b', marginTop: 4 },
  jobLine: { fontSize: 14, color: '#475569', marginTop: 2, fontStyle: 'italic' },
  headerRight: { textAlign: 'right' },
  scoreBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: 20,
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    textTransform: 'uppercase',
  },
  scoreNumber: { fontSize: 14, color: '#64748b', marginTop: 6, fontWeight: 600 },
  visits: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: 20,
  },
  column: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  sectionTitle: { fontSize: 15, fontWeight: 600, color: '#334155', marginBottom: 12, marginTop: 0 },
  fieldGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' },
  intentGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  intentItem: { textAlign: 'center', padding: 8 },
  intentLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  intentValue: { fontSize: 20, fontWeight: 700, marginTop: 4, color: '#1e293b' },
  contactSection: { marginBottom: 12 },
  contactLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 },
  contactValue: { fontSize: 14, color: '#1e293b', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 8 },
  primaryBadge: {
    fontSize: 10,
    backgroundColor: '#dbeafe',
    color: '#2563eb',
    padding: '2px 8px',
    borderRadius: 10,
    fontWeight: 600,
  },
  link: { color: '#6366f1', textDecoration: 'none' },
  tagWrap: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  interestTag: {
    backgroundColor: '#eef2ff',
    color: '#4338ca',
    padding: '5px 12px',
    borderRadius: 16,
    fontSize: 13,
    fontWeight: 500,
  },
  systemTag: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 500,
  },
  pageList: { maxHeight: 300, overflowY: 'auto' },
  pageItem: { padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 },
  pageLink: { color: '#6366f1', textDecoration: 'none', wordBreak: 'break-all' },
  empty: { color: '#94a3b8', fontSize: 13 },
  footer: {
    textAlign: 'center',
    padding: '24px 0',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 20,
  },
};
