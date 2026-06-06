import { LessonsGraphSchema, type LessonsGraph } from './graph-schema.js';
import {
  collectDanglingRefs,
  collectLifecycleInvariants,
  collectOrphans,
  collectReachability,
  collectStatusInvariants,
} from './validate-checks.js';
import {
  collectDuplicateRules,
  collectDuplicateTriggers,
  collectFanout,
  collectInvalidTriggerPatterns,
} from './validate-quality.js';

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
  collectLifecycleInvariants(graph, findings);
  collectDuplicateRules(graph, findings);
  collectReachability(graph, findings);
  collectInvalidTriggerPatterns(graph, findings);
  collectDuplicateTriggers(graph, findings);
  collectOrphans(graph, findings);
  collectFanout(graph, findings);

  const ok = findings.every((f) => f.level !== 'error');
  return { ok, findings };
}
