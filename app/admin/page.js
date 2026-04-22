'use client';

import { useState, useEffect, useCallback } from 'react';

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('clients');

  // Blocklist state
  const [blocklist, setBlocklist] = useState([]);
  const [blocklistLoading, setBlocklistLoading] = useState(false);
  const [newEntry, setNewEntry] = useState({ match_type: 'email', match_value: '', reason: '' });
  const [addStatus, setAddStatus] = useState('');

  // Engagement state
  const [engagement, setEngagement] = useState(null);
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementError, setEngagementError] = useState('');

  const clients = [
    { key: 'sa-spine', name: 'SA Spine', domain: 'saspine.com', vertical: 'Spine Surgery', geo: 'TX' },
    { key: 'waverly-manor', name: 'Waverly Manor', domain: 'waverlymanor.com', vertical: 'Wedding Venue', geo: 'TX' },
    { key: 'az-breasts', name: 'AZ Breasts', domain: 'azbreasts.com', vertical: 'Plastic Surgery', geo: 'AZ' },
    { key: 'tbr', name: 'The Brilliance Revolution', domain: 'thebrilliancerevolution.com', vertical: 'Coaching', geo: '' },
    { key: 'four-winds', name: 'Four Winds CMMS', domain: 'fourwindscmms.com', vertical: 'B2B SaaS', geo: '' },
    { key: 'cyr-md', name: 'CYR-MD (Dr. Cyr)', domain: 'cyrmd.com', vertical: 'Spine Surgery', geo: 'TX' },
    { key: 'p5', name: 'P5 Marketing', domain: 'p5marketing.com', vertical: 'Marketing Agency', geo: 'TX' },
  ];

  // ── Auth: verify password against the API before granting access ──
  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/admin/blocklist', {
        headers: { 'Authorization': `Bearer ${password}` }
      });
      if (res.status === 401) {
        setAuthError('Incorrect password.');
        return;
      }
      // Password is valid — store in state
      setToken(password);
      setAuthed(true);
    } catch (err) {
      setAuthError('Could not connect to server.');
    }
  }

  // ── Blocklist ──
  const loadBlocklist = useCallback(async () => {
    if (!token) return;
    setBlocklistLoading(true);
    try {
      const res = await fetch('/api/admin/blocklist', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        setAuthed(false);
        setAuthError('Session expired. Please log in again.');
        return;
      }
      const data = await res.json();
      setBlocklist(data.entries || []);
    } catch (err) {
      console.error('Failed to load blocklist:', err);
    } finally {
      setBlocklistLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authed && activeTab === 'blocklist') {
      loadBlocklist();
    }
  }, [authed, activeTab, loadBlocklist]);

  // ── Engagement ──
  const loadEngagement = useCallback(async () => {
    if (!token) return;
    setEngagementLoading(true);
    setEngagementError('');
    try {
      const res = await fetch('/api/admin/engagement-stats', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) {
        setAuthed(false);
        setAuthError('Session expired. Please log in again.');
        return;
      }
      if (!res.ok) {
        const body = await res.text();
        setEngagementError(`Error ${res.status}: ${body.slice(0, 200)}`);
        return;
      }
      const data = await res.json();
      setEngagement(data);
    } catch (err) {
      setEngagementError('Network error');
    } finally {
      setEngagementLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (authed && activeTab === 'engagement') {
      loadEngagement();
    }
  }, [authed, activeTab, loadEngagement]);

  async function handleAddEntry(e) {
    e.preventDefault();
    setAddStatus('');
    try {
      const res = await fetch('/api/admin/blocklist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newEntry)
      });
      const data = await res.json();
      if (res.ok) {
        setAddStatus('Added');
        setNewEntry({ match_type: 'email', match_value: '', reason: '' });
        loadBlocklist();
        setTimeout(() => setAddStatus(''), 2000);
      } else {
        setAddStatus(data.error || data.message || 'Error');
      }
    } catch (err) {
      setAddStatus('Network error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this blocklist entry?')) return;
    try {
      await fetch('/api/admin/blocklist', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      loadBlocklist();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }

  // ── Login Screen ──
  if (!authed) {
    return (
      <div style={styles.loginWrap}>
        <div style={styles.loginCard}>
          <div style={styles.loginIcon}>P5</div>
          <h1 style={styles.loginTitle}>VisitorID Admin</h1>
          <p style={styles.loginSub}>Enter admin password to continue</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              style={styles.input}
              autoFocus
            />
            {authError && <p style={styles.error}>{authError}</p>}
            <button type="submit" style={styles.btnPrimary}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main Admin Dashboard ──
  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div>
            <h1 style={styles.headerTitle}>VisitorID Admin</h1>
            <span style={styles.headerSub}>P5 Marketing &middot; Pixel Intelligence Pipeline</span>
          </div>
          <button onClick={() => { setToken(''); setAuthed(false); }} style={styles.logoutBtn}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={styles.tabBar}>
        <button
          onClick={() => setActiveTab('clients')}
          style={activeTab === 'clients' ? { ...styles.tab, ...styles.tabActive } : styles.tab}
        >
          Clients
        </button>
        <button
          onClick={() => setActiveTab('engagement')}
          style={activeTab === 'engagement' ? { ...styles.tab, ...styles.tabActive } : styles.tab}
        >
          Engagement
        </button>
        <button
          onClick={() => setActiveTab('blocklist')}
          style={activeTab === 'blocklist' ? { ...styles.tab, ...styles.tabActive } : styles.tab}
        >
          Blocklist
        </button>
      </div>

      <main style={styles.main}>

        {/* ═══ CLIENTS TAB ═══ */}
        {activeTab === 'clients' && (
          <div>
            <h2 style={styles.sectionTitle}>Client Dashboards</h2>
            <p style={styles.sectionSub}>Select a client to open their VisitorID dashboard.</p>
            <div style={styles.clientGrid}>
              {clients.map(c => (
                <a
                  key={c.key}
                  href={c.key === 'cyr-md' ? '#' : `/dashboard/${c.key}`}
                  style={styles.clientCard}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#2E86AB'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  <div style={styles.clientName}>{c.name}</div>
                  <div style={styles.clientDomain}>{c.domain}</div>
                  <div style={styles.clientMeta}>
                    <span style={styles.pill}>{c.vertical}</span>
                    {c.geo && <span style={{ ...styles.pill, background: '#e8f4f8', color: '#1a5276' }}>{c.geo}</span>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ═══ ENGAGEMENT TAB ═══ */}
        {activeTab === 'engagement' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
              <div>
                <h2 style={styles.sectionTitle}>Instantly Engagement</h2>
                <p style={styles.sectionSub}>
                  Email engagement loop-back from Instantly to VisitorID. Replies and clicks promote visitors to HOT and re-surface them in the next HOT digest.
                </p>
              </div>
              <button onClick={loadEngagement} style={{ ...styles.btnPrimary, width: 'auto', marginTop: 0, padding: '10px 18px' }}>
                {engagementLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {engagementError && <p style={styles.error}>{engagementError}</p>}

            {engagement && (
              <>
                {/* KPI tiles */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                  <KpiTile label="Enrolled" value={engagement.totals.enrolled} />
                  <KpiTile label="Engaged" value={engagement.totals.engaged} sub={engagement.totals.enrolled ? `${Math.round(engagement.totals.engaged / engagement.totals.enrolled * 1000) / 10}%` : null} />
                  <KpiTile label="Opens" value={engagement.totals.opens} sub={engagement.totals.open_rate != null ? `${engagement.totals.open_rate}%` : null} />
                  <KpiTile label="Clicks" value={engagement.totals.clicks} sub={engagement.totals.click_rate != null ? `${engagement.totals.click_rate}%` : null} />
                  <KpiTile label="Replies" value={engagement.totals.replies} sub={engagement.totals.reply_rate != null ? `${engagement.totals.reply_rate}%` : null} />
                  <KpiTile label="Reclaimed (7d)" value={engagement.totals.reclaimed_7d} />
                  <KpiTile label="Reclaim eligible" value={engagement.totals.reclaim_eligible} tone={engagement.totals.reclaim_eligible > 500 ? 'warn' : 'default'} />
                </div>

                {/* Per-client table */}
                <h3 style={{ ...styles.sectionTitle, fontSize: '16px', margin: '0 0 8px' }}>By client</h3>
                <table style={{ ...styles.table, marginBottom: '32px' }}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Client</th>
                      <th style={styles.th}>Enrolled</th>
                      <th style={styles.th}>Engaged</th>
                      <th style={styles.th}>Opens</th>
                      <th style={styles.th}>Clicks</th>
                      <th style={styles.th}>Replies</th>
                      <th style={styles.th}>Bounces</th>
                      <th style={styles.th}>Unsubs</th>
                      <th style={styles.th}>Reclaim elig.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagement.per_client.map(r => (
                      <tr key={r.client_key} style={styles.tr}>
                        <td style={{ ...styles.td, fontWeight: 600 }}>{r.client_key}</td>
                        <td style={styles.td}>{r.enrolled}</td>
                        <td style={styles.td}>{r.engaged}</td>
                        <td style={styles.td}>{r.opens}</td>
                        <td style={styles.td}>{r.clicks}</td>
                        <td style={styles.td}>{r.replies}</td>
                        <td style={styles.td}>{r.bounces}</td>
                        <td style={styles.td}>{r.unsubs}</td>
                        <td style={{ ...styles.td, color: r.reclaim_eligible > 500 ? '#dc2626' : '#333' }}>{r.reclaim_eligible}</td>
                      </tr>
                    ))}
                    {engagement.per_client.length === 0 && (
                      <tr><td style={styles.td} colSpan={9}>No campaigns configured yet.</td></tr>
                    )}
                  </tbody>
                </table>

                {/* Recent engaged visitors */}
                <h3 style={{ ...styles.sectionTitle, fontSize: '16px', margin: '0 0 8px' }}>Recently engaged visitors</h3>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Client</th>
                      <th style={styles.th}>Visitor</th>
                      <th style={styles.th}>Intent</th>
                      <th style={styles.th}>Engagement</th>
                      <th style={styles.th}>O / C / R</th>
                      <th style={styles.th}>Last event</th>
                      <th style={styles.th}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engagement.recent_engaged.map(v => (
                      <tr key={v.visitor_id} style={styles.tr}>
                        <td style={{ ...styles.td, fontSize: '12px', color: '#666' }}>{v.client_key}</td>
                        <td style={styles.td}>
                          <a href={`/dashboard/${v.client_key}/visitor/${v.visitor_id}`} style={{ color: '#2E86AB', textDecoration: 'none' }}>
                            {[v.first_name, v.last_name].filter(Boolean).join(' ') || v.email || `Visitor #${v.visitor_id}`}
                          </a>
                          <div style={{ fontSize: '11px', color: '#888' }}>{v.email}</div>
                        </td>
                        <td style={styles.td}>
                          <span style={tierPillStyle(v.intent_tier)}>{v.intent_tier || '-'}</span>
                        </td>
                        <td style={styles.td}>
                          <span style={engagementPillStyle(v.engagement_tier)}>{v.engagement_tier || 'None'}</span>
                        </td>
                        <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '12px' }}>
                          {v.open_count || 0} / {v.click_count || 0} / {v.reply_count || 0}
                        </td>
                        <td style={{ ...styles.td, fontSize: '12px' }}>{v.last_event_type || '-'}</td>
                        <td style={{ ...styles.td, fontSize: '12px', color: '#666' }}>
                          {v.last_engaged_at ? new Date(v.last_engaged_at).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                    {engagement.recent_engaged.length === 0 && (
                      <tr><td style={styles.td} colSpan={7}>No engaged visitors yet. Engagement arrives via Instantly webhook.</td></tr>
                    )}
                  </tbody>
                </table>

                <p style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
                  Fetched {new Date(engagement.fetched_at).toLocaleString()}
                </p>
              </>
            )}
          </div>
        )}

        {/* ═══ BLOCKLIST TAB ═══ */}
        {activeTab === 'blocklist' && (
          <div>
            <h2 style={styles.sectionTitle}>Global Blocklist</h2>
            <p style={styles.sectionSub}>
              Blocked entries are silently dropped across all clients during ingestion and processing.
              Use <code>%</code> as a wildcard (e.g. <code>fordtruck@%</code> blocks any email starting with that prefix).
            </p>

            {/* Add new entry form */}
            <form onSubmit={handleAddEntry} style={styles.addForm}>
              <select
                value={newEntry.match_type}
                onChange={e => setNewEntry({ ...newEntry, match_type: e.target.value })}
                style={{ ...styles.input, width: '160px', flex: 'none' }}
              >
                <option value="email">Email</option>
                <option value="email_domain">Email Domain</option>
                <option value="name">Name</option>
                <option value="phone">Phone</option>
                <option value="ip">IP Address</option>
              </select>
              <input
                type="text"
                value={newEntry.match_value}
                onChange={e => setNewEntry({ ...newEntry, match_value: e.target.value })}
                placeholder="Pattern (e.g. fordtruck@cox.internet.com)"
                style={{ ...styles.input, flex: 1 }}
                required
              />
              <input
                type="text"
                value={newEntry.reason}
                onChange={e => setNewEntry({ ...newEntry, reason: e.target.value })}
                placeholder="Reason (optional)"
                style={{ ...styles.input, width: '200px', flex: 'none' }}
              />
              <button type="submit" style={{ ...styles.btnPrimary, padding: '10px 24px', marginTop: 0 }}>
                Add
              </button>
              {addStatus && <span style={{ fontSize: '13px', color: addStatus === 'Added' ? '#16a34a' : '#dc2626', alignSelf: 'center' }}>{addStatus}</span>}
            </form>

            {/* Blocklist table */}
            {blocklistLoading ? (
              <p style={{ color: '#999', padding: '20px 0' }}>Loading...</p>
            ) : blocklist.length === 0 ? (
              <p style={{ color: '#999', padding: '20px 0' }}>No blocklist entries yet. Add one above.</p>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Pattern</th>
                    <th style={styles.th}>Reason</th>
                    <th style={styles.th}>Added</th>
                    <th style={{ ...styles.th, width: '70px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {blocklist.map(entry => (
                    <tr key={entry.id} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={{ ...styles.typePill, background: typeColors[entry.match_type] || '#e2e8f0' }}>
                          {entry.match_type}
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: '13px' }}>{entry.match_value}</td>
                      <td style={{ ...styles.td, color: '#666' }}>{entry.reason}</td>
                      <td style={{ ...styles.td, color: '#999', fontSize: '12px' }}>
                        {new Date(entry.created_at).toLocaleDateString()}
                      </td>
                      <td style={styles.td}>
                        <button onClick={() => handleDelete(entry.id)} style={styles.deleteBtn}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        Powered by P5 Marketing &middot; VisitorID&trade; Pixel Intelligence Pipeline
      </footer>
    </div>
  );
}

const typeColors = {
  email: '#dbeafe',
  email_domain: '#fef3c7',
  name: '#ede9fe',
  phone: '#d1fae5',
  ip: '#fee2e2',
};

// ── Engagement tab helpers ──
function KpiTile({ label, value, sub, tone }) {
  const bg = tone === 'warn' ? '#fff7ed' : '#fff';
  const border = tone === 'warn' ? '#fed7aa' : '#e2e8f0';
  const valColor = tone === 'warn' ? '#c2410c' : '#1B3A5C';
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: valColor, marginTop: '4px' }}>{value ?? 0}</div>
      {sub && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

function tierPillStyle(tier) {
  const colors = {
    HOT:    { bg: '#fee2e2', fg: '#b91c1c' },
    High:   { bg: '#fef3c7', fg: '#92400e' },
    Medium: { bg: '#e0f2fe', fg: '#075985' },
    Low:    { bg: '#f1f5f9', fg: '#475569' },
  };
  const c = colors[tier] || { bg: '#f1f5f9', fg: '#475569' };
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: '99px',
    fontSize: '11px', fontWeight: 600, background: c.bg, color: c.fg,
  };
}

function engagementPillStyle(tier) {
  const colors = {
    Hot:     { bg: '#fee2e2', fg: '#b91c1c' },
    Engaged: { bg: '#fef3c7', fg: '#92400e' },
    Passive: { bg: '#e0f2fe', fg: '#075985' },
    None:    { bg: '#f1f5f9', fg: '#94a3b8' },
  };
  const c = colors[tier] || colors.None;
  return {
    display: 'inline-block', padding: '2px 10px', borderRadius: '99px',
    fontSize: '11px', fontWeight: 600, background: c.bg, color: c.fg,
  };
}

const styles = {
  // Login
  loginWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', fontFamily: 'system-ui, -apple-system, sans-serif' },
  loginCard: { background: '#fff', borderRadius: '12px', padding: '48px 40px', maxWidth: '380px', width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' },
  loginIcon: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '12px', background: '#1B3A5C', color: '#fff', fontWeight: 700, fontSize: '18px', marginBottom: '20px' },
  loginTitle: { fontSize: '22px', fontWeight: 700, color: '#1B3A5C', margin: '0 0 4px' },
  loginSub: { fontSize: '14px', color: '#888', margin: '0 0 24px' },
  error: { color: '#dc2626', fontSize: '13px', margin: '8px 0' },

  // Layout
  page: { minHeight: '100vh', background: '#f5f7fa', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { background: '#1B3A5C', color: '#fff', padding: '0 24px' },
  headerInner: { maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' },
  headerTitle: { fontSize: '18px', fontWeight: 700, margin: 0 },
  headerSub: { fontSize: '12px', opacity: 0.7 },
  logoutBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },

  // Tabs
  tabBar: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', maxWidth: '1200px', margin: '0 auto' },
  tab: { background: 'none', border: 'none', padding: '14px 20px', fontSize: '14px', fontWeight: 500, color: '#666', cursor: 'pointer', borderBottom: '2px solid transparent', transition: 'all 0.15s' },
  tabActive: { color: '#1B3A5C', borderBottomColor: '#2E86AB' },

  // Main
  main: { maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' },
  sectionTitle: { fontSize: '20px', fontWeight: 700, color: '#1B3A5C', margin: '0 0 4px' },
  sectionSub: { fontSize: '14px', color: '#666', margin: '0 0 24px', lineHeight: 1.5 },

  // Clients grid
  clientGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  clientCard: { display: 'block', background: '#fff', borderRadius: '10px', padding: '20px 24px', border: '1px solid #e2e8f0', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s, box-shadow 0.15s', cursor: 'pointer' },
  clientName: { fontSize: '17px', fontWeight: 600, color: '#1B3A5C', marginBottom: '4px' },
  clientDomain: { fontSize: '13px', color: '#2E86AB', marginBottom: '12px' },
  clientMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  pill: { display: 'inline-block', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 500, background: '#f0f1f5', color: '#555' },

  // Blocklist
  addForm: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'flex-start' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  th: { textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f0f1f5' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#333' },
  typePill: { display: 'inline-block', padding: '2px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 },
  deleteBtn: { background: 'none', border: '1px solid #fecaca', color: '#dc2626', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' },

  // Shared
  input: { padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', fontFamily: 'system-ui', outline: 'none' },
  btnPrimary: { display: 'block', width: '100%', padding: '12px', background: '#1B3A5C', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '16px' },

  // Footer
  footer: { textAlign: 'center', padding: '24px', fontSize: '12px', color: '#999', borderTop: '1px solid #e2e8f0', marginTop: '48px' },
};
