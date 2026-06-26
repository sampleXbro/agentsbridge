import type { LessonsGraph } from './graph-schema.js';
import { deadFileGlobIds } from './validate-liveness.js';
import { isSafeRegexPattern } from './regex-safety.js';
import { keywordNeedleLosesTokens } from './keyword-signal.js';
import { tokenize } from './ranking-text.js';

/**
 * Operational reachability of a lesson on the MANDATORY recall path (--file/--cmd).
 * The tiers are deliberately ASYMMETRIC about how much can be verified statically:
 *  - `file-reachable`: a file_glob matches >=1 file in the working tree. VERIFIED
 *    against ground truth (the tree) — fires when that file is edited.
 *  - `command-pattern`: no live glob, but a VALID command_pattern. We can confirm
 *    only that the matcher COMPILES; there is no command corpus to test against, so
 *    "fires on a real command" is NOT statically verifiable (weaker than a glob).
 *  - `keyword-only`: no live glob / valid command, but a live keyword — fires only
 *    when the keyword surfaces as a path/command token (conditional).
 *  - `inert`: no live trigger of any kind — captured but never recalled.
 */
export type ReachabilityTier = 'file-reachable' | 'command-pattern' | 'keyword-only' | 'inert';

export interface LessonReachability {
  readonly id: string;
  readonly tier: ReachabilityTier;
  /** file_glob triggers that match >=1 working-tree file (verified live). */
  readonly liveFileGlob: readonly string[];
  /** command_pattern triggers that compile (valid; match-vs-real-commands unverifiable). */
  readonly validCommand: readonly string[];
  /** keyword triggers with a non-empty, gap-free needle. */
  readonly liveKeyword: readonly string[];
  /** Triggers that can never fire on the mandatory path (dead glob, invalid regex, dead keyword, missing). */
  readonly dead: readonly string[];
}

export interface ReachabilityReport {
  readonly activeLessons: number;
  readonly fileReachable: number;
  readonly commandPattern: number;
  readonly keywordOnly: number;
  readonly inert: number;
  /** Every active lesson, tiered. */
  readonly lessons: readonly LessonReachability[];
  /** keyword-only + inert — the operationally weak, actionable subset. */
  readonly weak: readonly LessonReachability[];
}

/** A keyword can fire on the file/cmd path only with a non-empty, gap-free needle. */
function keywordLive(pattern: string): boolean {
  return tokenize(pattern).length > 0 && !keywordNeedleLosesTokens(pattern);
}

function tierOf(fileGlob: number, command: number, keyword: number): ReachabilityTier {
  if (fileGlob > 0) return 'file-reachable';
  if (command > 0) return 'command-pattern';
  if (keyword > 0) return 'keyword-only';
  return 'inert';
}

/**
 * Audit a graph for per-lesson reachability on the mandatory recall path, reusing
 * the liveness predicates the capture guardrails and `validate` use, so the audit
 * agrees with how the system judges a dead glob / unsafe pattern / dead keyword
 * everywhere else. Pure: `knownPaths` (project-relative, forward-slash) is supplied
 * by the caller; deprecated/superseded lessons are excluded.
 */
export function auditReachability(
  graph: LessonsGraph,
  knownPaths: ReadonlySet<string>,
): ReachabilityReport {
  const deadGlobs = deadFileGlobIds(graph, knownPaths);
  const lessons: LessonReachability[] = [];
  for (const [id, lesson] of Object.entries(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    const liveFileGlob: string[] = [];
    const validCommand: string[] = [];
    const liveKeyword: string[] = [];
    const dead: string[] = [];
    for (const tid of lesson.triggers) {
      const trigger = graph.triggers[tid];
      if (trigger === undefined) dead.push(tid);
      else if (trigger.kind === 'file_glob') (deadGlobs.has(tid) ? dead : liveFileGlob).push(tid);
      else if (trigger.kind === 'command_pattern')
        (isSafeRegexPattern(trigger.pattern) ? validCommand : dead).push(tid);
      else (keywordLive(trigger.pattern) ? liveKeyword : dead).push(tid);
    }
    const tier = tierOf(liveFileGlob.length, validCommand.length, liveKeyword.length);
    lessons.push({ id, tier, liveFileGlob, validCommand, liveKeyword, dead });
  }
  const count = (t: ReachabilityTier): number => lessons.filter((l) => l.tier === t).length;
  return {
    activeLessons: lessons.length,
    fileReachable: count('file-reachable'),
    commandPattern: count('command-pattern'),
    keywordOnly: count('keyword-only'),
    inert: count('inert'),
    lessons,
    weak: lessons.filter((l) => l.tier === 'keyword-only' || l.tier === 'inert'),
  };
}
