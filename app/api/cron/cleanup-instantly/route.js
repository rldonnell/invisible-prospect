import { getDb } from '../../../../lib/db';

/**
 * GET /api/cron/cleanup-instantly
 *
 * Reclaims slots against Instantly's account-wide lead cap by DELETE'ing
 * unengaged leads whose 3-email sequence has finished.
 *
 * A lead is eligible for cleanup when ALL of these are true:
 *   - It was actually pushed to Instantly (instantly_lead_id IS NOT NULL)
 *   - It hasn't opened, clicked, or replied (first_engaged_at IS NULL)
 *   - The sequence is complete, defined as either:
 *       last_step_sent >= FINAL_STEP (default 3)  OR
 *       last_sent_at older than HARD_COMPLETE_DAYS (default 21)
 *     AND last_sent_at is at least QUIET_DAYS old (default 7) to give
 *     late opens a chance to land before we nuke the lead.
 *   - The enrollment hasn't already been cleaned up (status != 'cleaned_up').
 *
 * Fallback for pre-webhook enrollments: the Instantly webhook only started
 * recording `email_sent` events on 2026-04-08, so older enrollments have
 * `last_sent_at = NULL` and `last_step_sent = 0` despite their sequences
 * having long since wrapped. For those rows we fall back to `enrolled_at`:
 * if it's older than HARD_COMPLETE_DAYS and there's no engagement, the
 * sequence is done and the lead is eligible for reclaim.
 *
 * For each eligible enrollment we:
 *   1) DELETE /api/v2/leads/{id} on Instantly
 *   2) Mark email_enrollments.status = 'cleaned_up' with cleaned_up_at stamp
 *
 * Scheduled weekly (Sunday 08:00 UTC) via vercel.json.
 *
 * Manual trigger:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     https://visitorid.p5marketing.com/api/cron/cleanup-instantly
 *
 * Optional query params:
 *   ?dry=true        - log what WOULD be deleted, don't call Instantly
 *   ?client=sa-spine - scope to a single client
 *   ?limit=500       - max leads to delete this run (safety cap, default 2000)
 *   ?quiet_days=7    - override quiet period (days since last_sent_at)
 *   ?hard_days=21    - override hard-complete fallback
 *
 * Env vars:
 *   CRON_SECRET                — shared auth with Vercel Cron
 *   INSTANTLY_API_KEY          — Instantly.ai V2 API key
 *   INSTANTLY_CLEANUP_ENABLED  — "true" to enable deletions (kill switch,
 *                                defaults to disabled so a bad deploy
 *                                can't wipe the Instantly workspace)
 */

const INSTANTLY_LEADS_API = 'https://api.instantly.ai/api/v2/leads';
const DEFAULT_LIMIT = 2000;
const DEFAULT_QUIET_DAYS = 7;
// Instantly's 3-email sequence wraps in ~7-8 days, so any enrollment older
// than 9 days without engagement is safe to reclaim. This is the fallback
// branch's window (since Instantly doesn't fire `email_sent` webhooks,
// `last_sent_at` stays NULL and we rely on `enrolled_at` for scheduling).
const DEFAULT_HARD_DAYS = 9;
const FINAL_STEP = 3; // 3-email sequence

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min - cleanup may iterate hundreds of leads

