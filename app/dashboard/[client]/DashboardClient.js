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

// Color for the "Return Visitor" pattern (not a tier — a quality badge)
const RETURN_COLOR = '#6366f1';

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
  const trendChartRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [darkMode, setDarkMode] = useState(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dark') === '1');
  const pageSize = 20;

  const {
    clientName, totalVisitors, allTimeTotal, tiers,
    returnVisitors = 0,
    dailyTrend = [],
    interests,
    sources, topVisitors, dateRange, lastProcessed, lastProcessedCount,
    newestVisit, newestProcessed,
    clientGeo, dateWindow, activeState, activeStateNegate,
    // Source filter (warm/cold/all). coldEnabled hides the toggle for
    // warm-only clients. sourceCounts feeds the badge labels.
    activeSource = 'all', coldEnabled = false, sourceCounts = { warm: 0, cold: 0 },
    isAuthenticated, authRole,
  } = data;

  // Helper: does a visitor carry the return-visitor tag?
  const isReturn = (v) => Array.isArray(v.tags) && v.tags.includes('return-visitor');

  // Authenticated users see full names; unauthenticated see "First L."
  const showFullNames = !!isAuthenticated;

  const activeDays = String(dateWindow || 30);

  // Build URLs preserving existing params
  const buildHref = (overrides = {}) => {
    const params = {};
    // Keep current date window
    if (activeDays !== '30') params.days = activeDays;
    // Keep current state filter
    if (activeState) params.state = activeState;
    // Keep current source filter (only when not the default 'all')
    if (activeSource && activeSource !== 'all') params.source = activeSource;
    // Apply overrides
    Object.assign(params, overrides);
    // Clean up defaults
    if (params.days === '30') delete params.days;
    if (params.state === '') delete params.state;
    if (params.source === 'all' || params.source === '') delete params.source;
    const qs = new URLSearchParams(params).toString();
    return `${pathname}${qs ? '?' + qs : ''}`;
  };

  const windowHref = (val) => buildHref({ days: val === '30' ? undefined : val });
  const stateHref = (stateCode) => buildHref({ state: stateCode });
  const outOfStateHref = (stateCode) => buildHref({ state: `!${stateCode}` });
  const sourceHref = (val) => buildHref({ source: val });

  const chartInstances = useRef([]);

  useEffect(() => {
    if (!chartReady || typeof Chart === 'undefined') return;

    // Destroy old chart instances before recreating
    chartInstances.current.forEach(c => c.destroy());
    chartInstances.current = [];

    const textColor = darkMode ? '#e2e8f0' : '#334155';
    const gridColor = darkMode ? '#334155' : '#f1f5f9';

    // Tier donut
    if (tierChartRef.current) {
      const ctx = tierChartRef.current.getContext('2d');
      chartInstances.current.push(new Chart(ctx, {
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
            legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 }, color: textColor } },
          },
        },
      }));
    }

    // Source bar chart
    if (sourceChartRef.current && sources.length > 0) {
      const ctx = sourceChartRef.current.getContext('2d');
      chartInstances.current.push(new Chart(ctx, {
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
            x: { grid: { display: false }, ticks: { font: { size: 12 }, color: textColor } },
            y: { grid: { display: false }, ticks: { font: { size: 12 }, color: textColor } },
          },
        },
      }));
    }

    // New-vs-Return trend (line chart) — two series per day
    if (trendChartRef.current && dailyTrend.length > 0) {
      const ctx = trendChartRef.current.getContext('2d');
      const labels = dailyTrend.map(d => {
        try { return new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
        catch { return d.day; }
      });
      chartInstances.current.push(new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'New Visitors',
              data: dailyTrend.map(d => d.new || 0),
              borderColor: '#14b8a6',
              backgroundColor: 'rgba(20, 184, 166, 0.15)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 3,
            },
            {
              label: 'Return Visitors',
              data: dailyTrend.map(d => d.returning || 0),
              borderColor: RETURN_COLOR,
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              borderWidth: 2,
              tension: 0.3,
              fill: true,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 }, color: textColor } },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, color: textColor, maxRotation: 0, autoSkip: true } },
            y: { grid: { color: gridColor }, ticks: { font: { size: 11 }, color: textColor, precision: 0 }, beginAtZero: true },
          },
          interaction: { mode: 'nearest', axis: 'x', intersect: false },
        },
      }));
    }

    // Interest horizontal bar
    if (interestChartRef.current && interests.length > 0) {
      const ctx = interestChartRef.current.getContext('2d');
      const top15 = interests.slice(0, 15);
      chartInstances.current.push(new Chart(ctx, {
        type: 'bar',
        data: {
          labels: top15.map(i => i.interest),
          datasets: [{
            data: top15.map(i => i.count),
            backgroundColor: darkMode ? '#818cf8' : '#6366f1',
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: gridColor }, ticks: { font: { size: 11 }, color: textColor } },
            y: { grid: { display: false }, ticks: { font: { size: 11 }, color: textColor } },
          },
        },
      }));
    }
  }, [chartReady, tiers, sources, interests, dailyTrend, darkMode]);

  // Filter visitors (state already filtered server-side, just tier + search here)
  // Filter values: 'ALL' | 'HOT' | 'High' | 'Medium' | 'Low' | 'RETURN'
  const filtered = topVisitors.filter(v => {
    if (filter === 'RETURN') {
      if (!isReturn(v)) return false;
    } else if (filter !== 'ALL' && v.intent_tier !== filter) {
      return false;
    }
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

  // CSV download — accepts optional tier list to override the current filter
  const downloadCSV = (tiers = null) => {
    const escCSV = (val) => {
      const s = String(val ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };

    // If specific tiers are passed, filter from the full topVisitors list
    // (which already has date range + state applied server-side).
    // If null, use the current filtered list (respects tier dropdown + search).
    let exportList;
    let tierLabel;
    if (tiers) {
      const tierSet = new Set(tiers);
      exportList = topVisitors.filter(v => tierSet.has(v.intent_tier));
      tierLabel = tiers.map(t => t.toLowerCase()).join('-');
    } else {
      exportList = filtered;
      tierLabel = filter !== 'ALL' ? filter.toLowerCase() : 'all';
    }

    const headers = [
      'Name', 'Email', 'City', 'State', 'Score', 'Tier',
      'Confidence', 'Interests', 'Source', 'Visits', 'Last Seen',
    ];

    const rows = exportList.map(v => [
      showFullNames ? `${v.first_name} ${v.last_name}`.trim() : `${v.first_name} ${v.last_initial}.`,
      showFullNames ? (v.email || '') : '',
      v.city || '',
      v.state || '',
      v.intent_score,
      v.intent_tier,
      v.confidence || '',
      (v.interests || []).join('; '),
      v.referrer_source || 'Direct',
      v.visit_count,
      v.last_visit ? new Date(v.last_visit).toLocaleDateString('en-US') : '',
    ]);

    const csv = [headers, ...rows].map(row => row.map(escCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    // Build descriptive filename
    const parts = [data.clientKey, tierLabel];
    if (activeState && activeStateNegate) parts.push(`not-${activeState.toLowerCase()}`);
    else if (activeState) parts.push(activeState.toLowerCase());
    parts.push(activeDays === 'all' ? 'all-time' : `${activeDays}d`);
    parts.push(new Date().toISOString().split('T')[0]);
    a.href = url;
    a.download = `visitorid-${parts.join('-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    return exportList.length;
  };

  // Preset download counts (for button labels)
  const countByTiers = (tierList) => topVisitors.filter(v => tierList.includes(v.intent_tier)).length;

  // Merge light + dark styles
  const s = darkMode ? Object.keys(styles).reduce((acc, key) => {
    acc[key] = { ...styles[key], ...(darkStyles[key] || {}) };
    return acc;
  }, {}) : styles;

  return (
    <>
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
        onLoad={() => setChartReady(true)}
      />
      <div style={s.page}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.h1}>
              <span style={s.logo}>P5</span> VisitorID<sup style={{ fontSize: '0.5em', verticalAlign: 'super' }}>&trade;</sup>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={s.subtitle}>{clientName}</p>
              {isAuthenticated && authRole === 'admin' && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: darkMode ? '#a5b4fc' : '#6366f1',
                  backgroundColor: darkMode ? '#312e81' : '#eef2ff',
                  padding: '2px 8px',
                  borderRadius: 4, letterSpacing: 0.5, textTransform: 'uppercase',
                }}>Admin</span>
              )}
            </div>
          </div>
          <div style={s.headerRight}>
            <div style={s.dateWindowRow}>
              {DATE_WINDOWS.map(w => (
                <a
                  key={w.value}
                  href={windowHref(w.value)}
                  style={{
                    ...s.dateWindowBtn,
                    backgroundColor: activeDays === w.value ? '#6366f1' : (darkMode ? '#1e293b' : '#fff'),
                    color: activeDays === w.value ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                    borderColor: activeDays === w.value ? '#6366f1' : (darkMode ? '#334155' : '#e2e8f0'),
                    textDecoration: 'none',
                  }}
                >
                  {w.label}
                </a>
              ))}
              {clientGeo && (
                <>
                  <span style={{ color: darkMode ? '#334155' : '#e2e8f0', fontSize: 16, margin: '0 2px' }}>|</span>
                  <a
                    href={buildHref({ state: '' })}
                    style={{
                      ...s.dateWindowBtn,
                      backgroundColor: !activeState ? '#6366f1' : (darkMode ? '#1e293b' : '#fff'),
                      color: !activeState ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                      borderColor: !activeState ? '#6366f1' : (darkMode ? '#334155' : '#e2e8f0'),
                      textDecoration: 'none',
                    }}
                  >
                    All
                  </a>
                  <a
                    href={stateHref(clientGeo.code)}
                    style={{
                      ...s.dateWindowBtn,
                      backgroundColor: (activeState && !activeStateNegate) ? '#16a34a' : (darkMode ? '#1e293b' : '#fff'),
                      color: (activeState && !activeStateNegate) ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                      borderColor: (activeState && !activeStateNegate) ? '#16a34a' : (darkMode ? '#334155' : '#e2e8f0'),
                      textDecoration: 'none',
                    }}
                  >
                    {clientGeo.label}
                  </a>
                  <a
                    href={outOfStateHref(clientGeo.code)}
                    style={{
                      ...s.dateWindowBtn,
                      backgroundColor: (activeState && activeStateNegate) ? '#dc2626' : (darkMode ? '#1e293b' : '#fff'),
                      color: (activeState && activeStateNegate) ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                      borderColor: (activeState && activeStateNegate) ? '#dc2626' : (darkMode ? '#334155' : '#e2e8f0'),
                      textDecoration: 'none',
                    }}
                  >
                    Out of State
                  </a>
                </>
              )}
              {/* Source toggle: All / Warm / Cold. Auto-hidden for warm-only clients
                  (driven by coldEnabled, which is true when the client has any
                  campaigns row with kind='cold'). */}
              {coldEnabled && (
                <>
                  <span style={{ color: darkMode ? '#334155' : '#e2e8f0', fontSize: 16, margin: '0 2px' }}>|</span>
                  <a
                    href={sourceHref('all')}
                    style={{
                      ...s.dateWindowBtn,
                      backgroundColor: activeSource === 'all' ? '#6366f1' : (darkMode ? '#1e293b' : '#fff'),
                      color: activeSource === 'all' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                      borderColor: activeSource === 'all' ? '#6366f1' : (darkMode ? '#334155' : '#e2e8f0'),
                      textDecoration: 'none',
                    }}
                    title="All visitors (warm + cold)"
                  >
                    All
                  </a>
                  <a
                    href={sourceHref('warm')}
                    style={{
                      ...s.dateWindowBtn,
                      backgroundColor: activeSource === 'warm' ? '#1e3a5f' : (darkMode ? '#1e293b' : '#fff'),
                      color: activeSource === 'warm' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                      borderColor: activeSource === 'warm' ? '#1e3a5f' : (darkMode ? '#334155' : '#e2e8f0'),
                      textDecoration: 'none',
                    }}
                    title="Pixel-identified site visitors only"
                  >
                    Pixel Leads ({sourceCounts.warm.toLocaleString()})
                  </a>
                  <a
                    href={sourceHref('cold')}
                    style={{
                      ...s.dateWindowBtn,
                      backgroundColor: activeSource === 'cold' ? '#9a3412' : (darkMode ? '#1e293b' : '#fff'),
                      color: activeSource === 'cold' ? '#fff' : (darkMode ? '#94a3b8' : '#64748b'),
                      borderColor: activeSource === 'cold' ? '#9a3412' : (darkMode ? '#334155' : '#e2e8f0'),
                      textDecoration: 'none',
                    }}
                    title="Cold email recipients from Audience Lab only"
                  >
                    Cold Emails ({sourceCounts.cold.toLocaleString()})
                  </a>
                </>
              )}
              <span style={{ color: darkMode ? '#334155' : '#e2e8f0', fontSize: 16, margin: '0 2px' }}>|</span>
              <button
                onClick={() => setDarkMode(dm => !dm)}
                style={{
                  ...s.dateWindowBtn,
                  backgroundColor: darkMode ? '#6366f1' : '#fff',
                  color: darkMode ? '#fff' : '#64748b',
                  borderColor: darkMode ? '#6366f1' : '#e2e8f0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? '\u2600\uFE0F' : '\uD83C\uDF19'} {darkMode ? 'Light' : 'Dark'}
              </button>
            </div>
            <div style={s.dateRange}>
              {activeDays === 'all'
                ? `${fmtDate(dateRange.earliest)} \u2014 ${fmtDate(dateRange.latest)}`
                : `${fmtDate(new Date(Date.now() - parseInt(activeDays) * 86400000).toISOString())} \u2014 ${fmtDate(new Date().toISOString())}`}
            </div>
            {(newestVisit || newestProcessed) && (
              <div style={s.lastUpdated}>
                Latest visitor data: {fmtDate(newestVisit || newestProcessed)}
              </div>
            )}
            {lastProcessed && (
              <div style={{ ...s.lastUpdated, fontSize: 11, marginTop: 1 }}>
                Last cron run: {fmtDate(lastProcessed)}{lastProcessedCount > 0 ? ` (${lastProcessedCount} processed)` : ''}
              </div>
            )}
            {isAuthenticated && (
              <button
                onClick={async () => {
                  await fetch('/api/dashboard/auth', { method: 'DELETE' });
                  window.location.reload();
                }}
                style={s.logoutBtn}
              >
                Sign Out
              </button>
            )}
          </div>
        </header>

        {/* KPI Cards */}
        <div style={s.kpiRow}>
          <div style={{ ...s.kpiCard, borderTop: `4px solid ${darkMode ? '#e2e8f0' : '#1e293b'}` }}>
            <div style={s.kpiLabel}>Total Identified</div>
            <div style={s.kpiValue}>{totalVisitors.toLocaleString()}</div>
            {activeDays !== 'all' && allTimeTotal !== totalVisitors && (
              <div style={s.kpiSub}>{allTimeTotal.toLocaleString()} all-time</div>
            )}
          </div>
          <div style={{ ...s.kpiCard, borderTop: `4px solid ${TIER_COLORS.HOT}` }}>
            <div style={s.kpiLabel}>HOT</div>
            <div style={{ ...s.kpiValue, color: TIER_COLORS.HOT }}>{tiers.HOT.toLocaleString()}</div>
            <div style={s.kpiSub}>Immediate Outreach</div>
          </div>
          <div style={{ ...s.kpiCard, borderTop: `4px solid ${RETURN_COLOR}` }}>
            <div style={s.kpiLabel}>Return Visitors</div>
            <div style={{ ...s.kpiValue, color: RETURN_COLOR }}>{returnVisitors.toLocaleString()}</div>
            <div style={s.kpiSub}>
              {totalVisitors > 0 ? `${Math.round((returnVisitors / totalVisitors) * 100)}% of total` : 'Visited on 2+ days'}
            </div>
          </div>
          <div style={{ ...s.kpiCard, borderTop: `4px solid ${TIER_COLORS.High}` }}>
            <div style={s.kpiLabel}>High Intent</div>
            <div style={{ ...s.kpiValue, color: TIER_COLORS.High }}>{tiers.High.toLocaleString()}</div>
            <div style={s.kpiSub}>Priority Nurture</div>
          </div>
          <div style={{ ...s.kpiCard, borderTop: `4px solid ${TIER_COLORS.Medium}` }}>
            <div style={s.kpiLabel}>Medium</div>
            <div style={{ ...s.kpiValue, color: TIER_COLORS.Medium }}>{tiers.Medium.toLocaleString()}</div>
            <div style={s.kpiSub}>Standard Follow-up</div>
          </div>
          <div style={{ ...s.kpiCard, borderTop: `4px solid ${TIER_COLORS.Low}` }}>
            <div style={s.kpiLabel}>Low</div>
            <div style={{ ...s.kpiValue, color: TIER_COLORS.Low }}>{tiers.Low.toLocaleString()}</div>
            <div style={s.kpiSub}>Awareness</div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={s.chartsRow}>
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Intent Distribution</h3>
            <div style={{ height: 260 }}>
              <canvas ref={tierChartRef}></canvas>
            </div>
          </div>
          <div style={s.chartCard}>
            <h3 style={s.chartTitle}>Traffic Sources</h3>
            <div style={{ height: 260 }}>
              <canvas ref={sourceChartRef}></canvas>
            </div>
          </div>
        </div>

        {/* New vs Return trend — only render when there's data to show */}
        {dailyTrend.length > 0 && (
          <div style={s.fullCard}>
            <h3 style={s.chartTitle}>New vs Return Visitors Over Time</h3>
            <div style={{ height: 280 }}>
              <canvas ref={trendChartRef}></canvas>
            </div>
          </div>
        )}

        {/* Interests Chart */}
        <div style={s.fullCard}>
          <h3 style={s.chartTitle}>Top Conditions & Procedures Researched</h3>
          <div style={{ height: Math.max(300, Math.min(interests.length, 15) * 32) }}>
            <canvas ref={interestChartRef}></canvas>
          </div>
        </div>

        {/* Visitor Table */}
        <div style={s.fullCard}>
          <div style={s.tableHeader}>
            <h3 style={s.chartTitle}>High-Intent Visitors</h3>
            <div style={s.tableControls}>
              <input
                type="text"
                placeholder="Search name, city, interest..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                style={s.searchInput}
              />
              <select
                value={filter}
                onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
                style={s.filterSelect}
              >
                <option value="ALL">All Tiers</option>
                <option value="HOT">HOT Only</option>
                <option value="High">High Only</option>
                <option value="Medium">Medium Only</option>
                <option value="Low">Low Only</option>
                <option value="RETURN">Return Visitors ({returnVisitors})</option>
              </select>
            </div>
          </div>

          {/* Download buttons row */}
          <div style={s.downloadRow}>
            <span style={s.downloadLabel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: 4 }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download:
            </span>
            <button onClick={() => downloadCSV(null)} style={s.downloadBtn} title="Download all visible visitors">
              All ({filtered.length})
            </button>
            <button onClick={() => downloadCSV(['HOT', 'High'])} style={{ ...s.downloadBtn, backgroundColor: '#dc2626', borderColor: '#dc2626' }} title="Download HOT + High tier visitors">
              HOT + High ({countByTiers(['HOT', 'High'])})
            </button>
            <button onClick={() => downloadCSV(['HOT', 'High', 'Medium'])} style={{ ...s.downloadBtn, backgroundColor: '#f59e0b', borderColor: '#f59e0b', color: '#1e293b' }} title="Download HOT + High + Medium tier visitors">
              HOT + High + Med ({countByTiers(['HOT', 'High', 'Medium'])})
            </button>
            <button onClick={() => downloadCSV(['HOT'])} style={{ ...s.downloadBtn, backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: '#dc2626', color: '#dc2626' }} title="Download HOT tier only">
              HOT Only ({countByTiers(['HOT'])})
            </button>
          </div>

          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>{showFullNames ? 'Name / Email' : 'Name'}</th>
                  <th style={s.th}>Location</th>
                  <th style={s.th}>Score</th>
                  <th style={s.th}>Tier</th>
                  <th style={s.th}>Confidence</th>
                  <th style={s.th}>Interests</th>
                  <th style={s.th}>Source</th>
                  <th style={s.th}>Visits</th>
                  <th style={s.th}>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((v, i) => (
                  <tr key={v.id} style={i % 2 === 0 ? s.trEven : s.trOdd}>
                    <td style={s.td}>
                      <a href={`${pathname === '/' ? '' : pathname}/visitor/${v.id}${darkMode ? '?dark=1' : ''}`} style={s.nameLink}>
                        {showFullNames
                          ? `${v.first_name} ${v.last_name}`.trim()
                          : `${v.first_name} ${v.last_initial}.`
                        }
                      </a>
                      {showFullNames && v.email && (
                        <div style={{ fontSize: 11, color: darkMode ? '#64748b' : '#94a3b8', marginTop: 2 }}>{v.email}</div>
                      )}
                    </td>
                    <td style={s.td}>{[v.city, v.state].filter(Boolean).join(', ') || '-'}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{v.intent_score}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                        <span style={{
                          ...s.tierBadge,
                          backgroundColor: TIER_COLORS[v.intent_tier] || '#94a3b8',
                        }}>
                          {v.intent_tier}
                        </span>
                        {/* Cold-acquired badge: only shown on rows that came in via the
                            cold pipeline (acquisition_source = 'al_cold'). Warm is the default
                            and gets no badge so warm-only clients see no visual change. */}
                        {v.acquisition_source === 'al_cold' && (
                          <span style={{
                            ...s.tierBadge,
                            backgroundColor: '#9a3412',
                            fontSize: 9,
                            padding: '2px 8px',
                          }}>
                            Cold Email
                          </span>
                        )}
                        {/* Return-visitor badge: short "Return" chip in accent color */}
                        {isReturn(v) && (
                          <span style={{
                            ...s.tierBadge,
                            backgroundColor: RETURN_COLOR,
                            fontSize: 9,
                            padding: '2px 8px',
                          }}>
                            Return
                          </span>
                        )}
                        {/* HOT reason label — tiny sub-text telling why this row is HOT */}
                        {v.intent_tier === 'HOT' && (
                          <span style={{
                            fontSize: 10,
                            color: darkMode ? '#94a3b8' : '#64748b',
                            fontWeight: 500,
                            fontStyle: 'italic',
                            marginTop: 1,
                          }}>
                            {isReturn(v)
                              ? 'return visitor'
                              : (v.interests && v.interests.length > 0
                                  ? 'high intent'
                                  : 'high frequency')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={s.td}>
                      {v.confidence ? (
                        <span style={{
                          ...s.tierBadge,
                          backgroundColor: v.confidence === 'High' ? '#16a34a' : v.confidence === 'Medium' ? '#d97706' : '#dc2626',
                          fontSize: 10,
                        }}>
                          {v.confidence}
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ ...s.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(v.interests || []).join(', ') || '-'}
                    </td>
                    <td style={s.td}>{v.referrer_source || 'Direct'}</td>
                    <td style={{ ...s.td, textAlign: 'center' }}>{v.visit_count}</td>
                    <td style={s.td}>{fmtDate(v.last_visit)}</td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ ...s.td, textAlign: 'center', color: darkMode ? '#64748b' : '#999' }}>
                      No visitors match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={s.pagination}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={s.pageBtn}
              >
                Previous
              </button>
              <span style={s.pageInfo}>
                Page {currentPage} of {totalPages} ({filtered.length} visitors{activeState && clientGeo ? ` in ${clientGeo.label}` : ''})
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={s.pageBtn}
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer style={s.footer}>
          <p>P5 Marketing &bull; VisitorID&trade; &bull; Powered by Audience Lab + AI Scoring</p>
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
  logoutBtn: {
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 500,
    color: '#64748b',
    backgroundColor: 'transparent',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    cursor: 'pointer',
    marginTop: 4,
  },
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
  downloadRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid #f1f5f9',
  },
  downloadLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#64748b',
    marginRight: 4,
  },
  downloadBtn: {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #6366f1',
    backgroundColor: '#6366f1',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease',
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

/* ── Dark mode overrides ── */
const darkStyles = {
  page: { backgroundColor: '#0f172a', color: '#e2e8f0' },
  h1: { color: '#f8fafc' },
  logo: { backgroundColor: '#818cf8' },
  subtitle: { color: '#94a3b8' },
  dateRange: { color: '#cbd5e1' },
  lastUpdated: { color: '#64748b' },
  logoutBtn: { color: '#94a3b8', borderColor: '#334155' },
  dateWindowBtn: { borderColor: '#334155' },
  kpiCard: { backgroundColor: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  kpiLabel: { color: '#94a3b8' },
  kpiValue: { color: '#f8fafc' },
  kpiSub: { color: '#64748b' },
  chartCard: { backgroundColor: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  fullCard: { backgroundColor: '#1e293b', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' },
  chartTitle: { color: '#cbd5e1' },
  searchInput: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' },
  filterSelect: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' },
  downloadRow: { borderBottomColor: '#334155' },
  downloadLabel: { color: '#94a3b8' },
  downloadBtn: { backgroundColor: '#818cf8', borderColor: '#818cf8' },
  stateBtn: { borderColor: '#334155' },
  th: { borderBottomColor: '#334155', color: '#94a3b8' },
  td: { borderBottomColor: '#1e293b', color: '#cbd5e1' },
  trEven: { backgroundColor: '#1e293b' },
  trOdd: { backgroundColor: '#162032' },
  nameLink: { color: '#a5b4fc' },
  pagination: { borderTopColor: '#334155' },
  pageBtn: { backgroundColor: '#1e293b', borderColor: '#334155', color: '#e2e8f0' },
  pageInfo: { color: '#94a3b8' },
  footer: { color: '#64748b' },
};
