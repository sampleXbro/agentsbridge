import type { LessonsGraph } from './graph-schema.js';
import type { ValidationFinding } from './validate.js';

export function collectDanglingRefs(graph: LessonsGraph, findings: ValidationFinding[]): void {
  for (const [lessonId, lesson] of Object.entries(graph.lessons)) {
    for (const topicId of lesson.topics) {
      if (graph.topics[topicId] === undefined) {
        findings.push({
          level: 'error',
          code: 'DANGLING_TOPIC',
          message: `Lesson "${lessonId}" references unknown topic "${topicId}".`,
          lessonId,
          topicId,
        });
      }
    }
    for (const triggerId of lesson.triggers) {
      if (graph.triggers[triggerId] === undefined) {
        findings.push({
          level: 'error',
          code: 'DANGLING_TRIGGER',
          message: `Lesson "${lessonId}" references unknown trigger "${triggerId}".`,
          lessonId,
          triggerId,
        });
      }
    }
    if (lesson.supersededBy !== undefined && graph.lessons[lesson.supersededBy] === undefined) {
      findings.push({
        level: 'error',
        code: 'DANGLING_SUPERSEDER',
        message: `Lesson "${lessonId}" supersededBy unknown lesson "${lesson.supersededBy}".`,
        lessonId,
      });
    }
  }
}

export function collectStatusInvariants(graph: LessonsGraph, findings: ValidationFinding[]): void {
  for (const [lessonId, lesson] of Object.entries(graph.lessons)) {
    if (lesson.status === 'superseded' && lesson.supersededBy === undefined) {
      findings.push({
        level: 'error',
        code: 'SUPERSEDED_WITHOUT_TARGET',
        message: `Lesson "${lessonId}" has status "superseded" but no supersededBy target.`,
        lessonId,
      });
    }
    if (lesson.status === 'active' && lesson.supersededBy !== undefined) {
      findings.push({
        level: 'error',
        code: 'ACTIVE_WITH_SUPERSEDER',
        message: `Lesson "${lessonId}" has status "active" but declares supersededBy.`,
        lessonId,
      });
    }
  }
}

/**
 * Self-supersession, supersession cycles, and inactive superseders. A
 * superseded lesson must point at a *different*, ultimately-active replacement;
 * otherwise recall silently drops knowledge with no live successor.
 */
export function collectLifecycleInvariants(
  graph: LessonsGraph,
  findings: ValidationFinding[],
): void {
  for (const [lessonId, lesson] of Object.entries(graph.lessons)) {
    if (lesson.supersededBy === undefined) continue;
    if (lesson.supersededBy === lessonId) {
      findings.push({
        level: 'error',
        code: 'SELF_SUPERSEDED',
        message: `Lesson "${lessonId}" is superseded by itself.`,
        lessonId,
      });
      continue;
    }
    const target = graph.lessons[lesson.supersededBy];
    if (target !== undefined && target.status !== 'active') {
      findings.push({
        level: 'error',
        code: 'INACTIVE_SUPERSEDER',
        message: `Lesson "${lessonId}" is superseded by "${lesson.supersededBy}", which is itself ${target.status} — the chain dead-ends with no live replacement.`,
        lessonId,
      });
    }
  }
  collectSupersedeCycles(graph, findings);
}

function collectSupersedeCycles(graph: LessonsGraph, findings: ValidationFinding[]): void {
  const reported = new Set<string>();
  for (const startId of Object.keys(graph.lessons)) {
    const seen = new Set<string>();
    let cur: string | undefined = startId;
    while (cur !== undefined) {
      if (seen.has(cur)) {
        if (cur !== startId || reported.has(cur)) break;
        reported.add(cur);
        findings.push({
          level: 'error',
          code: 'SUPERSEDE_CYCLE',
          message: `Lesson "${startId}" is part of a supersededBy cycle.`,
          lessonId: startId,
        });
        break;
      }
      seen.add(cur);
      const next: string | undefined = graph.lessons[cur]?.supersededBy;
      if (next === cur) break; // self-supersession reported separately
      cur = next;
    }
  }
}

export function collectReachability(graph: LessonsGraph, findings: ValidationFinding[]): void {
  for (const [lessonId, lesson] of Object.entries(graph.lessons)) {
    if (lesson.status === 'active' && lesson.triggers.length === 0) {
      findings.push({
        level: 'warning',
        code: 'UNREACHABLE_LESSON',
        message: `Active lesson "${lessonId}" has no triggers and can never be recalled.`,
        lessonId,
      });
    }
  }
}

export function collectOrphans(graph: LessonsGraph, findings: ValidationFinding[]): void {
  const referencedTopics = new Set<string>();
  const referencedTriggers = new Set<string>();
  for (const lesson of Object.values(graph.lessons)) {
    for (const t of lesson.topics) referencedTopics.add(t);
    for (const t of lesson.triggers) referencedTriggers.add(t);
  }
  for (const topicId of Object.keys(graph.topics)) {
    if (!referencedTopics.has(topicId)) {
      findings.push({
        level: 'warning',
        code: 'ORPHAN_TOPIC',
        message: `Topic "${topicId}" is not referenced by any lesson.`,
        topicId,
      });
    }
  }
  for (const triggerId of Object.keys(graph.triggers)) {
    if (!referencedTriggers.has(triggerId)) {
      findings.push({
        level: 'warning',
        code: 'ORPHAN_TRIGGER',
        message: `Trigger "${triggerId}" is not referenced by any lesson.`,
        triggerId,
      });
    }
  }
}
