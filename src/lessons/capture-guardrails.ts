import type { LessonsGraph } from './graph-schema.js';

/**
 * Non-blocking capture guardrails. Over-triggering — too many triggers per
 * lesson, broad globs, keyword-only triggers that never fire on the mandatory
 * `--file`/`--cmd` recall path — is the single biggest threat to recall
 * precision (ranking can only compensate so far). Capture must never be
 * rejected for it (losing a lesson is worse), so these surface as WARNINGS on
 * `add`, steering authors toward a few specific triggers without blocking.
 */

export type GuardrailCode =
  | 'OVERSIZED_LESSON_TRIGGERS'
  | 'BROAD_GLOB_TRIGGER'
  | 'KEYWORD_ONLY_LESSON';

export interface GuardrailWarning {
  readonly code: GuardrailCode;
  readonly message: string;
}

/** Soft cap: past this many triggers a lesson fires on too much and dilutes recall. */
export const MAX_RECOMMENDED_TRIGGERS = 8;

/**
 * A glob is "broad" when it matches large swaths of the tree: a bare star or
 * double-star, or any pattern that contains a double-star segment AND whose
 * basename is itself a wildcard (starts with a star — e.g. a globstar followed
 * by a star-extension). A double-star with a concrete basename (a globstar
 * followed by `index.ts`) or a single-directory wildcard is specific enough and
 * is not flagged.
 */
function isBroadGlob(pattern: string): boolean {
  const p = pattern.trim();
  if (p === '*' || p === '**') return true;
  if (!p.includes('**')) return false;
  const basename = p.slice(p.lastIndexOf('/') + 1);
  return basename.startsWith('*');
}

/**
 * Inspect a freshly captured/updated lesson and return any guardrail warnings.
 * Operates on the post-mutation graph so it reflects the merged trigger set of
 * an upserted lesson, not just the triggers from this one `add` call.
 */
export function inspectCapturedLesson(graph: LessonsGraph, lessonId: string): GuardrailWarning[] {
  const lesson = graph.lessons[lessonId];
  if (lesson === undefined) return [];
  const warnings: GuardrailWarning[] = [];

  if (lesson.triggers.length > MAX_RECOMMENDED_TRIGGERS) {
    warnings.push({
      code: 'OVERSIZED_LESSON_TRIGGERS',
      message: `Lesson "${lessonId}" has ${lesson.triggers.length} triggers (recommended ≤ ${MAX_RECOMMENDED_TRIGGERS}); broad trigger sets fire on too many edits and dilute recall — prefer a few specific triggers.`,
    });
  }

  const triggers = lesson.triggers
    .map((id) => graph.triggers[id])
    .filter((t): t is NonNullable<typeof t> => t !== undefined);

  const broad = triggers
    .filter((t) => t.kind === 'file_glob' && isBroadGlob(t.pattern))
    .map((t) => t.pattern);
  if (broad.length > 0) {
    warnings.push({
      code: 'BROAD_GLOB_TRIGGER',
      message: `Lesson "${lessonId}" has broad file glob(s) (${broad.join(', ')}) that match large swaths of the tree; prefer a path specific to the lesson.`,
    });
  }

  if (triggers.length > 0 && triggers.every((t) => t.kind === 'keyword')) {
    warnings.push({
      code: 'KEYWORD_ONLY_LESSON',
      message: `Lesson "${lessonId}" has only keyword triggers; mandatory recall runs on --file/--cmd, so it will rarely surface — add a file_glob or command_pattern trigger.`,
    });
  }

  return warnings;
}
