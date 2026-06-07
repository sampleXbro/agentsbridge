import picomatch from 'picomatch';
import type { Lesson, LessonsGraph, Trigger } from './graph-schema.js';
import { getCommandMatcher } from './regex-safety.js';
import type { WorkBudget } from './regex-linear/index.js';

/**
 * Query-wide budget for command_pattern matching (NFA state-visits). ONE budget
 * is shared across every trigger in a single recall, so total matching work is
 * bounded regardless of how many near-cap patterns the graph holds — not just
 * per pattern. ~5M state-visits ≈ a few hundred ms worst case; a normal query
 * uses a tiny fraction. When exhausted, remaining command patterns are treated
 * as non-matches (safe degradation, never a false positive).
 */
const COMMAND_MATCH_BUDGET = 5_000_000;

export interface LessonsQuery {
  /** Project-relative path of the file about to be edited. */
  readonly file?: string;
  /** Shell command about to be executed. */
  readonly command?: string;
  /** Free-form text describing the current task. */
  readonly keyword?: string;
}

export interface MatchedLesson {
  readonly id: string;
  readonly lesson: Lesson;
}

/**
 * Recall primitive — returns every active lesson whose triggers match any of
 * the supplied query fields. The query fields combine as OR across triggers:
 * a lesson matches if ANY of its triggers match ANY supplied field.
 * Deprecated and superseded lessons are excluded.
 */
export function queryLessons(graph: LessonsGraph, query: LessonsQuery): MatchedLesson[] {
  if (query.file === undefined && query.command === undefined && query.keyword === undefined) {
    return [];
  }

  const matchedTriggerIds = collectMatchedTriggerIds(graph, query);

  const matched: MatchedLesson[] = [];
  for (const [id, lesson] of Object.entries(graph.lessons)) {
    if (lesson.status !== 'active') continue;
    if (lesson.triggers.some((t) => matchedTriggerIds.has(t))) {
      matched.push({ id, lesson });
    }
  }

  matched.sort((a, b) => (a.id < b.id ? -1 : 1));
  return matched;
}

/** Matched trigger ids split by kind — drives recall telemetry provenance. */
export interface MatchedTriggersByKind {
  readonly file_glob: Set<string>;
  readonly command_pattern: Set<string>;
  readonly keyword: Set<string>;
}

/**
 * Partition the query's matched trigger ids by kind in a single pass. The flat
 * {@link collectMatchedTriggerIds} delegates here so matching logic and the
 * shared command-pattern budget live in exactly one place.
 */
export function collectMatchedTriggersByKind(
  graph: LessonsGraph,
  query: LessonsQuery,
): MatchedTriggersByKind {
  const byKind: MatchedTriggersByKind = {
    file_glob: new Set(),
    command_pattern: new Set(),
    keyword: new Set(),
  };
  // One budget shared across ALL command_pattern triggers in this query.
  const budget: WorkBudget = { remaining: COMMAND_MATCH_BUDGET };
  for (const [id, trigger] of Object.entries(graph.triggers)) {
    if (triggerMatches(trigger, query, budget)) byKind[trigger.kind].add(id);
  }
  return byKind;
}

/** The set of trigger ids that match the query — shared by recall and ranking. */
export function collectMatchedTriggerIds(graph: LessonsGraph, query: LessonsQuery): Set<string> {
  const { file_glob, command_pattern, keyword } = collectMatchedTriggersByKind(graph, query);
  return new Set([...file_glob, ...command_pattern, ...keyword]);
}

function triggerMatches(trigger: Trigger, query: LessonsQuery, budget: WorkBudget): boolean {
  switch (trigger.kind) {
    case 'file_glob':
      if (query.file === undefined) return false;
      return picomatch(trigger.pattern, { dot: true })(query.file);
    case 'command_pattern': {
      if (query.command === undefined) return false;
      // Match via the non-backtracking linear engine — recall must never run a
      // backtracking regex on the hot path (see regex-safety.ts). null = the
      // pattern is unsupported/over-long; treat as a non-match (fail closed).
      // The shared budget bounds total command-matching work query-wide.
      const matcher = getCommandMatcher(trigger.pattern);
      return matcher !== null && matcher.test(query.command, budget);
    }
    case 'keyword':
      if (query.keyword === undefined) return false;
      return query.keyword.toLowerCase().includes(trigger.pattern.toLowerCase());
  }
}
