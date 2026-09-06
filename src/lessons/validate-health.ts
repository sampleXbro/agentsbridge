import type { LessonsGraph } from './graph-schema.js';
import { effectiveness, readOutcomeLog, type OutcomeEvent } from './outcome-log.js';
import { queryLessons, type LessonsQuery } from './query.js';
import { readRecallLog, type RecallTelemetryRecord } from './telemetry.js';
import type { ValidationFinding } from './validate.js';

/**
 * Log-derived health findings for `validate` (MAINTAIN). These read the outcome
 * side-channel, so they live OUTSIDE validateLessonsGraph — that function doubles
 * as the write barrier (mutate.ts), and a telemetry-derived warning must never
 * gate a write. Every finding is `warning` level: advisory only, acted on via the
 * existing `deprecate`/`add`. Empty when telemetry is off or the log is absent, so
 * the default configuration adds nothing to `validate`.
 *
 * The graph-shape health signals the spec also lists — stale (dead glob),
 * duplicate, refine (over-broad trigger) — are ALREADY emitted by
 * validateLessonsGraph; this module only adds what the log makes newly knowable.
 */

/** A lesson delivered at least this often that never once helped is ineffective. */
export const INEFFECTIVE_MIN_DELIVERIES = 3;
/** A contextKey failing at least this often with no covering lesson is uncovered. */
const UNCOVERED_MIN_FAILURES = 2;
/** Only a recall log at least this long can say a lesson "never" fires. */
export const UNUSED_MIN_RECALLS = 500;
/** Ids named in the NEVER_RECALLED message; the finding's `lessonIds` carries them all. */
const UNUSED_NAMED_IDS = 8;

export function collectHealthFindings(
  projectRoot: string,
  graph: LessonsGraph,
): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  const events = readOutcomeLog(projectRoot);
  if (events.length > 0) {
    collectIneffective(events, graph, findings);
    collectUncovered(events, graph, findings);
  }
  collectNeverRecalled(readRecallLog(projectRoot), graph, findings);
  return findings;
}

/**
 * Lessons that never fired across the whole recall window — trigger cost with no
 * return so far. Field data: 59% of a mature graph. One aggregate finding, not one
 * per lesson, so a long tail cannot flood `validate` into being ignored; the ids
 * ride on `lessonIds` for tooling. A lesson counts only when it is active, not
 * always-on (those ride prompts, outside the recall log), and older than the log
 * window, so a fresh capture is never accused of silence it had no time to break.
 */
function collectNeverRecalled(
  records: readonly RecallTelemetryRecord[],
  graph: LessonsGraph,
  findings: ValidationFinding[],
): void {
  if (records.length < UNUSED_MIN_RECALLS) return;
  const stamps = records.map((r) => Date.parse(r.ts)).filter((t) => Number.isFinite(t));
  if (stamps.length === 0) return;
  const windowStart = Math.min(...stamps);
  const delivered = new Set(records.flatMap((r) => r.lessonIds ?? []));
  const ids = Object.entries(graph.lessons)
    .filter(
      ([id, l]) =>
        l.status === 'active' &&
        l.scope !== 'always' &&
        Date.parse(l.createdAt) < windowStart &&
        !delivered.has(id),
    )
    .map(([id]) => id)
    .sort();
  if (ids.length === 0) return;
  const named = ids.slice(0, UNUSED_NAMED_IDS).join(', ');
  const more = ids.length > UNUSED_NAMED_IDS ? ` (+${ids.length - UNUSED_NAMED_IDS} more)` : '';
  findings.push({
    level: 'warning',
    code: 'NEVER_RECALLED',
    lessonIds: ids,
    message:
      `${ids.length} active lesson(s) never delivered across the last ${records.length} recalls ` +
      `(since ${new Date(windowStart).toISOString().slice(0, 10)}): ${named}${more}. Their triggers ` +
      `may point at paths or commands no longer touched — inspect with \`agentsmesh lessons show <id>\`, ` +
      `narrow or retarget the trigger, or retire with: agentsmesh lessons deprecate <id>`,
  });
}

function collectIneffective(
  events: readonly OutcomeEvent[],
  graph: LessonsGraph,
  findings: ValidationFinding[],
): void {
  const eff = effectiveness(events);
  for (const lessonId of [...eff.keys()].sort()) {
    const outcome = eff.get(lessonId)!;
    // Delivered enough to judge, and every single delivery was a miss (never helped).
    if (outcome.delivered < INEFFECTIVE_MIN_DELIVERIES || outcome.missed < outcome.delivered)
      continue;
    if (graph.lessons[lessonId]?.status !== 'active') continue; // already retired → nothing to do
    findings.push({
      level: 'warning',
      code: 'INEFFECTIVE_LESSON',
      lessonId,
      message:
        `Delivered ${outcome.delivered}× but the same mistake recurred every time — the rule may be ` +
        `wrong, too vague, or mis-triggered. Refine it, or run: agentsmesh lessons deprecate ${lessonId}`,
    });
  }
}

function queryFromContextKey(key: string): LessonsQuery | null {
  // Only file: keys are lossless. A cmd: key holds the normalized command CLASS
  // (flags/args stripped), which a command_pattern trigger matching the full command
  // cannot be re-checked against — so we never claim a command action is uncovered
  // here (the failure hook, which still has the raw command, judges those precisely).
  if (key.startsWith('file:')) return { file: key.slice('file:'.length) };
  return null;
}

function collectUncovered(
  events: readonly OutcomeEvent[],
  graph: LessonsGraph,
  findings: ValidationFinding[],
): void {
  const failures = new Map<string, number>();
  for (const ev of events) {
    if (ev.kind === 'failure') failures.set(ev.contextKey, (failures.get(ev.contextKey) ?? 0) + 1);
  }
  for (const key of [...failures.keys()].sort()) {
    const count = failures.get(key)!;
    if (count < UNCOVERED_MIN_FAILURES) continue;
    const query = queryFromContextKey(key);
    if (query === null || queryLessons(graph, query).length > 0) continue; // covered → skip
    findings.push({
      level: 'warning',
      code: 'UNCOVERED_FAILURE',
      message: `Failed ${count}× at ${key} with no lesson to prevent it — capture one: agentsmesh lessons add`,
    });
  }
}
