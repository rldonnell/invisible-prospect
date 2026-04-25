/**
 * lib/dashboard-where.js
 *
 * Builds a parameterized WHERE clause for the per-client dashboard queries.
 * Centralizes the (client × date window × state filter × acquisition source)
 * matrix that was previously expanded inline as nested ternaries in
 * app/dashboard/[client]/page.js.
 *
 * Why not use neon's tagged template directly: @neondatabase/serverless
 * doesn't support fragment composition (each tagged-template call resolves
 * to a query immediately, so you can't splice `sql\`...\`` fragments into
 * other queries). We use sql.query(text, params) for dynamic WHERE building.
 *
 * Returns { where, params } - the caller composes the final query with:
 *   const { where, params } = visitorWhere({ ... });
 *   const rows = await sql.query(`SELECT ... FROM visitors WHERE ${where} GROUP BY ...`, params);
 */

/**
 * @param {object} opts
 * @param {string} opts.client          - client_key (required)
 * @param {string} opts.cutoff          - ISO date for last_visit lower bound (required)
 * @param {string} [opts.stateFilter]   - 2-letter state code (optional)
 * @param {boolean} [opts.stateNegate]  - true => not-this-state, false => this-state
 * @param {string} [opts.source]        - 'pixel' | 'al_cold' | 'all' (default: 'all')
 * @param {string} [opts.dateColumn]    - column to apply cutoff against (default: 'last_visit')
 * @returns {{ where: string, params: (string|number)[] }}
 */
export function visitorWhere({
  client,
  cutoff,
  stateFilter,
  stateNegate = false,
  source = 'all',
  dateColumn = 'last_visit',
}) {
  const conds = [];
  const params = [];

  // Client key
  params.push(client);
  conds.push(`client_key = $${params.length}`);

  // Date window. Caller picks which column (last_visit or first_visit) so
  // queries that key on first_visit (e.g. "new visitors per day") work too.
  params.push(cutoff);
  conds.push(`${dateColumn} >= CAST($${params.length} AS date)`);

  // State filter (only applies when a 2-letter code was provided)
  if (stateFilter) {
    params.push(stateFilter);
    conds.push(
      stateNegate
        ? `UPPER(COALESCE(state,'')) != $${params.length}`
        : `UPPER(state) = $${params.length}`
    );
  }

  // Acquisition source filter. 'all' is the no-op default.
  if (source && source !== 'all') {
    params.push(source);
    conds.push(`acquisition_source = $${params.length}`);
  }

  return { where: conds.join(' AND '), params };
}
