'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

const TIER_COLORS = {
  HOT: '#dc2626',
  High: '#f59e0b',
  Medium: '#3b82f6',
  Low: '#94a3b8',
};

const SOURCE_COLORS = [
  '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6',
  '#06b6d4', '#84cc16', '#ef4444', '#a855f7', '#22d3ee',
];

const DATE_WINDOWS = [
  { label: '7d', value: '7' },
  { label: '30d', value: '30' },
  { label: '90d', value: '90' },
  { label: 'All', value: 'all' },
];

export default function DashboardClient({ data }) {
  const pathname = usePathname();
  const tierChartRef = useRef(null);
  const sourceChartRef = useRef(null);
  const interestChartRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const {
    clientName, totalVisitors, allTimeTotal, tiers, interests,
    sources, topVisitors, dateRange, lastProcessed,
    clientGeo, dateWindow, activeState,
  } = data;

  const activeDays = String(dateWindow || 30);

  // Build URLs preserving existing params
  const buildHref = (overrides = {}) => {
    const params = {};
    // Keep current date window
    if (activeDays !== '30') params.days = activeDays;
    // Keep current state filter
    if (activeState) params.state = activeState;
    // Apply overrides
    Object.assign(params, overrides);
    // Clean up defaults
    if (params.days === '30') delete params.days;
    if (params.state === '') delete params.state;
    const qs = new URLSearchParams(params).toString();
    return `${pathname}${qs ? '?' + qs : ''}`;
  };

  const windowHref = (val) => buildHref({ days: val === '30' ? undefined : val });
  const stateHref = (stateCode) => buildHref({ state: activeState ? '' : stateCode });

  useEffect(() => {
    if (!chartReady || typeof Chart === 'undefined') return;

    // Tier donut
    if (tierChartRef.current) {
      const ctx = tierChartRef.current.getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['HOT', 'High', 'Medium', 'Low'],
          datasets: [{
            data: [tiers.HOT, tiers.High, tiers.Medium, tiers.Low],
            backgroundColor: [TIER_COLORS.HOT, TIER_COLORS.High, TIER_COLORS.Medium, TIER_COLORS.Low],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } },
          },
        },
      });
    }

    // Source bar chart
    if (sourceChartRef.current && sources.length > 0) {
      const ctx = sourceChartRef.current.getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sources.slice(0, 8).map(s => s.source),
          datasets: [{
            data: sources.slice(0, 8).map(s => s.count),
            backgroundColor: SOURCE_COLORS.slice(0, 8),
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 12 } } },
            y: { grid: { display: false }, ticks: { font: { size: 12 } } },
          },
        },
      });
    }

    // Interest horizontal bar
    if (interestChartRef.current && interests.length > 0) {
      const ctx = interestChartRef.current.getContext('2d');
      const top15 = interests.slice(0, 15);
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top15.map(i => i.interest),
          datasets: [{
            data: top15.map(i => i.count),
            backgroundColor: '#6366f1',
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 } } },
            y: { grid: { display: false }, ticks: { font: { size: 11 } } },
          },
        },
      });
    }
  }, [chartReady, tiers, sources, interests]);

  // Filter visitors (state already filtered server-side, just tier + search here)
  const filtered = topVisitors.filter(v => {
    if (filter !== 'ALL' && v.intent_tier !== filter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const fullName = `${v.first_name} ${v.last_name}`.toLowerCase();
      const loc = `${v.city} ${v.state}`.toLowerCase();
      const ints = (v.interests || []).join(' ').toLowerCase();
      const email = (v.email || '').toLowerCase();
      return fullName.includes(term) || loc.includes(term) || ints.includes(term) || email.includes(term);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const fmtDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
        onLoad={() => setChartReady(true)}
      />
      <div style={styles.page}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>
              <span style={styles.logo}>P5</span> Invisible Patient Intelligence
            </h1>
            <p style={styles.subtitle}>{clientName}</p>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.dateWindowRow}>
              {DATE_WINDOWS.map(w => (
                <a
                  key={w.value}
                  href={windowHref(w.value)}
                  style={{
                    ...styles.dateWindowBtn,
                    backgroundColor: activeDays === w.value ? '#6366f1' : '#fff',
                    color: activeDays === w.value ? '#fff' : '#64748b',
                    borderColor: activeDays === w.value ? '#6366f1' : '#e2e8f0',
                    textDecoration: 'none',
                  }}
                >
                  {w.label}
                </a>
              ))}
              {clientGeo && (
                <>
                  <span style={{ color: '#e2e8f0', fontSize: 16, margin: '0 2px' }}>|</span>
                  <a
                    href={stateHref(clientGeo.code)}
                    style={{
                      ...styles.dateWindowBtn,
                      backgroundColor: activeState ? '#16a34a' : '#fff',
                      color: activeState ? '#fff' : '#64748b',
                      borderColor: activeState ? '#16a34a' : '#e2e8f0',
                      textDecoration: 'none',
                    }}
                  >
                    {activeState ? `${clientGeo.label} Only` : clientGeo.label}
                  </a>
                </>
              )}
            </div>
            <div style={styles.dateRange}>
              {fmtDate(dateRange.earliest)} &mdash; {fmtDate(dateRange.latest)}
            </div>
            {lastProcessed && (
              <div style={styles.lastUpdated}>
                Last updated: {fmtDate(lastProcessed)}
              </div>
            )}
          </div>
        </header>

        {/* KPI Cards */}
        <div style={styles.kpiRow}>
          <div style={{ ...styles.kpiCard, borderTop: '4px solid #1e293b' }}>
            <div style={styles.kpiLabel}>Total Identified</div>
            <div style={styles.kpiValue}>{totalVisitors.toLocaleString()}</div>
            {activeDays !== 'all' && allTimeTotal !== totalVisitors && (
              <div style={styles.kpiSub}>{allTimeTotal.toLocaleString()} all-time</div>
            )}
          </div>
          <div style={{ ...styles.kpiCard, borderTop: `4px solid ${TIER_COLORS.HOT}` }}>
            <div style={styles.kpiLabel}>HOT</div>
            <div style={{ ...styles.kpiValue, color: TIER_COLORS.HOT }}>{tiers.HOT.toLocaleString()}</div>
            <div style={styles.kpiSub}>Immediate Outreach</div>
          </div>
          <div style={{ ...styles.kpiCard, borderTop: `4px solid ${TIER_COLORS.High}` }}>
            <div style={styles.kpiLabel}>High Intent</div>
            <div style={{ ...styles.kpiValue, color: TIER_COLORS.High }}>{tiers.High.toLocaleString()}</div>
            <div style={styles.kpiSub}>Priority Nurture</div>
          </div>
          <div style={{ ...styles.kpiCard, borderTop: `4px solid ${TIER_COLORS.Medium}` }}>
            <div style={styles.kpiLabel}>Medium</div>
            <div style={{ ...styles.kpiValue, color: TIER_COLORS.Medium }}>{tiers.Medium.toLocaleString()}</div>
            <div style={styles.kpiSub}>Standard Follow-up</div>
          </div>
          <div style={{ ...styles.kpiCard, borderTop: `4px solid ${TIER_COLORS.Low}` }}>
            <div style={styles.kpiLabel}>Low</div>
            <div style={{ ...styles.kpiValue, color: TIER_COLORS.Low }}>{tiers.Low.toLocaleString()}</div>
            <div style={styles.kpiSub}>Awareness</div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={styles.chartsRow}>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Intent Distribution</h3>
            <div style={{ height: 260 }}>
              <canvas ref={tierChartRef}></canvas>
            </div>
          </div>
          <div style={styles.chartCard}>
            <h3 style={styles.chartTitle}>Traffic Sources</h3>
            <div style={{ height: 260 }}>
              <canvas ref={sourceChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* Interests Chart */}
        <div style={styles.fullCard}>
          <h3 style={styles.chartTitle}>Top Conditions & Procedures Researched</h3>
          <div style={{ height: Math.max(300, Math.min(interests.length, 15) * 32) }}>
            <canvas ref={interestChartRef}></canvas>
          </div>
        </div>

        {/* Visitor Table */}
        <div style={styles.fullCard}>
          <div style={styles.tableHeader}>
            <h3 style={styles.chartTitle}>High-Intent Visitors</h3>
            <div style={styles.tableControls}>
              <input
                type="text"
                placeholder="Search name, city, interest..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={styles.searchInput}
              />
              <select
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
                style={styles.filterSelect}
              >
                <option value="ALL">All Tiers</option>
                <option value="HOT">HOT Only</option>
                <option value="High">High Only</option>
                <option value="Medium">Medium Only</option>
                <option value="Low">Low Only</option>
              </select>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Score</th>
                  <th style={styles.th}>Tier</th>
                  <th style={styles.th}>Confidence</th>
                  <th style={styles.th}>Interests</th>
                  <th style={styles.th}>Source</th>
                  <th style={styles.th}>Visits</th>
                  <th style={styles.th}>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((v, i) => (
                  <tr key={v.id} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                    <td style={styles.td}>
                      <a href={`${pathname}/visitor/${v.id}`} style={styles.nameLink}>
                        {v.first_name} {v.last_initial}.
                      </a>
                    </td>
                    <td style={styles.td}>{[v.city, v.state].filter(Boolean).join(', ') || '-'}</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{v.intent_score}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.tierBadge,
                        backgroundColor: TIER_COLORS[v.intent_tier] || '#94a3b8',
                      }}>
                        {v.intent_tier}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {v.confidence ? (
                        <span style={{
                          ...styles.tierBadge,
                          backgroundColor: v.confidence === 'High' ? '#16a34a' : v.confidence === 'Medium' ? '#d97706' : '#dc2626',
                          fontSize: 10,
                        }}>
                          {v.confidence}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ ...styles.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(v.interests || []).join(', ') || '-'}
                    </td>
                    <td style={styles.td}>{v.referrer_source || 'Direct'}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>{v.visit_count}</td>
                    <td style={styles.td}>{fmtDate(v.last_visit)}</td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#999' }}>
                      No visitors match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={styles.pageBtn}
              >
                Previous
              </button>
              <span style={styles.pageInfo}>
                Page {currentPage} of {totalPages} ({filtered.length} visitors{activeState && clientGeo ? ` in ${clientGeo.label}` : ''})
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={styles.pageBtn}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={styles.footer}>
          <p>P5 Marketing &bull; Invisible Patient Intelligence &bull; Powered by Audience Lab + AI Scoring</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Data refreshes automatically with each processing run. Reload page for latest data.
          </p>
        </footer>
      </div>
    </>
  );
}

const styles = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    padding: '24px',
    maxWidth: 1280,
    margin: '0 auto',
    color: '#1e293b',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    flexWrap: 'wrap',
    gap: 16,
  },
  h1: {
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    color: '#0f172a',
  },
  logo: {
    display: 'inline-block',
    backgroundColor: '#6366f1',
    color: '#fff',
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 20,
    fontWeight: 800,
    marginRight: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  headerRight: { textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  dateWindowRow: { display: 'flex', gap: 4, marginBottom: 4 },
  dateWindowBtn: {
    padding: '5px 12px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  dateRange: { fontSize: 14, fontWeight: 600, color: '#334155' },
  lastUpdated: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  kpiLabel: { fontSize: 13, color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' },
  kpiValue: { fontSize: 36, fontWeight: 700, marginTop: 4, color: '#0f172a' },
  kpiSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: 20,
    marginBottom: 20,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  fullCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    marginBottom: 20,
  },
  chartTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16, color: '#334155' },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  tableControls: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  stateBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '2px solid #e2e8f0',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  searchInput: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 13,
    width: 220,
    outline: 'none',
  },
  filterSelect: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 13,
    outline: 'none',
    backgroundColor: '#fff',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    borderBottom: '2px solid #e2e8f0',
    color: '#64748b',
    fontWeight: 600,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },
  nameLink: { color: '#6366f1', textDecoration: 'none', fontWeight: 600 },
  trEven: { backgroundColor: '#fff' },
  trOdd: { backgroundColor: '#f8fafc' },
  tierBadge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    color: '#fff',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid #f1f5f9',
  },
  pageBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  pageInfo: { fontSize: 13, color: '#64748b' },
  footer: {
    textAlign: 'center',
    padding: '24px 0',
    color: '#94a3b8',
    fontSize: 13,
  },
};
