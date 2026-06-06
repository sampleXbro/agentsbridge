import picomatch from 'picomatch';
import type { Lesson, LessonsGraph, Trigger } from './graph-schema.js';
import { getSafeCommandRegex } from './regex-safety.js';

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

/** The set of trigger ids that match the query — shared by recall and ranking. */
export function collectMatchedTriggerIds(graph: LessonsGraph, query: LessonsQuery): Set<string> {
  const ids = new Set<string>();
  for (const [id, trigger] of Object.entries(graph.triggers)) {
    if (triggerMatches(trigger, query)) ids.add(id);
  }
  return ids;
}

function triggerMatches(trigger: Trigger, query: LessonsQuery): boolean {
  switch (trigger.kind) {
    case 'file_glob':
      if (query.file === undefined) return false;
      return picomatch(trigger.pattern, { dot: true })(query.file);
    case 'command_pattern': {
      if (query.command === undefined) return false;
      // Skip invalid OR ReDoS-unsafe patterns — recall must never execute a
      // catastrophic-backtracking regex on the hot path (see regex-safety.ts).
      const re = getSafeCommandRegex(trigger.pattern);
      return re !== null && re.test(query.command);
    }
    case 'keyword':
      if (query.keyword === undefined) return false;
      return query.keyword.toLowerCase().includes(trigger.pattern.toLowerCase());
  }
}
