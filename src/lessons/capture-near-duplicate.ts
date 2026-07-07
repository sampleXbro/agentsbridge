import type { GuardrailWarning } from './capture-guardrails.js';
import type { LessonsGraph } from './graph-schema.js';
import { tokenize } from './ranking-text.js';

/**
 * Near-duplicate detection for capture — split from capture-guardrails.ts (the
 * trigger-hygiene warnings) so each stays within the 200-line limit and owns one
 * responsibility: this module answers "does this new rule paraphrase an existing
 * one?", the other "are this lesson's triggers reachable and precise?".
 */

/** Token-Jaccard similarity at/above which a new lesson is flagged a near-duplicate. */
export const NEAR_DUPLICATE_THRESHOLD = 0.6;

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
