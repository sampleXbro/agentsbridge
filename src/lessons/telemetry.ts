import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { lessonsPaths } from './paths.js';

/** Keep at most this many recall records; older ones are dropped on truncation. */
export const MAX_RECALL_LOG_RECORDS = 5000;

/**
 * Byte size past which {@link appendRecallRecord} truncates the log. Generous
 * headroom over {@link MAX_RECALL_LOG_RECORDS} worth of records so trimming is
 * rare (each append pays only a cheap `statSync`, never a full read).
 */
const RECALL_LOG_TRIM_TRIGGER_BYTES = 2_000_000;

/**
 * Opt-in recall telemetry. Mandatory recall runs before every edit/command, so
 * its *frequency* — not its per-call payload — is the real token cost. This log
 * captures one append-only record per recall so `lessons stats` can answer "is
 * per-action recall token-justified versus loading the whole active set once?".
 *
 * OFF by default: a no-op unless {@link TELEMETRY_ENV} === '1'. Records carry
 * field-PRESENCE booleans only — never the raw file / command / keyword text —
 * so the log stays small and leaks no source content.
 */

export const TELEMETRY_ENV = 'AGENTSMESH_LESSONS_TELEMETRY';

/** Per-recall telemetry row. One JSON object per line in {@link recallLogPath}. */
export interface RecallTelemetryRecord {
  /** ISO-8601 timestamp supplied by the caller. */
  readonly ts: string;
  readonly hasFile: boolean;
  readonly hasCommand: boolean;
  readonly hasKeyword: boolean;
  /** Active lessons that matched before ranking/cap. */
  readonly totalMatches: number;
  /** Lessons actually returned after limit + token budget. */
  readonly returnedCount: number;
  /** Estimated cumulative rule-token cost of the returned lessons. */
  readonly returnedTokens: number;
  /** True when caps hid matches (`totalMatches > returnedCount`). */
  readonly truncated: boolean;
  /** Matched lessons attributable to each trigger kind (overlaps allowed). */
  readonly matchedByKind: {
    readonly file: number;
    readonly command: number;
    readonly keyword: number;
  };
}

/** Append-only JSONL recall log. Sibling of the canonical graph, never the graph. */
export function recallLogPath(projectRoot: string): string {
  return join(lessonsPaths(projectRoot).base, 'recall-log.jsonl');
}

export function isTelemetryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[TELEMETRY_ENV] === '1';
}

/**
 * Append one record to the recall log — a no-op unless telemetry is enabled, so
 * the recall hot path pays nothing in the default configuration.
 */
export function appendRecallRecord(
  projectRoot: string,
  record: RecallTelemetryRecord,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!isTelemetryEnabled(env)) return;
  const path = recallLogPath(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
  // Bound the append-only log: cheap statSync on each write, full rewrite only
  // when it has grown past the trigger. Keeps a committed `.agentsmesh/` from
  // accumulating an ever-growing diagnostic file.
  if (statSync(path).size > RECALL_LOG_TRIM_TRIGGER_BYTES) capRecallLog(projectRoot);
}

/**
 * Truncate the recall log to its last {@link MAX_RECALL_LOG_RECORDS} records
 * (or `maxRecords` when given). No-op when the log is absent or already within
 * the cap. Rewrites atomically (temp + rename) so a reader never sees a torn
 * file. Idempotent and safe to call from any startup/append path.
 */
export function capRecallLog(projectRoot: string, maxRecords = MAX_RECALL_LOG_RECORDS): void {
  const path = recallLogPath(projectRoot);
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length <= maxRecords) return;
  const kept = lines.slice(lines.length - maxRecords);
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${kept.join('\n')}\n`, 'utf8');
  renameSync(tmp, path);
}

/** True when a recall log exists — distinguishes "never recorded" from "empty". */
export function recallLogExists(projectRoot: string): boolean {
  return existsSync(recallLogPath(projectRoot));
}

/** Read the recall log, skipping any malformed line. Returns [] when absent. */
export function readRecallLog(projectRoot: string): RecallTelemetryRecord[] {
  const path = recallLogPath(projectRoot);
  if (!existsSync(path)) return [];
  const out: RecallTelemetryRecord[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      out.push(JSON.parse(line) as RecallTelemetryRecord);
    } catch {
      // A torn final line (crash mid-append) or hand-edit — skip it, don't fail stats.
    }
  }
  return out;
}
