/**
 * lib/al-segments.js
 *
 * Parser for the AL_SEGMENTS env var. Supports two formats:
 *
 * 1) Legacy flat (warm / pixel only):
 *      AL_SEGMENTS = {
 *        "sa-spine":      "abc-123",
 *        "four-winds":    "def-456"
 *      }
 *    -> Each entry treated as kind='pixel' (the warm/pixel pipeline).
 *
 * 2) Nested per-client kinds (warm + cold):
 *      AL_SEGMENTS = {
 *        "sa-spine":   { "pixel":   "abc-123" },
 *        "four-winds": { "pixel":   "def-456",
 *                        "al_cold": "ghi-789" }
 *      }
 *    -> Each (client, kind) pair is its own ingest job.
 *
 * Both formats can be mixed within the same env var. The output of
 * `parseAlSegments(envValue)` is always a normalized array:
 *
 *   [
 *     { client_key: 'sa-spine',   kind: 'pixel',   segment_id: 'abc-123' },
 *     { client_key: 'four-winds', kind: 'pixel',   segment_id: 'def-456' },
 *     { client_key: 'four-winds', kind: 'al_cold', segment_id: 'ghi-789' },
 *   ]
 *
 * `kind` here matches the `acquisition_source` column on visitors (added
 * in migration-015): 'pixel' (warm) or 'al_cold' (cold).
 */

const VALID_KINDS = new Set(['pixel', 'al_cold']);

/**
 * Parse the AL_SEGMENTS env var (string or already-parsed object) into a
 * flat list of ingest jobs.
 *
 * @param {string|object|undefined|null} raw - process.env.AL_SEGMENTS
 * @returns {Array<{client_key: string, kind: 'pixel'|'al_cold', segment_id: string}>}
 * @throws {Error} on malformed JSON or unknown kind names
 */
export function parseAlSegments(raw) {
  if (!raw) return [];

  let parsed;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`AL_SEGMENTS is not valid JSON: ${err.message}`);
    }
  } else if (typeof raw === 'object') {
    parsed = raw;
  } else {
    throw new Error(`AL_SEGMENTS must be a JSON string or object, got ${typeof raw}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AL_SEGMENTS must be a JSON object keyed by client_key');
  }

  const jobs = [];

  for (const [clientKey, value] of Object.entries(parsed)) {
    if (!clientKey || typeof clientKey !== 'string') continue;

    // Form 1: flat — value is the segment_id string.
    if (typeof value === 'string') {
      if (!value.trim()) continue;
      jobs.push({ client_key: clientKey, kind: 'pixel', segment_id: value });
      continue;
    }

    // Form 2: nested — value is { kind: segment_id, ... }.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [kind, segmentId] of Object.entries(value)) {
        if (!segmentId || typeof segmentId !== 'string' || !segmentId.trim()) {
          continue;
        }
        if (!VALID_KINDS.has(kind)) {
          throw new Error(
            `AL_SEGMENTS[${clientKey}] has unknown kind "${kind}". ` +
            `Valid kinds: ${Array.from(VALID_KINDS).join(', ')}`
          );
        }
        jobs.push({ client_key: clientKey, kind, segment_id: segmentId });
      }
      continue;
    }

    throw new Error(
      `AL_SEGMENTS[${clientKey}] must be a string (legacy) or object (nested), ` +
      `got ${value === null ? 'null' : typeof value}`
    );
  }

  return jobs;
}

/**
 * Convenience: filter a parsed job list down to one client.
 */
export function jobsForClient(jobs, clientKey) {
  return jobs.filter(j => j.client_key === clientKey);
}

/**
 * Convenience: filter a parsed job list down to one kind ('pixel' | 'al_cold').
 */
export function jobsForKind(jobs, kind) {
  return jobs.filter(j => j.kind === kind);
}
