import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
  /**
   * Project root. Namespaces the seen file by a hash of the resolved root, so two
   * projects sharing one fixed `AGENTSMESH_SESSION_ID` (e.g. a CI runner that
   * exports it once) keep SEPARATE dedup state — otherwise project B inherits
   * project A's "seen" set and suppresses coincidentally-colliding lesson ids.
   * Omitted → the legacy flat path (unchanged behavior).
   */
  readonly projectRoot?: string;
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
  const path = seenPath(id, options.projectRoot);
  return { sessionId: id, seen: loadSeen(path), path };
}

/** Short, stable, dependency-free hash (djb2) of a string, base-36. */
function shortHash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function seenPath(id: string, projectRoot?: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 200);
  // Namespace by a hash of the resolved project root (per-project × per-session).
  const scoped = projectRoot === undefined ? safe : `${safe}__${shortHash(resolve(projectRoot))}`;
  return join(tmpdir(), SEEN_DIR, `${scoped}.json`);
}

/**
 * Discard the per-session seen set, so subsequent recalls re-inject as if fresh.
 * Called when the model's context was actually reset — a `SessionStart`
 * `compact`/`clear` — so dedup (which assumes a delivered lesson stays in context)
 * does not keep suppressing lessons the summarization dropped. Best-effort: a
 * failed remove just leaves the stale set, degrading to today's behavior.
 */
export function clearSeen(sessionId: string, projectRoot?: string): void {
  try {
    rmSync(seenPath(sessionId, projectRoot), { force: true });
  } catch {
    // Never let a dedup-reset failure break the blocking recall path.
  }
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
