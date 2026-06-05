import { LessonsGraphSchema, type LessonsGraph } from './graph-schema.js';

export type ValidationLevel = 'error' | 'warning';

export interface ValidationFinding {
  readonly level: ValidationLevel;
  readonly code: string;
  readonly message: string;
  readonly lessonId?: string;
  readonly topicId?: string;
  readonly triggerId?: string;
}

export interface ValidationReport {
  /** True when no `error`-level findings exist (warnings do not affect `ok`). */
  readonly ok: boolean;
  readonly findings: ValidationFinding[];
}

export function validateLessonsGraph(graph: LessonsGraph): ValidationReport {
  const findings: ValidationFinding[] = [];

  const schemaResult = LessonsGraphSchema.safeParse(graph);
  if (!schemaResult.success) {
    findings.push({
      level: 'error',
      code: 'SCHEMA_INVALID',
      message: schemaResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
    return { ok: false, findings };
  }

  collectDanglingRefs(graph, findings);
  collectStatusInvariants(graph, findings);
  collectDuplicateRules(graph, findings);
  collectOrphans(graph, findings);

  const ok = findings.every((f) => f.level !== 'error');
  return { ok, findings };
}

function collectDanglingRefs(graph: LessonsGraph, findings: ValidationFinding[]): void {
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

function collectStatusInvariants(graph: LessonsGraph, findings: ValidationFinding[]): void {
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

function collectDuplicateRules(graph: LessonsGraph, findings: ValidationFinding[]): void {
  const byKey = new Map<string, string[]>();
  for (const [lessonId, lesson] of Object.entries(graph.lessons)) {
    const key = normalizeRule(lesson.rule);
    const bucket = byKey.get(key) ?? [];
    bucket.push(lessonId);
    byKey.set(key, bucket);
  }
  for (const [key, ids] of byKey) {
    if (ids.length < 2) continue;
    const sorted = [...ids].sort();
    for (const lessonId of sorted) {
      const others = sorted.filter((other) => other !== lessonId);
      findings.push({
        level: 'error',
        code: 'DUPLICATE_RULE',
        message: `Lesson "${lessonId}" duplicates rule text of: ${others.join(', ')} (normalized key: "${key.slice(0, 60)}").`,
        lessonId,
      });
    }
  }
}

function collectOrphans(graph: LessonsGraph, findings: ValidationFinding[]): void {
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

function normalizeRule(rule: string): string {
  return rule.trim().replace(/\s+/g, ' ').toLowerCase();
}
