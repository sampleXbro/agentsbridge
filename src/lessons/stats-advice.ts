import type { LessonsGraph } from './graph-schema.js';
import type { RecallStatsReport } from './stats.js';
import type { RecallTelemetryRecord } from './telemetry.js';

/**
 * Actionable diagnoses derived from the stats report — the numbers alone leave
 * the two dominant field pathologies undiagnosed (one deployment stared at 58.7%
 * redundancy / 82.4% no-match with no pointer to the cause). Each advice line
 * names the condition AND the fix, so `stats` is self-diagnosing instead of a
 * number dump. Deliberately conservative: an advice fires only when the signal
 * pattern is unambiguous, silence is the default.
 */

/** Redundancy past this share of delivered rule-tokens is worth diagnosing. */
const REDUNDANCY_ADVICE_RATE = 0.25;
/** Below this fraction of session-tagged recalls, dedup is effectively off. */
const SESSION_COVERAGE_FLOOR = 0.5;
/** No-match share past this is structural, not incidental. */
const NO_MATCH_ADVICE_RATE = 0.5;
/** Command-only share of no-matches past this pins the cause on cmd recalls. */
const CMD_ONLY_SHARE_FLOOR = 0.5;

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

/**
 * Command_pattern triggers reachable by triggered recall — active, non-always
 * lessons only, mirroring queryLessons (always-on lessons are delivered, not
 * matched, so their triggers can never satisfy a command recall).
 */
function activeCommandTriggerCount(graph: LessonsGraph): number {
  const active = new Set<string>();
  for (const lesson of Object.values(graph.lessons)) {
    if (lesson.status !== 'active' || lesson.scope === 'always') continue;
    for (const t of lesson.triggers) active.add(t);
  }
  let n = 0;
  for (const [id, trigger] of Object.entries(graph.triggers)) {
    if (trigger.kind === 'command_pattern' && active.has(id)) n += 1;
  }
  return n;
}

/** Diagnostic advice lines for the recall report — empty when nothing is wrong. */
export function statsAdvice(
  records: readonly RecallTelemetryRecord[],
  graph: LessonsGraph,
  report: RecallStatsReport,
): string[] {
  if (records.length === 0) return [];
  const advice: string[] = [];

  // Inert dedup: repeats dominate AND recalls carry no session correlator, so
  // dedup never had a chance. High redundancy WITH sessions threaded is a
  // different (rarer) condition — stay silent rather than misdiagnose.
  const sessionCoverage = records.filter((r) => r.session !== undefined).length / records.length;
  if (report.redundancy.rate > REDUNDANCY_ADVICE_RATE && sessionCoverage < SESSION_COVERAGE_FLOOR) {
    advice.push(
      `advice: ${pct(report.redundancy.rate)} of delivered rule-tokens are repeats and ` +
        `${pct(1 - sessionCoverage)} of recalls carry no session id — session dedup is inert. ` +
        `CLI ritual recalls: pass --session auto; hook/MCP recalls thread a session ` +
        `automatically on current versions.`,
    );
  }

  // Command-trigger starvation: the no-match volume is dominated by command-only
  // recalls while the graph barely has command_pattern triggers to hit.
  const noMatch = records.filter((r) => r.totalMatches === 0);
  const cmdOnlyNoMatch = noMatch.filter((r) => r.hasCommand && !r.hasFile && !r.hasKeyword).length;
  if (
    report.noMatchRate > NO_MATCH_ADVICE_RATE &&
    noMatch.length > 0 &&
    cmdOnlyNoMatch / noMatch.length > CMD_ONLY_SHARE_FLOOR
  ) {
    const n = activeCommandTriggerCount(graph);
    advice.push(
      `advice: ${pct(cmdOnlyNoMatch / noMatch.length)} of no-match recalls are command-only ` +
        `against ${n} command_pattern trigger${n === 1 ? '' : 's'} — command-shaped lessons ` +
        `are starving. Author --trigger-cmd on lessons about commands (the capture nudge ` +
        `pre-fills one from the failed command).`,
    );
  }

  return advice;
}
