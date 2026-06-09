import type { LessonsGraph } from './graph-schema.js';
import { isLowSignalKeyword, MAX_RECOMMENDED_KEYWORD_TOKENS } from './keyword-signal.js';

/**
 * Non-blocking capture guardrails. Over-triggering — too many triggers per
 * lesson, broad globs, keyword-only triggers that fire less reliably on the
 * mandatory `--file`/`--cmd` recall path, long keyword patterns too specific to
 * match — is the single biggest threat to recall precision (ranking can only
 * compensate so far). Capture must never be rejected for it (losing a lesson is
 * worse), so these surface as WARNINGS on `add`, steering authors toward a few
 * specific triggers without blocking.
 */

export type GuardrailCode =
  | 'OVERSIZED_LESSON_TRIGGERS'
  | 'BROAD_GLOB_TRIGGER'
  | 'KEYWORD_ONLY_LESSON'
  | 'LOW_SIGNAL_KEYWORD';

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
      message: `Lesson "${lessonId}" has only keyword triggers; mandatory --file/--cmd recall surfaces these only when the keyword appears as a path/command token, so it fires less reliably — add a file_glob or command_pattern trigger for precise recall.`,
    });
  }

  const lowSignal = triggers
    .filter((t) => t.kind === 'keyword' && isLowSignalKeyword(t.pattern))
    .map((t) => t.pattern);
  if (lowSignal.length > 0) {
    warnings.push({
      code: 'LOW_SIGNAL_KEYWORD',
      message: `Lesson "${lessonId}" has long keyword trigger(s) (${lowSignal.join(', ')}); recall matches a keyword only as a substring of --keyword or a contiguous token-run in the file/command, so a pattern past ${MAX_RECOMMENDED_KEYWORD_TOKENS} tokens rarely fires — use a short distinctive phrase.`,
    });
  }

  return warnings;
}
