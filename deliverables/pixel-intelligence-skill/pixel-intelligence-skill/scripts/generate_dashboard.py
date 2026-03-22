#!/usr/bin/env python3
"""
Pixel Intelligence Dashboard Generator
Generates a self-contained interactive HTML dashboard from pixel_intelligence.json data.

Usage:
    python generate_dashboard.py <pixel_intelligence.json> <output.html>
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path


def load_json_file(filepath):
    """Load and validate JSON file."""
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {filepath}: {e}")
        sys.exit(1)

    if 'summary' not in data or 'visitors' not in data:
        print("Error: JSON must contain 'summary' and 'visitors' keys")
        sys.exit(1)

    return data


def get_top_visitors(visitors, limit=200):
    """Get top visitors by score."""
    sorted_visitors = sorted(visitors, key=lambda v: v.get('intent_score', v.get('score', 0)), reverse=True)
    return sorted_visitors[:limit]


def generate_dashboard_html(data, json_filepath):
    """Generate the complete HTML dashboard."""
    summary = data.get('summary', {})
    visitors = data.get('visitors', [])

    # Get top 200 visitors by score
    top_visitors = get_top_visitors(visitors, 200)

    # Extract summary stats — map from processor output keys
    client_name = summary.get('client_name', 'Client')
    date_range_raw = summary.get('date_range', {})
    if isinstance(date_range_raw, dict):
        dr_first = date_range_raw.get('first', '')[:10]
        dr_last = date_range_raw.get('last', '')[:10]
        date_range = f"{dr_first} to {dr_last}" if dr_first else "Unknown"
    else:
        date_range = str(date_range_raw)
    total_visitors = summary.get('total_visitors', 0)
    tier_counts = summary.get('tier_counts', {})
    hot_high_intent = tier_counts.get('HOT', 0) + tier_counts.get('High', 0)
    repeat_visitors = summary.get('repeat_visitors', 0)

    # Compute avg intent score from visitor data
    scores = [v.get('intent_score', 0) for v in visitors if v.get('intent_score')]
    avg_intent_score = sum(scores) / len(scores) if scores else 0

    # Map summary fields to dashboard chart data
    intent_distribution = tier_counts
    top_interests = summary.get('subcategory_counts', {})
    traffic_sources = summary.get('referrer_counts', {})
    daily_trend_raw = summary.get('daily_trend', {})
    daily_trend_list = [{"date": k, "count": v} for k, v in daily_trend_raw.items()] if isinstance(daily_trend_raw, dict) else daily_trend_raw

    # Pre-serialize data for JS embedding (avoids f-string/double-brace issues)
    intent_distribution_json = json.dumps(intent_distribution)
    top_interests_json = json.dumps(top_interests)
    traffic_sources_json = json.dumps(traffic_sources)
    daily_trend_json = json.dumps(daily_trend_list)

    # Generate timestamp
    generated_at = datetime.now().strftime('%B %d, %Y at %I:%M %p')

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invisible Prospect Report™ - {client_name}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.js"></script>
    <style>
        :root {{
            --primary-color: #1B3A5C;
            --accent-color: #2E86AB;
            --danger-color: #dc3545;
            --warning-color: #fd7e14;
            --info-color: #4C72B0;
            --light-gray: #adb5bd;
            --border-color: #e9ecef;
            --text-primary: #212529;
            --text-secondary: #6c757d;
            --bg-light: #f8f9fa;
            --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.15);
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: var(--text-primary);
            background-color: #f5f7fa;
            line-height: 1.5;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }}

        /* Header */
        .header {{
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: var(--shadow);
            margin-bottom: 30px;
            border-left: 5px solid var(--primary-color);
        }}

        .header h1 {{
            color: var(--primary-color);
            font-size: 28px;
            margin-bottom: 5px;
            font-weight: 700;
        }}

        .header .client-info {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid var(--border-color);
        }}

        .header .client-details {{
            flex: 1;
        }}

        .header .client-details p {{
            color: var(--text-secondary);
            font-size: 14px;
            margin: 4px 0;
        }}

        .header .client-name {{
            color: var(--text-primary);
            font-size: 18px;
            font-weight: 600;
        }}

        .header .powered-by {{
            text-align: right;
            color: var(--accent-color);
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}

        /* KPI Cards */
        .kpi-row {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}

        .kpi-card {{
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: var(--shadow);
            border-top: 4px solid var(--accent-color);
        }}

        .kpi-card .label {{
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 10px;
        }}

        .kpi-card .value {{
            font-size: 32px;
            font-weight: 700;
            color: var(--primary-color);
        }}

        /* Filters */
        .filters {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: var(--shadow);
            margin-bottom: 30px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }}

        .filter-group {{
            display: flex;
            flex-direction: column;
        }}

        .filter-group label {{
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }}

        .filter-group select {{
            padding: 10px 12px;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            font-size: 14px;
            color: var(--text-primary);
            background-color: white;
            cursor: pointer;
            transition: border-color 0.2s;
        }}

        .filter-group select:hover {{
            border-color: var(--accent-color);
        }}

        .filter-group select:focus {{
            outline: none;
            border-color: var(--accent-color);
            box-shadow: 0 0 0 3px rgba(46, 134, 171, 0.1);
        }}

        /* Charts Grid */
        .charts-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}

        .chart-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: var(--shadow);
        }}

        .chart-card h3 {{
            color: var(--primary-color);
            font-size: 16px;
            margin-bottom: 15px;
            font-weight: 600;
        }}

        .chart-container {{
            position: relative;
            height: 300px;
        }}

        /* Table */
        .table-section {{
            background: white;
            border-radius: 8px;
            box-shadow: var(--shadow);
            overflow: hidden;
            margin-bottom: 30px;
        }}

        .table-header {{
            padding: 20px;
            border-bottom: 1px solid var(--border-color);
        }}

        .table-header h3 {{
            color: var(--primary-color);
            font-size: 16px;
            font-weight: 600;
        }}

        .table-wrapper {{
            overflow-x: auto;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}

        table thead {{
            background-color: var(--bg-light);
            border-bottom: 2px solid var(--border-color);
        }}

        table th {{
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s;
        }}

        table th:hover {{
            background-color: #e9ecef;
        }}

        table th.sortable::after {{
            content: ' ↕';
            color: var(--text-secondary);
            opacity: 0.3;
        }}

        table th.sorted-asc::after {{
            content: ' ↑';
            color: var(--accent-color);
            opacity: 1;
        }}

        table th.sorted-desc::after {{
            content: ' ↓';
            color: var(--accent-color);
            opacity: 1;
        }}

        table tbody tr {{
            border-bottom: 1px solid var(--border-color);
            transition: background-color 0.2s;
        }}

        table tbody tr:hover {{
            background-color: var(--bg-light);
        }}

        table td {{
            padding: 12px 15px;
            color: var(--text-primary);
        }}

        .badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }}

        .badge-hot {{
            background-color: #fdeaea;
            color: #dc3545;
        }}

        .badge-high {{
            background-color: #fef3e2;
            color: #fd7e14;
        }}

        .badge-medium {{
            background-color: #e7f0f8;
            color: #4C72B0;
        }}

        .badge-low {{
            background-color: #f0f0f0;
            color: #adb5bd;
        }}

        /* Pagination */
        .pagination {{
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 5px;
            padding: 20px;
            border-top: 1px solid var(--border-color);
        }}

        .pagination button {{
            padding: 6px 12px;
            border: 1px solid var(--border-color);
            background: white;
            color: var(--text-primary);
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
        }}

        .pagination button:hover:not(:disabled) {{
            border-color: var(--accent-color);
            color: var(--accent-color);
        }}

        .pagination button:disabled {{
            color: var(--light-gray);
            cursor: not-allowed;
        }}

        .pagination .page-info {{
            color: var(--text-secondary);
            font-size: 12px;
            margin: 0 10px;
        }}

        /* Footer */
        .footer {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            color: var(--text-secondary);
            font-size: 12px;
            border-top: 1px solid var(--border-color);
        }}

        .footer a {{
            color: var(--accent-color);
            text-decoration: none;
        }}

        .footer a:hover {{
            text-decoration: underline;
        }}

        /* Responsive */
        @media (max-width: 768px) {{
            .container {{
                padding: 15px;
            }}

            .header {{
                padding: 20px;
            }}

            .header h1 {{
                font-size: 22px;
            }}

            .header .client-info {{
                flex-direction: column;
                align-items: flex-start;
            }}

            .header .powered-by {{
                text-align: left;
                margin-top: 10px;
            }}

            .kpi-row {{
                grid-template-columns: 1fr;
            }}

            .charts-grid {{
                grid-template-columns: 1fr;
            }}

            table {{
                font-size: 12px;
            }}

            table th, table td {{
                padding: 8px 10px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>Invisible Prospect Report™</h1>
            <div class="client-info">
                <div class="client-details">
                    <p class="client-name">{client_name}</p>
                    <p>{date_range}</p>
                    <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">Generated {generated_at}</p>
                </div>
                <div class="powered-by">
                    Powered by P5 Marketing<br>
                    P5Marketing.com
                </div>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="kpi-row">
            <div class="kpi-card">
                <div class="label">Total Identified Visitors</div>
                <div class="value">{total_visitors:,}</div>
            </div>
            <div class="kpi-card">
                <div class="label">HOT + High Intent</div>
                <div class="value">{hot_high_intent:,}</div>
            </div>
            <div class="kpi-card">
                <div class="label">Repeat Visitors</div>
                <div class="value">{repeat_visitors:,}</div>
            </div>
            <div class="kpi-card">
                <div class="label">Avg Intent Score</div>
                <div class="value">{avg_intent_score:.1f}</div>
            </div>
        </div>

        <!-- Filters -->
        <div class="filters">
            <div class="filter-group">
                <label for="intentFilter">Intent Tier</label>
                <select id="intentFilter">
                    <option value="">All Intent Tiers</option>
                    <option value="HOT">HOT</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="interestFilter">Interest/Procedure</label>
                <select id="interestFilter">
                    <option value="">All Interests</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="sourceFilter">Traffic Source</label>
                <select id="sourceFilter">
                    <option value="">All Sources</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="resetFilter">&nbsp;</label>
                <button id="resetButton" style="padding: 10px 12px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px;">Reset Filters</button>
            </div>
        </div>

        <!-- Charts -->
        <div class="charts-grid">
            <div class="chart-card">
                <h3>Intent Tier Distribution</h3>
                <div class="chart-container">
                    <canvas id="intentChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <h3>Top 10 Interests/Procedures</h3>
                <div class="chart-container">
                    <canvas id="interestChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <h3>Traffic Sources</h3>
                <div class="chart-container">
                    <canvas id="sourceChart"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <h3>Daily Visitor Trend</h3>
                <div class="chart-container">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Table -->
        <div class="table-section">
            <div class="table-header">
                <h3>Priority Patient List</h3>
            </div>
            <div class="table-wrapper">
                <table id="visitorTable">
                    <thead>
                        <tr>
                            <th class="sortable" data-field="intent_tier">Intent Tier</th>
                            <th class="sortable" data-field="intent_score">Score</th>
                            <th class="sortable" data-field="last_name">Name</th>
                            <th class="sortable" data-field="email">Email</th>
                            <th class="sortable" data-field="phone">Phone</th>
                            <th class="sortable" data-field="city">Location</th>
                            <th class="sortable" data-field="interests">Interests</th>
                            <th class="sortable" data-field="visit_count">Visits</th>
                            <th class="sortable" data-field="last_visit">Last Visit</th>
                            <th class="sortable" data-field="referrer_source">Source</th>
                        </tr>
                    </thead>
                    <tbody id="tableBody">
                    </tbody>
                </table>
            </div>
            <div class="pagination">
                <button id="prevBtn" onclick="previousPage()">← Previous</button>
                <span class="page-info">Page <span id="currentPage">1</span> of <span id="totalPages">1</span></span>
                <button id="nextBtn" onclick="nextPage()">Next →</button>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            Generated by P5 Marketing — <a href="https://p5marketing.com" target="_blank">P5Marketing.com</a> | Data from VisitorID™ pixel
        </div>
    </div>

    <script>
        // Embedded Data — add aliases so JS chart code finds the right keys
        const summaryData = {{
            ...{json.dumps(summary)},
            intent_distribution: {intent_distribution_json},
            top_interests: {top_interests_json},
            traffic_sources: {traffic_sources_json},
            daily_trend: {daily_trend_json}
        }};
        const visitorsData = {json.dumps(top_visitors)};

        // Filtering & Pagination
        let currentPage = 1;
        const itemsPerPage = 50;
        let filteredVisitors = [...visitorsData];

        // Initialize filters
        function initializeFilters() {{
            // Populate interest filter
            const interests = new Set();
            visitorsData.forEach(v => {{
                if (v.interests && Array.isArray(v.interests)) {{
                    v.interests.forEach(i => interests.add(i));
                }}
            }});
            const interestSelect = document.getElementById('interestFilter');
            Array.from(interests).sort().forEach(interest => {{
                const option = document.createElement('option');
                option.value = interest;
                option.textContent = interest;
                interestSelect.appendChild(option);
            }});

            // Populate source filter
            const sources = new Set();
            visitorsData.forEach(v => {{
                if (v.referrer_source || v.source) sources.add(v.referrer_source || v.source);
            }});
            const sourceSelect = document.getElementById('sourceFilter');
            Array.from(sources).sort().forEach(source => {{
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                sourceSelect.appendChild(option);
            }});

            // Add filter listeners
            document.getElementById('intentFilter').addEventListener('change', applyFilters);
            document.getElementById('interestFilter').addEventListener('change', applyFilters);
            document.getElementById('sourceFilter').addEventListener('change', applyFilters);
            document.getElementById('resetButton').addEventListener('click', resetFilters);
        }}

        function applyFilters() {{
            const intentFilter = document.getElementById('intentFilter').value;
            const interestFilter = document.getElementById('interestFilter').value;
            const sourceFilter = document.getElementById('sourceFilter').value;

            filteredVisitors = visitorsData.filter(v => {{
                const matchIntent = !intentFilter || v.intent_tier === intentFilter;
                const matchInterest = !interestFilter || (v.interests && v.interests.includes(interestFilter));
                const matchSource = !sourceFilter || (v.referrer_source || v.source) === sourceFilter;
                return matchIntent && matchInterest && matchSource;
            }});

            currentPage = 1;
            updateTable();
            updateCharts();
        }}

        function resetFilters() {{
            document.getElementById('intentFilter').value = '';
            document.getElementById('interestFilter').value = '';
            document.getElementById('sourceFilter').value = '';
            applyFilters();
        }}

        function updateTable() {{
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';

            const start = (currentPage - 1) * itemsPerPage;
            const end = start + itemsPerPage;
            const pageVisitors = filteredVisitors.slice(start, end);

            pageVisitors.forEach(visitor => {{
                const row = document.createElement('tr');
                const intentColor = {{
                    'HOT': 'badge-hot',
                    'High': 'badge-high',
                    'Medium': 'badge-medium',
                    'Low': 'badge-low'
                }}[visitor.intent_tier] || 'badge-low';

                const fullName = [visitor.first_name, visitor.last_name].filter(Boolean).join(' ') || visitor.name || 'Unknown';
                const score = visitor.intent_score || visitor.score || 0;
                const source = visitor.referrer_source || visitor.source || 'Unknown';
                const lastVisit = (visitor.last_visit || 'N/A').substring(0, 10);
                const interestList = Array.isArray(visitor.interests) ? visitor.interests.join(', ') : 'N/A';

                row.innerHTML = `
                    <td><span class="badge ${{intentColor}}">${{visitor.intent_tier || 'Unknown'}}</span></td>
                    <td>${{score}}</td>
                    <td>${{fullName}}</td>
                    <td style="font-size:0.85em">${{visitor.email || ''}}</td>
                    <td style="white-space:nowrap">${{visitor.phone || ''}}</td>
                    <td>${{visitor.city || ''}}, ${{visitor.state || ''}}</td>
                    <td>${{interestList}}</td>
                    <td>${{visitor.visit_count || 0}}</td>
                    <td>${{lastVisit}}</td>
                    <td>${{source}}</td>
                `;
                tbody.appendChild(row);
            }});

            updatePagination();
        }}

        function updatePagination() {{
            const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
            document.getElementById('currentPage').textContent = currentPage;
            document.getElementById('totalPages').textContent = totalPages;
            document.getElementById('prevBtn').disabled = currentPage === 1;
            document.getElementById('nextBtn').disabled = currentPage === totalPages;
        }}

        function nextPage() {{
            const totalPages = Math.ceil(filteredVisitors.length / itemsPerPage);
            if (currentPage < totalPages) {{
                currentPage++;
                updateTable();
                document.querySelector('.table-wrapper').scrollTop = 0;
            }}
        }}

        function previousPage() {{
            if (currentPage > 1) {{
                currentPage--;
                updateTable();
                document.querySelector('.table-wrapper').scrollTop = 0;
            }}
        }}

        // Table sorting
        document.querySelectorAll('table th.sortable').forEach(header => {{
            header.addEventListener('click', function() {{
                const field = this.getAttribute('data-field');
                const isAsc = this.classList.contains('sorted-asc');

                // Remove sorting classes
                document.querySelectorAll('table th').forEach(h => {{
                    h.classList.remove('sorted-asc', 'sorted-desc');
                }});

                // Add sorting class and sort data
                if (isAsc) {{
                    this.classList.add('sorted-desc');
                    filteredVisitors.sort((a, b) => {{
                        const aVal = a[field];
                        const bVal = b[field];
                        if (typeof aVal === 'number' && typeof bVal === 'number') {{
                            return bVal - aVal;
                        }}
                        return String(bVal).localeCompare(String(aVal));
                    }});
                }} else {{
                    this.classList.add('sorted-asc');
                    filteredVisitors.sort((a, b) => {{
                        const aVal = a[field];
                        const bVal = b[field];
                        if (typeof aVal === 'number' && typeof bVal === 'number') {{
                            return aVal - bVal;
                        }}
                        return String(aVal).localeCompare(String(bVal));
                    }});
                }}

                currentPage = 1;
                updateTable();
            }});
        }});

        // Chart Colors
        const chartColors = {{
            HOT: '#dc3545',
            High: '#fd7e14',
            Medium: '#4C72B0',
            Low: '#adb5bd'
        }};

        let charts = {{}};

        function updateCharts() {{
            // Calculate distributions based on filtered data
            const intentDist = {{}};
            const interestDist = {{}};
            const sourceDist = {{}};

            filteredVisitors.forEach(v => {{
                intentDist[v.intent_tier] = (intentDist[v.intent_tier] || 0) + 1;
                if (v.interests) {{
                    v.interests.forEach(i => {{
                        interestDist[i] = (interestDist[i] || 0) + 1;
                    }});
                }}
                sourceDist[v.referrer_source || v.source] = (sourceDist[v.referrer_source || v.source] || 0) + 1;
            }});

            // Intent Chart
            if (charts.intentChart) {{
                charts.intentChart.data.labels = Object.keys(intentDist);
                charts.intentChart.data.datasets[0].data = Object.values(intentDist);
                charts.intentChart.data.datasets[0].backgroundColor = Object.keys(intentDist).map(tier => chartColors[tier]);
                charts.intentChart.update();
            }}

            // Interest Chart (top 10)
            if (charts.interestChart) {{
                const topInterests = Object.entries(interestDist)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                charts.interestChart.data.labels = topInterests.map(x => x[0]);
                charts.interestChart.data.datasets[0].data = topInterests.map(x => x[1]);
                charts.interestChart.update();
            }}

            // Source Chart
            if (charts.sourceChart) {{
                charts.sourceChart.data.labels = Object.keys(sourceDist);
                charts.sourceChart.data.datasets[0].data = Object.values(sourceDist);
                charts.sourceChart.update();
            }}
        }}

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {{
            initializeFilters();

            // Intent Tier Chart
            const intentCtx = document.getElementById('intentChart').getContext('2d');
            charts.intentChart = new Chart(intentCtx, {{
                type: 'doughnut',
                data: {{
                    labels: Object.keys(summaryData.intent_distribution || {{}}),
                    datasets: [{{
                        data: Object.values(summaryData.intent_distribution || {{}}),
                        backgroundColor: Object.keys(summaryData.intent_distribution || {{}}).map(tier => chartColors[tier]),
                        borderColor: 'white',
                        borderWidth: 2
                    }}]
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{
                        legend: {{
                            position: 'bottom'
                        }}
                    }}
                }}
            }});

            // Interest Chart
            const interestCtx = document.getElementById('interestChart').getContext('2d');
            const topInterests = Object.entries(summaryData.top_interests || {{}})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
            charts.interestChart = new Chart(interestCtx, {{
                type: 'bar',
                data: {{
                    labels: topInterests.map(x => typeof x[0] === 'object' ? x[0].name || 'Unknown' : x[0]),
                    datasets: [{{
                        label: 'Count',
                        data: topInterests.map(x => x[1]),
                        backgroundColor: '#2E86AB',
                        borderRadius: 6
                    }}]
                }},
                options: {{
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{
                        legend: {{
                            display: false
                        }}
                    }},
                    scales: {{
                        x: {{
                            beginAtZero: true
                        }}
                    }}
                }}
            }});

            // Traffic Source Chart
            const sourceCtx = document.getElementById('sourceChart').getContext('2d');
            charts.sourceChart = new Chart(sourceCtx, {{
                type: 'doughnut',
                data: {{
                    labels: Object.keys(summaryData.traffic_sources || {{}}),
                    datasets: [{{
                        data: Object.values(summaryData.traffic_sources || {{}}),
                        backgroundColor: ['#2E86AB', '#E8573A', '#F5A623', '#8B5CF6', '#10B981', '#EC4899', '#F97316', '#06B6D4'],
                        borderColor: 'white',
                        borderWidth: 2
                    }}]
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{
                        legend: {{
                            position: 'bottom'
                        }}
                    }}
                }}
            }});

            // Daily Trend Chart
            const trendCtx = document.getElementById('trendChart').getContext('2d');
            const trendLabels = (summaryData.daily_trend || []).map(d => d.date || 'Unknown');
            const trendData = (summaryData.daily_trend || []).map(d => d.count || 0);
            charts.trendChart = new Chart(trendCtx, {{
                type: 'line',
                data: {{
                    labels: trendLabels,
                    datasets: [{{
                        label: 'Daily Visitors',
                        data: trendData,
                        borderColor: '#2E86AB',
                        backgroundColor: 'rgba(46, 134, 171, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 3,
                        pointBackgroundColor: '#2E86AB',
                        pointBorderColor: 'white',
                        pointBorderWidth: 2
                    }}]
                }},
                options: {{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {{
                        legend: {{
                            display: true,
                            position: 'top'
                        }}
                    }},
                    scales: {{
                        y: {{
                            beginAtZero: true
                        }}
                    }}
                }}
            }});

            updateTable();
        }});
    </script>
</body>
</html>"""

    return html


def main():
    """Main entry point."""
    if len(sys.argv) != 3:
        print("Usage: python generate_dashboard.py <pixel_intelligence.json> <output.html>")
        sys.exit(1)

    json_filepath = sys.argv[1]
    output_filepath = sys.argv[2]

    # Load data
    data = load_json_file(json_filepath)

    # Generate HTML
    html_content = generate_dashboard_html(data, json_filepath)

    # Write output
    try:
        with open(output_filepath, 'w') as f:
            f.write(html_content)
        print(f"✓ Dashboard generated successfully: {output_filepath}")
        print(f"  - Total visitors in data: {len(data.get('visitors', []))}")
        print(f"  - Top 200 visitors embedded in dashboard")
        print(f"  - File size: {len(html_content) / 1024:.1f} KB")
    except IOError as e:
        print(f"Error writing output file: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
