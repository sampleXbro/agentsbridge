import { sessionId as envSessionId } from './telemetry.js';

/**
 * When a signal-less recall session begins and ends.
 *
 * A hook is TOLD what happened to the model's context (SessionStart
 * compact/clear/startup), so it can reset dedup exactly. The CLI and the MCP
 * server are told nothing — they are a command someone runs and a process
 * someone keeps alive — so for them "which chat is this?" has to be inferred.
 * This module owns that inference: the fallback correlator plus the two windows
 * that bound how wrong it can be. Split from seen-cache.ts (which owns the seen
 * set itself) for the 200-line limit; it imports no dedup state, so the
 * dependency runs one way only.
 */

/**
 * Ceiling for a correlator with no context-reset signal (the `--session auto`
 * day bucket, and the MCP server). It bounds the worst case: a new chat opened
 * with no pause at all inherits the previous chat's suppressions only until this
 * window passes. Kept short deliberately — re-showing a rule costs a few hundred
 * tokens, hiding one from a fresh context costs the whole point of recall.
 */
export const AUTO_SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * A quiet gap this long means the previous chat is over, so the WHOLE session
 * resets rather than expiring entry by entry. A new chat usually starts after a
 * pause, so idleness is the best signal available; `lessons stats` groups
 * sessions by the same kind of gap.
 */
export const AUTO_SESSION_IDLE_MS = 30 * 60 * 1000;

/**
 * Resolve `--session auto`: the exported `AGENTSMESH_SESSION_ID` when present,
 * else a day-bucket key. Prose-driven (non-hook) recall has no harness stdin to
 * carry a session id, so without this every ritual recall re-delivers the whole
 * matched set all day (field-measured at ~59% repeated rule-tokens). The day key
 * is deliberately coarse — {@link AUTO_SESSION_IDLE_MS} and
 * {@link AUTO_SESSION_TTL_MS} are what keep a new chat from inheriting an old
 * one's suppressions, and `--no-dedup` is the immediate escape.
 */
export function autoSessionId(env: NodeJS.ProcessEnv = process.env): string {
  return envSessionId(env) ?? dayBucketId();
}

/**
 * The env-independent half of {@link autoSessionId}. A reset runs in a DIFFERENT
 * process from the recall it is resetting (the hook is a subprocess; the CLI
 * runs in the agent's shell), and those environments need not match — one may
 * see `AGENTSMESH_SESSION_ID` while the other does not. So a reset clears this
 * key as well, rather than assuming both processes resolved the same one.
 */
export function dayBucketId(): string {
  return `auto-${new Date().toISOString().slice(0, 10)}`;
}

/** Clock jitter between the writing and reading process that is not suspicious. */
const FUTURE_TOLERANCE_MS = 60_000;

/**
 * Age of a stamp. A stamp meaningfully in the FUTURE cannot be trusted — a clock
 * jump, or a store copied from a machine ahead of this one — and treating it as
 * fresh would pin both the entry and the whole session forever, which is exactly
 * the "rule hidden indefinitely" failure this module exists to prevent. Such a
 * stamp is reported as infinitely old instead, so it expires and its session
 * resets: the cost is one re-delivery, which is always the safe direction.
 */
export function stampAgeMs(stamp: number, now: number = Date.now()): number {
  if (stamp - now > FUTURE_TOLERANCE_MS) return Number.POSITIVE_INFINITY;
  return Math.max(0, now - stamp);
}

/**
 * True when this session's last ACTIVITY predates the idle gap. Activity is not
 * the same as delivery: a recall whose matches were all already suppressed
 * delivers nothing, and treating that as inactivity would re-deliver the whole
 * set every gap even while the agent works steadily. So the store records
 * `lastAt` on every recall and this falls back to the newest delivery stamp only
 * for stores written before that field existed. An unstamped (legacy) or empty
 * store is never "idle": there is nothing to reset, and the TTL path already
 * treats it as fully expired.
 */
export function isIdleSession(
  stamps: ReadonlyMap<string, number> | null,
  lastAt?: number,
): boolean {
  if (stamps === null || stamps.size === 0) return false;
  let newest = lastAt ?? 0;
  for (const ms of stamps.values()) if (ms > newest) newest = ms;
  return stampAgeMs(newest) > AUTO_SESSION_IDLE_MS;
}