export async function GET(request) {
  // ── Auth ──
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get('dry') === 'true';
  const clientFilter = url.searchParams.get('client') || null;
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    5000
  );
  const quietDays = parseInt(url.searchParams.get('quiet_days') || String(DEFAULT_QUIET_DAYS), 10);
  const hardDays  = parseInt(url.searchParams.get('hard_days')  || String(DEFAULT_HARD_DAYS),  10);

  const apiKey = process.env.INSTANTLY_API_KEY;
  const killSwitch = process.env.INSTANTLY_CLEANUP_ENABLED === 'true';

  if (!dry) {
    if (!apiKey) {
      return Response.json(
        { error: 'INSTANTLY_API_KEY is not configured. Use ?dry=true for a dry run.' },
        { status: 500 }
      );
    }
    if (!killSwitch) {
      return Response.json(
        {
          error: 'INSTANTLY_CLEANUP_ENABLED is not "true". Set env var to enable deletions.',
          hint: 'Run with ?dry=true to see what would be deleted without the kill switch.',
        },
        { status: 503 }
      );
    }
  }

  try {
    const sql = getDb();

    // ── Create processing run ──
    const [run] = await sql`
      INSERT INTO processing_runs (client_key, run_type)
      VALUES (${clientFilter || 'ALL'}, 'cleanup-instantly')
      RETURNING id
    `;

    // ── Find eligible enrollments ──
    // We use parameterized intervals by computing cutoffs in JS so the
    // query is straightforward (neon's SQL tagged template handles the
    // timestamp parameters cleanly).
    const now = Date.now();
    const quietCutoff = new Date(now - quietDays * 24 * 60 * 60 * 1000).toISOString();
    const hardCutoff  = new Date(now - hardDays  * 24 * 60 * 60 * 1000).toISOString();

    // Eligibility has THREE branches:
    //   1. Normal flow: webhook recorded sends, sequence finished or hit
    //      hard-day timeout, AND quiet window past.
    //   2. Pre-webhook enrollments (before 2026-04-08): `last_sent_at IS NULL`
    //      and `last_step_sent = 0` even though their sequences finished
    //      long ago. Fall back to `enrolled_at`.
    //   3. Stuck mid-sequence: `enrolled_at` is old but `last_sent_at` is
    //      recent. This happens when account-level cap pressure stalls a
    //      sequence: a lead enrolled 17 days ago that should have wrapped
    //      by day 8 finally crawled to step 2 yesterday. Branch 1 won't
    //      fire (quiet window not satisfied) and Branch 2 won't fire
    //      (last_sent_at not null). Without this third branch the cron
    //      would return processed=0 indefinitely while the cap stays full.
    //
    // Every sequence in the codebase wraps within ~10 days, so if a lead
    // is hard_days+ into enrollment with no engagement, it isn't going to
    // engage now - safe to reclaim regardless of where the sequence is.
    const eligible = clientFilter
      ? await sql`
          SELECT e.id AS enrollment_id, e.instantly_lead_id, e.campaign_id,
                 e.visitor_id, e.last_step_sent, e.last_sent_at, e.enrolled_at,
                 c.client_key, c.bucket
          FROM email_enrollments e
          JOIN campaigns c ON c.id = e.campaign_id
          WHERE e.instantly_lead_id IS NOT NULL
            AND e.first_engaged_at IS NULL
            AND COALESCE(e.status, 'sent') NOT IN ('cleaned_up', 'failed')
            AND (
              -- Branch 1: normal-flow completion + quiet window
              (
                e.last_sent_at IS NOT NULL
                AND e.last_sent_at < ${quietCutoff}::timestamptz
                AND (
                  COALESCE(e.last_step_sent, 0) >= ${FINAL_STEP}
                  OR e.last_sent_at < ${hardCutoff}::timestamptz
                )
              )
              -- Branch 2: pre-webhook enrollments (no email_sent stamps)
              OR (
                e.last_sent_at IS NULL
                AND e.enrolled_at IS NOT NULL
                AND e.enrolled_at < ${hardCutoff}::timestamptz
              )
              -- Branch 3: stuck mid-sequence (cap-induced stalling)
              OR (
                e.enrolled_at IS NOT NULL
                AND e.enrolled_at < ${hardCutoff}::timestamptz
              )
            )
            AND c.client_key = ${clientFilter}
          ORDER BY COALESCE(e.last_sent_at, e.enrolled_at) ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT e.id AS enrollment_id, e.instantly_lead_id, e.campaign_id,
                 e.visitor_id, e.last_step_sent, e.last_sent_at, e.enrolled_at,
                 c.client_key, c.bucket
          FROM email_enrollments e
          JOIN campaigns c ON c.id = e.campaign_id
          WHERE e.instantly_lead_id IS NOT NULL
            AND e.first_engaged_at IS NULL
            AND COALESCE(e.status, 'sent') NOT IN ('cleaned_up', 'failed')
            AND (
              -- Branch 1: normal-flow completion + quiet window
              (
                e.last_sent_at IS NOT NULL
                AND e.last_sent_at < ${quietCutoff}::timestamptz
                AND (
                  COALESCE(e.last_step_sent, 0) >= ${FINAL_STEP}
                  OR e.last_sent_at < ${hardCutoff}::timestamptz
                )
              )
              -- Branch 2: pre-webhook enrollments (no email_sent stamps)
              OR (
                e.last_sent_at IS NULL
                AND e.enrolled_at IS NOT NULL
                AND e.enrolled_at < ${hardCutoff}::timestamptz
              )
              -- Branch 3: stuck mid-sequence (cap-induced stalling)
              OR (
                e.enrolled_at IS NOT NULL
                AND e.enrolled_at < ${hardCutoff}::timestamptz
              )
            )
          ORDER BY COALESCE(e.last_sent_at, e.enrolled_at) ASC
          LIMIT ${limit}
        `;

    const perClient = {}; // client_key -> { eligible, deleted, notFound, errors, samples: [] }
    for (const row of eligible) {
      if (!perClient[row.client_key]) {
        perClient[row.client_key] = {
          eligible: 0, deleted: 0, already_gone: 0, errors: 0, samples: [],
        };
      }
      perClient[row.client_key].eligible++;
    }

    if (dry) {
      // Fast path: just report what we would do, don't hit Instantly.
      await sql`
        UPDATE processing_runs SET
          completed_at = NOW(),
          processed = ${eligible.length},
          errors = 0,
          tier_counts = ${JSON.stringify({
            mode: 'dry-run',
            per_client: perClient,
            params: { quietDays, hardDays, limit, clientFilter },
          })}::jsonb
        WHERE id = ${run.id}
      `;

      return Response.json({
        success: true,
        mode: 'dry-run',
        eligible: eligible.length,
        per_client: perClient,
        sample: eligible.slice(0, 25).map(e => ({
          enrollment_id: e.enrollment_id,
          instantly_lead_id: e.instantly_lead_id,
          client_key: e.client_key,
          bucket: e.bucket,
          last_step_sent: e.last_step_sent,
          last_sent_at: e.last_sent_at,
          enrolled_at: e.enrolled_at,
          matched_branch: e.last_sent_at ? 'last_sent_at' : 'enrolled_at_fallback',
        })),
        params: { quietDays, hardDays, limit, clientFilter },
      });
    }

    // ── Live mode: delete from Instantly then mark enrollment ──
    // We parallelize deletes in chunks of CONCURRENCY to defeat the per-call
    // latency to Instantly's API (~2s/call serial). With concurrency=8 we
    // effectively do 8× the throughput and can clear ~1500-2000 leads per
    // 300s invocation. Drop concurrency if Instantly starts 429'ing us.
    const CONCURRENCY = 8;
    let totalDeleted = 0;
    let totalErrors = 0;
    let totalAlreadyGone = 0;
    const errorSamples = []; // capped at 10

    async function processOne(row) {
      let ok = false;
      let alreadyGone = false;
      let errBody = null;

      try {
        // NOTE: do NOT send Content-Type: application/json on a DELETE with
        // no body. Instantly's Fastify backend returns 400
        // FST_ERR_CTP_EMPTY_JSON_BODY if the header is present without a body.
        const res = await fetch(`${INSTANTLY_LEADS_API}/${row.instantly_lead_id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        });

        if (res.status === 200 || res.status === 204) {
          ok = true;
        } else if (res.status === 404) {
          // Lead already deleted on Instantly side — still mark our row cleaned_up
          // so we don't keep reprocessing it.
          alreadyGone = true;
          ok = true;
        } else {
          errBody = (await res.text()).slice(0, 300);
        }
      } catch (err) {
        errBody = err.message;
      }

      if (ok) {
        await sql`
          UPDATE email_enrollments
          SET status        = 'cleaned_up',
              cleaned_up_at = NOW()
          WHERE id = ${row.enrollment_id}
        `;
        totalDeleted++;
        if (alreadyGone) totalAlreadyGone++;
        perClient[row.client_key].deleted++;
        if (alreadyGone) perClient[row.client_key].already_gone++;
      } else {
        totalErrors++;
        perClient[row.client_key].errors++;
        if (errorSamples.length < 10) {
          errorSamples.push({
            enrollment_id: row.enrollment_id,
            instantly_lead_id: row.instantly_lead_id,
            client_key: row.client_key,
            error: errBody,
          });
        }
      }
    }

    // Process in chunks so we don't open 2000 concurrent connections at once
    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const chunk = eligible.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(processOne));
    }

    // ── Finalize run ──
    await sql`
      UPDATE processing_runs SET
        completed_at = NOW(),
        processed = ${totalDeleted},
        errors = ${totalErrors},
        tier_counts = ${JSON.stringify({
          mode: 'live',
          per_client: perClient,
          already_gone: totalAlreadyGone,
          error_samples: errorSamples,
          params: { quietDays, hardDays, limit, clientFilter },
        })}::jsonb
      WHERE id = ${run.id}
    `;

    return Response.json({
      success: true,
      mode: 'live',
      eligible: eligible.length,
      deleted: totalDeleted,
      already_gone: totalAlreadyGone,
      errors: totalErrors,
      per_client: perClient,
      error_samples: errorSamples,
      params: { quietDays, hardDays, limit, clientFilter },
    });
  } catch (err) {
    console.error('[cleanup-instantly] Error:', err);
    return Response.json(
      { error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}
