import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { MatchedLesson } from './query.js';
import { sessionId as envSessionId } from './telemetry.js';

/**
 * Session-scoped recall dedup. Recall is stateless and deterministic, so the
 * same `--file` returns the identical rules every time — N recalls touching one
 * area re-deliver the same ~280 tokens N times. When a session correlator is
 * present (`AGENTSMESH_SESSION_ID` or an explicit `--session`), this suppresses
 * lessons already delivered earlier in the session so each recall carries only
 * what is NEW. Opt-in: with no correlator the recall path is untouched.
 *
 * The per-session set of delivered lesson ids lives in the OS temp dir (not the
 * project tree), so it never dirties `.agentsmesh/` and the OS reclaims it.
 */

const SEEN_DIR = 'agentsmesh-lessons-seen';

export interface SessionDedup {
  readonly sessionId: string;
  readonly seen: ReadonlySet<string>;
  readonly path: string;
}

export interface OpenDedupOptions {
  /** Explicit session id (CLI `--session`); wins over the environment. */
  readonly explicit?: string;
  /** Force dedup off (CLI `--no-dedup`) even when a correlator is present. */
  readonly disabled?: boolean;
  readonly env?: NodeJS.ProcessEnv;
}

/**
 * Open the dedup state for the current session, or `null` when dedup is off —
 * no correlator set, or explicitly disabled. `null` is the default, fully
 * stateless path, so existing behavior is unchanged unless a session is named.
 */
export function openSessionDedup(options: OpenDedupOptions = {}): SessionDedup | null {
  if (options.disabled === true) return null;
  const id =
    options.explicit !== undefined && options.explicit.trim().length > 0
      ? options.explicit.trim()
      : envSessionId(options.env);
  if (id === undefined) return null;
  const path = seenPath(id);
  return { sessionId: id, seen: loadSeen(path), path };
}

function seenPath(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
  return join(tmpdir(), SEEN_DIR, `${safe}.json`);
}

function loadSeen(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Drop matches already delivered this session BEFORE ranking, so the limit +
 * token budget fill with FRESH lessons rather than wasting slots on repeats.
 */
export function filterUnseen(
  dedup: SessionDedup,
  matches: readonly MatchedLesson[],
): MatchedLesson[] {
  return matches.filter((m) => !dedup.seen.has(m.id));
}

/**
 * Record the ids actually returned so a later recall this session suppresses
 * them. Best-effort and atomic (temp + rename); a write failure is swallowed —
 * dedup is an optimization and must never break the blocking recall path.
 */
export function commitSeen(dedup: SessionDedup, returnedIds: readonly string[]): void {
  if (returnedIds.length === 0) return;
  const union = new Set(dedup.seen);
  for (const id of returnedIds) union.add(id);
  if (union.size === dedup.seen.size) return;
  try {
    mkdirSync(dirname(dedup.path), { recursive: true });
    const tmp = `${dedup.path}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify([...union]), 'utf8');
    renameSync(tmp, dedup.path);
  } catch {
    // Optimization only — never fail recall because the seen cache could not be written.
  }
}
