import type { z } from 'zod';

/**
 * Turn raw Zod validation issues into self-correcting ones. A strict-object
 * `unrecognized_keys` issue only names the REJECTED key; an agent that guessed a
 * field name (e.g. the CLI flag `cmd` instead of the MCP field `command`) gets no
 * hint about what was valid. This enriches such issues with the allowed key set
 * and a best-effort "did you mean" so a wrong-field call corrects itself in one
 * round trip — for every tool, not just lessons.
 */

/** Minimal structural view of a Zod issue (avoids coupling to Zod internals). */
interface RawIssue {
  readonly code: string;
  readonly path: ReadonlyArray<string | number | symbol>;
  readonly message: string;
  /** Present on `unrecognized_keys` issues. */
  readonly keys?: readonly string[];
}

export interface EnrichedIssue {
  readonly code: string;
  readonly path: (string | number)[];
  readonly message: string;
  /** Allowed top-level keys, when the issue is an unrecognized-key rejection. */
  readonly expected?: string[];
  /** Closest valid key to the rejected one, when a confident match exists. */
  readonly suggestion?: string;
}

export function enrichValidationIssues(
  schema: z.ZodTypeAny,
  issues: readonly RawIssue[],
): EnrichedIssue[] {
  const allowed = objectShapeKeys(schema);
  return issues.map((issue) => {
    const path = issue.path.map((p) => (typeof p === 'symbol' ? p.toString() : p));
    // Only top-level rejections can be resolved against the schema's shape keys.
    if (issue.code === 'unrecognized_keys' && allowed.length > 0 && issue.path.length === 0) {
      const bad = issue.keys?.[0];
      const suggestion = bad === undefined ? undefined : nearestKey(bad, allowed);
      const tail = suggestion === undefined ? '' : ` Did you mean "${suggestion}"?`;
      return {
        code: issue.code,
        path,
        message: `${issue.message}. Expected one of: ${allowed.join(', ')}.${tail}`,
        expected: allowed,
        ...(suggestion === undefined ? {} : { suggestion }),
      };
    }
    return { code: issue.code, path, message: issue.message };
  });
}

/** Allowed top-level field names of a Zod object schema (empty for non-objects). */
function objectShapeKeys(schema: z.ZodTypeAny): string[] {
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  return shape !== undefined && typeof shape === 'object' ? Object.keys(shape) : [];
}

/**
 * Closest candidate to `bad`: exact (case-insensitive) match, else nearest by
 * edit distance within a length-scaled threshold, else the shortest candidate
 * that contains `bad` as a substring (catches `tokens` -> `max_tokens`). Returns
 * undefined when nothing is close enough, so a confident-only suggestion is made.
 */
export function nearestKey(bad: string, candidates: readonly string[]): string | undefined {
  const lower = bad.toLowerCase();
  const exact = candidates.find((c) => c.toLowerCase() === lower);
  if (exact !== undefined) return exact;

  let best: string | undefined;
  let bestDistance = Infinity;
  const threshold = Math.max(2, Math.ceil(bad.length / 3));
  for (const candidate of candidates) {
    const d = editDistance(lower, candidate.toLowerCase());
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  if (best !== undefined && bestDistance <= threshold) return best;

  const containing = candidates
    .filter((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()))
    .sort((a, b) => a.length - b.length);
  return containing[0];
}

/** Levenshtein edit distance (iterative, single-row). */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + cost);
      diag = tmp;
    }
  }
  return prev[b.length]!;
}
