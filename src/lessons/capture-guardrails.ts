import type { LessonsGraph } from './graph-schema.js';
import {
  isLowSignalKeyword,
  keywordNeedleLosesTokens,
  MAX_RECOMMENDED_KEYWORD_TOKENS,
} from './keyword-signal.js';
import { tokenize } from './ranking-text.js';
import { deadFileGlobIds } from './validate-liveness.js';

/**
 * Capture guardrails — mostly WARNINGS, steering authors toward a few specific
 * triggers. Over-triggering (too many triggers per lesson, broad globs,
 * keyword-only triggers that fire less reliably on the mandatory `--file`/`--cmd`
 * path, long/stopworded keyword patterns) is the single biggest threat to recall
 * precision, and a paraphrase silently accumulates a near-duplicate; these are
 * surfaced without blocking, because an over-broad lesson is better than a lost
 * one.
 *
 * The ONE blocking case lives elsewhere (`addLessonInto` → `UnrecallableLessonError`):
 * a capture whose EVERY trigger is dead on the mandatory recall path is rejected,
 * because that lesson is captured then silently never recalled. These guardrails
 * are the warn-only complement to that single hard block.
 */

export type GuardrailCode =
  | 'OVERSIZED_LESSON_TRIGGERS'
  | 'BROAD_GLOB_TRIGGER'
  | 'KEYWORD_ONLY_LESSON'
  | 'LOW_SIGNAL_KEYWORD'
  | 'STOPWORD_KEYWORD'
  | 'DEAD_GLOB'
  | 'NEAR_DUPLICATE_LESSON';

/** Token-Jaccard similarity at/above which a new lesson is flagged a near-duplicate. */
export const NEAR_DUPLICATE_THRESHOLD = 0.6;

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
 *
 * `knownPaths` (project-relative, forward-slash) enables the DEAD_GLOB liveness
 * warning. The pure write-barrier path passes nothing (no tree walk on the hot
 * mutate path); only the capture entry point supplies it, so a dead glob is
 * flagged at the best moment to fix it — right after capture.
 */
export function inspectCapturedLesson(
  graph: LessonsGraph,
  lessonId: string,
  knownPaths?: ReadonlySet<string>,
): GuardrailWarning[] {
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

  const stopworded = triggers
    .filter((t) => t.kind === 'keyword' && keywordNeedleLosesTokens(t.pattern))
    .map((t) => t.pattern);
  if (stopworded.length > 0) {
    warnings.push({
      code: 'STOPWORD_KEYWORD',
      message: `Lesson "${lessonId}" has keyword trigger(s) containing stopwords/short words (${stopworded.join(', ')}); recall filters them from the pattern but NOT from the file/command text, so the phrase can never match contiguously on the --file/--cmd path — drop the stopwords (e.g. "state art" instead of "state of the art").`,
    });
  }

  if (knownPaths !== undefined) {
    const dead = deadFileGlobIds(graph, knownPaths);
    const deadHere = lesson.triggers
      .filter((id) => dead.has(id))
      .map((id) => graph.triggers[id]?.pattern)
      .filter((p): p is string => p !== undefined);
    if (deadHere.length > 0) {
      warnings.push({
        code: 'DEAD_GLOB',
        message: `Lesson "${lessonId}" has file_glob trigger(s) (${deadHere.join(', ')}) that match no file in the working tree — likely a rename. Re-point them at the current path, or the lesson is unreachable via those globs.`,
      });
    }
  }

  return warnings;
}

/**
 * Suggest updating an existing active lesson when a NEW lesson paraphrases it.
 * Dedup is exact-normalized-text only, so a reordered/reworded rule slips through
 * and both recall. This scans active lessons (skipping `lessonId` itself), scores
 * rule similarity with token Jaccard over {@link tokenize} (robust to word
 * reordering, no corpus needed), and returns one warning for the top match at or
 * above {@link NEAR_DUPLICATE_THRESHOLD}. Called only on the new-lesson branch —
 * an upsert IS the match, and exact matches already upserted before reaching here.
 */
export function nearDuplicateWarning(
  graph: LessonsGraph,
  lessonId: string,
): GuardrailWarning | null {
  const subject = graph.lessons[lessonId];
  if (subject === undefined) return null;
  const subjectTokens = new Set(tokenize(subject.rule));
  if (subjectTokens.size === 0) return null;

  let best: { id: string; score: number } | null = null;
  for (const [id, other] of Object.entries(graph.lessons)) {
    if (id === lessonId || other.status !== 'active') continue;
    const otherTokens = new Set(tokenize(other.rule));
    if (otherTokens.size === 0) continue;
    const score = jaccard(subjectTokens, otherTokens);
    if (score >= NEAR_DUPLICATE_THRESHOLD && (best === null || score > best.score)) {
      best = { id, score };
    }
  }
  if (best === null) return null;
  return {
    code: 'NEAR_DUPLICATE_LESSON',
    message: `Lesson "${lessonId}" closely resembles active lesson "${best.id}" (~${Math.round(best.score * 100)}% token overlap); consider updating "${best.id}" instead of adding a paraphrase (recall would surface both).`,
  };
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}
