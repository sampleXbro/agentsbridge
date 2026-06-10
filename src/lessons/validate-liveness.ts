import picomatch from 'picomatch';
import type { LessonsGraph } from './graph-schema.js';
import type { ValidationFinding } from './validate.js';

/**
 * Trigger-LIVENESS checks: a trigger referenced by an active lesson that can
 * never fire makes the lesson unreachable, silently, as the codebase moves
 * underneath it. These are distinct from breadth — the system deliberately
 * optimizes for precision, so neither check ever asks to WIDEN a narrow trigger;
 * `collectDeadFileGlobs` flags a glob that matches *nothing*, and
 * `collectRunnerAnchoredPatterns` flags a scope-MATCH gap (anchored to one
 * runner), not a scope-too-narrow one.
 */

function activeTriggerIds(graph: LessonsGraph): Set<string> {
  const ids = new Set<string>();
  for (const lesson of Object.values(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    for (const t of lesson.triggers) ids.add(t);
  }
  return ids;
}

/**
 * A `file_glob` (referenced by an active lesson) that matches NO path in the
 * working tree is dead — the lesson is unreachable via that trigger, almost
 * always because a refactor renamed the path it pointed at. Liveness, not
 * breadth: a narrow glob that still matches one file is fine; only a glob that
 * matches zero is reported. Caller supplies `knownPaths` (project-relative,
 * forward-slash); when it can't be determined the check is skipped entirely
 * (see {@link validateLessonsGraph}), so we never flag every glob dead.
 */
export function collectDeadFileGlobs(
  graph: LessonsGraph,
  findings: ValidationFinding[],
  knownPaths: ReadonlySet<string>,
): void {
  const active = activeTriggerIds(graph);
  const paths = [...knownPaths];
  for (const [triggerId, trigger] of Object.entries(graph.triggers)) {
    if (trigger.kind !== 'file_glob') continue;
    if (!active.has(triggerId)) continue;
    const isMatch = picomatch(trigger.pattern, { dot: true });
    if (paths.some((p) => isMatch(p))) continue;
    findings.push({
      level: 'warning',
      code: 'DEAD_FILE_GLOB',
      message: `file_glob trigger "${triggerId}" (${trigger.pattern}) matches no file in the working tree — the lesson is unreachable via this trigger (a rename likely moved the path). Re-point it at the current path, or detach it with \`lessons untrigger\`.`,
      triggerId,
    });
  }
}

/** Anchored to a single package-runner at the start of the pattern. */
const RUNNER_ANCHOR = /^\^(pnpm|npm|npx|yarn|bun)\b/;

/**
 * A `command_pattern` anchored to ONE runner (e.g. `^pnpm test`, `^npx vitest`)
 * will not fire for the same task run another way — an agent that types
 * `npx vitest` gets nothing from a `^pnpm` lesson, and `npx` is the shape agents
 * actually use. Scope-MATCH, not breadth: the fix is to drop the `^<runner>`
 * anchor and key on the task verb, not to widen what the lesson covers.
 */
export function collectRunnerAnchoredPatterns(
  graph: LessonsGraph,
  findings: ValidationFinding[],
): void {
  const active = activeTriggerIds(graph);
  for (const [triggerId, trigger] of Object.entries(graph.triggers)) {
    if (trigger.kind !== 'command_pattern') continue;
    if (!active.has(triggerId)) continue;
    if (!RUNNER_ANCHOR.test(trigger.pattern)) continue;
    findings.push({
      level: 'warning',
      code: 'RUNNER_ANCHORED_PATTERN',
      message: `command_pattern trigger "${triggerId}" (${trigger.pattern}) is anchored to one runner — it won't fire for the same task via another runner (e.g. \`npx\` vs \`pnpm\`). Drop the \`^<runner>\` anchor and key on the task (e.g. \`\\bvitest\\b\`).`,
      triggerId,
    });
  }
}
